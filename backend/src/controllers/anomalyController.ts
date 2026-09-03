import { Request, Response, NextFunction } from 'express';
import { Anomaly, Equipment, UsageLog, Alert } from '../models';
import { callMlAnomalies } from '../services/mlClient';
import { getIO } from '../config/socket';
import { generateId } from '../utils/helpers';
import { AuthRequest } from '../middleware/auth';

export async function getAnomalies(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { severity, status = 'ACTIVE' } = req.query;

    const query: any = {};
    if (status && status !== 'ALL') query.status = status;
    if (severity) query.severity = severity;

    const anomalies = await Anomaly.find(query).sort({ score: -1, createdAt: -1 }).lean();

    // Attach equipment metadata
    const eqIds = [...new Set(anomalies.map((a) => a.equipmentId))];
    const equipmentList = await Equipment.find({ equipmentId: { $in: eqIds } }).lean();
    const eqMap = new Map(equipmentList.map((e) => [e.equipmentId, e]));

    const enriched = anomalies.map((a) => ({
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

export async function runAnomalyDetection(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // 1. Try ML detection
    const mlResponse = await callMlAnomalies();
    const detected: any[] = [];

    if (mlResponse?.success && mlResponse.anomalies?.length > 0) {
      for (const item of mlResponse.anomalies) {
        const anomaly = await Anomaly.findOneAndUpdate(
          { equipmentId: item.equipment_id, status: 'ACTIVE' },
          {
            $set: {
              score: item.score,
              severity: item.severity,
              reasons: item.reasons,
              detectionMethod: item.detection_method,
              timestamp: new Date(),
            },
          },
          { upsert: true, new: true }
        );
        detected.push(anomaly);
      }
    } else {
      // 2. Rule-based anomaly engine
      const allEquipment = await Equipment.find().lean();

      for (const eq of allEquipment) {
        const issues: string[] = [];
        let score = 0;

        // Rule 1: Active/Rented without operator
        if (['ACTIVE', 'RENTED'].includes(eq.status) && !eq.operatorId) {
          issues.push('No qualified operator assigned while machine is on active rental schedule');
          score += 0.35;
        }

        // Rule 2: Excessive idle hours / low utilization
        const totalH = eq.operatingHours + eq.idleHours;
        const idleRatio = totalH > 0 ? eq.idleHours / totalH : 0;
        if (idleRatio > 0.65) {
          issues.push(`Idle ratio is high at ${(idleRatio * 100).toFixed(1)}% (${eq.idleHours} idle hrs)`);
          score += 0.35;
        }

        // Rule 3: Low fuel level warning
        if (eq.fuelLevel < 20) {
          issues.push(`Fuel level critically low at ${eq.fuelLevel}%`);
          score += 0.15;
        }

        // Rule 4: Overdue machine
        if (eq.status === 'OVERDUE') {
          issues.push('Rental agreement return date has expired without check-in');
          score += 0.3;
        }

        // Rule 5: Degraded health score
        if (eq.healthScore < 75) {
          issues.push(`Health score degraded to ${eq.healthScore}%, preventive maintenance required`);
          score += 0.2;
        }

        if (issues.length > 0 && score >= 0.3) {
          const finalScore = Math.min(1, Math.round(score * 100) / 100);
          const severity =
            finalScore >= 0.8 ? 'CRITICAL' : finalScore >= 0.6 ? 'HIGH' : finalScore >= 0.4 ? 'MEDIUM' : 'LOW';

          const anomaly = await Anomaly.findOneAndUpdate(
            { equipmentId: eq.equipmentId, status: 'ACTIVE' },
            {
              $set: {
                score: finalScore,
                severity,
                reasons: issues,
                detectionMethod: 'RULE_BASED',
                timestamp: new Date(),
              },
            },
            { upsert: true, new: true }
          );
          detected.push(anomaly);

          // Auto-generate Alert if severe
          if (finalScore >= 0.6) {
            await Alert.findOneAndUpdate(
              { equipmentId: eq.equipmentId, type: 'ANOMALY', status: 'ACTIVE' },
              {
                $set: {
                  alertId: generateId('ALT'),
                  type: 'ANOMALY',
                  equipmentId: eq.equipmentId,
                  siteId: eq.siteId,
                  severity,
                  message: `Anomaly on ${eq.model} (${eq.equipmentId}): ${issues[0]}`,
                  status: 'ACTIVE',
                },
              },
              { upsert: true }
            );
          }
        }
      }
    }

    try {
      getIO().emit('anomaly:detected', { count: detected.length, detected });
    } catch (e) {}

    res.json({
      success: true,
      data: detected,
      message: `Anomaly detection completed. ${detected.length} anomalous assets flagged with explainable factors.`,
    });
  } catch (error) {
    next(error);
  }
}

export async function acknowledgeAnomaly(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    const anomaly = await Anomaly.findByIdAndUpdate(
      id,
      {
        $set: {
          status: 'ACKNOWLEDGED',
          resolvedAt: new Date(),
          resolvedBy: req.userId || 'ADMIN',
        },
      },
      { new: true }
    );

    res.json({
      success: true,
      data: anomaly,
    });
  } catch (error) {
    next(error);
  }
}
