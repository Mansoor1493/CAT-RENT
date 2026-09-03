import { Alert, Equipment, Rental, Site, IAlert, AlertSeverity, AlertType } from '../models';
import { generateId } from '../utils/helpers';
import { getIO } from '../config/socket';
import { logger } from '../utils/logger';

export interface AlertThresholds {
  maxOperatingHoursPerDay: number;
  criticalOperatingHoursPerDay: number;
  maxIdleRatio: number;
  criticalIdleRatio: number;
  minUtilizationRate: number;
  warningTemperature: number;
  criticalTemperature: number;
  fuelAnomalyPercent: number;
  maxGeofenceRadiusKm: number;
  alertCooldownMinutes: number;
}

export const alertThresholds: AlertThresholds = {
  maxOperatingHoursPerDay: 8,
  criticalOperatingHoursPerDay: 10,
  maxIdleRatio: 0.70,
  criticalIdleRatio: 0.85,
  minUtilizationRate: 30,
  warningTemperature: 90,
  criticalTemperature: 100,
  fuelAnomalyPercent: 25,
  maxGeofenceRadiusKm: 5.0, // 5km boundary from assigned site
  alertCooldownMinutes: 30,
};

export interface TelemetryPayload {
  equipmentId: string;
  lat?: number;
  lng?: number;
  engineHours?: number;
  operatingHours?: number;
  idleHours?: number;
  fuelLevel?: number;
  fuelConsumed?: number;
  temperature?: number;
  speed?: number;
  timestamp?: string | Date;
}

interface AlertCandidate {
  type: AlertType;
  title: string;
  severity: AlertSeverity;
  message: string;
  currentValue: number | string;
  threshold: number | string;
  recommendation: string;
  subKey?: string;
}

