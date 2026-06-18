import { Context } from "hono";
import User from "@/models/User";
import { sendError, sendSuccess } from "@/utils/sendResponse";
import { createOpaqueToken, hashPassword, verifyPassword } from "@/utils/password";
import { getUserMetadata, signSessionToken } from "@/utils/auth";
import logger from "@/utils/logger";

const publicUser = async (user: any) => ({
  _id: user._id.toString(),
  id: user._id.toString(),
  email: user.email,
  emailAddresses: [{ id: user._id.toString(), emailAddress: user.email }],
  primaryEmailAddress: { id: user._id.toString(), emailAddress: user.email },
  firstName: user.firstName || user.name?.split(" ")[0] || "",
  lastName: user.lastName || user.name?.split(" ").slice(1).join(" ") || "",
  fullName: user.name || [user.firstName, user.lastName].filter(Boolean).join(" "),
  imageUrl: user.imageUrl || "",
  publicMetadata: await getUserMetadata(user._id.toString()),
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  lastLoginAt: user.lastLoginAt,
  sessions: user.sessions || [],
  loginHistory: user.loginHistory || [],
});

const createSession = async (user: any, c: Context) => {
  const sessionId = createOpaqueToken();
  const token = signSessionToken({
    sub: user._id.toString(),
    email: user.email,
    sessionId,
  } as any);

  const session = {
    id: sessionId,
    userAgent: c.req.header("user-agent") || "Unknown device",
    ipAddress: c.req.header("x-forwarded-for") || c.req.header("cf-connecting-ip") || "",
    createdAt: new Date(),
    lastSeenAt: new Date(),
  };

  user.sessions = [...(user.sessions || []), session].slice(-10);
  user.loginHistory = [
    {
      at: new Date(),
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      status: "success",
    },
    ...(user.loginHistory || []),
  ].slice(0, 25);
  user.lastLoginAt = new Date();
  await user.save();

  return { token, user: await publicUser(user) };
};

const register = async (c: Context) => {
  try {
    const { email, password, firstName = "", lastName = "", name } = await c.req.json();

    if (!email || !password) {
      return sendError(c, 400, "Email and password are required");
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) return sendError(c, 409, "An account already exists for this email");

    const user = await User.create({
      email: normalizedEmail,
      passwordHash: hashPassword(password),
      firstName,
      lastName,
      name: name || [firstName, lastName].filter(Boolean).join(" ") || normalizedEmail,
    });

    return sendSuccess(c, 201, "Account created", await createSession(user, c));
  } catch (error) {
    logger.error(error as string);
    return sendError(c, 500, "Failed to create account");
  }
};

const login = async (c: Context) => {
  try {
    const { email, password } = await c.req.json();
    if (!email || !password) return sendError(c, 400, "Email and password are required");

    const user = await User.findOne({ email: String(email).trim().toLowerCase() }).select("+passwordHash");
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return sendError(c, 401, "Invalid email or password");
    }

    return sendSuccess(c, 200, "Signed in", await createSession(user, c));
  } catch (error) {
    logger.error(error as string);
    return sendError(c, 500, "Failed to sign in");
  }
};

const me = async (c: Context) => {
  const auth = c.get("auth");
  const user = await User.findById(auth?._id);
  if (!user) return sendError(c, 401, "Unauthorized");
  return sendSuccess(c, 200, "Account fetched", await publicUser(user));
};

const logout = async (c: Context) => {
  const auth = c.get("auth");
  if (auth?._id && auth?.sessionId) {
    await User.findByIdAndUpdate(auth._id, {
      $pull: { sessions: { id: auth.sessionId } },
    });
  }
  return sendSuccess(c, 200, "Signed out");
};

const forgotPassword = async (c: Context) => {
  const { email } = await c.req.json();
  const user = await User.findOne({ email: String(email || "").trim().toLowerCase() });
  if (user) {
    user.resetToken = createOpaqueToken();
    user.resetTokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();
  }
  return sendSuccess(c, 200, "If an account exists, recovery instructions are available");
};

const resetPassword = async (c: Context) => {
  const { token, password } = await c.req.json();
  const user = await User.findOne({
    resetToken: token,
    resetTokenExpiresAt: { $gt: new Date() },
  });
  if (!user) return sendError(c, 400, "Invalid or expired recovery token");

  user.passwordHash = hashPassword(password);
  user.resetToken = undefined;
  user.resetTokenExpiresAt = undefined;
  user.sessions = [] as any;
  await user.save();
  return sendSuccess(c, 200, "Password updated");
};

const updateProfile = async (c: Context) => {
  const auth = c.get("auth");
  const { firstName, lastName, imageUrl } = await c.req.json();
  const user = await User.findByIdAndUpdate(
    auth._id,
    {
      firstName: String(firstName || "").trim(),
      lastName: String(lastName || "").trim(),
      name: [firstName, lastName].filter(Boolean).join(" ").trim(),
      imageUrl: String(imageUrl || "").trim(),
    },
    { new: true }
  );
  if (!user) return sendError(c, 404, "Account not found");
  return sendSuccess(c, 200, "Profile updated", await publicUser(user));
};

const changePassword = async (c: Context) => {
  const auth = c.get("auth");
  const { currentPassword, newPassword } = await c.req.json();
  if (!newPassword || String(newPassword).length < 8) {
    return sendError(c, 400, "New password must be at least 8 characters");
  }

  const user = await User.findById(auth._id).select("+passwordHash");
  if (!user || !verifyPassword(currentPassword, user.passwordHash)) {
    return sendError(c, 401, "Current password is incorrect");
  }

  user.passwordHash = hashPassword(newPassword);
  user.sessions = user.sessions.filter((session: any) => session.id === auth.sessionId) as any;
  await user.save();
  return sendSuccess(c, 200, "Password updated");
};

const revokeSession = async (c: Context) => {
  const auth = c.get("auth");
  const sessionId = c.req.param("sessionId");
  await User.findByIdAndUpdate(auth._id, {
    $pull: { sessions: { id: sessionId } },
  });
  return sendSuccess(c, 200, "Session revoked");
};

export default {
  register,
  login,
  logout,
  me,
  forgotPassword,
  resetPassword,
  updateProfile,
  changePassword,
  revokeSession,
};
