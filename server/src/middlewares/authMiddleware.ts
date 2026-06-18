import { createMiddleware } from "hono/factory";
import type { Context } from "hono";
import { sendError } from "../utils/sendResponse";
import User from "@/models/User";
import { verifySessionToken } from "@/utils/auth";

const authMiddleware = createMiddleware(async (c: Context, next) => {
  if (c.req.path === "/health") return next();
  if (c.req.path.startsWith("/submissions")) return next();
  if (c.req.path.startsWith("/users/auth/login")) return next();
  if (c.req.path.startsWith("/users/auth/register")) return next();
  if (c.req.path.startsWith("/users/auth/forgot-password")) return next();
  if (c.req.path.startsWith("/users/auth/reset-password")) return next();
  if (c.req.path.startsWith("/ws")) return next();
  if (c.req.path.startsWith("/socket.io")) return next();

  if (c.req.path.startsWith("/assessments/verify")) return next();
  if (c.req.path.startsWith("/assessments/code/submit")) return next();
  if (c.req.path.startsWith("/assessments/submit/mcq")) return next();
  if (c.req.path.startsWith("/assessments/code/check-progress")) return next();
  if (c.req.path.startsWith("/assessments/mcq/check-progress")) return next();

  const authorization = c.req.header("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : undefined;

  if (!token) {
    return sendError(c, 401, "Request Unauthorized");
  }

  try {
    const claims = verifySessionToken(token);
    const user = await User.findById(claims.sub);
    if (!user) return sendError(c, 401, "Request Unauthorized");

    c.set("auth", {
      userId: user._id.toString(),
      _id: user._id.toString(),
      email: user.email,
      sessionId: claims.sessionId,
    });
    c.set("user", user);
  } catch {
    return sendError(c, 401, "Request Unauthorized");
  }

  return next();
});

export default authMiddleware;
