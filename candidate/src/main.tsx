import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { HeroUIProvider } from "@heroui/react";
import { AuthProvider } from "@/auth";
import { Toaster } from "sonner";
import { ErrorBoundary } from "react-error-boundary";
import ErrorBoundaryPage from "./components/ErrorBoundary";


createRoot(document.getElementById("root")!).render(
  <ErrorBoundary FallbackComponent={ErrorBoundaryPage}>
    <HeroUIProvider>
      <AuthProvider>
        <App />
        <Toaster richColors />
      </AuthProvider>
    </HeroUIProvider>
  </ErrorBoundary>
);
