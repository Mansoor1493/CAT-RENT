import { Request, Response, NextFunction } from 'express';
import { Rental, Equipment, Operator, Site, AuditLog, Alert } from '../models';
import { AppError } from '../middleware/errorHandler';
import { getIO } from '../config/socket';
import { generateId } from '../utils/helpers';
import { logger } from '../utils/logger';
import { AuthRequest } from '../middleware/auth';

export async function getRentals(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status, equipmentId, siteId, operatorId, page = '1', limit = '100' } = req.query;

    const query: any = {};
    if (status) query.status = status;
    if (equipmentId) query.equipmentId = equipmentId;
    if (siteId) query.siteId = siteId;
    if (operatorId) query.operatorId = operatorId;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const [rentals, total] = await Promise.all([
      Rental.find(query).sort({ checkoutDate: -1 }).skip(skip).limit(limitNum).lean(),
      Rental.countDocuments(query),
    ]);

    // Enrich with equipment, site, and operator data
    const eqIds = [...new Set(rentals.map((r) => r.equipmentId))];
    const siteIds = [...new Set(rentals.map((r) => r.siteId))];
    const opIds = [...new Set(rentals.map((r) => r.operatorId))];

    const [equipmentList, sites, operators] = await Promise.all([
      Equipment.find({ equipmentId: { $in: eqIds } }).lean(),
      Site.find({ siteId: { $in: siteIds } }).lean(),
      Operator.find({ operatorId: { $in: opIds } }).lean(),
    ]);

    const eqMap = new Map(equipmentList.map((e) => [e.equipmentId, e]));
    const siteMap = new Map(sites.map((s) => [s.siteId, s]));
    const opMap = new Map(operators.map((o) => [o.operatorId, o]));

    const enriched = rentals.map((r) => ({
      ...r,
      equipment: eqMap.get(r.equipmentId) || null,
      site: siteMap.get(r.siteId) || null,
      operator: opMap.get(r.operatorId) || null,
    }));

    res.json({
      success: true,
      data: enriched,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function checkout(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const {
      equipmentId,
      operatorId,
      siteId,
      expectedReturnDate,
      notes,
      customerName,
      contactPerson,
      poNumber,
    } = req.body;

    if (!equipmentId || !operatorId || !siteId || !expectedReturnDate) {
      throw new AppError('equipmentId, operatorId, siteId, and expectedReturnDate are required', 400);
    }

    const returnDate = new Date(expectedReturnDate);
    const now = new Date();
    if (returnDate <= now) {
      throw new AppError('Expected return date must be in the future', 400);
    }

    // Check equipment availability
    const equipment = await Equipment.findOne({ equipmentId });
    if (!equipment) {
      throw new AppError(`Equipment ${equipmentId} not found`, 404);
    }

    if (['RENTED', 'ACTIVE', 'OVERDUE'].includes(equipment.status)) {
      throw new AppError(`Equipment ${equipmentId} is already rented (status: ${equipment.status})`, 409);
    }

    if (equipment.status === 'MAINTENANCE') {
      throw new AppError(`Equipment ${equipmentId} is currently under maintenance`, 409);
    }

    // Check operator
    const operator = await Operator.findOne({ operatorId });
    if (!operator) {
      throw new AppError(`Operator ${operatorId} not found`, 404);
    }

    // Check site
    const site = await Site.findOne({ siteId });
    if (!site) {
      throw new AppError(`Site ${siteId} not found`, 404);
    }

    // Check site access for Site Manager
    if (req.userRole === 'SITE_MANAGER') {
      const assigned = req.assignedSiteIds || [];
      if (!assigned.includes(siteId)) {
        throw new AppError(`Forbidden: You do not have site authorization for ${siteId}. Assigned sites: ${assigned.join(', ')}`, 403);
      }
    }

    const rentalId = generateId('RNT');

    // Create rental record
    const rental = await Rental.create({
      rentalId,
      equipmentId,
      operatorId,
      siteId,
      checkoutDate: now,
      expectedReturnDate: returnDate,
      status: 'ACTIVE',
      checkoutEngineHours: equipment.engineHours,
      checkoutFuelLevel: equipment.fuelLevel,
      rentalCost: 0,
      extensionCount: 0,
      checkinNotes: notes || '',
      customerName: customerName || 'Kiewit Infrastructure Corp',
      contactPerson: contactPerson || 'David Miller (Site Superintendent)',
      poNumber: poNumber || `PO-2026-CAT-${Math.floor(1000 + Math.random() * 9000)}`,
      checkedOutBy: req.userId || 'ADMIN',
    });

    // Update equipment
    const prevEqStatus = equipment.status;
    equipment.status = 'ACTIVE';
    equipment.siteId = siteId;
    equipment.operatorId = operatorId;
    equipment.lat = site.lat + (Math.random() - 0.5) * 0.01;
    equipment.lng = site.lng + (Math.random() - 0.5) * 0.01;
    await equipment.save();

    // Update operator
    operator.status = 'ASSIGNED';
    operator.assignedEquipmentId = equipmentId;
    operator.assignedSiteId = siteId;
    await operator.save();

    // Update site active rentals
    await Site.updateOne({ siteId }, { $inc: { activeRentals: 1 } });

    // Create Audit Log
    await AuditLog.create({
      userId: req.userId || 'ADMIN',
      role: req.userRole || 'ADMIN',
      action: 'CHECK_OUT',
      entity: 'RENTAL',
      entityId: rentalId,
      timestamp: now,
      previousValue: { equipmentStatus: prevEqStatus },
      newValue: { equipmentStatus: 'ACTIVE', rentalId, siteId, operatorId, equipmentId },
      ipAddress: req.ip || '',
      details: `Equipment ${equipmentId} digital check-out completed at site ${siteId}`,
    });

    // Real-time broadcasts
    try {
      const io = getIO();
      io.emit('rental:created', rental);
      io.emit('equipment:updated', equipment);
    } catch (e) {
      logger.warn('Socket broadcast failed:', e);
    }

    res.status(201).json({
      success: true,
      data: {
        rental,
        equipment,
      },
      message: `Equipment ${equipmentId} successfully checked out to ${operator.name} at ${site.name}`,
    });
  } catch (error) {
    next(error);
  }
}

export async function checkin(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { rentalId, checkinEngineHours, checkinFuelLevel, condition = 'GOOD', notes } = req.body;

    if (!rentalId) {
      throw new AppError('rentalId is required', 400);
    }

    const rental = await Rental.findOne({ rentalId });
    if (!rental) {
      throw new AppError(`Rental ${rentalId} not found`, 404);
    }

    if (rental.status === 'COMPLETED') {
      throw new AppError('This rental has already been checked in', 400);
    }

    const equipment = await Equipment.findOne({ equipmentId: rental.equipmentId });
    if (!equipment) {
      throw new AppError(`Equipment ${rental.equipmentId} not found`, 404);
    }

    const now = new Date();
    const finalEngineHours = checkinEngineHours !== undefined
      ? Number(checkinEngineHours)
      : equipment.engineHours;

    if (finalEngineHours < rental.checkoutEngineHours) {
      throw new AppError(
        `Check-in engine hours (${finalEngineHours}) cannot be lower than checkout hours (${rental.checkoutEngineHours})`,
        400
      );
    }

    const finalFuelLevel = checkinFuelLevel !== undefined
      ? Math.max(0, Math.min(100, Number(checkinFuelLevel)))
      : equipment.fuelLevel;

    // Calculate rental cost based on duration or engine hours
    const durationHours = Math.max(1, (now.getTime() - new Date(rental.checkoutDate).getTime()) / (1000 * 3600));
    const hoursBilled = Math.max(durationHours, finalEngineHours - rental.checkoutEngineHours);
    const calculatedCost = Math.round(hoursBilled * equipment.hourlyRate);

    // Update rental
    rental.actualReturnDate = now;
    rental.status = 'COMPLETED';
    rental.checkinEngineHours = finalEngineHours;
    rental.checkinFuelLevel = finalFuelLevel;
    rental.rentalCost = calculatedCost;
    rental.checkinNotes = notes || (condition === 'DAMAGED' ? 'Flagged for damage inspection' : 'Normal return');
    rental.checkedInBy = req.userId || 'ADMIN';
    await rental.save();

    // Update equipment status
    const targetStatus = condition === 'DAMAGED' ? 'MAINTENANCE' : 'AVAILABLE';
    equipment.status = targetStatus;
    equipment.engineHours = finalEngineHours;
    equipment.operatingHours += Math.max(0, finalEngineHours - rental.checkoutEngineHours);
    equipment.fuelLevel = finalFuelLevel;
    equipment.operatorId = undefined;
    await equipment.save();

    // Free operator
    if (rental.operatorId) {
      await Operator.updateOne(
        { operatorId: rental.operatorId },
        { status: 'AVAILABLE', assignedEquipmentId: null }
      );
    }

    // Decrement site active rentals
    if (rental.siteId) {
      await Site.updateOne(
        { siteId: rental.siteId, activeRentals: { $gt: 0 } },
        { $inc: { activeRentals: -1 } }
      );
    }

    // Resolve any active overdue alerts for this rental/equipment
    await Alert.updateMany(
      { equipmentId: rental.equipmentId, type: 'OVERDUE', status: 'ACTIVE' },
      { status: 'RESOLVED', resolvedAt: now, resolvedBy: req.userId || 'ADMIN' }
    );

    // Create Audit Log
    await AuditLog.create({
      userId: req.userId || 'ADMIN',
      role: req.userRole || 'ADMIN',
      action: 'CHECK_IN',
      entity: 'RENTAL',
      entityId: rentalId,
      timestamp: now,
      previousValue: { status: rental.status, equipmentStatus: 'ACTIVE' },
      newValue: { status: 'COMPLETED', finalEngineHours, calculatedCost, equipmentStatus: targetStatus, equipmentId: equipment.equipmentId },
      ipAddress: req.ip || '',
      details: `Equipment ${equipment.equipmentId} digital check-in completed. Status: ${targetStatus}.`,
    });

    // Real-time broadcasts
    try {
      const io = getIO();
      io.emit('rental:returned', rental);
      io.emit('rental:updated', rental);
      io.emit('equipment:updated', equipment);
    } catch (e) {
      logger.warn('Socket broadcast failed:', e);
    }

    res.json({
      success: true,
      data: {
        rental,
        equipment,
        cost: calculatedCost,
      },
      message: `Equipment ${equipment.equipmentId} successfully checked in. Status set to ${targetStatus}.`,
    });
  } catch (error) {
    next(error);
  }
}