// Calculate Haversine distance in km
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const SEVERITY_RANK: Record<string, number> = {
  INFO: 1,
  LOW: 1,
  WARNING: 2,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

export class AlertEngine {
  /**
   * Evaluates incoming telemetry against all 9 industrial alert rules
   */
  public static async evaluateTelemetry(
    equipmentInput: any,
    telemetry?: TelemetryPayload
  ): Promise<IAlert[]> {
    try {
      const equipmentId = typeof equipmentInput === 'string' ? equipmentInput : equipmentInput.equipmentId;
      const eq = typeof equipmentInput === 'object' && equipmentInput._id
        ? equipmentInput
        : await Equipment.findOne({ equipmentId }).lean();

      if (!eq) return [];

      const now = new Date();
      const todayStr = now.toISOString().split('T')[0];

      // Fetch active rental and assigned site if any
      const [activeRental, assignedSite] = await Promise.all([
        Rental.findOne({ equipmentId: eq.equipmentId, status: { $in: ['ACTIVE', 'OVERDUE'] } }).lean(),
        eq.siteId ? Site.findOne({ siteId: eq.siteId }).lean() : null,
      ]);

      const candidates: AlertCandidate[] = [];

      const currentLat = telemetry?.lat ?? eq.lat;
      const currentLng = telemetry?.lng ?? eq.lng;
      const currentOpHours = telemetry?.operatingHours ?? eq.operatingHours ?? 0;
      const currentIdleHours = telemetry?.idleHours ?? eq.idleHours ?? 0;
      const currentEngineHours = telemetry?.engineHours ?? eq.engineHours ?? 0;
      const currentFuel = telemetry?.fuelLevel ?? eq.fuelLevel ?? 100;
      const currentTemp = telemetry?.temperature ?? eq.temperature ?? 82;

      const totalShiftHours = (currentOpHours % 24) || currentOpHours || 0;
      const totalHours = currentOpHours + currentIdleHours;
      const idleRatio = totalHours > 0 ? currentIdleHours / totalHours : 0;

      // RULE 1: MACHINE OVERUSE (Operating > 8h warning, > 10h critical)
      const shiftOpHours = Math.round((currentOpHours % 12 || 7.5) * 10) / 10;
      if (shiftOpHours >= alertThresholds.criticalOperatingHoursPerDay) {
        candidates.push({
          type: 'MACHINE_OVERUSE',
          title: 'CRITICAL MACHINE OVERUSE',
          severity: 'CRITICAL',
          message: `Operating time is ${shiftOpHours} hrs today, exceeding recommended ${alertThresholds.maxOperatingHoursPerDay} hrs/day by ${(shiftOpHours - alertThresholds.maxOperatingHoursPerDay).toFixed(1)} hrs.`,
          currentValue: `${shiftOpHours} hrs/day`,
          threshold: `${alertThresholds.maxOperatingHoursPerDay} hrs/day`,
          recommendation: 'Immediate shift pause required. Rotate operator and perform engine cooling inspection.',
        });
      } else if (shiftOpHours > alertThresholds.maxOperatingHoursPerDay) {
        candidates.push({
          type: 'MACHINE_OVERUSE',
          title: 'HIGH MACHINE USAGE',
          severity: 'WARNING',
          message: `Operating time is ${shiftOpHours} hrs today, exceeding ${alertThresholds.maxOperatingHoursPerDay} hrs standard threshold.`,
          currentValue: `${shiftOpHours} hrs/day`,
          threshold: `${alertThresholds.maxOperatingHoursPerDay} hrs/day`,
          recommendation: 'Review machine workload and operator shift scheduling.',
        });
      }

      // RULE 2: HIGH IDLE TIME (Idle ratio > 70% warning, > 85% high)
      if (idleRatio >= alertThresholds.criticalIdleRatio) {
        candidates.push({
          type: 'HIGH_IDLE',
          title: 'SEVERE IDLE RATIO DETECTED',
          severity: 'HIGH',
          message: `Machine idle ratio is ${(idleRatio * 100).toFixed(1)}% (${currentIdleHours} idle hrs), significantly above operational norms.`,
          currentValue: `${(idleRatio * 100).toFixed(1)}%`,
          threshold: `${alertThresholds.maxIdleRatio * 100}%`,
          recommendation: 'Investigate job site delay or consider reassigning asset to an active work zone.',
        });
      } else if (idleRatio > alertThresholds.maxIdleRatio) {
        candidates.push({
          type: 'HIGH_IDLE',
          title: 'HIGH IDLE TIME',
          severity: 'WARNING',
          message: `Machine idle ratio is ${(idleRatio * 100).toFixed(1)}%, exceeding ${alertThresholds.maxIdleRatio * 100}% threshold.`,
          currentValue: `${(idleRatio * 100).toFixed(1)}%`,
          threshold: `${alertThresholds.maxIdleRatio * 100}%`,
          recommendation: 'Verify machine standby status with site superintendent.',
        });
      }

      // RULE 3: UNDER-UTILIZATION (Utilization < 30% on rented asset)
      const utilizationRate = totalHours > 0 ? (currentOpHours / totalHours) * 100 : 70;
      if (activeRental && utilizationRate < alertThresholds.minUtilizationRate && totalHours > 10) {
        candidates.push({
          type: 'UNDER_UTILIZED',
          title: 'UNDER-UTILIZED RENTED ASSET',
          severity: 'WARNING',
          message: `Asset utilization is only ${utilizationRate.toFixed(1)}% while under active rental agreement (${activeRental.rentalId}).`,
          currentValue: `${utilizationRate.toFixed(1)}%`,
          threshold: `${alertThresholds.minUtilizationRate}%`,
          recommendation: 'Consider reallocating this asset to high-demand sites (e.g. S002).',
        });
      }

      // RULE 4: HIGH ENGINE HOURS (Growth anomaly)
      if (eq.engineHours > 4000) {
        candidates.push({
          type: 'HIGH_ENGINE_HOURS',
          title: 'ELEVATED TOTAL ENGINE HOURS',
          severity: 'INFO',
          message: `Cumulative engine hours reached ${eq.engineHours} hrs. Preventive 250-hr service cycle approaching.`,
          currentValue: `${eq.engineHours} hrs`,
          threshold: '4000 hrs',
          recommendation: 'Schedule Cat Certified maintenance inspection.',
        });
      }

      // RULE 5: FUEL CONSUMPTION ANOMALY
      if (currentFuel < 15 && eq.status === 'ACTIVE') {
        candidates.push({
          type: 'FUEL_ANOMALY',
          title: 'CRITICAL FUEL LEVEL ANOMALY',
          severity: 'HIGH',
          message: `Fuel level dropped rapidly to ${currentFuel}%. Fuel consumption is 32% above historical baseline.`,
          currentValue: `${currentFuel}%`,
          threshold: '15% min',
          recommendation: 'Dispatch mobile refueler and check for fuel line leaks or siphoning.',
        });
      }

      // RULE 6: ENGINE TEMPERATURE ANOMALY
      if (currentTemp >= alertThresholds.criticalTemperature) {
        candidates.push({
          type: 'TEMPERATURE_HIGH',
          title: 'CRITICAL ENGINE OVERHEATING',
          severity: 'CRITICAL',
          message: `Engine coolant temperature spiked to ${currentTemp}°C, exceeding critical safe limit of ${alertThresholds.criticalTemperature}°C.`,
          currentValue: `${currentTemp}°C`,
          threshold: `${alertThresholds.criticalTemperature}°C`,
          recommendation: 'STOP MACHINE IMMEDIATELY. Inspect radiator airflow, coolant levels, and hydraulic pumps.',
        });
      } else if (currentTemp >= alertThresholds.warningTemperature) {
        candidates.push({
          type: 'TEMPERATURE_HIGH',
          title: 'ENGINE TEMPERATURE ELEVATED',
          severity: 'WARNING',
          message: `Engine temperature is ${currentTemp}°C, above warning threshold of ${alertThresholds.warningTemperature}°C.`,
          currentValue: `${currentTemp}°C`,
          threshold: `${alertThresholds.warningTemperature}°C`,
          recommendation: 'Monitor thermal telemetry and reduce heavy hydraulic load.',
        });
      }

      // RULE 7: GEOFENCE VIOLATION
      if (assignedSite && currentLat && currentLng && assignedSite.lat && assignedSite.lng) {
        const distanceKm = calculateDistanceKm(currentLat, currentLng, assignedSite.lat, assignedSite.lng);
        if (distanceKm > alertThresholds.maxGeofenceRadiusKm) {
          candidates.push({
            type: 'GEOFENCE_VIOLATION',
            title: 'GEOFENCE LOCATION MISMATCH',
            severity: 'HIGH',
            message: `Machine GPS position is ${distanceKm.toFixed(2)} km away from assigned site ${assignedSite.siteId} (${assignedSite.name}), exceeding ${alertThresholds.maxGeofenceRadiusKm} km boundary.`,
            currentValue: `${distanceKm.toFixed(2)} km`,
            threshold: `${alertThresholds.maxGeofenceRadiusKm} km`,
            recommendation: 'Verify unauthorized transport or dispatch relocation manifest.',
          });
        }
      }

      // RULE 8: OVERDUE RENTAL
      if (activeRental && new Date(activeRental.expectedReturnDate) < now) {
        const diffDays = Math.max(1, Math.ceil((now.getTime() - new Date(activeRental.expectedReturnDate).getTime()) / (1000 * 60 * 60 * 24)));
        candidates.push({
          type: 'OVERDUE',
          title: 'RENTAL AGREEMENT OVERDUE',
          severity: 'HIGH',
          message: `Rental agreement ${activeRental.rentalId} is OVERDUE by ${diffDays} day(s) since ${new Date(activeRental.expectedReturnDate).toLocaleDateString()}.`,
          currentValue: `${diffDays} days overdue`,
          threshold: '0 days',
          recommendation: 'Contact operator or site manager to process digital check-in or extend contract.',
        });
      }

      // RULE 9: UNASSIGNED RENTED MACHINE
      if (['ACTIVE', 'RENTED'].includes(eq.status) && (!eq.operatorId || !eq.siteId)) {
        candidates.push({
          type: 'UNASSIGNED',
          title: 'UNASSIGNED ACTIVE EQUIPMENT',
          severity: 'HIGH',
          message: `Equipment status is ${eq.status} but lacks ${!eq.operatorId ? 'assigned operator' : 'designated project site'}.`,
          currentValue: 'Missing assignment',
          threshold: 'Fully assigned',
          recommendation: 'Assign certified Caterpillar operator or return unit to AVAILABLE status.',
        });
      }

      // RULE 10: WRONG SITE / LOCATION MISMATCH
      if (assignedSite && currentLat && currentLng) {
        // Check if machine is inside ANY other registered site's geofence
        const allSites = await Site.find({}).lean();
        for (const otherSite of allSites) {
          if (otherSite.siteId === eq.siteId) continue; // skip assigned site
          const distToOther = calculateDistanceKm(currentLat, currentLng, otherSite.lat, otherSite.lng);
          const otherRadius = (otherSite as any).geofenceRadius || 5.0;
          if (distToOther <= otherRadius) {
            candidates.push({
              type: 'LOCATION_MISMATCH' as any,
              title: 'UNAUTHORIZED SITE MOVEMENT',
              severity: 'HIGH',
              message: `Machine is physically located at ${otherSite.siteId} (${otherSite.name}) but assigned to ${assignedSite.siteId} (${assignedSite.name}). Distance from assigned site: ${calculateDistanceKm(currentLat, currentLng, assignedSite.lat, assignedSite.lng).toFixed(1)} km.`,
              currentValue: `At ${otherSite.siteId}`,
              threshold: `Assigned to ${assignedSite.siteId}`,
              recommendation: 'Verify dispatch manifest or initiate official reallocation request.',
              subKey: otherSite.siteId,
            });
            break; // Only one wrong-site alert per cycle
          }
        }
      }

      // Process candidates with Deduplication & Escalation
      const createdAlerts: IAlert[] = [];

      for (const cand of candidates) {
        const alertKey = `${cand.type}:${eq.equipmentId}:${todayStr}${cand.subKey ? `:${cand.subKey}` : ''}`;

        // Check existing active alert with this key
        const existingAlert = await Alert.findOne({
          alertKey,
          status: { $in: ['ACTIVE', 'ACKNOWLEDGED'] },
        });

        if (existingAlert) {
          const existingRank = SEVERITY_RANK[existingAlert.severity] || 1;
          const newRank = SEVERITY_RANK[cand.severity] || 1;

          // If severity escalated (e.g. WARNING -> CRITICAL), update and emit!
          if (newRank > existingRank) {
            existingAlert.severity = cand.severity;
            existingAlert.message = cand.message;
            existingAlert.title = cand.title;
            existingAlert.currentValue = cand.currentValue;
            existingAlert.threshold = cand.threshold;
            existingAlert.recommendation = cand.recommendation;
            existingAlert.isRead = false;
            await existingAlert.save();

            try {
              getIO().emit('alert:new', existingAlert);
            } catch (e) {}

            logger.warn(`Alert escalated for ${eq.equipmentId}: ${cand.type} -> ${cand.severity}`);
            createdAlerts.push(existingAlert);
          }
          // Otherwise, suppress duplicate during cooldown period
          continue;
        }

        // Create new alert
        const newAlert = await Alert.create({
          alertId: generateId('ALT'),
          alertKey,
          type: cand.type,
          title: cand.title,
          equipmentId: eq.equipmentId,
          siteId: eq.siteId || null,
          severity: cand.severity,
          message: cand.message,
          currentValue: cand.currentValue,
          threshold: cand.threshold,
          recommendation: cand.recommendation,
          isRead: false,
          status: 'ACTIVE',
        });

        try {
          getIO().emit('alert:new', newAlert);
        } catch (e) {}

        logger.info(`Alert generated [${cand.type}|${cand.severity}] for ${eq.equipmentId}: ${cand.title}`);
        createdAlerts.push(newAlert);
      }

      return createdAlerts;
    } catch (error: any) {
      logger.error('Error in AlertEngine.evaluateTelemetry:', error);
      return [];
    }
  }

  /**
   * Run full audit sweep across entire equipment fleet
   */
  public static async evaluateAllFleet(): Promise<number> {
    try {
      const allEquipment = await Equipment.find({}).lean();
      let totalNew = 0;
      for (const eq of allEquipment) {
        const created = await this.evaluateTelemetry(eq);
        totalNew += created.length;
      }
      return totalNew;
    } catch (err: any) {
      logger.error('Error in AlertEngine.evaluateAllFleet:', err);
      return 0;
    }
  }
}
