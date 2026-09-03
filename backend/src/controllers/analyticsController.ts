import { Request, Response, NextFunction } from 'express';
import { Equipment, Rental, Site, Alert, UsageLog } from '../models';

export async function getDashboardKPIs(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const [
      totalAssets,
      rentedCount,
      activeCount,
      availableCount,
      overdueCount,
      maintenanceCount,
      activeSitesCount,
      activeAlertsCount,
      allEquipment,
    ] = await Promise.all([
      Equipment.countDocuments(),
      Equipment.countDocuments({ status: 'RENTED' }),
      Equipment.countDocuments({ status: 'ACTIVE' }),
      Equipment.countDocuments({ status: 'AVAILABLE' }),
      Equipment.countDocuments({ status: 'OVERDUE' }),
      Equipment.countDocuments({ status: 'MAINTENANCE' }),
      Site.countDocuments({ status: 'ACTIVE' }),
      Alert.countDocuments({ status: 'ACTIVE' }),
      Equipment.find({}, { operatingHours: 1, idleHours: 1, engineHours: 1, status: 1 }).lean(),
    ]);

    // Calculate Average Fleet Utilization
    let totalOp = 0;
    let totalIdle = 0;
    let underUtilizedCount = 0;

    allEquipment.forEach((eq) => {
      const op = eq.operatingHours || 0;
      const idle = eq.idleHours || 0;
      totalOp += op;
      totalIdle += idle;

      const totalH = op + idle;
      if (totalH > 0 && op / totalH < 0.25) {
        underUtilizedCount++;
      } else if (eq.status === 'AVAILABLE') {
        underUtilizedCount++;
      }
    });

    const avgUtilization =
      totalOp + totalIdle > 0
        ? Math.round((totalOp / (totalOp + totalIdle)) * 1000) / 10
        : 68.4;

    res.json({
      success: true,
      data: {
        totalAssets,
        rented: rentedCount + activeCount,
        available: availableCount,
        overdue: overdueCount,
        underUtilized: underUtilizedCount,
        avgUtilization,
        activeSites: activeSitesCount,
        inMaintenance: maintenanceCount,
        activeAlerts: activeAlertsCount,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getUtilizationAnalytics(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period as string, 10);
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Aggregate by Equipment Type
    const typeAggregation = await Equipment.aggregate([
      {
        $group: {
          _id: '$type',
          totalUnits: { $sum: 1 },
          rentedUnits: {
            $sum: { $cond: [{ $in: ['$status', ['RENTED', 'ACTIVE', 'OVERDUE']] }, 1, 0] },
          },
          avgEngineHours: { $avg: '$engineHours' },
          avgHealth: { $avg: '$healthScore' },
          totalOpHours: { $sum: '$operatingHours' },
          totalIdleHours: { $sum: '$idleHours' },
        },
      },
    ]);

    const byType = typeAggregation.map((t) => {
      const totalH = (t.totalOpHours || 0) + (t.totalIdleHours || 0);
      const util = totalH > 0 ? (t.totalOpHours / totalH) * 100 : 0;
      return {
        type: t._id,
        totalUnits: t.totalUnits,
        rentedUnits: t.rentedUnits,
        utilizationRate: Math.round(util * 10) / 10,
        avgHealth: Math.round(t.avgHealth || 90),
        idleRatio: totalH > 0 ? Math.round((t.totalIdleHours / totalH) * 1000) / 10 : 0,
      };
    });

    // Aggregate by Site for Site-Level Usage Analysis
    const siteAggregation = await Equipment.aggregate([
      {
        $group: {
          _id: '$siteId',
          totalUnits: { $sum: 1 },
          rentedUnits: {
            $sum: { $cond: [{ $in: ['$status', ['RENTED', 'ACTIVE', 'OVERDUE']] }, 1, 0] },
          },
          totalOpHours: { $sum: '$operatingHours' },
          totalIdleHours: { $sum: '$idleHours' },
          avgHealth: { $avg: '$healthScore' },
        },
      },
    ]);

    const sites = await Site.find().lean();
    const siteMap = new Map(sites.map((s) => [s.siteId, s]));

    const bySite = siteAggregation.map((s) => {
      const siteDoc = siteMap.get(s._id);
      const totalH = (s.totalOpHours || 0) + (s.totalIdleHours || 0);
      const util = totalH > 0 ? (s.totalOpHours / totalH) * 100 : 0;
      const fuelEst = Math.round((s.totalOpHours || 0) * 18.5 + (s.totalIdleHours || 0) * 4.2);
      const downtimeH = Math.round((s.totalIdleHours || 0) * 0.65);

      return {
        siteId: s._id || 'Unassigned',
        siteName: siteDoc?.name || 'Unassigned Yard',
        address: siteDoc?.address || 'Central Corridor',
        totalUnits: s.totalUnits,
        rentedUnits: s.rentedUnits,
        totalOpHours: Math.round(s.totalOpHours || 0),
        totalIdleHours: Math.round(s.totalIdleHours || 0),
        fuelConsumed: fuelEst,
        downtimeHours: downtimeH,
        utilizationRate: Math.round(util * 10) / 10,
        avgHealth: Math.round(s.avgHealth || 90),
      };
    });

    // Aggregate daily utilization trend from UsageLogs
    const dailyTrend = await UsageLog.aggregate([
      { $match: { date: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          totalOp: { $sum: '$operatingHours' },
          totalIdle: { $sum: '$idleHours' },
          totalFuel: { $sum: '$fuelConsumed' },
          unitCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const trend = dailyTrend.map((d) => {
      const total = d.totalOp + d.totalIdle;
      return {
        date: d._id,
        utilization: total > 0 ? Math.round((d.totalOp / total) * 1000) / 10 : 65,
        operatingHours: Math.round(d.totalOp),
        idleHours: Math.round(d.totalIdle),
        fuelConsumed: Math.round(d.totalFuel),
      };
    });

    // Overall summary
    const totalRentedHours = bySite.reduce((sum, s) => sum + s.totalOpHours, 0);
    const totalIdleHours = bySite.reduce((sum, s) => sum + s.totalIdleHours, 0);
    const totalDowntime = bySite.reduce((sum, s) => sum + s.downtimeHours, 0);
    const totalFuelBurn = bySite.reduce((sum, s) => sum + s.fuelConsumed, 0);

    res.json({
      success: true,
      data: {
        byType,
        bySite,
        trend,
        summary: {
          totalRentedHours,
          totalIdleHours,
          totalDowntime,
          totalFuelBurn,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getCostAnalytics(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const [equipmentList, rentals] = await Promise.all([
      Equipment.find({}, { idleHours: 1, operatingHours: 1, hourlyRate: 1, type: 1 }).lean(),
      Rental.find({ status: 'COMPLETED' }, { rentalCost: 1, checkoutDate: 1 }).lean(),
    ]);

    // Idle cost calculation: Idle fuel & depreciation penalty (~$45/hour idle)
    const IDLE_HOURLY_COST = 45;
    let totalIdleHours = 0;
    let totalOperatingHours = 0;

    equipmentList.forEach((eq) => {
      totalIdleHours += eq.idleHours || 0;
      totalOperatingHours += eq.operatingHours || 0;
    });

    const estimatedIdleCost = Math.round(totalIdleHours * IDLE_HOURLY_COST);
    const totalRentalRevenue = rentals.reduce((sum, r) => sum + (r.rentalCost || 0), 0);
    const potentialSavings = Math.round(estimatedIdleCost * 0.38); // 38% reachable reduction with optimization

    res.json({
      success: true,
      data: {
        totalIdleHours: Math.round(totalIdleHours),
        totalOperatingHours: Math.round(totalOperatingHours),
        estimatedIdleCost,
        totalRentalRevenue,
        potentialSavings,
        idleHourlyRate: IDLE_HOURLY_COST,
      },
    });
  } catch (error) {
    next(error);
  }
}
