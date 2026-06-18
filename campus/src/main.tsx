import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { NextUIProvider } from "@nextui-org/react";
import { AuthProvider } from "@/auth";
import { Toaster } from "sonner";
import { Provider } from "react-redux";
import store from "@/store/store.ts";
import { Toaster as ShadToaster } from "@/components/ui/toaster";
import { ThemeProvider } from "./components/theme-provider.tsx";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <ThemeProvider defaultTheme="light" storageKey="ui-theme">
    <NextUIProvider>
      <Provider store={store}>
        <AuthProvider>
          <Toaster richColors theme="light" />
          <ShadToaster />
          <App />
        </AuthProvider>
      </Provider>
    </NextUIProvider>
  </ThemeProvider>
);
