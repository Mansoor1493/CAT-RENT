import { Equipment, LocationLog, UsageLog, Site } from '../models';
import { getIO } from '../config/socket';
import { logger } from '../utils/logger';
import { AlertEngine } from '../services/alertEngine';
import { activeScenarios } from '../controllers/simulationController';

let intervalId: NodeJS.Timeout | null = null;
let cycleCounter = 0;

export function startTelemetrySimulator(): void {
  // Simulate live telemetry pulse every 10 seconds
  intervalId = setInterval(async () => {
    try {
      cycleCounter++;
      // Fetch active, rented, idle, and overdue units across the fleet
      const activeUnits = await Equipment.find({
        status: { $in: ['ACTIVE', 'RENTED', 'IDLE', 'OVERDUE'] },
      });

      if (activeUnits.length === 0) return;

      const io = getIO();
      const now = new Date();

      // Pre-fetch site coordinates for geofence validation and anchor positioning
      const sites = await Site.find({}).lean();
      const siteMap = new Map(sites.map((s) => [s.siteId, s]));

      for (const eq of activeUnits) {
        const scenario = activeScenarios.get(eq.equipmentId);
        const assignedSite = eq.siteId ? siteMap.get(eq.siteId) : null;

        // Realistic GPS simulation
        let newLat = eq.lat;
        let newLng = eq.lng;

        if (scenario === 'GEOFENCE_VIOLATION' && assignedSite) {
          // Relocate machine 7.5 km north of assigned site to create authentic geofence trigger
          newLat = assignedSite.lat + 0.07;
          newLng = assignedSite.lng + 0.05;
        } else if (eq.status === 'ACTIVE' || eq.status === 'RENTED') {
          // Active machine moving around work zone: small drift (approx 10-30 meters per tick)
          const latJitter = (Math.random() - 0.49) * 0.00035;
          const lngJitter = (Math.random() - 0.49) * 0.00035;
          newLat = Number((eq.lat + latJitter).toFixed(6));
          newLng = Number((eq.lng + lngJitter).toFixed(6));
        } else if (eq.status === 'IDLE') {
          // Idle machine stationary with minimal GPS jitter (approx 1-3 meters)
          const latJitter = (Math.random() - 0.5) * 0.00004;
          const lngJitter = (Math.random() - 0.5) * 0.00004;
          newLat = Number((eq.lat + latJitter).toFixed(6));
          newLng = Number((eq.lng + lngJitter).toFixed(6));
        }

        // Apply operational progression or scenario overrides
        let opInc = eq.status === 'ACTIVE' || eq.status === 'RENTED' ? 0.03 : 0.0;
        let idleInc = eq.status === 'IDLE' ? 0.03 : 0.005;
        let fuelBurn = eq.status === 'ACTIVE' || eq.status === 'RENTED' ? 0.08 : 0.01;

        if (scenario === 'HIGH_USAGE') {
          opInc = 0.2;
          fuelBurn = 0.35;
        } else if (scenario === 'HIGH_IDLE') {
          opInc = 0.0;
          idleInc = 0.25;
        } else if (scenario === 'TEMPERATURE_SPIKE') {
          eq.temperature = Math.min(115, (eq.temperature || 82) + 1.5);
        } else if (scenario === 'FUEL_ANOMALY') {
          fuelBurn = 1.2;
        }

        eq.lat = newLat;
        eq.lng = newLng;
        eq.engineHours = Math.round((eq.engineHours + opInc + idleInc) * 10) / 10;
        eq.operatingHours = Math.round((eq.operatingHours + opInc) * 10) / 10;
        eq.idleHours = Math.round((eq.idleHours + idleInc) * 10) / 10;
        eq.fuelLevel = Math.max(5, Math.round((eq.fuelLevel - fuelBurn) * 10) / 10);
        if (!eq.temperature) eq.temperature = 82;

        await eq.save();

        const speedKmh = eq.status === 'ACTIVE' || eq.status === 'RENTED' ? Math.round(10 + Math.random() * 12) : 0;

        // 1. Broadcast live telemetry position
        io.emit('equipment:location', {
          equipmentId: eq.equipmentId,
          lat: newLat,
          lng: newLng,
          speed: speedKmh,
          timestamp: now.toISOString(),
        });

        // 2. Broadcast updated equipment telemetry state
        io.emit('equipment:updated', eq);

        function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
          const R = 6371;
          const dLat = ((lat2 - lat1) * Math.PI) / 180;
          const dLon = ((lon2 - lon1) * Math.PI) / 180;
          const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
          return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        }

        let detectedSiteId = null;
        let minSiteDist = Infinity;
        for (const s of sites) {
          const dist = haversineKm(newLat, newLng, s.lat, s.lng);
          if (dist < minSiteDist) {
            minSiteDist = dist;
            detectedSiteId = s.siteId;
          }
        }
        const nearestSite = sites.find(s => s.siteId === detectedSiteId);
        let siteMatchStatus = 'NO_ASSIGNED_SITE';
        if (eq.siteId) {
          siteMatchStatus = 'OUTSIDE_GEOFENCE';
          if (assignedSite && haversineKm(newLat, newLng, assignedSite.lat, assignedSite.lng) <= (assignedSite.geofenceRadius || 5.0)) {
            siteMatchStatus = 'MATCHED';
          } else if (nearestSite && haversineKm(newLat, newLng, nearestSite.lat, nearestSite.lng) <= (nearestSite.geofenceRadius || 5.0)) {
            siteMatchStatus = 'WRONG_SITE';
          }
        }

        const distFromAssigned = assignedSite ? haversineKm(newLat, newLng, assignedSite.lat, assignedSite.lng) : null;

        io.emit('equipment:telemetry', {
          equipmentId: eq.equipmentId,
          lat: newLat,
          lng: newLng,
          speed: speedKmh,
          timestamp: now.toISOString(),
          detectedSiteId,
          siteMatchStatus,
          distanceFromAssignedSiteKm: distFromAssigned,
          engineHours: eq.engineHours,
          fuelLevel: eq.fuelLevel,
          temperature: eq.temperature,
          status: eq.status
        });

        // 3. Persist periodic LocationLog for historical breadcrumb trails (every ~30s)
        if (cycleCounter % 3 === 0) {
          LocationLog.create({
            equipmentId: eq.equipmentId,
            timestamp: now,
            lat: newLat,
            lng: newLng,
            speed: speedKmh,
            siteId: eq.siteId || null,
          }).catch(() => {});
        }

        // 4. Evaluate in AlertEngine (checks all 9 industrial rules including geofencing)
        await AlertEngine.evaluateTelemetry(eq, {
          equipmentId: eq.equipmentId,
          lat: newLat,
          lng: newLng,
          operatingHours: eq.operatingHours,
          idleHours: eq.idleHours,
          engineHours: eq.engineHours,
          fuelLevel: eq.fuelLevel,
          temperature: eq.temperature,
          speed: speedKmh,
          timestamp: now,
        });
      }
    } catch (error) {
      // Background loop resilient to temporary disconnections
    }
  }, 10000);

  logger.info('Live Telemetry Simulator started (10s interval across active fleet assets)');
}

export function stopTelemetrySimulator(): void {
  if (intervalId) clearInterval(intervalId);
}
