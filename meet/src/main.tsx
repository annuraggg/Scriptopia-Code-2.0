import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import { AuthProvider } from "@/auth";
import "./index.css";
import { NextUIProvider } from "@nextui-org/react";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <NextUIProvider>
      <App />
    </NextUIProvider>
  </AuthProvider>
);
