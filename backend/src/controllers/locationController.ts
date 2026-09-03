import { Request, Response, NextFunction } from 'express';
import { LocationLog, Equipment } from '../models';
import { AppError } from '../middleware/errorHandler';
import { getIO } from '../config/socket';

export async function logLocation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { equipmentId, lat, lng, speed = 0, siteId } = req.body;

    if (!equipmentId || lat === undefined || lng === undefined) {
      throw new AppError('equipmentId, lat, and lng are required', 400);
    }

    const log = await LocationLog.create({
      equipmentId,
      lat: Number(lat),
      lng: Number(lng),
      speed: Number(speed),
      siteId,
      timestamp: new Date(),
    });

    await Equipment.updateOne(
      { equipmentId },
      { $set: { lat: Number(lat), lng: Number(lng) } }
    );

    try {
      getIO().emit('equipment:location', {
        equipmentId,
        lat: Number(lat),
        lng: Number(lng),
        speed: Number(speed),
        timestamp: new Date().toISOString(),
      });
    } catch (e) {}

    res.status(201).json({
      success: true,
      data: log,
    });
  } catch (error) {
    next(error);
  }
}

export async function getLocationHistory(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { equipmentId } = req.params;
    const { limit = '100' } = req.query;

    const logs = await LocationLog.find({ equipmentId })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit as string, 10))
      .lean();

    res.json({
      success: true,
      data: logs.reverse(),
    });
  } catch (error) {
    next(error);
  }
}

export async function getLiveLocations(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const fleet = await Equipment.find({}, {
      equipmentId: 1,
      model: 1,
      type: 1,
      status: 1,
      siteId: 1,
      lat: 1,
      lng: 1,
      healthScore: 1,
      fuelLevel: 1,
    }).lean();

    res.json({
      success: true,
      data: fleet,
    });
  } catch (error) {
    next(error);
  }
}

export async function getLocationTrail(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { equipmentId } = req.params;
    const { duration = '1h' } = req.query as { duration?: string };

    let minutes = 60;
    if (duration.endsWith('m')) minutes = parseInt(duration);
    else if (duration.endsWith('h')) minutes = parseInt(duration) * 60;

    const cutoff = new Date(Date.now() - minutes * 60 * 1000);

    const logs = await LocationLog.find({
      equipmentId,
      timestamp: { $gte: cutoff }
    }).sort({ timestamp: 1 }).select('lat lng timestamp speed siteId').lean();

    res.json({ success: true, data: logs });
  } catch (error) {
    next(error);
  }
}

export async function getDwellTime(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { equipmentId } = req.params;
    const eq = await Equipment.findOne({ equipmentId }).populate('siteId', 'name').lean();
    if (!eq) {
      res.status(404).json({ success: false, message: 'Equipment not found' });
      return;
    }

    const currentSiteId = eq.siteId;
    if (!currentSiteId) {
      res.json({ success: true, data: { dwellMinutes: 0, dwellFormatted: '0m' } });
      return;
    }

    // Find the earliest contiguous log at this site
    // To do this simply, we get logs ordered by descending time and find where siteId changes.
    // However, it's simpler to just find the earliest log for the equipment and siteId, 
    // assuming it hasn't left and returned, but let's query backward.
    const logs = await LocationLog.find({ equipmentId }).sort({ timestamp: -1 }).lean();
    let earliestLog = logs.length > 0 ? logs[0] : null;
    
    for (const log of logs) {
      if (log.siteId === (currentSiteId as any).siteId || log.siteId === currentSiteId) {
        earliestLog = log;
      } else {
        break;
      }
    }

    const now = new Date();
    const dwellMinutes = earliestLog ? Math.round((now.getTime() - new Date(earliestLog.timestamp as any).getTime()) / 60000) : 0;
    
    const activeMinutes = eq.operatingHours ? Math.round(eq.operatingHours * 60) : 0;
    const idleMinutes = eq.idleHours ? Math.round(eq.idleHours * 60) : 0;

    const hours = Math.floor(dwellMinutes / 60);
    const mins = dwellMinutes % 60;
    const dwellFormatted = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    
    const siteObj = typeof currentSiteId === 'object' ? currentSiteId : null;

    res.json({
      success: true,
      data: {
        siteId: siteObj ? (siteObj as any).siteId : currentSiteId,
        siteName: siteObj ? (siteObj as any).name : '',
        dwellMinutes,
        dwellFormatted,
        activeMinutes,
        idleMinutes
      }
    });
  } catch (error) {
    next(error);
  }
}
