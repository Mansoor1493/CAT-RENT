import { Router } from 'express';
import { authenticate, requireRole, requireSiteAccess } from '../middleware/auth';

// Controllers
import * as authCtrl from '../controllers/authController';
import * as eqCtrl from '../controllers/equipmentController';
import * as rentalCtrl from '../controllers/rentalController';
import * as rentalRequestCtrl from '../controllers/rentalRequestController';
import * as extensionRequestCtrl from '../controllers/extensionRequestController';
import * as siteOpsCtrl from '../controllers/siteOperationsController';
import * as auditLogCtrl from '../controllers/auditLogController';
import * as usageCtrl from '../controllers/usageController';
import * as locCtrl from '../controllers/locationController';
import * as analyticsCtrl from '../controllers/analyticsController';
import * as forecastCtrl from '../controllers/forecastController';
import * as anomalyCtrl from '../controllers/anomalyController';
import * as recCtrl from '../controllers/recommendationController';
import * as copilotCtrl from '../controllers/copilotController';
import * as siteCtrl from '../controllers/siteController';
import * as opCtrl from '../controllers/operatorController';
import * as alertCtrl from '../controllers/alertController';
import * as simCtrl from '../controllers/simulationController';

const router = Router();

// Health check
router.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      service: 'catrent-api',
      timestamp: new Date().toISOString(),
    },
  });
});

// AUTH
router.post('/auth/register', authCtrl.register);
router.post('/auth/login', authCtrl.login);
router.get('/auth/me', authenticate, authCtrl.getMe);

// RENTAL REQUESTS (Customer submission & Admin approval/rejection)
router.post('/rental-requests', authenticate, rentalRequestCtrl.createRentalRequest);
router.get('/rental-requests', authenticate, rentalRequestCtrl.getRentalRequests);
router.get('/rental-requests/:id', authenticate, rentalRequestCtrl.getRentalRequestById);
router.post(
  '/rental-requests/:id/approve',
  authenticate,
  requireRole('ADMIN', 'RENTAL_MANAGER'),
  rentalRequestCtrl.approveRentalRequest
);
router.post(
  '/rental-requests/:id/reject',
  authenticate,
  requireRole('ADMIN', 'RENTAL_MANAGER'),
  rentalRequestCtrl.rejectRentalRequest
);
router.post('/rental-requests/:id/cancel', authenticate, rentalRequestCtrl.cancelRentalRequest);

// EXTENSION REQUESTS (Customer submission & Admin review)
router.post('/extension-requests', authenticate, extensionRequestCtrl.createExtensionRequest);
router.get('/extension-requests', authenticate, extensionRequestCtrl.getExtensionRequests);
router.post(
  '/extension-requests/:id/approve',
  authenticate,
  requireRole('ADMIN', 'RENTAL_MANAGER'),
  extensionRequestCtrl.approveExtensionRequest
);
router.post(
  '/extension-requests/:id/reject',
  authenticate,
  requireRole('ADMIN', 'RENTAL_MANAGER'),
  extensionRequestCtrl.rejectExtensionRequest
);

// SITE OPERATIONS (Site Manager scoped access)
router.get('/site-ops/my-sites', authenticate, siteOpsCtrl.getMySites);
router.get('/site-ops/equipment', authenticate, siteOpsCtrl.getMySiteEquipment);
router.get('/site-ops/rentals', authenticate, siteOpsCtrl.getMySiteRentals);
router.get('/site-ops/alerts', authenticate, siteOpsCtrl.getMySiteAlerts);

// AUDIT LOGS (Admin only)
router.get(
  '/audit-logs',
  authenticate,
  requireRole('ADMIN', 'RENTAL_MANAGER'),
  auditLogCtrl.getAuditLogs
);

