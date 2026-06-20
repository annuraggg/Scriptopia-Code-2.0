import { Suspense, lazy } from "react";
import Loader from "../components/Loader";

// Lazy load components
const Layout = lazy(() => import("../components/Layout"));
const Dashboard = lazy(() => import("../pages/dashboard/Dashboard"));
const Jobs = lazy(() => import("../pages/jobs/Jobs"));
const Candidates = lazy(() => import("../pages/candidates/Candidates"));
const Analytics = lazy(() => import("../pages/analytics/Analytics"));
const Notifications = lazy(
  () => import("../pages/notifications/Notifications")
);
const Documentation = lazy(
  () => import("../pages/documentation/Documentation")
);
const Support = lazy(() => import("../pages/support/Support"));

const dashboardRoutes = [
  {
    path: "/",
    element: (
      <Suspense fallback={<Loader />}>
        <Layout />
      </Suspense>
    ),
    children: [
      {
        path: "dashboard",
        element: (
          <Suspense fallback={<Loader />}>
            <Dashboard />
          </Suspense>
        ),
      },
      {
        path: "jobs",
        element: (
          <Suspense fallback={<Loader />}>
            <Jobs />
          </Suspense>
        ),
      },
      {
        path: "candidates",
        element: (
          <Suspense fallback={<Loader />}>
            <Candidates />
          </Suspense>
        ),
      },
      {
        path: "analytics",
        element: (
          <Suspense fallback={<Loader />}>
            <Analytics />
          </Suspense>
        ),
      },
      {
        path: "notifications",
        element: (
          <Suspense fallback={<Loader />}>
            <Notifications />
          </Suspense>
        ),
      },
      {
        path: "documentation",
        element: (
          <Suspense fallback={<Loader />}>
            <Documentation />
          </Suspense>
        ),
      },
      {
        path: "support",
        element: (
          <Suspense fallback={<Loader />}>
            <Support />
          </Suspense>
        ),
      },
    ],
  },
];

export default dashboardRoutes;
