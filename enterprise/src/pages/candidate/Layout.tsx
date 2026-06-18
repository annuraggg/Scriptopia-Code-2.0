import CandidateNavbar from "@/components/CandidateNavbar";
import { RedirectToSignIn, SignedIn, SignedOut } from "@/auth";
import { Organization } from "@shared-types/Organization";
import { Posting } from "@shared-types/Posting";
import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";

const Layout = () => {
  const [posting, _setPosting] = useState<Posting>({} as Posting);
  const [organization, _setOrganization] = useState<Organization>(
    {} as Organization
  );

  useEffect(() => {

  }, []);

  return (
    <div>
      <SignedIn>
        <CandidateNavbar />
        <Outlet context={{ posting, organization }} />
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </div>
  );
};

export default Layout;
