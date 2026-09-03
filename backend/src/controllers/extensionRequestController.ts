import { Response, NextFunction } from 'express';
import { ExtensionRequest, Rental, Equipment, AuditLog } from '../models';
import { AppError } from '../middleware/errorHandler';
import { generateId } from '../utils/helpers';
import { getIO } from '../config/socket';
import { AuthRequest } from '../middleware/auth';

export async function createExtensionRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { rentalId, requestedReturnDate, reason } = req.body;

    if (!rentalId || !requestedReturnDate) {
      throw new AppError('Rental ID and new requested return date are required', 400);
    }

    const rental = await Rental.findOne({ rentalId });
    if (!rental) {
      throw new AppError(`Rental agreement ${rentalId} not found`, 404);
    }

    // Role check: Customer can only extend their own rental
    if (req.userRole === 'CUSTOMER' && rental.customerId && rental.customerId !== req.userId) {
      throw new AppError('Forbidden: You can only request extensions for your own rentals', 403);
    }

    if (!['ACTIVE', 'OVERDUE'].includes(rental.status)) {
      throw new AppError(`Cannot request extension for rental with status ${rental.status}`, 400);
    }

    const newDate = new Date(requestedReturnDate);
    const currDate = new Date(rental.expectedReturnDate);

    if (isNaN(newDate.getTime())) {
      throw new AppError('Invalid date format provided for extension', 400);
    }

    if (newDate <= currDate) {
      throw new AppError(`New return date must be strictly after the current expected return date (${currDate.toLocaleDateString()})`, 400);
    }

    // Check if there is already a pending extension request
    const existingPending = await ExtensionRequest.findOne({ rentalId, status: 'PENDING_APPROVAL' });
    if (existingPending) {
      throw new AppError(`There is already a pending extension request (${existingPending.extensionId}) for this rental`, 409);
    }

    const customerId = req.userId || rental.customerId || 'USR-CUST-DEMO';

    const extensionRequest = await ExtensionRequest.create({
      extensionId: generateId('EXT'),
      rentalId: rental.rentalId,
      customerId,
      equipmentId: rental.equipmentId,
      currentReturnDate: rental.expectedReturnDate,
      requestedReturnDate: newDate,
      reason: reason || 'Project milestone extended',
      status: 'PENDING_APPROVAL',
    });

    // Write Audit Log
    await AuditLog.create({
      userId: customerId,
      role: req.userRole || 'CUSTOMER',
      action: 'EXTENSION_REQUESTED',
      entity: 'EXTENSION_REQUEST',
      entityId: extensionRequest.extensionId,
      newValue: {
        rentalId: rental.rentalId,
        currentReturnDate: rental.expectedReturnDate,
        requestedReturnDate: newDate,
      },
      ipAddress: req.ip || '',
      details: `Customer requested extension for rental ${rental.rentalId} to ${newDate.toLocaleDateString()}`,
    });

    // Emit Socket.IO notification
    try {
      getIO().emit('extension:requested', {
        extension: extensionRequest,
        rentalId: rental.rentalId,
        equipmentId: rental.equipmentId,
        message: `New extension request for rental ${rental.rentalId} to ${newDate.toLocaleDateString()}`,
      });
    } catch (e) {}

    res.status(201).json({
      success: true,
      message: 'Extension request submitted! Awaiting administrator approval.',
      data: extensionRequest,
    });
  } catch (error) {
    next(error);
  }
}

export async function getExtensionRequests(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, rentalId } = req.query;
    const query: any = {};

    if (req.userRole === 'CUSTOMER') {
      query.customerId = req.userId;
    }

    if (status) query.status = status as string;
    if (rentalId) query.rentalId = rentalId as string;

    const extensions = await ExtensionRequest.find(query).sort({ createdAt: -1 }).lean();

    // Populate rental and equipment details
    const rentalIds = [...new Set(extensions.map((e) => e.rentalId))];
    const equipmentIds = [...new Set(extensions.map((e) => e.equipmentId))];

    const [rentals, equipmentList] = await Promise.all([
      Rental.find({ rentalId: { $in: rentalIds } }).lean(),
      Equipment.find({ equipmentId: { $in: equipmentIds } }).lean(),
    ]);

    const rentalMap = new Map(rentals.map((r) => [r.rentalId, r]));
    const eqMap = new Map(equipmentList.map((e) => [e.equipmentId, e]));

    const populated = extensions.map((ext) => ({
      ...ext,
      rental: rentalMap.get(ext.rentalId),
      equipment: eqMap.get(ext.equipmentId),
    }));

    res.json({
      success: true,
      data: populated,
    });
  } catch (error) {
    next(error);
  }
}

