import mongoose, { Schema } from 'mongoose';

export type RentalRequestStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface IRentalRequest {
  requestId: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  equipmentId: string;
  siteId: string;
  startDate: Date;
  expectedReturnDate: Date;
  estimatedCost: number;
  purpose?: string;
  notes?: string;
  status: RentalRequestStatus;
  approvedBy?: string;
  approvedAt?: Date;
  rejectedBy?: string;
  rejectedAt?: Date;
  rejectionReason?: string;
  rentalId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const RentalRequestSchema = new Schema<IRentalRequest>(
  {
    requestId: { type: String, required: true, unique: true, index: true },
    customerId: { type: String, required: true, index: true },
    customerName: { type: String, required: true },
    customerEmail: { type: String, default: '' },
    equipmentId: { type: String, required: true, index: true },
    siteId: { type: String, required: true, index: true },
    startDate: { type: Date, required: true },
    expectedReturnDate: { type: Date, required: true },
    estimatedCost: { type: Number, required: true, default: 0 },
    purpose: { type: String, default: 'Industrial Site Operations' },
    notes: { type: String, default: '' },
    status: {
      type: String,
      enum: ['PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED'],
      default: 'PENDING_APPROVAL',
      index: true,
    },
    approvedBy: { type: String, default: null },
    approvedAt: { type: Date, default: null },
    rejectedBy: { type: String, default: null },
    rejectedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: '' },
    rentalId: { type: String, default: null },
  },
  { timestamps: true }
);

RentalRequestSchema.index({ customerId: 1, status: 1 });
RentalRequestSchema.index({ equipmentId: 1, status: 1 });
RentalRequestSchema.index({ createdAt: -1 });

export const RentalRequest = mongoose.model<IRentalRequest>('RentalRequest', RentalRequestSchema);
