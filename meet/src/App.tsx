import "./App.css";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import MeetV3 from "./pages/v3/Main";
import { Toaster } from "@/components/ui/sonner";
import Layout from "./components/Layout";
import { AuthPage } from "@/auth";

function App() {
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
      path: "/v3/:id",
      children: [{ path: "", element: <MeetV3 /> }],
      element: <Layout />,
    },
  ]);

  return (
    <>
      <RouterProvider router={router} />
      <Toaster richColors position="top-left" />
    </>
  );
}

export default App;
