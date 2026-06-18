import { Outlet, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import {
  RedirectToSignIn,
  SignedIn,
  SignedOut,
  useAuth,
} from "@/auth";
import { useCallback, useEffect, useState } from "react";
import ax from "@/config/axios";
import { toast } from "sonner";
import Loader from "./Loader";
import { ExtendedCandidate } from "@shared-types/ExtendedCandidate";
import { Notification } from "@shared-types/Notification";

const Layout = () => {
  const { getToken } = useAuth();
  const [user, setUser] = useState<ExtendedCandidate>({} as ExtendedCandidate);
  const [notifications, setNotificationsState] = useState<Notification[]>([]);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  const axios = ax(getToken);

  const setNotifications = useCallback(
    (updatedNotifications: Notification[], notificationId: string) => {
      setNotificationsState(updatedNotifications);

      const newlyReadNotification = updatedNotifications.find(
        (notification) => notification._id === notificationId
      );

      console.log("Newly read notification:", newlyReadNotification);
      if (newlyReadNotification) {
        axios
          .post(`/users/notifications/${newlyReadNotification._id}`)
          .catch((error) => {
            console.error("Error marking notification as read:", error);
            toast.error("Failed to mark notification as read");
          });
      }
    },
    [notifications, user._id, axios]
  );

  useEffect(() => {
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

    // Fetch notifications
    axios
      .get("/users/notifications?platform=candidate")
      .then((res) => {
        setNotificationsState(res.data.data);
      })
      .catch((err) => {
        console.error("Failed to fetch notifications:", err);
      });
  }, []);

  if (loading) {
    return <Loader />;
  }

  return (
    <>
      <SignedIn>
        <div className="">
          <div className="flex w-full h-screen">
            <div className="h-full">
              <Sidebar
                user={user}
                notifications={
                  notifications?.filter((n) => !n.readBy?.includes(user?.userId?._id!))
                    ?.length || 0
                }
              />
            </div>

            <div className="h-full w-full overflow-y-auto">
              <Outlet
                context={{
                  user,
                  setUser,
                  notifications,
                  setNotifications,
                }}
              />
            </div>
          </div>
        </div>
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
};

export default Layout;
