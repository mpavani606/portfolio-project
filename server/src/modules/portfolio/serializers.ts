import type {
  AchievementDocument,
  AssetDocument,
  CareerEntryDocument,
  ContactMessageDocument,
  GoalDocument,
  ProfileDocument,
  ProjectDocument,
  SkillDocument,
} from "../../models/portfolio.js";
import type {
  BadgeDefinitionDocument,
  ProjectMilestoneDocument,
  ProjectReleaseDocument,
  UserBadgeDocument,
} from "../../models/timeline-badges.js";

export function profileOwnerDto(profile: ProfileDocument) {
  return {
    id: profile._id.toString(),
    fullName: profile.fullName,
    headline: profile.headline ?? null,
    bio: profile.bio ?? null,
    location: profile.location ?? null,
    avatarAsset: profile.avatarAsset?.toString() ?? null,
    socialLinks: profile.socialLinks.map(({ label, url }) => ({ label, url })),
    contactEmail: profile.contactEmail ?? null,
    publicFields: { email: profile.publicFields.email, location: profile.publicFields.location },
    defaultLocale: profile.defaultLocale,
    publishState: profile.publishState,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

export function projectOwnerDto(project: ProjectDocument) {
  return {
    id: project._id.toString(),
    title: project.title,
    slug: project.slug,
    summary: project.summary ?? null,
    description: project.description ?? null,
    techStack: [...project.techStack],
    coverAsset: project.coverAsset?.toString() ?? null,
    screenshots: project.screenshots.map((assetId) => assetId.toString()),
    liveUrl: project.liveUrl ?? null,
    repoUrl: project.repoUrl ?? null,
    status: project.status,
    featured: project.featured,
    sortOrder: project.sortOrder,
    publishState: project.publishState,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

export function skillOwnerDto(skill: SkillDocument) {
  return {
    id: skill._id.toString(),
    name: skill.name,
    category: skill.category ?? null,
    status: skill.status,
    progressSelfReported: skill.progressSelfReported,
    evidenceProjectIds: skill.evidenceProjectIds.map((id) => id.toString()),
    publishState: skill.publishState,
    createdAt: skill.createdAt.toISOString(),
    updatedAt: skill.updatedAt.toISOString(),
  };
}

export function achievementOwnerDto(achievement: AchievementDocument) {
  return {
    id: achievement._id.toString(),
    title: achievement.title,
    type: achievement.type,
    issuer: achievement.issuer ?? null,
    credentialId: achievement.credentialId ?? null,
    issueDate: achievement.issueDate?.toISOString() ?? null,
    expiryDate: achievement.expiryDate?.toISOString() ?? null,
    verificationUrl: achievement.verificationUrl ?? null,
    verificationStatus: achievement.verificationStatus,
    evidenceAsset: achievement.evidenceAsset?.toString() ?? null,
    visibility: achievement.visibility,
    publishState: achievement.publishState,
    createdAt: achievement.createdAt.toISOString(),
    updatedAt: achievement.updatedAt.toISOString(),
  };
}

export function careerEntryOwnerDto(entry: CareerEntryDocument) {
  return {
    id: entry._id.toString(),
    kind: entry.kind,
    title: entry.title,
    organization: entry.organization ?? null,
    startDate: entry.startDate?.toISOString() ?? null,
    endDate: entry.endDate?.toISOString() ?? null,
    description: entry.description ?? null,
    publishState: entry.publishState,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}

export function goalOwnerDto(goal: GoalDocument) {
  return {
    id: goal._id.toString(),
    title: goal.title,
    horizon: goal.horizon,
    targetDate: goal.targetDate?.toISOString() ?? null,
    status: goal.status,
    description: goal.description ?? null,
    relatedTechnologies: [...goal.relatedTechnologies],
    publishState: goal.publishState,
    createdAt: goal.createdAt.toISOString(),
    updatedAt: goal.updatedAt.toISOString(),
  };
}

export function assetDto(asset: AssetDocument) {
  return {
    assetId: asset._id.toString(),
    key: asset.key,
    url: asset.url,
    width: asset.width,
    height: asset.height,
  };
}

export function contactMessageOwnerDto(message: ContactMessageDocument) {
  return {
    id: message._id.toString(),
    name: message.name,
    email: message.email,
    subject: message.subject,
    message: message.message,
    status: message.status,
    createdAt: message.createdAt.toISOString(),
    updatedAt: message.updatedAt.toISOString(),
  };
}

export function publicProfileDto(
  profile: ProfileDocument,
  avatarUrl: string | null,
) {
  return {
    fullName: profile.fullName,
    headline: profile.headline ?? null,
    bio: profile.bio ?? null,
    ...(profile.publicFields.location ? { location: profile.location ?? null } : {}),
    ...(profile.publicFields.email && profile.contactEmail
      ? { contactEmail: profile.contactEmail }
      : {}),
    avatarUrl,
    socialLinks: profile.socialLinks.map(({ label, url }) => ({ label, url })),
    defaultLocale: profile.defaultLocale,
  };
}

export function publicProjectDto(
  project: ProjectDocument,
  assetUrls: ReadonlyMap<string, string>,
) {
  return {
    title: project.title,
    slug: project.slug,
    summary: project.summary ?? null,
    description: project.description ?? null,
    techStack: [...project.techStack],
    coverUrl: project.coverAsset ? assetUrls.get(project.coverAsset.toString()) ?? null : null,
    screenshotUrls: project.screenshots.map((assetId) => assetUrls.get(assetId.toString())).filter(
      (url): url is string => url !== undefined,
    ),
    liveUrl: project.liveUrl ?? null,
    repoUrl: project.repoUrl ?? null,
    status: project.status,
    featured: project.featured,
  };
}

export function publicSkillDto(skill: SkillDocument) {
  return {
    name: skill.name,
    category: skill.category ?? null,
    status: skill.status,
    progressSelfReported: skill.progressSelfReported,
  };
}

export function publicAchievementDto(
  achievement: AchievementDocument,
  evidenceUrl: string | null,
) {
  return {
    title: achievement.title,
    type: achievement.type,
    issuer: achievement.issuer ?? null,
    credentialId: achievement.credentialId ?? null,
    issueDate: achievement.issueDate?.toISOString() ?? null,
    expiryDate: achievement.expiryDate?.toISOString() ?? null,
    verificationUrl: achievement.verificationUrl ?? null,
    verificationStatus: achievement.verificationStatus,
    evidenceUrl,
  };
}

export function publicCareerEntryDto(entry: CareerEntryDocument) {
  return {
    kind: entry.kind,
    title: entry.title,
    organization: entry.organization ?? null,
    startDate: entry.startDate?.toISOString() ?? null,
    endDate: entry.endDate?.toISOString() ?? null,
    description: entry.description ?? null,
  };
}

export function publicGoalDto(goal: GoalDocument) {
  return {
    title: goal.title,
    horizon: goal.horizon,
    targetDate: goal.targetDate?.toISOString() ?? null,
    status: goal.status,
    description: goal.description ?? null,
    relatedTechnologies: [...goal.relatedTechnologies],
  };
}

export function projectMilestoneOwnerDto(milestone: ProjectMilestoneDocument) {
  return {
    id: milestone._id.toString(),
    projectId: milestone.projectId.toString(),
    stage: milestone.stage,
    title: milestone.title,
    description: milestone.description ?? null,
    status: milestone.status,
    startedAt: milestone.startedAt?.toISOString() ?? null,
    completedAt: milestone.completedAt?.toISOString() ?? null,
    notes: milestone.notes ?? null,
    evidenceUrl: milestone.evidenceUrl ?? null,
    sortOrder: milestone.sortOrder,
    visibility: milestone.visibility,
    createdAt: milestone.createdAt.toISOString(),
    updatedAt: milestone.updatedAt.toISOString(),
  };
}

export function projectMilestonePublicDto(milestone: ProjectMilestoneDocument) {
  return {
    stage: milestone.stage,
    title: milestone.title,
    description: milestone.description ?? null,
    status: milestone.status,
    startedAt: milestone.startedAt?.toISOString() ?? null,
    completedAt: milestone.completedAt?.toISOString() ?? null,
    evidenceUrl: milestone.evidenceUrl ?? null,
    sortOrder: milestone.sortOrder,
  };
}

export function projectReleaseOwnerDto(release: ProjectReleaseDocument) {
  return {
    id: release._id.toString(),
    projectId: release.projectId.toString(),
    version: release.version,
    releaseDate: release.releaseDate.toISOString(),
    summary: release.summary,
    changes: release.changes.map(({ type, text }) => ({ type, text })),
    links: release.links.map(({ label, url }) => ({ label, url })),
    assets: release.assets.map((id) => id.toString()),
    visibility: release.visibility,
    createdAt: release.createdAt.toISOString(),
    updatedAt: release.updatedAt.toISOString(),
  };
}

export function projectReleasePublicDto(
  release: ProjectReleaseDocument,
  assetUrls: ReadonlyMap<string, string>,
) {
  return {
    version: release.version,
    releaseDate: release.releaseDate.toISOString(),
    summary: release.summary,
    changes: release.changes.map(({ type, text }) => ({ type, text })),
    links: release.links.map(({ label, url }) => ({ label, url })),
    assets: release.assets.map((id) => assetUrls.get(id.toString())).filter(
      (url): url is string => url !== undefined,
    ),
  };
}

export function badgeDefinitionDto(definition: BadgeDefinitionDocument) {
  return {
    id: definition._id.toString(),
    key: definition.key,
    title: definition.title,
    category: definition.category,
    criteriaText: definition.criteriaText,
    criteriaRule: definition.criteriaRule
      ? { type: definition.criteriaRule.type, threshold: definition.criteriaRule.threshold }
      : null,
    iconKey: definition.iconKey,
    active: definition.active,
    platformWide: definition.tenantId === null,
  };
}

export function userBadgeOwnerDto(
  badge: UserBadgeDocument,
  definition: BadgeDefinitionDocument | null,
) {
  return {
    id: badge._id.toString(),
    publicId: badge.publicId,
    definition: definition ? badgeDefinitionDto(definition) : null,
    issuedAt: badge.issuedAt.toISOString(),
    evidenceUrl: badge.evidenceUrl ?? null,
    evidenceNote: badge.evidenceNote ?? null,
    verificationStatus: badge.verificationStatus,
    visibility: badge.visibility,
    revokedAt: badge.revokedAt?.toISOString() ?? null,
    revokedReason: badge.revokedReason ?? null,
  };
}

export function userBadgePublicDto(
  badge: UserBadgeDocument,
  definition: BadgeDefinitionDocument,
) {
  return {
    publicId: badge.publicId,
    key: definition.key,
    title: definition.title,
    category: definition.category,
    criteriaText: definition.criteriaText,
    iconKey: definition.iconKey,
    issuedAt: badge.issuedAt.toISOString(),
    evidenceUrl: badge.evidenceUrl ?? null,
    verificationStatus: badge.verificationStatus,
  };
}
