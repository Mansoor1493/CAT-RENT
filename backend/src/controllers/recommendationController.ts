import { Request, Response, NextFunction } from 'express';
import { Recommendation, Forecast, Equipment, Site, AuditLog } from '../models';
import { callMlRecommendations } from '../services/mlClient';
import { getIO } from '../config/socket';
import { generateId, haversineDistance } from '../utils/helpers';
import { AuthRequest } from '../middleware/auth';

export async function getRecommendations(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { status = 'ALL' } = req.query;

    const query: any = {};
    if (status && status !== 'ALL') query.status = status;

    const recommendations = await Recommendation.find(query).sort({ score: -1, createdAt: -1 }).lean();

    // Enrich with target site and source equipment info
    const siteIds = [...new Set(recommendations.map((r) => r.targetSiteId))];
    const sites = await Site.find({ siteId: { $in: siteIds } }).lean();
    const siteMap = new Map(sites.map((s) => [s.siteId, s]));

    const allEqIds = [...new Set(recommendations.flatMap((r) => r.sourceEquipmentIds))];
    const equipmentList = await Equipment.find({ equipmentId: { $in: allEqIds } }).lean();
    const eqMap = new Map(equipmentList.map((e) => [e.equipmentId, e]));

    const enriched = recommendations.map((r) => ({
      ...r,
      targetSite: siteMap.get(r.targetSiteId) || null,
      equipment: r.sourceEquipmentIds.map((id) => eqMap.get(id)).filter(Boolean),
    }));

    res.json({
      success: true,
      data: enriched,
    });
  } catch (error) {
    next(error);
  }
}

export async function generateRecommendations(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // 1. Try ML recommendations
    const mlResponse = await callMlRecommendations();
    const generated: any[] = [];

    if (mlResponse?.success && mlResponse.recommendations?.length > 0) {
      for (const rec of mlResponse.recommendations) {
        const doc = await Recommendation.create({
          recommendationId: generateId('REC'),
          action: rec.action,
          sourceEquipmentIds: rec.source_equipment_ids,
          sourceSiteId: rec.source_site_id,
          targetSiteId: rec.target_site_id,
          equipmentType: rec.equipment_type,
          reasons: rec.reasons,
          expectedImpact: rec.expected_impact,
          score: rec.score,
          status: 'PENDING',
        });
        generated.push(doc);
      }
    } else {
      // 2. Intelligent Reallocation Recommendation Engine
      // Find forecasts with HIGH or MEDIUM shortage risks
      const shortages = await Forecast.find({ shortageRisk: { $in: ['HIGH', 'MEDIUM'] } }).lean();
      const sites = await Site.find().lean();
      const siteMap = new Map(sites.map((s) => [s.siteId, s]));

      // Clear existing pending recommendations to avoid duplicates
      await Recommendation.deleteMany({ status: 'PENDING' });

      for (const shortage of shortages) {
        const targetSite = siteMap.get(shortage.siteId);
        if (!targetSite) continue;

        const needed = Math.max(1, Math.ceil(shortage.predictedDemand - shortage.available));

        // Find candidate machines of the same type at other sites that are AVAILABLE or IDLE
        const candidates = await Equipment.find({
          type: shortage.equipmentType,
          status: { $in: ['AVAILABLE', 'IDLE'] },
          siteId: { $ne: shortage.siteId },
        }).lean();

        if (candidates.length === 0) continue;

        // Rank candidates by distance and under-utilization
        const scoredCandidates = candidates.map((cand) => {
          const dist = haversineDistance(cand.lat, cand.lng, targetSite.lat, targetSite.lng);
          const totalH = cand.operatingHours + cand.idleHours;
          const idleRatio = totalH > 0 ? cand.idleHours / totalH : 0.5;

          // Score: prioritize closer, high-health, high-idle (under-utilized) assets
          const candScore = 50 + idleRatio * 30 + (cand.healthScore / 10) - Math.min(30, dist / 15);
          return { candidate: cand, score: candScore, distance: Math.round(dist) };
        });

        scoredCandidates.sort((a, b) => b.score - a.score);
        const selected = scoredCandidates.slice(0, needed);
        const sourceEqIds = selected.map((s) => s.candidate.equipmentId);
        const avgDist = Math.round(selected.reduce((sum, s) => sum + s.distance, 0) / selected.length);

        const recDoc = await Recommendation.create({
          recommendationId: generateId('REC'),
          action: 'REALLOCATE',
          sourceEquipmentIds: sourceEqIds,
          sourceSiteId: selected[0]?.candidate.siteId || null,
          targetSiteId: shortage.siteId,
          equipmentType: shortage.equipmentType,
          reasons: [
            `${targetSite.name} (${shortage.siteId}) forecasted demand is ${shortage.predictedDemand} ${shortage.equipmentType}s (available: ${shortage.available})`,
            `Shortage risk flagged as ${shortage.shortageRisk} - projected deficit of ${needed} units`,
            `${sourceEqIds.join(', ')} identified as under-utilized / available at nearby facilities (avg dist: ${avgDist} km)`,
            `Pre-positioning mitigates costly project work stoppages and eliminates emergency spot-rental markups`,
          ],
          expectedImpact: {
            utilizationGain: Math.round((needed / Math.max(1, shortage.predictedDemand)) * 100 * 10) / 10,
            shortageCoverage: 100,
            costSaving: needed * 1450, // estimated savings
          },
          score: Math.round((selected.reduce((sum, s) => sum + s.score, 0) / selected.length) * 10) / 10,
          status: 'PENDING',
        });

        generated.push(recDoc);
      }
    }

    try {
      getIO().emit('recommendation:new', generated);
    } catch (e) {}

    res.json({
      success: true,
      data: generated,
      message: `Generated ${generated.length} actionable reallocation recommendations.`,
    });
  } catch (error) {
    next(error);
  }
}

