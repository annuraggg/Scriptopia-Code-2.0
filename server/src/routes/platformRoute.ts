import { Hono } from "hono";
import { getPlatformFlags } from "@/services/featureFlags";
import { getAccess } from "@/services/subscriptionService";
import { sendSuccess } from "@/utils/sendResponse";

const app = new Hono();

app.get("/feature-flags", async (c) => {
  const auth = c.get("auth");
  return sendSuccess(
    c,
    200,
    "Feature flags fetched",
    await getPlatformFlags({ targetingKey: auth._id, email: auth.email })
  );
});

app.get("/subscription/access/:entitlement", async (c) => {
  const auth = c.get("auth");
  return sendSuccess(
    c,
    200,
    "Subscription access evaluated",
    await getAccess(
      { subjectType: "user", subjectId: auth._id },
      c.req.param("entitlement"),
      c.req.query("metric")
    )
  );
});

export default app;
