import mongoose, { Schema } from 'mongoose';

export type AlertType =
  | 'MACHINE_OVERUSE'
  | 'HIGH_IDLE'
  | 'UNDER_UTILIZED'
  | 'HIGH_ENGINE_HOURS'
  | 'FUEL_ANOMALY'
  | 'TEMPERATURE_HIGH'
  | 'GEOFENCE_VIOLATION'
  | 'OVERDUE'
  | 'UNASSIGNED'
  | 'ANOMALY'
  | 'MAINTENANCE_DUE'
  | 'LOCATION_MISMATCH';

export type AlertSeverity = 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL' | 'LOW' | 'MEDIUM';
export type AlertStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface IAlert {
  alertId: string;
  alertKey?: string;
  type: AlertType;
  title?: string;
  equipmentId: string;
  siteId?: string | null;
  severity: AlertSeverity;
  message: string;
  currentValue?: number | string;
  threshold?: number | string;
  recommendation?: string;
  isRead?: boolean;
  status: AlertStatus;
  createdAt?: Date;
  resolvedAt?: Date | null;
  resolvedBy?: string | null;
}

const AlertSchema = new Schema<IAlert>(
  {
    alertId: { type: String, required: true, unique: true, index: true },
    alertKey: { type: String, default: null, index: true },
    type: {
      type: String,
      enum: [
        'MACHINE_OVERUSE',
        'HIGH_IDLE',
        'UNDER_UTILIZED',
        'HIGH_ENGINE_HOURS',
        'FUEL_ANOMALY',
        'TEMPERATURE_HIGH',
        'GEOFENCE_VIOLATION',
        'OVERDUE',
        'UNASSIGNED',
        'ANOMALY',
        'MAINTENANCE_DUE',
        'LOCATION_MISMATCH',
      ],
      required: true,
      index: true,
    },
    title: { type: String, default: '' },
    equipmentId: { type: String, required: true, index: true },
    siteId: { type: String, default: null, index: true },
    severity: {
      type: String,
      enum: ['INFO', 'WARNING', 'HIGH', 'CRITICAL', 'LOW', 'MEDIUM'],
      default: 'WARNING',
      required: true,
      index: true,
    },
    message: { type: String, required: true },
    currentValue: { type: Schema.Types.Mixed, default: null },
    threshold: { type: Schema.Types.Mixed, default: null },
    recommendation: { type: String, default: '' },
    isRead: { type: Boolean, default: false, index: true },
    status: {
      type: String,
      enum: ['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'],
      default: 'ACTIVE',
      required: true,
      index: true,
    },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: String, default: null },
  },
  { timestamps: true }
);

AlertSchema.index({ status: 1, severity: 1, createdAt: -1 });
AlertSchema.index({ equipmentId: 1, status: 1 });
AlertSchema.index({ alertKey: 1, status: 1 });
AlertSchema.index({ isRead: 1, status: 1 });

export const Alert = mongoose.model<IAlert>('Alert', AlertSchema);

