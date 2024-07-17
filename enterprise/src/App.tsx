import "./App.css";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Lander from "./pages/lander/Lander";
import Layout from "./components/Layout";
import Dashboard from "./pages/dashboard/Dashboard";
import Postings from "./pages/postings/Postings";
import Settings from "./pages/settings/Settings";

function App() {
  const router = createBrowserRouter([
    {
      path: "/",
      element: <Lander />,
    },
    {
      path: "/postings",
      element: <Postings />,
    },
    {
      path: "/settings",
      element: <Settings />,
    },
    {
      path: "/postings/:id",
      element: <Layout />,
      children: [
        {
          path: "dashboard",
          element: <Dashboard />,
        },
      ],
    },
  ]);

  return <RouterProvider router={router} />;
}

export default App;
