import { RedirectToSignIn, SignedIn, SignedOut } from "@/auth";
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import { useState } from "react";

const Layout = () => {
  const [refetch, setRefetch] = useState(false);

  return (
    <div>
      <SignedIn>
        <Navbar refetch={refetch} />
        <div className="h-[88vh] px-10">
          <Outlet context={{ setRefetch }} />
        </div>
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </div>
  );
};

export default Layout;
