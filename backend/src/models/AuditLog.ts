import mongoose, { Schema } from 'mongoose';

export interface IAuditLog {
  userId: string;
  role?: string;
  action: string;
  entity: string;
  entityId: string;
  timestamp: Date;
  previousValue?: any;
  newValue?: any;
  ipAddress?: string;
  details?: string;
  createdAt?: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    userId: { type: String, required: true, index: true },
    role: { type: String, default: 'USER', index: true },
    action: { type: String, required: true, index: true },
    entity: { type: String, required: true, index: true },
    entityId: { type: String, required: true, index: true },
    timestamp: { type: Date, default: Date.now, index: true },
    previousValue: { type: Schema.Types.Mixed, default: null },
    newValue: { type: Schema.Types.Mixed, default: null },
    ipAddress: { type: String, default: '' },
    details: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AuditLogSchema.index({ entity: 1, entityId: 1, timestamp: -1 });
AuditLogSchema.index({ userId: 1, timestamp: -1 });
AuditLogSchema.index({ action: 1, timestamp: -1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