// EQUIPMENT
router.get('/equipment', eqCtrl.getEquipmentList);
router.get('/equipment/qr/:qrCode', eqCtrl.getEquipmentByQR);
router.get('/equipment/:id', eqCtrl.getEquipmentById);
router.post('/equipment', authenticate, requireRole('ADMIN', 'RENTAL_MANAGER'), eqCtrl.createEquipment);
router.put('/equipment/:id', authenticate, requireRole('ADMIN', 'RENTAL_MANAGER', 'SITE_MANAGER'), eqCtrl.updateEquipment);

// RENTALS
router.get('/rentals', rentalCtrl.getRentals);
router.get('/rentals/overdue', rentalCtrl.getOverdueRentals);
router.post('/rentals/checkout', authenticate, requireRole('ADMIN', 'RENTAL_MANAGER', 'SITE_MANAGER'), rentalCtrl.checkout);
router.post('/rentals/checkin', authenticate, requireRole('ADMIN', 'RENTAL_MANAGER', 'SITE_MANAGER'), rentalCtrl.checkin);
router.post('/rentals/:id/extend', authenticate, requireRole('ADMIN', 'RENTAL_MANAGER'), rentalCtrl.extendRental);

// USAGE & TELEMETRY
router.post('/usage', usageCtrl.logUsage);
router.get('/usage/:equipmentId', usageCtrl.getUsageByEquipment);

// MAP INTELLIGENCE
import * as mapCtrl from '../controllers/mapIntelligenceController';

// LOCATION & GPS
router.post('/location', locCtrl.logLocation);
router.get('/location/live', locCtrl.getLiveLocations);
router.get('/location/:equipmentId/trail', locCtrl.getLocationTrail);
router.get('/location/:equipmentId/dwell', locCtrl.getDwellTime);
router.get('/location/:equipmentId', locCtrl.getLocationHistory);

// MAP INTELLIGENCE ROUTES
router.get('/map/site-summary/:siteId', mapCtrl.getSiteSummary);
router.get('/map/nearby-equipment', mapCtrl.getNearbyEquipment);
router.get('/map/fleet-positions', mapCtrl.getFleetPositions);

// ANALYTICS
router.get('/analytics/dashboard', analyticsCtrl.getDashboardKPIs);
router.get('/analytics/utilization', analyticsCtrl.getUtilizationAnalytics);
router.get('/analytics/cost', analyticsCtrl.getCostAnalytics);

// FORECAST
router.get('/forecast', forecastCtrl.getForecasts);
router.post('/forecast/generate', forecastCtrl.generateForecast);

// ANOMALIES
router.get('/anomalies', anomalyCtrl.getAnomalies);
router.post('/anomalies/run', anomalyCtrl.runAnomalyDetection);
router.put('/anomalies/:id/acknowledge', authenticate, anomalyCtrl.acknowledgeAnomaly);

// RECOMMENDATIONS
router.get('/recommendations', recCtrl.getRecommendations);
router.post('/recommendations/generate', recCtrl.generateRecommendations);
router.post('/recommendations/:id/execute', authenticate, requireRole('ADMIN', 'RENTAL_MANAGER'), recCtrl.executeRecommendation);

// COPILOT
router.post('/copilot/ask', copilotCtrl.askCopilot);

// SITES & OPERATORS
router.get('/sites', siteCtrl.getSites);
router.get('/operators', opCtrl.getOperators);

// ALERTS & NOTIFICATIONS
router.get('/alerts', alertCtrl.getAlerts);
router.get('/alerts/unread', alertCtrl.getUnreadAlerts);
router.get('/alerts/:id', alertCtrl.getAlertById);
router.put('/alerts/:id/resolve', authenticate, alertCtrl.resolveAlert);
router.post('/alerts/mark-all-read', alertCtrl.markAllAsRead);

// SIMULATION DEMO SCENARIOS
router.post('/simulation/scenario', simCtrl.triggerSimulationScenario);
router.get('/simulation/scenarios', simCtrl.getActiveScenarios);

export default router;
