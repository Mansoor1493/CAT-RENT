import { Request, Response, NextFunction } from 'express';
import { Alert, Equipment } from '../models';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { getIO } from '../config/socket';

export async function getAlerts(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status = 'ACTIVE', severity, limit = '100' } = req.query;

    const query: any = {};
    if (status && status !== 'ALL') query.status = status;
    if (severity && severity !== 'ALL') query.severity = severity;

    const limitNum = parseInt(limit as string, 10) || 100;

    const alerts = await Alert.find(query)
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .lean();

    // Attach equipment info
    const eqIds = alerts.map((a) => a.equipmentId).filter(Boolean);
    const equipmentList = await Equipment.find({ equipmentId: { $in: eqIds } }).lean();
    const eqMap = new Map(equipmentList.map((e) => [e.equipmentId, e]));

    const enriched = alerts.map((a) => ({
      ...a,
      equipment: eqMap.get(a.equipmentId) || null,
    }));

    res.json({
      success: true,
      data: enriched,
    });
  } catch (error) {
    next(error);
  }
}

export async function getUnreadAlerts(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const alerts = await Alert.find({ status: 'ACTIVE', isRead: false })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const count = await Alert.countDocuments({ status: 'ACTIVE', isRead: false });

    res.json({
      success: true,
      data: {
        count,
        alerts,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getAlertById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const alert = await Alert.findOne({
      $or: [{ alertId: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }],
    }).lean();

    if (!alert) {
      throw new AppError('Alert not found', 404);
    }

    const equipment = await Equipment.findOne({ equipmentId: alert.equipmentId }).lean();

    res.json({
      success: true,
      data: {
        ...alert,
        equipment,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function resolveAlert(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const alert = await Alert.findOneAndUpdate(
      {
        $or: [{ alertId: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }],
      },
      {
        $set: {
          status: 'RESOLVED',
          isRead: true,
          resolvedAt: new Date(),
          resolvedBy: req.userId || 'ADMIN',
        },
      },
      { new: true }
    );

    if (!alert) {
      throw new AppError('Alert not found', 404);
    }

    try {
      getIO().emit('alert:resolved', alert);
    } catch (e) {}

    res.json({
      success: true,
      message: 'Alert marked as resolved',
      data: alert,
    });
  } catch (error) {
    next(error);
  }
}

export async function markAllAsRead(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await Alert.updateMany({ isRead: false }, { $set: { isRead: true } });

    res.json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (error) {
    next(error);
  }
}

