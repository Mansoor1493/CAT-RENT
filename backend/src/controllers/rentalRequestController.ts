import { Response, NextFunction } from 'express';
import { RentalRequest, Equipment, Rental, Site, User, AuditLog } from '../models';
import { AppError } from '../middleware/errorHandler';
import { generateId } from '../utils/helpers';
import { getIO } from '../config/socket';
import { AuthRequest } from '../middleware/auth';

export async function createRentalRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { equipmentId, siteId, startDate, expectedReturnDate, purpose, notes } = req.body;

    if (!equipmentId || !siteId || !startDate || !expectedReturnDate) {
      throw new AppError('Equipment ID, Destination Site, Start Date, and Return Date are required', 400);
    }

    const start = new Date(startDate);
    const end = new Date(expectedReturnDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new AppError('Invalid date format provided', 400);
    }

    if (start < now) {
      throw new AppError('Start date cannot be in the past', 400);
    }

    if (end <= start) {
      throw new AppError('Expected return date must be strictly after the start date', 400);
    }

    // Validate Equipment exists
    const equipment = await Equipment.findOne({ equipmentId });
    if (!equipment) {
      throw new AppError(`Equipment ${equipmentId} not found in fleet`, 404);
    }

    if (equipment.status === 'MAINTENANCE') {
      throw new AppError(`Equipment ${equipmentId} is currently under maintenance and unavailable for rental`, 400);
    }

    // Validate Site exists
    const site = await Site.findOne({ siteId });
    if (!site) {
      throw new AppError(`Target site ${siteId} does not exist`, 404);
    }

    // Check for overlapping approved rentals
    const overlappingRental = await Rental.findOne({
      equipmentId,
      status: { $in: ['APPROVED', 'ACTIVE', 'OVERDUE'] },
      $or: [
        { checkoutDate: { $lte: end }, expectedReturnDate: { $gte: start } },
        { startDate: { $lte: end }, expectedReturnDate: { $gte: start } },
      ],
    });

    if (overlappingRental) {
      throw new AppError(
        `Equipment ${equipmentId} is already booked/rented between ${new Date(
          overlappingRental.checkoutDate || overlappingRental.startDate!
        ).toLocaleDateString()} and ${new Date(overlappingRental.expectedReturnDate).toLocaleDateString()}`,
        409
      );
    }

    // Calculate Estimated Cost (8 hours/day * hourlyRate)
    const diffDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    const estimatedCost = Math.round(diffDays * 8 * equipment.hourlyRate);

    const customerId = req.userId || 'USR-CUST-DEMO';
    const customerName = req.userName || 'Authorized Contractor';
    const customerEmail = req.userEmail || 'customer@example.com';

    const rentalRequest = await RentalRequest.create({
      requestId: generateId('RR'),
      customerId,
      customerName,
      customerEmail,
      equipmentId,
      siteId,
      startDate: start,
      expectedReturnDate: end,
      estimatedCost,
      purpose: purpose || 'Field Construction Operations',
      notes: notes || '',
      status: 'PENDING_APPROVAL',
    });

    // Write Audit Log
    await AuditLog.create({
      userId: customerId,
      role: req.userRole || 'CUSTOMER',
      action: 'RENTAL_REQUEST_CREATED',
      entity: 'RENTAL_REQUEST',
      entityId: rentalRequest.requestId,
      newValue: {
        equipmentId,
        siteId,
        startDate: start,
        expectedReturnDate: end,
        estimatedCost,
      },
      ipAddress: req.ip || '',
      details: `Rental request submitted for ${equipment.model} (${equipmentId}) at site ${siteId}`,
    });

    // Real-time notification to Admins
    try {
      getIO().emit('rental:requested', {
        request: rentalRequest,
        equipment: { model: equipment.model, type: equipment.type },
        site: { name: site.name },
        message: `New rental request ${rentalRequest.requestId} from ${customerName} for ${equipment.model}`,
      });
    } catch (e) {}

    res.status(201).json({
      success: true,
      message: 'Rental request submitted successfully! Awaiting administrator approval.',
      data: rentalRequest,
    });
  } catch (error) {
    next(error);
  }
}