export async function approveExtensionRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const adminId = req.userId || 'ADMIN';

    const extensionRequest = await ExtensionRequest.findOne({ extensionId: id });
    if (!extensionRequest) {
      throw new AppError(`Extension request ${id} not found`, 404);
    }

    if (extensionRequest.status !== 'PENDING_APPROVAL') {
      throw new AppError(`Extension request ${id} is already ${extensionRequest.status}`, 400);
    }

    const rental = await Rental.findOne({ rentalId: extensionRequest.rentalId });
    if (!rental) {
      throw new AppError(`Associated rental agreement ${extensionRequest.rentalId} not found`, 404);
    }

    const previousReturnDate = rental.expectedReturnDate;

    // Update rental expected return date and extension count
    rental.expectedReturnDate = extensionRequest.requestedReturnDate;
    rental.extensionCount = (rental.extensionCount || 0) + 1;
    if (rental.status === 'OVERDUE') {
      rental.status = 'ACTIVE';
    }
    await rental.save();

    // Update extension request status
    extensionRequest.status = 'APPROVED';
    extensionRequest.approvedBy = adminId;
    extensionRequest.approvedAt = new Date();
    await extensionRequest.save();

    // Write Audit Log
    await AuditLog.create({
      userId: adminId,
      role: req.userRole || 'ADMIN',
      action: 'EXTENSION_APPROVED',
      entity: 'EXTENSION_REQUEST',
      entityId: extensionRequest.extensionId,
      previousValue: { expectedReturnDate: previousReturnDate },
      newValue: { expectedReturnDate: extensionRequest.requestedReturnDate, approvedBy: adminId },
      ipAddress: req.ip || '',
      details: `Administrator approved rental extension for ${rental.rentalId} to ${extensionRequest.requestedReturnDate.toLocaleDateString()}`,
    });

    // Emit Socket.IO events
    try {
      const io = getIO();
      io.emit('extension:approved', {
        extensionId: extensionRequest.extensionId,
        rentalId: rental.rentalId,
        customerId: extensionRequest.customerId,
        newReturnDate: extensionRequest.requestedReturnDate,
        message: `Your extension request for rental ${rental.rentalId} has been APPROVED (+7 Days)!`,
      });
      io.emit('rental:updated', rental);
    } catch (e) {}

    res.json({
      success: true,
      message: `Extension request ${id} APPROVED! Rental return milestone updated to ${extensionRequest.requestedReturnDate.toLocaleDateString()}.`,
      data: {
        extension: extensionRequest,
        rental,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function rejectExtensionRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    const adminId = req.userId || 'ADMIN';

    const extensionRequest = await ExtensionRequest.findOne({ extensionId: id });
    if (!extensionRequest) {
      throw new AppError(`Extension request ${id} not found`, 404);
    }

    if (extensionRequest.status !== 'PENDING_APPROVAL') {
      throw new AppError(`Extension request ${id} is already ${extensionRequest.status}`, 400);
    }

    const reason = rejectionReason || 'Machine allocated to subsequent scheduled deployment';

    extensionRequest.status = 'REJECTED';
    extensionRequest.rejectedBy = adminId;
    extensionRequest.rejectedAt = new Date();
    extensionRequest.rejectionReason = reason;
    await extensionRequest.save();

    // Write Audit Log
    await AuditLog.create({
      userId: adminId,
      role: req.userRole || 'ADMIN',
      action: 'EXTENSION_REJECTED',
      entity: 'EXTENSION_REQUEST',
      entityId: extensionRequest.extensionId,
      newValue: { status: 'REJECTED', rejectionReason: reason, rejectedBy: adminId },
      ipAddress: req.ip || '',
      details: `Administrator rejected extension request ${extensionRequest.extensionId}. Reason: ${reason}`,
    });

    // Emit Socket.IO event
    try {
      getIO().emit('extension:rejected', {
        extensionId: extensionRequest.extensionId,
        rentalId: extensionRequest.rentalId,
        customerId: extensionRequest.customerId,
        reason,
        message: `Extension request for rental ${extensionRequest.rentalId} was REJECTED. Reason: ${reason}`,
      });
    } catch (e) {}

    res.json({
      success: true,
      message: `Extension request ${id} REJECTED.`,
      data: extensionRequest,
    });
  } catch (error) {
    next(error);
  }
}
