// Equipment types
export type EquipmentStatus = 'AVAILABLE' | 'RENTED' | 'IN_TRANSIT' | 'ACTIVE' | 'IDLE' | 'OVERDUE' | 'MAINTENANCE' | 'UNASSIGNED';

export type EquipmentType = 'Excavator' | 'Loader' | 'Dozer' | 'Crane' | 'Dump Truck' | 'Grader' | 'Compactor';

export interface Equipment {
  _id: string;
  equipmentId: string;
  type: EquipmentType;
  model: string;
  serialNumber: string;
  status: EquipmentStatus;
  siteId: string;
  operatorId: string;
  lat: number;
  lng: number;
  engineHours: number;
  operatingHours: number;
  idleHours: number;
  fuelLevel: number;
  healthScore: number;
  qrCode: string;
  qrPayload?: string;
  qrVersion?: number;
  temperature?: number;
  yearManufactured: number;
  hourlyRate: number;
  site?: Site;
  operator?: Operator;
  createdAt: string;
  updatedAt: string;
}

// Rental types
export type RentalStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'ACTIVE' | 'COMPLETED' | 'OVERDUE' | 'CANCELLED';

export interface Rental {
  _id: string;
  rentalId: string;
  requestId?: string;
  customerId?: string;
  equipmentId: string;
  operatorId: string;
  siteId: string;
  startDate?: string;
  checkoutDate: string;
  expectedReturnDate: string;
  actualReturnDate?: string;
  status: RentalStatus;
  checkoutEngineHours: number;
  checkinEngineHours?: number;
  checkoutFuelLevel: number;
  checkinFuelLevel?: number;
  rentalCost?: number;
  extensionCount: number;
  checkinNotes?: string;
  customerName?: string;
  contactPerson?: string;
  poNumber?: string;
  checkedOutBy: string;
  checkedInBy?: string;
  approvedBy?: string;
  approvedAt?: string;
  equipment?: Equipment;
  site?: Site;
  operator?: Operator;
}

// Rental Request types
export type RentalRequestStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface RentalRequest {
  _id: string;
  requestId: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  equipmentId: string;
  siteId: string;
  startDate: string;
  expectedReturnDate: string;
  estimatedCost: number;
  purpose?: string;
  notes?: string;
  status: RentalRequestStatus;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  rentalId?: string;
  equipment?: Equipment;
  site?: Site;
  createdAt: string;
  updatedAt: string;
}

// Extension Request types
export type ExtensionRequestStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

export interface ExtensionRequest {
  _id: string;
  extensionId: string;
  rentalId: string;
  customerId: string;
  equipmentId: string;
  currentReturnDate: string;
  requestedReturnDate: string;
  reason?: string;
  status: ExtensionRequestStatus;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  rental?: Rental;
  equipment?: Equipment;
  createdAt: string;
  updatedAt: string;
}

// Audit Log types
export interface AuditLog {
  _id: string;
  userId: string;
  role?: string;
  action: string;
  entity: string;
  entityId: string;
  timestamp: string;
  previousValue?: any;
  newValue?: any;
  ipAddress?: string;
  details?: string;
  createdAt: string;
}

// Site types
export type SiteStatus = 'ACTIVE' | 'INACTIVE';

export interface Site {
  _id: string;
  siteId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  geofenceRadius: number;
  activeRentals: number;
  status: SiteStatus;
}

// Operator types
export type OperatorStatus = 'AVAILABLE' | 'ASSIGNED' | 'ON_LEAVE';

export interface Operator {
  _id: string;
  operatorId: string;
  name: string;
  email: string;
  phone: string;
  qualification: EquipmentType[];
  assignedEquipmentId?: string;
  assignedSiteId?: string;
  status: OperatorStatus;
}

// Usage types
export interface UsageLog {
  _id: string;
  equipmentId: string;
  date: string;
  engineHours: number;
  operatingHours: number;
  idleHours: number;
  fuelConsumed: number;
  lat: number;
  lng: number;
  siteId: string;
  operatorId: string;
}

// Location types
export interface LocationLog {
  _id: string;
  equipmentId: string;
  timestamp: string;
  lat: number;
  lng: number;
  speed: number;
  siteId: string;
}

// Alert types
export type AlertType =
  | 'OVERDUE'
  | 'MAINTENANCE_DUE'
  | 'HEALTH_CRITICAL'
  | 'ANOMALY_HIGH_IDLE'
  | 'GEOFENCE_BREACH'
  | 'FUEL_RAPID_DROP'
  | 'TEMPERATURE_SPIKE'
  | 'PRESSURE_LOW'
  | 'UNAUTHORIZED_MOVEMENT';

