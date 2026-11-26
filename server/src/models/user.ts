import { Schema, model, type HydratedDocument } from "mongoose";

export type UserRole = "user" | "superadmin";

export interface User {
  email: string;
  passwordHash: string;
  role: UserRole;
  isVerified: boolean;
  verifyTokenHash?: string;
  verifyTokenExpiresAt?: Date;
  resetTokenHash?: string;
  resetTokenExpiresAt?: Date;
  failedLogins: number;
  lockedUntil?: Date;
  tokenVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

export type UserDocument = HydratedDocument<User>;

const userSchema = new Schema<User>(
  {
    email: { type: String, required: true, lowercase: true, trim: true, unique: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["user", "superadmin"], default: "user", required: true },
    isVerified: { type: Boolean, default: false, required: true },
    verifyTokenHash: { type: String, select: false },
    verifyTokenExpiresAt: { type: Date, select: false },
    resetTokenHash: { type: String, select: false },
    resetTokenExpiresAt: { type: Date, select: false },
    failedLogins: { type: Number, min: 0, default: 0, required: true },
    lockedUntil: { type: Date },
    tokenVersion: { type: Number, min: 0, default: 0, required: true },
  },
  { timestamps: true },
);

userSchema.index({ verifyTokenHash: 1 }, { unique: true, sparse: true });
userSchema.index({ resetTokenHash: 1 }, { unique: true, sparse: true });
userSchema.index(
  { role: 1 },
  { unique: true, partialFilterExpression: { role: "superadmin" } },
);

export const UserModel = model<User>("User", userSchema);
