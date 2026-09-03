import mongoose, { Schema } from 'mongoose';
import { EquipmentType } from './Equipment';

export type RecommendationAction =
  | 'REALLOCATE'
  | 'PRE_POSITION'
  | 'RETURN'
  | 'MAINTENANCE'
  | 'EXTEND_RENTAL';

export type RecommendationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXECUTED';

export interface IRecommendation {
  recommendationId: string;
  action: RecommendationAction;
  sourceEquipmentIds: string[];
  sourceSiteId?: string | null;
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
  createdAt?: Date;
  updatedAt?: Date;
}

const RecommendationSchema = new Schema<IRecommendation>(
  {
    recommendationId: { type: String, required: true, unique: true, index: true },
    action: {
      type: String,
      enum: ['REALLOCATE', 'PRE_POSITION', 'RETURN', 'MAINTENANCE', 'EXTEND_RENTAL'],
      default: 'REALLOCATE',
      required: true,
      index: true,
    },
    sourceEquipmentIds: [{ type: String, required: true }],
    sourceSiteId: { type: String, default: null },
    targetSiteId: { type: String, required: true, index: true },
    equipmentType: {
      type: String,
      enum: ['Excavator', 'Loader', 'Dozer', 'Crane', 'Dump Truck', 'Grader', 'Compactor'],
      required: true,
    },
    reasons: [{ type: String, required: true }],
    expectedImpact: {
      utilizationGain: { type: Number, default: 0 },
      shortageCoverage: { type: Number, default: 0 },
      costSaving: { type: Number, default: 0 },
    },
    score: { type: Number, required: true, default: 50 },
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'EXECUTED'],
      default: 'PENDING',
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

export const Recommendation = mongoose.model<IRecommendation>(
  'Recommendation',
  RecommendationSchema
);
