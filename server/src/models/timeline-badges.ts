import { model, Schema, Types, type HydratedDocument } from "mongoose";
import type { BadgeCriteriaRule } from "../../../shared/timeline-badges.js";
import type { ProjectStatus, Visibility } from "./portfolio.js";

export type MilestoneStatus = "pending" | "in_progress" | "done";
export type ReleaseChangeType = "added" | "changed" | "fixed" | "removed";
export type BadgeCategory =
  | "certificate"
  | "hackathon"
  | "project"
  | "learning"
  | "open_source"
  | "coding";
export type BadgeVerificationStatus = "owner_awarded" | "evidence_provided" | "issuer_verified";

export interface ProjectMilestone {
  tenantId: Types.ObjectId;
  projectId: Types.ObjectId;
  stage: ProjectStatus;
  title: string;
  description?: string;
  status: MilestoneStatus;
  startedAt?: Date;
  completedAt?: Date;
  notes?: string;
  evidenceUrl?: string;
  sortOrder: number;
  visibility: Visibility;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectRelease {
  tenantId: Types.ObjectId;
  projectId: Types.ObjectId;
  version: string;
  releaseDate: Date;
  summary: string;
  changes: Array<{ type: ReleaseChangeType; text: string }>;
  links: Array<{ label: string; url: string }>;
  assets: Types.ObjectId[];
  visibility: Visibility;
  createdAt: Date;
  updatedAt: Date;
}

export interface BadgeDefinition {
  tenantId: Types.ObjectId | null;
  key: string;
  title: string;
  category: BadgeCategory;
  criteriaText: string;
  criteriaRule?: BadgeCriteriaRule;
  iconKey: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserBadge {
  tenantId: Types.ObjectId;
  badgeDefinitionId: Types.ObjectId;
  publicId: string;
  issuedAt: Date;
  evidenceUrl?: string;
  evidenceNote?: string;
  verificationStatus: BadgeVerificationStatus;
  visibility: Visibility;
  revokedAt?: Date;
  revokedReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type ProjectMilestoneDocument = HydratedDocument<ProjectMilestone>;
export type ProjectReleaseDocument = HydratedDocument<ProjectRelease>;
export type BadgeDefinitionDocument = HydratedDocument<BadgeDefinition>;
export type UserBadgeDocument = HydratedDocument<UserBadge>;

const projectMilestoneSchema = new Schema<ProjectMilestone>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    stage: {
      type: String,
      enum: ["planning", "development", "testing", "completed", "on_hold", "cancelled"],
      required: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 5000 },
    status: { type: String, enum: ["pending", "in_progress", "done"], default: "pending", required: true },
    startedAt: { type: Date },
    completedAt: { type: Date },
    notes: { type: String, trim: true, maxlength: 5000 },
    evidenceUrl: { type: String },
    sortOrder: { type: Number, default: 0, required: true },
    visibility: { type: String, enum: ["public", "private"], default: "private", required: true },
  },
  { timestamps: true },
);
projectMilestoneSchema.index({ tenantId: 1, projectId: 1, sortOrder: 1, createdAt: 1 });
projectMilestoneSchema.index({ tenantId: 1, projectId: 1, visibility: 1, stage: 1 });

const projectReleaseSchema = new Schema<ProjectRelease>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    version: { type: String, required: true, trim: true, maxlength: 100 },
    releaseDate: { type: Date, required: true },
    summary: { type: String, required: true, trim: true, maxlength: 2000 },
    changes: {
      type: [{
        type: { type: String, enum: ["added", "changed", "fixed", "removed"], required: true },
        text: { type: String, required: true, trim: true, maxlength: 500 },
      }],
      default: [],
    },
    links: {
      type: [{
        label: { type: String, required: true, trim: true, maxlength: 80 },
        url: { type: String, required: true },
      }],
      default: [],
    },
    assets: { type: [{ type: Schema.Types.ObjectId, ref: "Asset" }], default: [] },
    visibility: { type: String, enum: ["public", "private"], default: "private", required: true },
  },
  { timestamps: true },
);
projectReleaseSchema.index({ tenantId: 1, projectId: 1, version: 1 }, { unique: true });
projectReleaseSchema.index({ tenantId: 1, projectId: 1, releaseDate: -1, version: -1 });
projectReleaseSchema.index({ tenantId: 1, projectId: 1, visibility: 1 });

const criteriaRuleSchema = new Schema<BadgeCriteriaRule>(
  {
    type: {
      type: String,
      enum: [
        "completed_projects",
        "published_projects",
        "projects_with_repo",
        "certificates_added",
        "completed_skills",
      ],
      required: true,
    },
    threshold: { type: Number, min: 1, max: 1000, required: true },
  },
  { _id: false },
);
const badgeDefinitionSchema = new Schema<BadgeDefinition>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", default: null },
    key: { type: String, required: true, lowercase: true, trim: true, maxlength: 80 },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    category: {
      type: String,
      enum: ["certificate", "hackathon", "project", "learning", "open_source", "coding"],
      required: true,
    },
    criteriaText: { type: String, required: true, trim: true, maxlength: 1000 },
    criteriaRule: { type: criteriaRuleSchema },
    iconKey: {
      type: String,
      enum: ["award", "certificate", "code", "github", "project", "star", "trophy", "book"],
      required: true,
    },
    active: { type: Boolean, default: true, required: true },
  },
  { timestamps: true },
);
badgeDefinitionSchema.index({ key: 1 }, { unique: true });
badgeDefinitionSchema.index({ tenantId: 1, active: 1 });

const userBadgeSchema = new Schema<UserBadge>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: "Tenant", required: true },
    badgeDefinitionId: { type: Schema.Types.ObjectId, ref: "BadgeDefinition", required: true },
    publicId: { type: String, required: true, unique: true, immutable: true },
    issuedAt: { type: Date, default: Date.now, required: true },
    evidenceUrl: { type: String },
    evidenceNote: { type: String, trim: true, maxlength: 1000 },
    verificationStatus: {
      type: String,
      enum: ["owner_awarded", "evidence_provided", "issuer_verified"],
      default: "owner_awarded",
      required: true,
    },
    visibility: { type: String, enum: ["public", "private"], default: "public", required: true },
    revokedAt: { type: Date },
    revokedReason: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true },
);
userBadgeSchema.index({ tenantId: 1, badgeDefinitionId: 1 }, { unique: true });
userBadgeSchema.index({ tenantId: 1, visibility: 1, revokedAt: 1, issuedAt: -1 });

export const ProjectMilestoneModel = model<ProjectMilestone>("ProjectMilestone", projectMilestoneSchema);
export const ProjectReleaseModel = model<ProjectRelease>("ProjectRelease", projectReleaseSchema);
export const BadgeDefinitionModel = model<BadgeDefinition>("BadgeDefinition", badgeDefinitionSchema);
export const UserBadgeModel = model<UserBadge>("UserBadge", userBadgeSchema);
