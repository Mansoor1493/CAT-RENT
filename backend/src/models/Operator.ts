import mongoose, { Schema } from 'mongoose';

export type OperatorStatus = 'AVAILABLE' | 'ASSIGNED' | 'ON_LEAVE';

export interface IOperator {
  operatorId: string;
  name: string;
  email: string;
  phone: string;
  qualification: string[];
  assignedEquipmentId?: string | null;
  assignedSiteId?: string | null;
  status: OperatorStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

const OperatorSchema = new Schema<IOperator>(
  {
    operatorId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    phone: { type: String, required: true },
    qualification: [{ type: String, required: true }],
    assignedEquipmentId: { type: String, default: null, index: true },
    assignedSiteId: { type: String, default: null, index: true },
    status: {
      type: String,
      enum: ['AVAILABLE', 'ASSIGNED', 'ON_LEAVE'],
      default: 'AVAILABLE',
      index: true,
    },
  },
  { timestamps: true }
);

export const Operator = mongoose.model<IOperator>('Operator', OperatorSchema);