export async function executeRecommendation(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    const rec = await Recommendation.findOne({
      $or: [{ recommendationId: id }, { _id: id }],
    });

    if (!rec) {
      throw new Error(`Recommendation ${id} not found`);
    }

    const targetSite = await Site.findOne({ siteId: rec.targetSiteId });
    if (!targetSite) {
      throw new Error(`Target site ${rec.targetSiteId} not found`);
    }

    // Move source equipment to target site
    for (const eqId of rec.sourceEquipmentIds) {
      await Equipment.updateOne(
        { equipmentId: eqId },
        {
          $set: {
            siteId: rec.targetSiteId,
            status: 'AVAILABLE',
            lat: targetSite.lat + (Math.random() - 0.5) * 0.01,
            lng: targetSite.lng + (Math.random() - 0.5) * 0.01,
          },
        }
      );
    }

    // Update recommendation status
    rec.status = 'EXECUTED';
    await rec.save();

    // Create Audit Log
    await AuditLog.create({
      userId: req.userId || 'ADMIN',
      action: 'EXECUTE_RECOMMENDATION',
      entity: 'Recommendation',
      entityId: rec.recommendationId,
      timestamp: new Date(),
      previousValue: { status: 'PENDING' },
      newValue: {
        status: 'EXECUTED',
        movedEquipment: rec.sourceEquipmentIds,
        targetSiteId: rec.targetSiteId,
      },
    });

    // Broadcast update
    try {
      const io = getIO();
      const updatedEquipment = await Equipment.find({ equipmentId: { $in: rec.sourceEquipmentIds } });
      updatedEquipment.forEach((eq) => io.emit('equipment:updated', eq));
    } catch (e) {}

    res.json({
      success: true,
      data: rec,
      message: `Successfully executed recommendation! Reallocated ${rec.sourceEquipmentIds.join(', ')} to ${targetSite.name}.`,
    });
  } catch (error) {
    next(error);
  }
}
