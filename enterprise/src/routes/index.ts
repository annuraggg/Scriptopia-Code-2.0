import { createBrowserRouter } from "react-router-dom";
import publicRoutes from "./publicRoutes";
import authRoutes from "./authRoutes";
import dashboardRoutes from "./dashboardRoutes";
import jobRoutes from "./jobRoutes";
import candidateRoutes from "./candidateRoutes"
import settingsRoutes from "./settingsRoute";
import { AuthPage } from "@/auth";
import { createElement } from "react";

// Combine all routes
const router = createBrowserRouter([
  {
    path: "/auth/login",
    element: createElement(AuthPage),
  },
  {
    path: "/auth/register",
    element: createElement(AuthPage),
  },
  ...publicRoutes,
  ...authRoutes,
  ...dashboardRoutes,
  ...jobRoutes,
  ...candidateRoutes,
  ...settingsRoutes,
]);

export default router;
