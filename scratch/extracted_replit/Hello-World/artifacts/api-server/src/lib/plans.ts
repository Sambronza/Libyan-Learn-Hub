/**
 * Teacher Subscription Plan Definitions
 * Defines storage limits and live session duration caps for each tier.
 */

export type TeacherTier = "free" | "bronze" | "golden" | "diamond";

export interface PlanConfig {
  label: string;
  pricePerMonthLYD: number;
  storageLimitBytes: number;
  sessionDurationLimitMinutes: number; // 0 for unlimited
  bonusStorageBytes: number;     // awarded when student threshold is reached
  studentBonusThreshold: number; // how many students unlock the bonus
}

const GB = 1024 * 1024 * 1024;
const STUDENT_BONUS_THRESHOLD = 100;
const STANDARD_BONUS_BYTES = 10 * GB;
const DIAMOND_BONUS_BYTES = 150 * GB;

export const PLANS: Record<TeacherTier, PlanConfig> = {
  free: {
    label: "Free",
    pricePerMonthLYD: 0,
    storageLimitBytes: 5 * GB,
    sessionDurationLimitMinutes: 30,
    bonusStorageBytes: STANDARD_BONUS_BYTES,
    studentBonusThreshold: STUDENT_BONUS_THRESHOLD,
  },
  bronze: {
    label: "Bronze",
    pricePerMonthLYD: 30,
    storageLimitBytes: 25 * GB,
    sessionDurationLimitMinutes: 45,
    bonusStorageBytes: STANDARD_BONUS_BYTES,
    studentBonusThreshold: STUDENT_BONUS_THRESHOLD,
  },
  golden: {
    label: "Golden",
    pricePerMonthLYD: 50,
    storageLimitBytes: 50 * GB,
    sessionDurationLimitMinutes: 90,
    bonusStorageBytes: STANDARD_BONUS_BYTES,
    studentBonusThreshold: STUDENT_BONUS_THRESHOLD,
  },
  diamond: {
    label: "Diamond",
    pricePerMonthLYD: 100,
    storageLimitBytes: 100 * GB,
    sessionDurationLimitMinutes: 0, // Unlimited
    bonusStorageBytes: DIAMOND_BONUS_BYTES,
    studentBonusThreshold: STUDENT_BONUS_THRESHOLD,
  },
};

/**
 * Returns the effective storage limit for a teacher,
 * adding the bonus if they have unlocked it.
 */
export function getEffectiveStorageLimit(tier: TeacherTier, isBonusUnlocked: boolean): number {
  const plan = PLANS[tier];
  return plan.storageLimitBytes + (isBonusUnlocked ? plan.bonusStorageBytes : 0);
}

/**
 * Returns the session duration limit (in minutes) for a given tier.
 */
export function getSessionDurationLimit(tier: TeacherTier): number {
  return PLANS[tier].sessionDurationLimitMinutes;
}

