import { Request, Response, NextFunction } from 'express';
import { Equipment, Site, Operator, Rental, UsageLog, Anomaly, AuditLog, Alert } from '../models';
import { AppError } from '../middleware/errorHandler';
import { getIO } from '../config/socket';
import { generateId } from '../utils/helpers';
import { logger } from '../utils/logger';

export async function getEquipmentList(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { status, type, siteId, search, page = '1', limit = '100', sort = '-updatedAt' } = req.query;

    const query: any = {};
    if (status) query.status = status;
    if (type) query.type = type;
    if (siteId) query.siteId = siteId;
    if (search) {
      query.$or = [
        { equipmentId: { $regex: search, $options: 'i' } },
        { model: { $regex: search, $options: 'i' } },
        { serialNumber: { $regex: search, $options: 'i' } },
        { qrCode: { $regex: search, $options: 'i' } },
      ];
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const [equipmentList, total] = await Promise.all([
      Equipment.find(query).sort(sort as string).skip(skip).limit(limitNum).lean(),
      Equipment.countDocuments(query),
    ]);

    // Attach site and operator details
    const siteIds = [...new Set(equipmentList.map((e) => e.siteId).filter(Boolean))];
    const operatorIds = [...new Set(equipmentList.map((e) => e.operatorId).filter(Boolean))];

    const [sites, operators] = await Promise.all([
      Site.find({ siteId: { $in: siteIds } }).lean(),
      Operator.find({ operatorId: { $in: operatorIds } }).lean(),
    ]);

    const siteMap = new Map(sites.map((s) => [s.siteId, s]));
    const opMap = new Map(operators.map((o) => [o.operatorId, o]));

    const enriched = equipmentList.map((eq) => ({
      ...eq,
      site: eq.siteId ? siteMap.get(eq.siteId) : null,
      operator: eq.operatorId ? opMap.get(eq.operatorId) : null,
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

export async function getEquipmentById(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const eq = await Equipment.findOne({
      $or: [{ equipmentId: id }, { qrCode: id }],
    }).lean();

    if (!eq) {
      throw new AppError('Equipment not found', 404);
    }

    const [site, operator, activeRental, recentUsage, anomalies] = await Promise.all([
      eq.siteId ? Site.findOne({ siteId: eq.siteId }).lean() : null,
      eq.operatorId ? Operator.findOne({ operatorId: eq.operatorId }).lean() : null,
      Rental.findOne({ equipmentId: eq.equipmentId, status: { $in: ['ACTIVE', 'OVERDUE'] } }).lean(),
      UsageLog.find({ equipmentId: eq.equipmentId }).sort({ date: -1 }).limit(14).lean(),
      Anomaly.find({ equipmentId: eq.equipmentId, status: 'ACTIVE' }).lean(),
    ]);

    res.json({
      success: true,
      data: {
        ...eq,
        site,
        operator,
        activeRental,
        recentUsage: recentUsage.reverse(),
        anomalies,
      },
    });
  } catch (error) {
    next(error);
  }
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function getEquipmentByQR(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const rawCode = decodeURIComponent(req.params.qrCode || '').trim();
    // Normalize format: CATRENT:EQX1050, RFID-EQX1050, EPC-CAT900-EQX1050 -> EQX1050
    const normalizedId = rawCode.replace(/^(CATRENT:|CATFLEET:|RFID:|RFID-|EPC-CAT900-|EPC-)/i, '').trim();

    const eq = await Equipment.findOne({
      $or: [
        { qrCode: rawCode },
        { qrCode: normalizedId },
        { equipmentId: normalizedId },
        { equipmentId: rawCode },
        { serialNumber: normalizedId },
        { serialNumber: rawCode },
      ],
    }).lean();

    if (!eq) {
      throw new AppError(`Equipment with QR identifier "${rawCode}" not found in CatRent fleet`, 404);
    }

    const [site, operator, activeRental, allSites, activeAlerts] = await Promise.all([
      eq.siteId ? Site.findOne({ siteId: eq.siteId }).lean() : null,
      eq.operatorId ? Operator.findOne({ operatorId: eq.operatorId }).lean() : null,
      Rental.findOne({ equipmentId: eq.equipmentId, status: { $in: ['ACTIVE', 'OVERDUE'] } }).lean(),
      Site.find({}).lean(),
      Alert.find({ equipmentId: eq.equipmentId, status: 'ACTIVE' }).sort({ severity: -1, createdAt: -1 }).lean(),
    ]);

    let detectedSite: any = null;
    let minSiteDist = Infinity;
    for (const s of allSites) {
      if (eq.lat && eq.lng && s.lat && s.lng) {
        const dist = haversineKm(eq.lat, eq.lng, s.lat, s.lng);
        if (dist < minSiteDist) {
          minSiteDist = dist;
          detectedSite = s;
        }
      }
    }

    let siteMatchStatus = 'NO_ASSIGNED_SITE';
    let distanceFromAssignedSiteKm: number | null = null;
    if (eq.siteId && site && eq.lat && eq.lng) {
      siteMatchStatus = 'OUTSIDE_GEOFENCE';
      const distToAssigned = haversineKm(eq.lat, eq.lng, site.lat, site.lng);
      distanceFromAssignedSiteKm = Math.round(distToAssigned * 10) / 10;
      if (distToAssigned <= (site.geofenceRadius || 5.0)) {
        siteMatchStatus = 'MATCHED';
      } else if (detectedSite && haversineKm(eq.lat, eq.lng, detectedSite.lat, detectedSite.lng) <= (detectedSite.geofenceRadius || 5.0)) {
        siteMatchStatus = 'WRONG_SITE';
      }
    }

    const utilization = eq.engineHours > 0 ? Math.round(((eq.operatingHours || 0) / eq.engineHours) * 100) : 0;

    // Write Audit Log for QR Scan
    try {
      await AuditLog.create({
        userId: (req as any).userId || 'SCANNER-OPERATOR',
        role: (req as any).userRole || 'USER',
        action: 'QR_SCAN',
        entity: 'EQUIPMENT',
        entityId: eq.equipmentId,
        newValue: { payload: rawCode, model: eq.model, status: eq.status },
        ipAddress: req.ip || '',
        details: `QR Code decoded: ${rawCode} -> ${eq.model} (${eq.equipmentId})`,
      });
    } catch (e) {}

    res.json({
      success: true,
      data: {
        ...eq,
        site,
        operator,
        activeRental,
        detectedSite: detectedSite ? { siteId: detectedSite.siteId, name: detectedSite.name, address: detectedSite.address } : null,
        siteMatchStatus,
        distanceFromAssignedSiteKm,
        utilization,
        activeAlerts,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function createEquipment(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { type, model, serialNumber, hourlyRate = 150, siteId, yearManufactured = 2023 } = req.body;

    if (!type || !model || !serialNumber) {
      throw new AppError('Type, model, and serialNumber are required', 400);
    }

    const existing = await Equipment.findOne({ serialNumber });
    if (existing) {
      throw new AppError('Equipment with this serial number already exists', 409);
    }

    const count = await Equipment.countDocuments();
    const equipmentId = `EQX${(1001 + count).toString()}`;
    const qrCode = `CATRENT-QR-${equipmentId}`;

    let lat = 39.7555;
    let lng = -105.2211;
    if (siteId) {
      const site = await Site.findOne({ siteId });
      if (site) {
        lat = site.lat;
        lng = site.lng;
      }
    }

    const newEquipment = await Equipment.create({
      equipmentId,
      type,
      model,
      serialNumber,
      status: 'AVAILABLE',
      siteId: siteId || null,
      lat,
      lng,
      engineHours: 0,
      operatingHours: 0,
      idleHours: 0,
      fuelLevel: 100,
      healthScore: 100,
      qrCode,
      yearManufactured,
      hourlyRate,
    });

    try {
      getIO().emit('equipment:updated', newEquipment);
    } catch (e) {
      logger.warn('Socket emit failed:', e);
    }

    res.status(201).json({
      success: true,
      data: newEquipment,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateEquipment(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const updates = req.body;

    const eq = await Equipment.findOneAndUpdate(
      { equipmentId: id },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!eq) {
      throw new AppError('Equipment not found', 404);
    }

    try {
      getIO().emit('equipment:updated', eq);
    } catch (e) {
      logger.warn('Socket emit failed:', e);
    }

    res.json({
      success: true,
      data: eq,
    });
  } catch (error) {
    next(error);
  }
}
