import { Response, NextFunction } from 'express';
import { AuditLog } from '../models';
import { AuthRequest } from '../middleware/auth';

export async function getAuditLogs(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { action, entity, userId, limit = '50', page = '1' } = req.query;
    const query: any = {};

    if (action) query.action = action as string;
    if (entity) query.entity = entity as string;
    if (userId) query.userId = userId as string;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    const [logs, total] = await Promise.all([
      AuditLog.find(query).sort({ timestamp: -1 }).skip(skip).limit(limitNum).lean(),
      AuditLog.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: logs,
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