export type AlertSeverity = 'CRITICAL' | 'HIGH' | 'WARNING' | 'INFO';
export type AlertStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface Alert {
  _id: string;
  alertId: string;
  type: AlertType;
  equipmentId: string;
  siteId?: string;
  severity: AlertSeverity;
  title?: string;
  message: string;
  currentValue?: string;
  threshold?: string;
  recommendation?: string;
  status: AlertStatus;
  isRead?: boolean;
  timestamp: string;
  createdAt?: string;
  resolvedAt?: string;
  resolvedBy?: string;
  equipment?: Equipment;
  site?: Site;
}

// Forecast types
export type ShortageRisk = 'LOW' | 'MEDIUM' | 'HIGH';

export interface Forecast {
  _id: string;
  siteId: string;
  equipmentType: EquipmentType;
  forecastDate: string;
  predictedDemand: number;
  confidence: number;
  shortageRisk: ShortageRisk;
  available: number;
  site?: Site;
}

// Anomaly types
export type AnomalyType = 'HIGH_IDLE_HOURS' | 'EXCESSIVE_FUEL_BURN' | 'TEMPERATURE_ANOMALY' | 'UNUSUAL_MOVEMENT_HOURS' | 'HEALTH_DEGRADATION';
export type AnomalySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Anomaly {
  _id: string;
  anomalyId: string;
  equipmentId: string;
  date?: string;
  timestamp?: string;
  anomalyType?: AnomalyType;
  detectionMethod?: string;
  severity: AnomalySeverity;
  anomalyScore?: number;
  score?: number;
  expectedValue?: number;
  actualValue?: number;
  explanation?: string;
  reasons?: string[];
  status?: string;
  featureImportance?: Record<string, number>;
  acknowledged?: boolean;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  equipment?: Equipment;
}

export interface SimulationScenario {
  id: string;
  name: string;
  description: string;
  triggerType: string;
  targetId: string;
  expectedOutcome: string;
}

// Recommendation types
export type RecommendationAction = 'REALLOCATE' | 'PRE_POSITION' | 'RETURN' | 'MAINTENANCE' | 'EXTEND_RENTAL';
export type RecommendationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXECUTED';

export interface Recommendation {
  _id: string;
  recommendationId: string;
  action: RecommendationAction;
  sourceEquipmentIds: string[];
  sourceSiteId?: string;
  targetSiteId: string;
  equipmentType: EquipmentType;
  reasons: string[];
  expectedImpact: {
    utilizationGain: number;
    shortageCoverage: number;
    costSaving: number;
  };
  score: number;
  status: RecommendationStatus;
  createdAt: string;
  equipment?: Equipment[];
  targetSite?: Site;
}

// Dashboard types
export interface DashboardKPIs {
  totalAssets: number;
  rented: number;
  available: number;
  overdue: number;
  underUtilized: number;
  avgUtilization: number;
  activeSites: number;
  inMaintenance: number;
}

// User/Auth types
export type UserRole = 'CUSTOMER' | 'ADMIN' | 'RENTAL_MANAGER' | 'SITE_MANAGER' | 'OPERATOR';

export interface User {
  _id: string;
  userId: string;
  email: string;
  name: string;
  role: UserRole;
  assignedSiteIds?: string[];
  companyName?: string;
  phone?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// API response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// Map Intelligence Types
export type SiteMatchStatus = 'MATCHED' | 'OUTSIDE_GEOFENCE' | 'WRONG_SITE' | 'NO_ASSIGNED_SITE' | 'STALE_TELEMETRY';

export interface SiteMatchInfo {
  detectedSiteId: string | null;
  detectedSiteName: string | null;
  siteMatchStatus: SiteMatchStatus;
  distanceFromAssignedSiteKm: number;
}

export interface SiteSummary {
  siteId: string;
  name: string;
  address: string;
  total: number;
  active: number;
  idle: number;
  available: number;
  risk: number;
  maintenance: number;
  avgUtilization: number;
  avgHealth: number;
  avgFuel: number;
}

export interface NearbyEquipmentResult {
  equipmentId: string;
  model: string;
  type: EquipmentType;
  currentSiteId: string;
  currentSiteName: string;
  distanceKm: number;
  utilization: number;
  health: number;
  status: EquipmentStatus;
}

export interface TrailPoint {
  lat: number;
  lng: number;
  timestamp: string;
  speed: number;
  siteId?: string;
}

export interface DwellInfo {
  siteId: string;
  siteName: string;
  dwellMinutes: number;
  dwellFormatted: string;
  activeMinutes: number;
  idleMinutes: number;
}

export interface TelemetryEvent {
  id: string;
  type: 'GPS_UPDATE' | 'FUEL_UPDATE' | 'ENGINE_UPDATE' | 'STATUS_CHANGE' | 'GEOFENCE_MATCH' | 'ALERT_CREATED' | 'SITE_DETECTED';
  equipmentId: string;
  message: string;
  timestamp: number;
  data?: any;
}
