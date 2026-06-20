import Plan from "@/models/Plan";
import Subscription from "@/models/Subscription";
import UsageRecord from "@/models/UsageRecord";
import { getBooleanFlag } from "@/services/featureFlags";

type Subject = {
  subjectType: "user" | "organization" | "institute";
  subjectId: string;
};

export const getAccess = async (
  subject: Subject,
  entitlement: string,
  metric?: string
) => {
  const enabled = await getBooleanFlag("subscription_enabled", {
    targetingKey: subject.subjectId,
    subjectType: subject.subjectType,
  });

  if (!enabled) {
    return { allowed: true, mode: "beta", entitlement, limit: null, used: 0 };
  }

  const subscription = await Subscription.findOne(subject).lean();
  if (!subscription || !["trialing", "active"].includes(subscription.state)) {
    return { allowed: false, mode: "subscription", reason: "inactive_subscription" };
  }

  const plan = await Plan.findOne({ key: subscription.planKey, active: true }).lean();
  if (!plan || !plan.entitlements.includes(entitlement)) {
    return { allowed: false, mode: "subscription", reason: "missing_entitlement" };
  }

  const limit = metric ? plan.limits?.[metric] ?? null : null;
  const period = new Date().toISOString().slice(0, 7);
  const usage = metric
    ? await UsageRecord.findOne({ ...subject, metric, period }).lean()
    : null;
  const used = usage?.quantity || 0;
  return {
    allowed: limit === null || used < limit,
    mode: "subscription",
    entitlement,
    limit,
    used,
  };
};

export const incrementUsage = async (subject: Subject, metric: string, quantity = 1) => {
  const period = new Date().toISOString().slice(0, 7);
  return UsageRecord.findOneAndUpdate(
    { ...subject, metric, period },
    { $inc: { quantity } },
    { upsert: true, new: true }
  );
};

export const billingProviderContract = {
  attachExternalSubscription: async (input: {
    subject: Subject;
    provider: string;
    providerReference: string;
    planKey: string;
  }) =>
    Subscription.findOneAndUpdate(
      input.subject,
      {
        planKey: input.planKey,
        state: "active",
        provider: input.provider,
        providerReference: input.providerReference,
      },
      { upsert: true, new: true }
    ),
};
