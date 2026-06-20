export type SubscriptionState =
  | "trialing"
  | "active"
  | "past_due"
  | "paused"
  | "canceled"
  | "expired";

export type EntitlementKey =
  | "campus"
  | "enterprise"
  | "code"
  | "meet"
  | "analytics"
  | "assessments"
  | "interviews"
  | "unlimited_members";

export interface PlanDefinition {
  key: string;
  name: string;
  description: string;
  entitlements: EntitlementKey[];
  limits: Record<string, number | null>;
  active: boolean;
}

export interface SubscriptionContract {
  subjectType: "user" | "organization" | "institute";
  subjectId: string;
  planKey: string;
  state: SubscriptionState;
  startsAt: Date;
  currentPeriodEndsAt?: Date;
  provider?: string;
  providerReference?: string;
}

export interface FeatureFlags {
  subscription_enabled: boolean;
}
