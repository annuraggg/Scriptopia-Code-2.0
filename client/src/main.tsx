import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ClerkProvider } from "@clerk/clerk-react";
import { dark } from "@clerk/themes";
import { NextUIProvider } from "@nextui-org/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";
import ErrorPage from "./components/ErrorPage.tsx";
import { Toaster } from "sonner";

import { SpeedInsights } from "@vercel/speed-insights/react";
import { Analytics } from "@vercel/analytics/react";


const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  throw new Error("Missing Publishable Key");
}

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ErrorBoundary FallbackComponent={ErrorPage}>
    <QueryClientProvider client={queryClient}>
      <NextUIProvider>
        <ClerkProvider
          publishableKey={PUBLISHABLE_KEY}
          appearance={{
            baseTheme: dark,
          }}
        >
          <App />

          <SpeedInsights debug={false} />
          <Analytics debug={false} />
          <Toaster richColors theme="dark" />
        </ClerkProvider>
      </NextUIProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);