export async function getRentalRequests(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, equipmentId, siteId, customerId } = req.query;
    const query: any = {};

    // Role-based data scoping
    if (req.userRole === 'CUSTOMER') {
      // Customer sees ONLY their own rental requests
      query.customerId = req.userId;
    } else if (req.userRole === 'SITE_MANAGER') {
      // Site Manager sees only requests for their assigned sites
      const assigned = req.assignedSiteIds || [];
      query.siteId = { $in: assigned };
    } else {
      // Admin can filter by customerId if provided
      if (customerId) query.customerId = customerId as string;
    }

    if (status) query.status = status as string;
    if (equipmentId) query.equipmentId = equipmentId as string;
    if (siteId) query.siteId = siteId as string;

    const requests = await RentalRequest.find(query).sort({ createdAt: -1 }).lean();

    // Populate equipment and site details
    const equipmentIds = [...new Set(requests.map((r) => r.equipmentId))];
    const siteIds = [...new Set(requests.map((r) => r.siteId))];

    const [equipmentDocs, siteDocs] = await Promise.all([
      Equipment.find({ equipmentId: { $in: equipmentIds } }).lean(),
      Site.find({ siteId: { $in: siteIds } }).lean(),
    ]);

    const eqMap = new Map(equipmentDocs.map((e) => [e.equipmentId, e]));
    const siteMap = new Map(siteDocs.map((s) => [s.siteId, s]));

    const populated = requests.map((r) => ({
      ...r,
      equipment: eqMap.get(r.equipmentId),
      site: siteMap.get(r.siteId),
    }));

    res.json({
      success: true,
      data: populated,
    });
  } catch (error) {
    next(error);
  }
}

