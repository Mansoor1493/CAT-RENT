import mongoose, { Schema } from 'mongoose';

export type ExtensionRequestStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

export interface IExtensionRequest {
  extensionId: string;
  rentalId: string;
  customerId: string;
  equipmentId: string;
  currentReturnDate: Date;
  requestedReturnDate: Date;
  reason?: string;
  status: ExtensionRequestStatus;
  approvedBy?: string;
  approvedAt?: Date;
  rejectedBy?: string;
  rejectedAt?: Date;
  rejectionReason?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const ExtensionRequestSchema = new Schema<IExtensionRequest>(
  {
    extensionId: { type: String, required: true, unique: true, index: true },
    rentalId: { type: String, required: true, index: true },
    customerId: { type: String, required: true, index: true },
    equipmentId: { type: String, required: true, index: true },
    currentReturnDate: { type: Date, required: true },
    requestedReturnDate: { type: Date, required: true },
    reason: { type: String, default: 'Project milestone extended' },
    status: {
      type: String,
      enum: ['PENDING_APPROVAL', 'APPROVED', 'REJECTED'],
      default: 'PENDING_APPROVAL',
      index: true,
    },
    approvedBy: { type: String, default: null },
    approvedAt: { type: Date, default: null },
    rejectedBy: { type: String, default: null },
    rejectedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: '' },
  },
  { timestamps: true }
);

ExtensionRequestSchema.index({ rentalId: 1, status: 1 });
ExtensionRequestSchema.index({ customerId: 1, status: 1 });

export const ExtensionRequest = mongoose.model<IExtensionRequest>('ExtensionRequest', ExtensionRequestSchema);
