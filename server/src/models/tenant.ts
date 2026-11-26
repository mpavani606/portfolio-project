import { Schema, model, Types, type HydratedDocument } from "mongoose";

export type TenantStatus = "active" | "suspended";

export interface Tenant {
  ownerId: Types.ObjectId;
  slug: string;
  displayName: string;
  status: TenantStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type TenantDocument = HydratedDocument<Tenant>;

const tenantSchema = new Schema<Tenant>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      minlength: 3,
      maxlength: 30,
    },
    displayName: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    status: { type: String, enum: ["active", "suspended"], default: "active", required: true },
  },
  { timestamps: true },
);

tenantSchema.index({ ownerId: 1 }, { unique: true });
tenantSchema.index({ slug: 1 }, { unique: true });

export const TenantModel = model<Tenant>("Tenant", tenantSchema);
