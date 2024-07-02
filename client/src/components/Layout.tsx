import {
  RedirectToSignIn,
  SignedIn,
  SignedOut,
} from "@clerk/clerk-react";
import { Outlet } from "react-router-dom";
import { Toaster } from "sonner";
import Navbar from "./Navbar";

const Layout = () => {
  return (
    <div>
      <SignedIn>
        <Toaster />
        <Navbar />
        <div className="h-[90vh] px-10">
          <Outlet />
        </div>
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </div>
  );
};

export default Layout;
