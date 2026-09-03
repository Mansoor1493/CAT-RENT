import mongoose, { Schema } from 'mongoose';

export type AnomalySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AnomalyStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
export type DetectionMethod = 'RULE_BASED' | 'ML_BASED';

export interface IAnomaly {
  equipmentId: string;
  timestamp: Date;
  score: number;
  severity: AnomalySeverity;
  reasons: string[];
  status: AnomalyStatus;
  detectionMethod: DetectionMethod;
  resolvedAt?: Date | null;
  resolvedBy?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const AnomalySchema = new Schema<IAnomaly>(
  {
    equipmentId: { type: String, required: true, index: true },
    timestamp: { type: Date, default: Date.now, index: true },
    score: { type: Number, required: true, min: 0, max: 1 },
    severity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM',
      required: true,
      index: true,
    },
    reasons: [{ type: String, required: true }],
    status: {
      type: String,
      enum: ['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'],
      default: 'ACTIVE',
      required: true,
      index: true,
    },
    detectionMethod: {
      type: String,
      enum: ['RULE_BASED', 'ML_BASED'],
      default: 'RULE_BASED',
      required: true,
    },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: String, default: null },
  },
  { timestamps: true }
);

AnomalySchema.index({ status: 1, severity: 1 });
AnomalySchema.index({ equipmentId: 1, status: 1 });

export const Anomaly = mongoose.model<IAnomaly>('Anomaly', AnomalySchema);