export async function extendRental(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { newReturnDate } = req.body;

    if (!newReturnDate) {
      throw new AppError('newReturnDate is required', 400);
    }

    const newDate = new Date(newReturnDate);
    const rental = await Rental.findOne({ rentalId: id });
    if (!rental) {
      throw new AppError(`Rental ${id} not found`, 404);
    }

    if (newDate <= new Date(rental.expectedReturnDate)) {
      throw new AppError('New return date must be later than the current return date', 400);
    }

    rental.expectedReturnDate = newDate;
    rental.extensionCount += 1;
    if (rental.status === 'OVERDUE') {
      rental.status = 'ACTIVE';
      await Equipment.updateOne({ equipmentId: rental.equipmentId }, { status: 'ACTIVE' });
    }
    await rental.save();

    res.json({
      success: true,
      data: rental,
      message: `Rental ${id} extended to ${newDate.toLocaleDateString()}`,
    });
  } catch (error) {
    next(error);
  }
}

export async function getOverdueRentals(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const now = new Date();
    const overdue = await Rental.find({
      status: { $in: ['ACTIVE', 'OVERDUE'] },
      expectedReturnDate: { $lt: now },
    }).lean();

    res.json({
      success: true,
      data: overdue,
    });
  } catch (error) {
    next(error);
  }
}
