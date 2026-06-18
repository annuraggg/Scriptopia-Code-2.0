import { RedirectToSignIn, SignedIn, SignedOut } from "@/auth";
import { Outlet } from "react-router-dom";

const Layout = () => {
  return (
    <div>
      <SignedIn>
        <Outlet />
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </div>
  );
};

export default Layout;
