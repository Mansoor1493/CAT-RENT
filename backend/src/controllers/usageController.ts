import { Request, Response, NextFunction } from 'express';
import { UsageLog, Equipment } from '../models';
import { AppError } from '../middleware/errorHandler';
import { getIO } from '../config/socket';

export async function logUsage(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { equipmentId, engineHours, operatingHours, idleHours, fuelConsumed, lat, lng, siteId, operatorId, date } = req.body;

    if (!equipmentId) {
      throw new AppError('equipmentId is required', 400);
    }

    const logDate = date ? new Date(date) : new Date();

    const usageLog = await UsageLog.create({
      equipmentId,
      date: logDate,
      engineHours: Number(engineHours) || 0,
      operatingHours: Number(operatingHours) || 0,
      idleHours: Number(idleHours) || 0,
      fuelConsumed: Number(fuelConsumed) || 0,
      lat: Number(lat) || 0,
      lng: Number(lng) || 0,
      siteId,
      operatorId,
    });

    // Update equipment cumulative hours
    if (engineHours || operatingHours || idleHours) {
      await Equipment.updateOne(
        { equipmentId },
        {
          $inc: {
            engineHours: Number(engineHours) || 0,
            operatingHours: Number(operatingHours) || 0,
            idleHours: Number(idleHours) || 0,
          },
        }
      );
    }

    try {
      getIO().emit('usage:updated', usageLog);
    } catch (e) {}

    res.status(201).json({
      success: true,
      data: usageLog,
    });
  } catch (error) {
    next(error);
  }
}

export async function getUsageByEquipment(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { equipmentId } = req.params;
    const { from, to, limit = '30' } = req.query;

    const query: any = { equipmentId };
    if (from || to) {
      query.date = {};
      if (from) query.date.$gte = new Date(from as string);
      if (to) query.date.$lte = new Date(to as string);
    }

    const logs = await UsageLog.find(query)
      .sort({ date: 1 })
      .limit(parseInt(limit as string, 10))
      .lean();

    res.json({
      success: true,
      data: logs,
    });
  } catch (error) {
    next(error);
  }
}
