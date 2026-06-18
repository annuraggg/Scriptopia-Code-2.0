
import "./App.css";
import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { useDispatch } from "react-redux";
import { setOrganization } from "./reducers/organizationReducer";
import { useUser } from "@/auth";
import router from "./routes";

function App() {
  const { user, isSignedIn } = useUser();
  const dispatch = useDispatch();

  // Sync user data with Redux
  useEffect(() => {
    if (isSignedIn) {
      const data = {
        _id: user?.publicMetadata?.orgId,
        role: user?.publicMetadata?.orgRole,
        permissions: user?.publicMetadata?.orgPermissions,
        name: user?.publicMetadata?.orgName,
      };
      dispatch(setOrganization(data));
    }
  }, [isSignedIn, user, dispatch]);

  return <RouterProvider router={router} />;
}

export default App;
