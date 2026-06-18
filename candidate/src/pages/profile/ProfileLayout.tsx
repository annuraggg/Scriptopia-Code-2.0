import { Outlet, useOutletContext } from "react-router-dom";
import { Candidate } from "@shared-types/Candidate";
import { useAuth } from "@/auth";
import ax from "@/config/axios";
import { toast } from "sonner";

const Layout = () => {
  const { user, setUser } = useOutletContext() as {
    user: Candidate;
    setUser: (user: Candidate) => void;
  };

  // on setUser, save to db
  const { getToken } = useAuth();
  const axios = ax(getToken);

  const updateUser = (newUser: Candidate) => {
    const oldState = user;
    console.log("New User", newUser);
    setUser(newUser);
    axios
      .put("candidates/candidate", newUser)
      .then((res) => {
        setUser(res.data.data);
      })
      .catch((err) => {
        toast.error("Failed to update profile");
        console.error(err);
        setUser(oldState);
      });
  };

  return (
    <>
      <div className="">
        <div className="flex w-full">
          <div className="h-screen w-full overflow-y-auto p-5">
            <Outlet context={{ user, setUser: updateUser }} />
          </div>
        </div>
      </div>
    </>
  );
};

export default Layout;
