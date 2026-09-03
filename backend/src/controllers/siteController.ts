import { Request, Response, NextFunction } from 'express';
import { Site, Equipment } from '../models';

export async function getSites(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const sites = await Site.find().sort({ name: 1 }).lean();

    // Attach current equipment counts
    const siteCounts = await Equipment.aggregate([
      { $match: { siteId: { $ne: null } } },
      { $group: { _id: '$siteId', count: { $sum: 1 } } },
    ]);

    const countMap = new Map(siteCounts.map((s) => [s._id, s.count]));

    const enriched = sites.map((s) => ({
      ...s,
      geofenceRadius: s.geofenceRadius || 5.0,
      equipmentCount: countMap.get(s.siteId) || 0,
    }));

    res.json({
      success: true,
      data: enriched,
    });
  } catch (error) {
    next(error);
  }
}
