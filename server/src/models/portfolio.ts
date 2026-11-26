import { model, Schema, Types, type HydratedDocument } from "mongoose";

export type PublishState = "draft" | "published";
export type Visibility = "public" | "private";
export type ProjectStatus =
  | "planning"
  | "development"
  | "testing"
  | "completed"
  | "on_hold"
  | "cancelled";
export type SkillStatus = "learning" | "practicing" | "completed" | "needs_refresh";
export type AchievementType = "certificate" | "hackathon" | "training" | "education" | "award";
export type VerificationStatus = "owner_entered" | "evidence_provided";
export type CareerKind = "education" | "experience" | "learning";
export type GoalHorizon = "short" | "medium" | "long";
export type GoalStatus = "not_started" | "in_progress" | "completed" | "on_hold";
export type ContactMessageStatus = "new" | "read" | "archived";
export type AssetStorageProvider = "local" | "s3";

export interface TenantPortfolioRecord {
  tenantId: Types.ObjectId;
  publishState: PublishState;
  createdAt: Date;
  updatedAt: Date;
}

export interface Profile extends TenantPortfolioRecord {
  fullName: string;
  headline?: string;
  bio?: string;
  location?: string;
  avatarAsset?: Types.ObjectId | null;
  socialLinks: Array<{ label: string; url: string }>;
  contactEmail?: string;
  publicFields: { email: boolean; location: boolean };
  defaultLocale: string;
}

export interface Project extends TenantPortfolioRecord {
  title: string;
  slug: string;
  summary?: string;
  description?: string;
  techStack: string[];
  coverAsset?: Types.ObjectId | null;
  screenshots: Types.ObjectId[];
  liveUrl?: string;
  repoUrl?: string;
  status: ProjectStatus;
  featured: boolean;
  sortOrder: number;
}

export interface Skill extends TenantPortfolioRecord {
  name: string;
  category?: string;
  status: SkillStatus;
  progressSelfReported: number;
  evidenceProjectIds: Types.ObjectId[];
}

export interface Achievement extends TenantPortfolioRecord {
  title: string;
  type: AchievementType;
  issuer?: string;
  credentialId?: string;
  issueDate?: Date;
  expiryDate?: Date;
  verificationUrl?: string;
  verificationStatus: VerificationStatus;
  evidenceAsset?: Types.ObjectId | null;
  visibility: Visibility;
}

export interface CareerEntry extends TenantPortfolioRecord {
  kind: CareerKind;
  title: string;
  organization?: string;
  startDate?: Date;
  endDate?: Date;
  description?: string;
}

export interface Goal extends TenantPortfolioRecord {
  title: string;
  horizon: GoalHorizon;
  targetDate?: Date;
  status: GoalStatus;
  description?: string;
  relatedTechnologies: string[];
}

export interface ContactMessage extends TenantPortfolioRecord {
  name: string;
  email: string;
  subject: string;
  message: string;
  status: ContactMessageStatus;
  ipHash: string;
}

export interface Asset extends TenantPortfolioRecord {
  key: string;
  url: string;
  mimeType: "image/webp";
  width: number;
  height: number;
  sizeBytes: number;
  storageProvider: AssetStorageProvider;
}

export interface DemoSeedManifest extends TenantPortfolioRecord {
  seedKey: string;
  profileIds: Types.ObjectId[];
  projectIds: Types.ObjectId[];
  skillIds: Types.ObjectId[];
  achievementIds: Types.ObjectId[];
  careerEntryIds: Types.ObjectId[];
  goalIds: Types.ObjectId[];
}

export type ProfileDocument = HydratedDocument<Profile>;
export type ProjectDocument = HydratedDocument<Project>;
export type SkillDocument = HydratedDocument<Skill>;
export type AchievementDocument = HydratedDocument<Achievement>;
export type CareerEntryDocument = HydratedDocument<CareerEntry>;
export type GoalDocument = HydratedDocument<Goal>;
export type ContactMessageDocument = HydratedDocument<ContactMessage>;
export type AssetDocument = HydratedDocument<Asset>;

