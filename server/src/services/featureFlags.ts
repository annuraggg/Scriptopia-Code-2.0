import { FlagshipServerProvider } from "@cloudflare/flagship/server";
import { OpenFeature } from "@openfeature/server-sdk";
import logger from "@/utils/logger";

export const featureFlagDefaults = {
  subscription_enabled: false,
} as const;

let initialized = false;

const initialize = async () => {
  if (initialized) return true;
  const appId = process.env.CLOUDFLARE_FLAGSHIP_APP_ID;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const authToken = process.env.CLOUDFLARE_FLAGSHIP_API_TOKEN;
  if (!appId || !accountId || !authToken) return false;

  try {
    await OpenFeature.setProviderAndWait(
      new FlagshipServerProvider({ appId, accountId, authToken }),
    );
    initialized = true;
    return true;
  } catch (error) {
    logger.warn(
      `Cloudflare Flagship unavailable; safe defaults active: ${error}`,
    );
    return false;
  }
};

export const getBooleanFlag = async (
  key: keyof typeof featureFlagDefaults,
  context: Record<string, string> = {},
) => {
  if (!(await initialize())) return featureFlagDefaults[key];
  return OpenFeature.getClient().getBooleanValue(
    key,
    featureFlagDefaults[key],
    {
      targetingKey: context.targetingKey || "anonymous",
      ...context,
    },
  );
};

export const getPlatformFlags = async (
  context: Record<string, string> = {},
) => ({
  subscription_enabled: await getBooleanFlag("subscription_enabled", context),
});
