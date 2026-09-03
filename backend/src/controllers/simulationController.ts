import { Request, Response, NextFunction } from 'express';
import { Equipment, Rental, Site } from '../models';
import { AlertEngine } from '../services/alertEngine';
import { AppError } from '../middleware/errorHandler';
import { getIO } from '../config/socket';
import { logger } from '../utils/logger';

// Store active scenarios in memory for continuous telemetry simulator
export const activeScenarios: Map<string, string> = new Map();

export async function triggerSimulationScenario(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { equipmentId, scenario } = req.body;

    if (!equipmentId || !scenario) {
      throw new AppError('equipmentId and scenario are required', 400);
    }

    const eq = await Equipment.findOne({ equipmentId });
    if (!eq) {
      throw new AppError(`Equipment ${equipmentId} not found`, 404);
    }

    activeScenarios.set(equipmentId, scenario);
    logger.info(`Triggering simulation scenario [${scenario}] on ${equipmentId}`);

    let telemetryUpdates: any = {};

    switch (scenario) {
      case 'HIGH_USAGE':
        eq.operatingHours = Math.round((eq.operatingHours + 4.5) * 10) / 10;
        eq.engineHours = Math.round((eq.engineHours + 4.5) * 10) / 10;
        eq.status = 'ACTIVE';
        telemetryUpdates = { operatingHours: eq.operatingHours, engineHours: eq.engineHours };
        break;

      case 'HIGH_IDLE':
        eq.idleHours = Math.round((eq.idleHours + 8.5) * 10) / 10;
        eq.engineHours = Math.round((eq.engineHours + 8.5) * 10) / 10;
        eq.status = 'IDLE';
        telemetryUpdates = { idleHours: eq.idleHours, engineHours: eq.engineHours };
        break;

      case 'TEMPERATURE_SPIKE':
        eq.temperature = 104.5;
        eq.status = 'ACTIVE';
        telemetryUpdates = { temperature: 104.5 };
        break;

      case 'FUEL_ANOMALY':
        eq.fuelLevel = 9;
        eq.status = 'ACTIVE';
        telemetryUpdates = { fuelLevel: 9 };
        break;

      case 'GEOFENCE_VIOLATION':
        // Shift latitude by +0.15 deg (~16 km away)
        eq.lat = eq.lat + 0.15;
        eq.lng = eq.lng + 0.15;
        eq.status = 'ACTIVE';
        telemetryUpdates = { lat: eq.lat, lng: eq.lng };
        break;

      case 'OVERDUE':
        // Set active rental expectedReturnDate to 3 days ago
        const activeRental = await Rental.findOne({
          equipmentId: eq.equipmentId,
          status: { $in: ['ACTIVE', 'OVERDUE'] },
        });
        if (activeRental) {
          const pastDate = new Date();
          pastDate.setDate(pastDate.getDate() - 3);
          activeRental.expectedReturnDate = pastDate;
          activeRental.status = 'OVERDUE';
          await activeRental.save();
        }
        eq.status = 'OVERDUE';
        break;

      case 'UNASSIGNED':
        eq.status = 'ACTIVE';
        eq.operatorId = null as any;
        break;

      case 'NORMAL':
      default:
        activeScenarios.delete(equipmentId);
        eq.temperature = 82;
        if (eq.fuelLevel < 20) eq.fuelLevel = 90;
        break;
    }

    await eq.save();

    // Broadcast equipment update
    try {
      getIO().emit('equipment:updated', eq);
    } catch (e) {}

    // Evaluate in AlertEngine immediately
    const generatedAlerts = await AlertEngine.evaluateTelemetry(eq, {
      equipmentId: eq.equipmentId,
      ...telemetryUpdates,
    });

    res.json({
      success: true,
      message: `Scenario ${scenario} triggered successfully on ${equipmentId}`,
      data: {
        equipment: eq,
        scenario,
        generatedAlertsCount: generatedAlerts.length,
        generatedAlerts,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function getActiveScenarios(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const list = Array.from(activeScenarios.entries()).map(([equipmentId, scenario]) => ({
      equipmentId,
      scenario,
    }));
    res.json({
      success: true,
      data: list,
    });
  } catch (error) {
    next(error);
  }
}