const tenantFields = {
  tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
  publishState: {
    type: String,
    enum: ["draft", "published"] as const,
    default: "draft" as PublishState,
    required: true,
  },
};

const profileSchema = new Schema<Profile>(
  {
    ...tenantFields,
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    headline: { type: String, trim: true, maxlength: 200 },
    bio: { type: String, maxlength: 20_000 },
    location: { type: String, trim: true, maxlength: 160 },
    avatarAsset: { type: Schema.Types.ObjectId, ref: "Asset", default: null },
    socialLinks: {
      type: [{ label: { type: String, required: true }, url: { type: String, required: true } }],
      default: [],
    },
    contactEmail: { type: String, lowercase: true, trim: true, maxlength: 254 },
    publicFields: {
      email: { type: Boolean, default: false, required: true },
      location: { type: Boolean, default: false, required: true },
    },
    defaultLocale: { type: String, default: "en", required: true, maxlength: 35 },
  },
  { timestamps: true },
);
profileSchema.index({ tenantId: 1 }, { unique: true });
profileSchema.index({ tenantId: 1, publishState: 1 });

const projectSchema = new Schema<Project>(
  {
    ...tenantFields,
    title: { type: String, required: true, trim: true, maxlength: 160 },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      maxlength: 80,
    },
    summary: { type: String, trim: true, maxlength: 400 },
    description: { type: String, maxlength: 20_000 },
    techStack: { type: [String], default: [] },
    coverAsset: { type: Schema.Types.ObjectId, ref: "Asset", default: null },
    screenshots: { type: [{ type: Schema.Types.ObjectId, ref: "Asset" }], default: [] },
    liveUrl: { type: String },
    repoUrl: { type: String },
    status: {
      type: String,
      enum: ["planning", "development", "testing", "completed", "on_hold", "cancelled"],
      default: "planning",
      required: true,
    },
    featured: { type: Boolean, default: false, required: true },
    sortOrder: { type: Number, default: 0, required: true },
  },
  { timestamps: true },
);
projectSchema.index({ tenantId: 1, slug: 1 }, { unique: true });
projectSchema.index({ tenantId: 1, publishState: 1, sortOrder: 1 });
projectSchema.index({ tenantId: 1, status: 1 });

const skillSchema = new Schema<Skill>(
  {
    ...tenantFields,
    name: { type: String, required: true, trim: true, maxlength: 100 },
    category: { type: String, trim: true, maxlength: 80 },
    status: {
      type: String,
      enum: ["learning", "practicing", "completed", "needs_refresh"],
      default: "learning",
      required: true,
    },
    progressSelfReported: { type: Number, min: 0, max: 100, default: 0, required: true },
    evidenceProjectIds: { type: [{ type: Schema.Types.ObjectId, ref: "Project" }], default: [] },
  },
  { timestamps: true },
);
skillSchema.index({ tenantId: 1, publishState: 1, category: 1 });
skillSchema.index({ tenantId: 1, status: 1 });

const achievementSchema = new Schema<Achievement>(
  {
    ...tenantFields,
    title: { type: String, required: true, trim: true, maxlength: 160 },
    type: {
      type: String,
      enum: ["certificate", "hackathon", "training", "education", "award"],
      required: true,
    },
    issuer: { type: String, trim: true, maxlength: 160 },
    credentialId: { type: String, trim: true, maxlength: 160 },
    issueDate: { type: Date },
    expiryDate: { type: Date },
    verificationUrl: { type: String },
    verificationStatus: {
      type: String,
      enum: ["owner_entered", "evidence_provided"],
      default: "owner_entered",
      required: true,
    },
    evidenceAsset: { type: Schema.Types.ObjectId, ref: "Asset", default: null },
    visibility: { type: String, enum: ["public", "private"], default: "private", required: true },
  },
  { timestamps: true },
);
achievementSchema.index({ tenantId: 1, publishState: 1, visibility: 1 });
achievementSchema.index({ tenantId: 1, type: 1 });

