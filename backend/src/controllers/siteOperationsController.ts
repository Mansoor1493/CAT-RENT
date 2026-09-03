import { Response, NextFunction } from 'express';
import { Site, Equipment, Rental, Alert } from '../models';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';

export async function getMySites(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    let query: any = {};

    if (req.userRole === 'SITE_MANAGER') {
      const assigned = req.assignedSiteIds || [];
      query = { siteId: { $in: assigned } };
    }

    const sites = await Site.find(query).lean();

    res.json({
      success: true,
      data: sites,
    });
  } catch (error) {
    next(error);
  }
}

export async function getMySiteEquipment(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { siteId } = req.query;
    let query: any = {};

    if (req.userRole === 'SITE_MANAGER') {
      const assigned = req.assignedSiteIds || [];
      if (siteId && !assigned.includes(siteId as string)) {
        throw new AppError(`Forbidden: You do not have access to site ${siteId}`, 403);
      }
      query.siteId = siteId ? siteId : { $in: assigned };
    } else if (siteId) {
      query.siteId = siteId as string;
    }

    const equipmentList = await Equipment.find(query).sort({ equipmentId: 1 }).lean();

    res.json({
      success: true,
      data: equipmentList,
    });
  } catch (error) {
    next(error);
  }
}

export async function getMySiteRentals(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { siteId, status } = req.query;
    let query: any = {};

    if (req.userRole === 'SITE_MANAGER') {
      const assigned = req.assignedSiteIds || [];
      if (siteId && !assigned.includes(siteId as string)) {
        throw new AppError(`Forbidden: You do not have access to site ${siteId}`, 403);
      }
      query.siteId = siteId ? siteId : { $in: assigned };
    } else if (siteId) {
      query.siteId = siteId as string;
    }

    if (status) query.status = status as string;

    const rentals = await Rental.find(query).sort({ expectedReturnDate: 1 }).lean();

    res.json({
      success: true,
      data: rentals,
    });
  } catch (error) {
    next(error);
  }
}

export async function getMySiteAlerts(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { siteId } = req.query;
    let query: any = { status: 'ACTIVE' };

    if (req.userRole === 'SITE_MANAGER') {
      const assigned = req.assignedSiteIds || [];
      if (siteId && !assigned.includes(siteId as string)) {
        throw new AppError(`Forbidden: You do not have access to site ${siteId}`, 403);
      }
      query.siteId = siteId ? siteId : { $in: assigned };
    } else if (siteId) {
      query.siteId = siteId as string;
    }

    const alerts = await Alert.find(query).sort({ timestamp: -1 }).lean();

    res.json({
      success: true,
      data: alerts,
    });
  } catch (error) {
    next(error);
  }
}
