import { createMiddleware } from "hono/factory";
import { sendError } from "@/utils/sendResponse";
import { getAccess } from "@/services/subscriptionService";

export const requireEntitlement = (entitlement: string, metric?: string) =>
  createMiddleware(async (c, next) => {
    const auth = c.get("auth");
    const access = await getAccess(
      { subjectType: "user", subjectId: auth._id },
      entitlement,
      metric
    );
    if (!access.allowed) return sendError(c, 403, "Feature unavailable", access);
    c.set("subscriptionAccess", access);
    return next();
  });
