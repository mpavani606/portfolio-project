import { Schema, model, Types, type HydratedDocument } from "mongoose";

export interface Session {
  sessionIdHash: string;
  userId: Types.ObjectId;
  tenantId: Types.ObjectId | null;
  expiresAt: Date;
  userAgent?: string;
  tokenVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

export type SessionDocument = HydratedDocument<Session>;

const sessionSchema = new Schema<Session>(
  {
    sessionIdHash: { type: String, required: true, unique: true, select: false },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", default: null, index: true },
    expiresAt: { type: Date, required: true },
    userAgent: { type: String, maxlength: 512 },
    tokenVersion: { type: Number, default: 0, required: true },
  },
  { timestamps: true },
);

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
sessionSchema.index({ userId: 1, expiresAt: 1 });

export const SessionModel = model<Session>("Session", sessionSchema);
