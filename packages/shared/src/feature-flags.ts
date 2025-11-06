/**
 * Feature Flags
 * Centralized feature flag keys and types
 */

export const FEATURE_FLAG_KEYS = {
  JOB_EXTRACTION: 'job_extraction',
  JOB_EMBEDDINGS: 'job_embeddings',
  JOB_DISCOVERY: 'job_discovery',
} as const;

export type FeatureFlagKey =
  (typeof FEATURE_FLAG_KEYS)[keyof typeof FEATURE_FLAG_KEYS];

export interface FeatureFlags {
  [FEATURE_FLAG_KEYS.JOB_EXTRACTION]: boolean;
  [FEATURE_FLAG_KEYS.JOB_EMBEDDINGS]: boolean;
  [FEATURE_FLAG_KEYS.JOB_DISCOVERY]: boolean;
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  [FEATURE_FLAG_KEYS.JOB_EXTRACTION]: true,
  [FEATURE_FLAG_KEYS.JOB_EMBEDDINGS]: true,
  [FEATURE_FLAG_KEYS.JOB_DISCOVERY]: true,
};

