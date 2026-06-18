import { Suspense, lazy } from "react";
import { SignedIn, SignedOut, RedirectToSignIn } from "@/auth";
import Loader from "../components/Loader";

// Lazy load components
const Start = lazy(() => import("../pages/start/Start"));
const Join = lazy(() => import("../pages/join/Join"));
const Onboarding = lazy(() => import("../pages/onboarding/Onboarding"));

const authRoutes = [
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
];

export default authRoutes;
