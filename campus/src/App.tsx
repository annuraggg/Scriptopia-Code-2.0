import "./App.css";
import { Suspense, lazy, useEffect } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { useDispatch } from "react-redux";
import { setInstitute } from "./reducers/instituteReducer";
import {
  AuthPage,
  RedirectToSignIn,
  SignedIn,
  SignedOut,
  useUser,
} from "@/auth";
import CreateDrive from "./pages/drives/create/CreateDrive";
import GroupDetails from "./pages/placementgroups/GroupDetails";

// Lazy load components
import Loader from "./components/Loader";
import PendingCandidates from "./pages/candidates/PendingCandidates";
import OfferLetters from "./pages/drives/drive/offer-letters/OfferLetters";
const Lander = lazy(() => import("./pages/lander/Lander"));
const Layout = lazy(() => import("./components/Layout"));
const DriveLayout = lazy(() => import("./pages/drives/drive/Layout"));
const SettingsLayout = lazy(() => import("./pages/settings/Layout"));
const Start = lazy(() => import("./pages/start/Start"));
const Join = lazy(() => import("./pages/join/Join"));
const Onboarding = lazy(() => import("./pages/onboarding/Onboarding"));
const CandidateLayout = lazy(() => import("./pages/candidates/Layout"));
const Company = lazy(() => import("./pages/companies/company/Company"));

// Dashboard and other main views
const Dashboard = lazy(() => import("./pages/dashboard/Dashboard"));
const Drives = lazy(() => import("./pages/drives/Drives"));
const PlacementGroups = lazy(
  () => import("./pages/placementgroups/PlacementGroups")
);
const Companies = lazy(
  () => import("./pages/companies/Companies")
);
const Candidates = lazy(() => import("./pages/candidates/Candidates"));
const Analytics = lazy(() => import("./pages/analytics/AnalyticsDashboard"));
const Notifications = lazy(() => import("./pages/notifications/Notifications"));
const Documentation = lazy(() => import("./pages/documentation/Documentation"));
const Support = lazy(() => import("./pages/support/Support"));

// Settings routes
const GeneralSettings = lazy(() => import("./pages/settings/general/General"));
const Members = lazy(() => import("./pages/settings/members/Member"));
const Roles = lazy(() => import("./pages/settings/roles/Roles"));
const Departments = lazy(
  () => import("./pages/settings/departments/Departments")
);
const AuditLogs = lazy(
  () => import("./pages/settings/security/audit-logs/Audit-Logs")
);
const OrgData = lazy(() => import("./pages/settings/security/data/Data"));
const MockData = lazy(() => import("./pages/settings/data/MockData"));

const StartOnboarding = lazy(() => import("./pages/onboarding/start/Start"));
const CandidateProfile = lazy(() => import("./pages/candidates/Profile"));

const CreatePlacementGroup = lazy(
  () => import("./pages/placementgroups/create/CreateGroupForm")
);

// drive specific routes
const DriveInfo = lazy(() => import("./pages/drives/drive/info/Info"));
const DriveDashboard = lazy(
  () => import("./pages/drives/drive/dashboard/Dashboard")
);
const Workflow = lazy(() => import("./pages/drives/drive/workflow/Workflow"));
const Ats = lazy(() => import("./pages/drives/drive/ats/Ats"));
const DriveCandidates = lazy(
  () => import("./pages/drives/drive/candidates/Candidates")
);
const Assessments = lazy(
  () => import("./pages/drives/drive/assessments/Assessments")
);
const Interviews = lazy(
  () => import("./pages/drives/drive/interviews/Interviews")
);
const Assignments = lazy(
  () => import("./pages/drives/drive/assignment/Assignments")
);
const NewAssignment = lazy(() => import("./pages/drives/drive/assignment/New"));
const ViewAssignment = lazy(
  () => import("./pages/drives/drive/assignment/ViewAssignment")
);

const ViewCodeAssessmentResults = lazy(
  () =>
    import("./pages/drives/drive/assessments/view/code/CodeAssessmentResults")
);
const ViewMcqAssessmentResults = lazy(
  () => import("./pages/drives/drive/assessments/view/mcq/McqAssessmentResults")
);

const ViewUserCodeAssessment = lazy(
  () => import("./pages/drives/drive/assessments/view/code/individual/View")
);

const ViewUserMCQAssessment = lazy(
  () => import("./pages/drives/drive/assessments/view/mcq/individual/View")
);

const Pipeline = lazy(() => import("./pages/drives/drive/pipeline/Pipeline"));
const CustomLayout = lazy(() => import("./pages/drives/drive/custom/Layout"));
const Custom = lazy(() => import("./pages/drives/drive/custom/Custom"));
const DriveAnalytics = lazy(
  () => import("./pages/drives/drive/analytics/Analytics")
);

