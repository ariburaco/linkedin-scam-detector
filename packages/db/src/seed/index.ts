/**
 * Database Seed Script
 * Seeds feature flags with default values
 */

import {
  DEFAULT_FEATURE_FLAGS,
  FEATURE_FLAG_KEYS,
} from "@acme/shared/feature-flags";

import prisma from "../index";

/**
 * Seed feature flags
 * Upserts (inserts or updates) feature flags with default values
 */
async function seedFeatureFlags() {
  console.log("🌱 Seeding feature flags...");

  const flags = [
    {
      key: FEATURE_FLAG_KEYS.JOB_EXTRACTION,
      enabled: DEFAULT_FEATURE_FLAGS[FEATURE_FLAG_KEYS.JOB_EXTRACTION],
    },
    {
      key: FEATURE_FLAG_KEYS.JOB_EMBEDDINGS,
      enabled: DEFAULT_FEATURE_FLAGS[FEATURE_FLAG_KEYS.JOB_EMBEDDINGS],
    },
    {
      key: FEATURE_FLAG_KEYS.JOB_DISCOVERY,
      enabled: DEFAULT_FEATURE_FLAGS[FEATURE_FLAG_KEYS.JOB_DISCOVERY],
    },
  ];

  for (const flag of flags) {
    // Check if flag exists before upserting to determine if it was created or updated
    const existing = await prisma.featureFlag.findUnique({
      where: { key: flag.key },
    });

    const result = await prisma.featureFlag.upsert({
      where: { key: flag.key },
      update: {
        enabled: flag.enabled,
        // updatedAt is auto-managed by Prisma @updatedAt
      },
      create: {
        key: flag.key,
        enabled: flag.enabled,
      },
    });

    const action = existing ? "updated" : "created";
    console.log(
      `  ✓ ${flag.key}: ${result.enabled ? "enabled" : "disabled"} (${action})`
    );
  }

  console.log("✅ Feature flags seeded successfully!");
}

/**
 * Main seed function
 */
async function main() {
  try {
    await seedFeatureFlags();
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run seed if executed directly
if (import.meta.main) {
  main();
}

export { seedFeatureFlags };