const careerEntrySchema = new Schema<CareerEntry>(
  {
    ...tenantFields,
    kind: { type: String, enum: ["education", "experience", "learning"], required: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    organization: { type: String, trim: true, maxlength: 160 },
    startDate: { type: Date },
    endDate: { type: Date },
    description: { type: String, maxlength: 10_000 },
  },
  { timestamps: true },
);
careerEntrySchema.index({ tenantId: 1, publishState: 1, kind: 1, startDate: -1 });

const goalSchema = new Schema<Goal>(
  {
    ...tenantFields,
    title: { type: String, required: true, trim: true, maxlength: 160 },
    horizon: { type: String, enum: ["short", "medium", "long"], required: true },
    targetDate: { type: Date },
    status: {
      type: String,
      enum: ["not_started", "in_progress", "completed", "on_hold"],
      default: "not_started",
      required: true,
    },
    description: { type: String, maxlength: 10_000 },
    relatedTechnologies: { type: [String], default: [] },
  },
  { timestamps: true },
);
goalSchema.index({ tenantId: 1, publishState: 1, horizon: 1 });
goalSchema.index({ tenantId: 1, status: 1, targetDate: 1 });

const contactMessageSchema = new Schema<ContactMessage>(
  {
    ...tenantFields,
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    subject: { type: String, required: true, trim: true, maxlength: 160 },
    message: { type: String, required: true, trim: true, maxlength: 5_000 },
    status: { type: String, enum: ["new", "read", "archived"], default: "new", required: true },
    ipHash: { type: String, required: true, select: false },
  },
  { timestamps: true },
);
contactMessageSchema.index({ tenantId: 1, status: 1, createdAt: -1 });
contactMessageSchema.index({ tenantId: 1, publishState: 1 });

const assetSchema = new Schema<Asset>(
  {
    ...tenantFields,
    key: { type: String, required: true, unique: true },
    url: { type: String, required: true },
    mimeType: { type: String, enum: ["image/webp"], default: "image/webp", required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    sizeBytes: { type: Number, required: true },
    storageProvider: { type: String, enum: ["local", "s3"], required: true },
  },
  { timestamps: true },
);
assetSchema.index({ tenantId: 1, key: 1 }, { unique: true });
assetSchema.index({ tenantId: 1, publishState: 1 });

const demoSeedManifestSchema = new Schema<DemoSeedManifest>(
  {
    ...tenantFields,
    seedKey: { type: String, required: true },
    profileIds: { type: [{ type: Schema.Types.ObjectId, ref: "Profile" }], default: [] },
    projectIds: { type: [{ type: Schema.Types.ObjectId, ref: "Project" }], default: [] },
    skillIds: { type: [{ type: Schema.Types.ObjectId, ref: "Skill" }], default: [] },
    achievementIds: { type: [{ type: Schema.Types.ObjectId, ref: "Achievement" }], default: [] },
    careerEntryIds: { type: [{ type: Schema.Types.ObjectId, ref: "CareerEntry" }], default: [] },
    goalIds: { type: [{ type: Schema.Types.ObjectId, ref: "Goal" }], default: [] },
  },
  { timestamps: true },
);
demoSeedManifestSchema.index({ tenantId: 1, seedKey: 1 }, { unique: true });

export const ProfileModel = model<Profile>("Profile", profileSchema);
export const ProjectModel = model<Project>("Project", projectSchema);
export const SkillModel = model<Skill>("Skill", skillSchema);
export const AchievementModel = model<Achievement>("Achievement", achievementSchema);
export const CareerEntryModel = model<CareerEntry>("CareerEntry", careerEntrySchema);
export const GoalModel = model<Goal>("Goal", goalSchema);
export const ContactMessageModel = model<ContactMessage>("ContactMessage", contactMessageSchema);
export const AssetModel = model<Asset>("Asset", assetSchema);
export const DemoSeedManifestModel = model<DemoSeedManifest>("DemoSeedManifest", demoSeedManifestSchema);