export async function getRentalRequestById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const request = await RentalRequest.findOne({ requestId: id }).lean();

    if (!request) {
      throw new AppError(`Rental request ${id} not found`, 404);
    }

    // Role-based authorization check
    if (req.userRole === 'CUSTOMER' && request.customerId !== req.userId) {
      throw new AppError('Forbidden: You are not authorized to view another customer\'s rental request', 403);
    }

    if (req.userRole === 'SITE_MANAGER' && !req.assignedSiteIds?.includes(request.siteId)) {
      throw new AppError(`Forbidden: You are not authorized to view requests for site ${request.siteId}`, 403);
    }

    const [equipment, site] = await Promise.all([
      Equipment.findOne({ equipmentId: request.equipmentId }).lean(),
      Site.findOne({ siteId: request.siteId }).lean(),
    ]);

    res.json({
      success: true,
      data: {
        ...request,
        equipment,
        site,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function approveRentalRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const adminId = req.userId || 'ADMIN';
    const adminName = req.userName || 'Administrator';

    const rentalRequest = await RentalRequest.findOne({ requestId: id });
    if (!rentalRequest) {
      throw new AppError(`Rental request ${id} not found`, 404);
    }

    if (rentalRequest.status !== 'PENDING_APPROVAL') {
      throw new AppError(`Request ${id} cannot be approved because current status is ${rentalRequest.status}`, 400);
    }

    // Re-check equipment exists and is available
    const equipment = await Equipment.findOne({ equipmentId: rentalRequest.equipmentId });
    if (!equipment) {
      throw new AppError(`Equipment ${rentalRequest.equipmentId} no longer exists`, 404);
    }

    if (equipment.status === 'MAINTENANCE') {
      throw new AppError(`Equipment ${rentalRequest.equipmentId} is currently under maintenance and cannot be approved`, 409);
    }

    // Re-check for overlapping approved rentals
    const overlapping = await Rental.findOne({
      equipmentId: rentalRequest.equipmentId,
      status: { $in: ['APPROVED', 'ACTIVE', 'OVERDUE'] },
      $or: [
        { checkoutDate: { $lte: rentalRequest.expectedReturnDate }, expectedReturnDate: { $gte: rentalRequest.startDate } },
        { startDate: { $lte: rentalRequest.expectedReturnDate }, expectedReturnDate: { $gte: rentalRequest.startDate } },
      ],
    });

    if (overlapping) {
      throw new AppError(
        `Concurrency Conflict: Equipment ${rentalRequest.equipmentId} is already booked under active rental agreement ${overlapping.rentalId}`,
        409
      );
    }

    // 1. Create Active/Approved Rental Record
    const rentalId = generateId('RNT');
    const rental = await Rental.create({
      rentalId,
      requestId: rentalRequest.requestId,
      customerId: rentalRequest.customerId,
      customerName: rentalRequest.customerName,
      contactPerson: rentalRequest.customerName,
      poNumber: `PO-${rentalRequest.requestId}`,
      equipmentId: rentalRequest.equipmentId,
      operatorId: equipment.operatorId || 'OP001',
      siteId: rentalRequest.siteId,
      startDate: rentalRequest.startDate,
      checkoutDate: new Date(),
      expectedReturnDate: rentalRequest.expectedReturnDate,
      status: 'ACTIVE',
      checkoutEngineHours: equipment.engineHours || 0,
      checkoutFuelLevel: equipment.fuelLevel || 100,
      rentalCost: rentalRequest.estimatedCost,
      checkedOutBy: adminId,
      approvedBy: adminId,
      approvedAt: new Date(),
    });

    // 2. Transition Equipment state to ACTIVE/RENTED and assign site
    await Equipment.updateOne(
      { equipmentId: rentalRequest.equipmentId },
      {
        $set: {
          status: 'ACTIVE',
          siteId: rentalRequest.siteId,
        },
      }
    );

    // 3. Update RentalRequest status to APPROVED
    rentalRequest.status = 'APPROVED';
    rentalRequest.approvedBy = adminId;
    rentalRequest.approvedAt = new Date();
    rentalRequest.rentalId = rentalId;
    await rentalRequest.save();

    // 4. Create Audit Log
    await AuditLog.create({
      userId: adminId,
      role: req.userRole || 'ADMIN',
      action: 'RENTAL_REQUEST_APPROVED',
      entity: 'RENTAL_REQUEST',
      entityId: rentalRequest.requestId,
      previousValue: { status: 'PENDING_APPROVAL' },
      newValue: { status: 'APPROVED', rentalId, approvedBy: adminId },
      ipAddress: req.ip || '',
      details: `Administrator approved rental request ${rentalRequest.requestId} for ${equipment.model} (${equipment.equipmentId})`,
    });

    // 5. Emit Real-time Socket.IO events
    try {
      const io = getIO();
      io.emit('rental:approved', {
        requestId: rentalRequest.requestId,
        rentalId,
        customerId: rentalRequest.customerId,
        equipmentId: equipment.equipmentId,
        model: equipment.model,
        siteId: rentalRequest.siteId,
        message: `Your rental request for ${equipment.model} (${equipment.equipmentId}) has been APPROVED!`,
      });
      io.emit('equipment:updated', { equipmentId: equipment.equipmentId, status: 'ACTIVE', siteId: rentalRequest.siteId });
      io.emit('rental:created', rental);
    } catch (e) {}

    res.json({
      success: true,
      message: `Rental request ${id} APPROVED! Agreement ${rentalId} created and equipment set to ACTIVE.`,
      data: {
        request: rentalRequest,
        rental,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function rejectRentalRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    const adminId = req.userId || 'ADMIN';

    const rentalRequest = await RentalRequest.findOne({ requestId: id });
    if (!rentalRequest) {
      throw new AppError(`Rental request ${id} not found`, 404);
    }

    if (rentalRequest.status !== 'PENDING_APPROVAL') {
      throw new AppError(`Request ${id} cannot be rejected because current status is ${rentalRequest.status}`, 400);
    }

    const reason = rejectionReason || 'Equipment unavailable or project scheduling conflict';

    rentalRequest.status = 'REJECTED';
    rentalRequest.rejectedBy = adminId;
    rentalRequest.rejectedAt = new Date();
    rentalRequest.rejectionReason = reason;
    await rentalRequest.save();

    // Write Audit Log
    await AuditLog.create({
      userId: adminId,
      role: req.userRole || 'ADMIN',
      action: 'RENTAL_REQUEST_REJECTED',
      entity: 'RENTAL_REQUEST',
      entityId: rentalRequest.requestId,
      previousValue: { status: 'PENDING_APPROVAL' },
      newValue: { status: 'REJECTED', rejectionReason: reason, rejectedBy: adminId },
      ipAddress: req.ip || '',
      details: `Administrator rejected rental request ${rentalRequest.requestId}. Reason: ${reason}`,
    });

    // Emit Real-time Socket.IO event
    try {
      getIO().emit('rental:rejected', {
        requestId: rentalRequest.requestId,
        customerId: rentalRequest.customerId,
        equipmentId: rentalRequest.equipmentId,
        reason,
        message: `Rental request ${rentalRequest.requestId} for ${rentalRequest.equipmentId} was not approved. Reason: ${reason}`,
      });
    } catch (e) {}

    res.json({
      success: true,
      message: `Rental request ${id} has been REJECTED.`,
      data: rentalRequest,
    });
  } catch (error) {
    next(error);
  }
}

export async function cancelRentalRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const rentalRequest = await RentalRequest.findOne({ requestId: id });
    if (!rentalRequest) {
      throw new AppError(`Rental request ${id} not found`, 404);
    }

    // Customer can only cancel their own request
    if (req.userRole === 'CUSTOMER' && rentalRequest.customerId !== req.userId) {
      throw new AppError('Forbidden: You can only cancel your own rental requests', 403);
    }

    if (rentalRequest.status !== 'PENDING_APPROVAL') {
      throw new AppError(`Request ${id} cannot be cancelled because it is already ${rentalRequest.status}`, 400);
    }

    rentalRequest.status = 'CANCELLED';
    await rentalRequest.save();

    // Write Audit Log
    await AuditLog.create({
      userId: req.userId || 'USER',
      role: req.userRole || 'CUSTOMER',
      action: 'RENTAL_REQUEST_CANCELLED',
      entity: 'RENTAL_REQUEST',
      entityId: rentalRequest.requestId,
      newValue: { status: 'CANCELLED' },
      ipAddress: req.ip || '',
      details: `Rental request ${rentalRequest.requestId} was cancelled by user`,
    });

    res.json({
      success: true,
      message: `Rental request ${id} has been cancelled.`,
      data: rentalRequest,
    });
  } catch (error) {
    next(error);
  }
}
