import { Outlet, useNavigate } from "react-router-dom";
import {
  RedirectToSignIn,
  SignedIn,
  SignedOut,
  useAuth,
} from "@/auth";
import { useEffect, useState } from "react";
import ax from "@/config/axios";
import { toast } from "sonner";
import Loader from "@/components/Loader";
import { ExtendedCandidate } from "@shared-types/ExtendedCandidate";
import InstituteOnboarding from "./InstituteOnboarding";

const Layout = () => {
  const { getToken } = useAuth();
  const [user, setUser] = useState<ExtendedCandidate>({} as ExtendedCandidate);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const axios = ax(getToken);
    axios
      .get("candidates/candidate")
      .then((res) => {
        setUser(res.data.data);
        console.log(res.data.data);
      })
      .catch((err) => {
        if (err.response.status === 404) {
          navigate("/onboarding");
          return;
        }
        toast.error(err.response.data.message || "An error occurred");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <Loader />;
  }

  return (
    <>
      <SignedIn>
        {user?.institute ? (
          <div className="">
            <div className="flex w-full h-screen">
              <div className="h-full w-full overflow-y-auto">
                <Outlet context={{ user, setUser }} />
              </div>
            </div>
          </div>
        ) : (
          <InstituteOnboarding />
        )}
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
};

export default Layout;
