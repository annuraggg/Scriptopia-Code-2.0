import { Hono } from "hono";
import userController from "../controllers/code/userController";
import authController from "@/controllers/authController";
const app = new Hono();

app.post("/auth/register", authController.register);
app.post("/auth/login", authController.login);
app.post("/auth/logout", authController.logout);
app.get("/auth/me", authController.me);
app.post("/auth/forgot-password", authController.forgotPassword);
app.post("/auth/reset-password", authController.resetPassword);
app.patch("/auth/profile", authController.updateProfile);
app.patch("/auth/preferences", authController.updatePreferences);
app.get("/account", authController.accountOverview);
app.post("/auth/change-password", authController.changePassword);
app.delete("/auth/sessions/:sessionId", authController.revokeSession);
app.get("/notifications", userController.getNotificationsForUser);
app.post("/notifications/:id", userController.markNotificationAsRead);

export default app;