function App() {
  const { user, isSignedIn } = useUser();
  const dispatch = useDispatch();

  // Sync user data with Redux
  useEffect(() => {
    if (isSignedIn) {
      const data = {
        _id: (user?.publicMetadata?.institute as any)?._id,
        role: (user?.publicMetadata?.institute as any)?.role.slug,
        permissions: (user?.publicMetadata?.institute as any)?.role.permissions,
        name: (user?.publicMetadata?.institute as any)?.name,
      };
      dispatch(setInstitute(data));
    }
  }, [isSignedIn]);

  // Define routes for each section
  const router = createBrowserRouter([
    {
      path: "/auth/login",
      element: <AuthPage />,
    },
    {
      path: "/auth/register",
      element: <AuthPage />,
    },
    {
      path: "/",
      element: (
        <Suspense fallback={<Loader />}>
          <Lander />
        </Suspense>
      ),
    },
    {
      path: "/start",
      element: (
        <Suspense fallback={<Loader />}>
          <SignedIn>
            <Start />
          </SignedIn>
          <SignedOut>
            <RedirectToSignIn />
          </SignedOut>
        </Suspense>
      ),
    },
    {
      path: "/onboarding",
      element: (
        <Suspense fallback={<Loader />}>
          <SignedIn>
            <Onboarding />
          </SignedIn>
          <SignedOut>
            <RedirectToSignIn />
          </SignedOut>
        </Suspense>
      ),
    },
    {
      path: "/onboarding/start",
      element: (
        <Suspense fallback={<Loader />}>
          <SignedIn>
            <StartOnboarding />
          </SignedIn>
          <SignedOut>
            <RedirectToSignIn />
          </SignedOut>
        </Suspense>
      ),
    },
    {
      path: "/join",
      element: (
        <Suspense fallback={<Loader />}>
          <SignedIn>
            <Join />
          </SignedIn>
          <SignedOut>
            <RedirectToSignIn />
          </SignedOut>
        </Suspense>
      ),
    },
    {
      path: "/",
      element: (
        <Suspense fallback={<Loader />}>
          <Layout />
        </Suspense>
      ),
      children: [
        {
          path: "drives/:id",
          element: (
            <Suspense fallback={<Loader />}>
              <DriveLayout />
            </Suspense>
          ),
          children: [
            {
              path: "info",
              element: (
                <Suspense fallback={<Loader />}>
                  <DriveInfo />
                </Suspense>
              ),
            },
            {
              path: "dashboard",
              element: (
                <Suspense fallback={<Loader />}>
                  <DriveDashboard />
                </Suspense>
              ),
            },
            {
              path: "workflow",
              element: (
                <Suspense fallback={<Loader />}>
                  <Workflow />
                </Suspense>
              ),
            },
            {
              path: "pipeline",
              element: (
                <Suspense fallback={<Loader />}>
                  <Pipeline />
                </Suspense>
              ),
            },
            {
              path: "custom",
              element: (
                <Suspense fallback={<Loader />}>
                  <CustomLayout />
                </Suspense>
              ),

              children: [
                {
                  path: ":id",
                  element: (
                    <Suspense fallback={<Loader />}>
                      <Custom />
                    </Suspense>
                  ),
                },
              ],
            },
            {
              path: "offer-letters",
              element: (
                <Suspense fallback={<Loader />}>
                  <OfferLetters />
                </Suspense>
              ),
            },
            {
              path: "analytics",
              element: (
                <Suspense fallback={<Loader />}>
                  <DriveAnalytics />
                </Suspense>
              ),
            },
            {
              path: "ats",
              element: (
                <Suspense fallback={<Loader />}>
                  <Ats />
                </Suspense>
              ),
            },
            {
              path: "candidates",
              element: (
                <Suspense fallback={<Loader />}>
                  <DriveCandidates />
                </Suspense>
              ),
            },
            {
              path: "assessments",
              element: (
                <Suspense fallback={<Loader />}>
                  <Assessments />
                </Suspense>
              ),
            },
            {
              path: "assessments/m/:id/view/:candId",
              element: (
                <Suspense fallback={<Loader />}>
                  <ViewUserMCQAssessment />
                </Suspense>
              ),
            },
            {
              path: "assessments/c/:id/view/:candId",
              element: (
                <Suspense fallback={<Loader />}>
                  <ViewUserCodeAssessment />
                </Suspense>
              ),
            },
            {
              path: "assessments/c/:id/view",
              element: (
                <Suspense fallback={<Loader />}>
                  <ViewCodeAssessmentResults />
                </Suspense>
              ),
            },
            {
              path: "assessments/c/:id/view",
              element: (
                <Suspense fallback={<Loader />}>
                  <ViewCodeAssessmentResults />
                </Suspense>
              ),
            },
            {
              path: "assessments/m/:id/view",
              element: (
                <Suspense fallback={<Loader />}>
                  <ViewMcqAssessmentResults />
                </Suspense>
              ),
            },
            //   {
            //     path: "assessments/m/:id/view/:candId",
            //     element: (
            //       <Suspense fallback={<Loader />}>
            //         <ViewMcqAssessmentResult />
            //       </Suspense>
            //     ),
            //   },
            {
              path: "assignments",
              element: (
                <Suspense fallback={<Loader />}>
                  <Assignments />
                </Suspense>
              ),
            },
            {
              path: "assignments/:id",
              element: (
                <Suspense fallback={<Loader />}>
                  <ViewAssignment />
                </Suspense>
              ),
            },
            {
              path: "assignments/new",
              element: (
                <Suspense fallback={<Loader />}>
                  <NewAssignment />
                </Suspense>
              ),
            },
            {
              path: "interviews",
              element: (
                <Suspense fallback={<Loader />}>
                  <Interviews />
                </Suspense>
              ),
            },
          ],
        },
        {
          path: "/settings",
          element: (
            <Suspense fallback={<Loader />}>
              <SettingsLayout />
            </Suspense>
          ),
          children: [
            {
              path: "general",
              element: (
                <Suspense fallback={<Loader />}>
                  <GeneralSettings />
                </Suspense>
              ),
            },
            {
              path: "members",
              element: (
                <Suspense fallback={<Loader />}>
                  <Members />
                </Suspense>
              ),
            },
            {
              path: "roles",
              element: (
                <Suspense fallback={<Loader />}>
                  <Roles />
                </Suspense>
              ),
            },
            {
              path: "departments",
              element: (
                <Suspense fallback={<Loader />}>
                  <Departments />
                </Suspense>
              ),
            },

            {
              path: "security/audit-logs",
              element: (
                <Suspense fallback={<Loader />}>
                  <AuditLogs />
                </Suspense>
              ),
            },
            {
              path: "security/data",
              element: (
                <Suspense fallback={<Loader />}>
                  <OrgData />
                </Suspense>
              ),
            },
            {
              path: "data/mock",
              element: (
                <Suspense fallback={<Loader />}>
                  <MockData />
                </Suspense>
              ),
            },
          ],
        },

        {
          path: "dashboard",
          element: (
            <Suspense fallback={<Loader />}>
              <Dashboard />
            </Suspense>
          ),
        },
        {
          path: "drives",
          element: (
            <Suspense fallback={<Loader />}>
              <Drives />
            </Suspense>
          ),
        },
        {
          path: "drives/create",
          element: (
            <Suspense fallback={<Loader />}>
              <CreateDrive />
            </Suspense>
          ),
        },
        {
          path: "placement-groups",
          element: (
            <Suspense fallback={<Loader />}>
              <PlacementGroups />
            </Suspense>
          ),
        },
        {
          path: "companies",
          element: (
            <Suspense fallback={<Loader />}>
              <Companies />
            </Suspense>
          ),
        },
        {
          path: "companies/:id",
          element: (
            <Suspense fallback={<Loader />}>
              <Company />
            </Suspense>
          ),
        },
        {
          path: "placement-groups",
          element: (
            <Suspense fallback={<Loader />}>
              <PlacementGroups />
            </Suspense>
          ),
        },
        {
          path: "placement-groups/create",
          element: (
            <Suspense fallback={<Loader />}>
              <CreatePlacementGroup />
            </Suspense>
          ),
        },
        {
          path: "placement-groups/:id",
          element: (
            <Suspense fallback={<Loader />}>
              <GroupDetails />
            </Suspense>
          ),
        },
        {
          path: "candidates",
          element: (
            <Suspense fallback={<Loader />}>
              <CandidateLayout />
            </Suspense>
          ),
          children: [
            {
              path: "active",
              element: (
                <Suspense fallback={<Loader />}>
                  <Candidates />
                </Suspense>
              ),
            },
            {
              path: "pending",
              element: (
                <Suspense fallback={<Loader />}>
                  <PendingCandidates />
                </Suspense>
              ),
            },
          ],
        },
        {
          path: "c/:id",
          element: (
            <Suspense fallback={<Loader />}>
              <CandidateProfile />
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
  ]);

  return <RouterProvider router={router} />;
}

export default App;
