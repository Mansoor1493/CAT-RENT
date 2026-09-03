import { Request, Response, NextFunction } from 'express';
import { Equipment, Site, Alert } from '../models';

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function getSiteSummary(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { siteId } = req.params;
    const site = await Site.findOne({ siteId }).lean();
    if (!site) {
      res.status(404).json({ success: false, message: 'Site not found' });
      return;
    }

    const equipment = await Equipment.find({ siteId }).lean();
    
    let total = equipment.length;
    let activeCount = 0;
    let idleCount = 0;
    let availableCount = 0;
    let riskCount = 0;
    
    let totalOpHours = 0;
    let totalEngHours = 0;
    let totalHealth = 0;
    let totalFuel = 0;

    for (const eq of equipment) {
      if (eq.status === 'ACTIVE' || eq.status === 'RENTED') activeCount++;
      if (eq.status === 'IDLE') idleCount++;
      if (eq.status === 'AVAILABLE') availableCount++;
      
      const activeAlerts = await Alert.countDocuments({ equipmentId: eq.equipmentId, status: 'ACTIVE' });
      if (eq.status === 'OVERDUE' || activeAlerts > 0) riskCount++;

      totalOpHours += (eq.operatingHours || 0);
      totalEngHours += (eq.engineHours || 0);
      totalHealth += (eq.healthScore || 0);
      totalFuel += (eq.fuelLevel || 0);
    }

    const avgUtilization = totalEngHours > 0 ? (totalOpHours / totalEngHours) * 100 : 0;
    const avgHealth = total > 0 ? totalHealth / total : 0;
    const avgFuel = total > 0 ? totalFuel / total : 0;

    res.json({
      success: true,
      data: {
        site: { name: site.name, address: site.address, siteId: site.siteId },
        siteId: site.siteId,
        name: site.name,
        address: site.address,
        total,
        active: activeCount,
        activeCount,
        idle: idleCount,
        idleCount,
        available: availableCount,
        availableCount,
        risk: riskCount,
        riskCount,
        avgUtilization: Math.round(avgUtilization * 10) / 10,
        avgHealth: Math.round(avgHealth),
        avgFuel: Math.round(avgFuel),
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function getNearbyEquipment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { siteId, type } = req.query as { siteId: string, type?: string };
    
    const targetSite = await Site.findOne({ siteId }).lean();
    if (!targetSite) {
      res.status(404).json({ success: false, message: 'Target site not found' });
      return;
    }

    const query: any = { status: { $in: ['AVAILABLE', 'IDLE'] } };
    if (type) {
      query.type = type;
    }

    const equipment = await Equipment.find(query).lean();
    const candidates = [];

    for (const eq of equipment) {
      const util = (eq.engineHours && eq.engineHours > 0) ? ((eq.operatingHours || 0) / eq.engineHours) * 100 : 0;
      // If idle, make sure it has low utilization to be a candidate
      if (eq.status === 'IDLE' && util > 30) continue; 

      const distanceKm = haversineKm(targetSite.lat, targetSite.lng, eq.lat, eq.lng);
      
      candidates.push({
        equipmentId: eq.equipmentId,
        model: eq.model,
        type: eq.type,
        currentSiteId: eq.siteId,
        distanceKm: Math.round(distanceKm * 10) / 10,
        utilization: Math.round(util * 10) / 10,
        health: eq.healthScore || 0,
        status: eq.status
      });
    }

    // Rank: availability first (AVAILABLE > IDLE), then distance asc, then health desc
    candidates.sort((a, b) => {
      if (a.status === 'AVAILABLE' && b.status !== 'AVAILABLE') return -1;
      if (b.status === 'AVAILABLE' && a.status !== 'AVAILABLE') return 1;
      if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
      return b.health - a.health;
    });

    res.json({
      success: true,
      data: candidates.slice(0, 5)
    });
  } catch (error) {
    next(error);
  }
}

export async function getFleetPositions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const fleet = await Equipment.find({}).populate('siteId').populate('operatorId').lean();
    const sites = await Site.find({}).lean();
    
    const enriched = fleet.map((eq: any) => {
      let detectedSiteId = null;
      let minSiteDist = Infinity;
      
      for (const s of sites) {
        const dist = haversineKm(eq.lat, eq.lng, s.lat, s.lng);
        if (dist < minSiteDist) {
          minSiteDist = dist;
          detectedSiteId = s.siteId;
        }
      }

      const nearestSite = sites.find(s => s.siteId === detectedSiteId);
      const assignedSite = eq.siteId && typeof eq.siteId === 'object' ? eq.siteId : sites.find(s => s.siteId === eq.siteId);
      
      let siteMatchStatus = 'NO_ASSIGNED_SITE';
      let distanceFromAssignedSiteKm = null;

      if (assignedSite) {
        siteMatchStatus = 'OUTSIDE_GEOFENCE';
        const distToAssigned = haversineKm(eq.lat, eq.lng, assignedSite.lat, assignedSite.lng);
        distanceFromAssignedSiteKm = Math.round(distToAssigned * 10) / 10;
        
        if (distToAssigned <= (assignedSite.geofenceRadius || 5.0)) {
          siteMatchStatus = 'MATCHED';
        } else if (nearestSite && haversineKm(eq.lat, eq.lng, nearestSite.lat, nearestSite.lng) <= (nearestSite.geofenceRadius || 5.0)) {
          siteMatchStatus = 'WRONG_SITE';
        }
      }

      return {
        ...eq,
        detectedSiteId,
        siteMatchStatus,
        distanceFromAssignedSiteKm
      };
    });

    res.json({
      success: true,
      data: enriched
    });
  } catch (error) {
    next(error);
  }
}
