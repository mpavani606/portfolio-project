import { Types } from "mongoose";
import { BadgeDefinitionModel } from "../../models/timeline-badges.js";
import type { BadgeDefinitionInput } from "../../../../shared/timeline-badges.js";

const platformBadges: BadgeDefinitionInput[] = [
  {
    key: "first-project-completed",
    title: "First Project Completed",
    category: "project",
    criteriaText: "Complete and publish one project.",
    criteriaRule: { type: "completed_projects", threshold: 1 },
    iconKey: "project",
    active: true,
  },
  {
    key: "three-projects-completed",
    title: "Three Projects Completed",
    category: "project",
    criteriaText: "Complete and publish three projects.",
    criteriaRule: { type: "completed_projects", threshold: 3 },
    iconKey: "trophy",
    active: true,
  },
  {
    key: "first-certificate-added",
    title: "First Certificate Added",
    category: "certificate",
    criteriaText: "Add and publish one public certificate.",
    criteriaRule: { type: "certificates_added", threshold: 1 },
    iconKey: "certificate",
    active: true,
  },
  {
    key: "first-skill-completed",
    title: "First Skill Completed",
    category: "learning",
    criteriaText: "Mark one skill completed and publish it.",
    criteriaRule: { type: "completed_skills", threshold: 1 },
    iconKey: "book",
    active: true,
  },
  {
    key: "first-project-published",
    title: "First Project Published",
    category: "coding",
    criteriaText: "Publish one project in your portfolio.",
    criteriaRule: { type: "published_projects", threshold: 1 },
    iconKey: "star",
    active: true,
  },
  {
    key: "open-source-contributor",
    title: "Open-Source Contributor",
    category: "open_source",
    criteriaText: "Award only after reviewing evidence of an actual contribution to a public repository.",
    iconKey: "github",
    active: true,
  },
];

export async function seedPlatformBadges(): Promise<void> {
  for (const badge of platformBadges) {
    await BadgeDefinitionModel.updateOne(
      { key: badge.key, tenantId: null },
      {
        $setOnInsert: {
          ...badge,
          tenantId: null as Types.ObjectId | null,
        },
      },
      { upsert: true },
    );
  }
}
