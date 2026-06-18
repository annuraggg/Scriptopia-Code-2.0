import { Outlet } from "react-router-dom";
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
import { MemberWithPermission as MWP } from "@shared-types/MemberWithPermission";
import { Bell, Menu, Search } from "lucide-react";
import { Button } from "@nextui-org/react";
import { AnimatePresence, motion } from "framer-motion";
import { ExtendedInstitute } from "@shared-types/ExtendedInstitute";
import { Notification } from "@shared-types/Notification";

const Layout = () => {
  const [notifications, setNotificationsState] = useState<Notification[]>([]);
  const [institute, setInstitute] = useState<ExtendedInstitute>(
    {} as ExtendedInstitute
  );
  const [user, setUser] = useState<MWP>({} as MWP);
  const [rerender, setRerender] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const { getToken } = useAuth();
  const axios = ax(getToken);

  const unreadCount =
    notifications?.filter((notification) => !notification.readBy?.includes(user?.user!))
      ?.length || 0;

  const setNotifications = useCallback(
    (updatedNotifications: Notification[], notificationId: string) => {
      setNotificationsState(updatedNotifications);

      const newlyReadNotification = updatedNotifications.find(
        (notification) => notification._id === notificationId
      );

      if (newlyReadNotification) {
        axios
          .post(`/users/notifications/${newlyReadNotification._id}`)
          .catch((error) => {
            console.error("Error marking notification as read:", error);
            toast.error("Failed to mark notification as read");
          });
      }
    },
    [axios]
  );

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 900;
      setIsMobile(mobile);
      if (!mobile) setIsMobileMenuOpen(false);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    axios
      .get("/institutes")
      .then((res) => {
        setInstitute(res.data.data.institute);
        setUser(res.data.data.user);
      })
      .catch((err) => {
        if (err.response?.status === 404) {
          window.location.href = "/onboarding";
          return;
        }
        toast.error(err.response?.data?.message || "An error occurred");
      })
      .finally(() => {
        setRerender((current) => !current);
      });

    axios
      .get("/users/notifications?platform=campus")
      .then((res) => setNotificationsState(res.data.data))
      .catch(() => setNotificationsState([]));
  }, []);

  const updateInstitute = (newInstitute: ExtendedInstitute) => {
    setInstitute(newInstitute);
    setRerender((current) => !current);
  };

  return (
    <>
      <SignedIn>
        <div className="min-h-screen bg-slate-50 text-slate-950">
          <div className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:hidden">
            <button
              className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-700"
              onClick={() => setIsMobileMenuOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <img src="/logo.svg" alt="Scriptopia Campus" className="h-7" />
            <Button isIconOnly variant="light" aria-label="Notifications">
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500" />
              )}
            </Button>
          </div>

          <div className="flex min-h-screen">
            <AnimatePresence>
              {isMobile && isMobileMenuOpen && (
                <motion.button
                  type="button"
                  aria-label="Close navigation overlay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
                  onClick={() => setIsMobileMenuOpen(false)}
                />
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {(!isMobile || isMobileMenuOpen) && (
                <motion.div
                  key="sidebar"
                  initial={isMobile ? { x: -320 } : false}
                  animate={{ x: 0 }}
                  exit={isMobile ? { x: -320 } : undefined}
                  transition={{ type: "spring", bounce: 0, duration: 0.28 }}
                  className={`${isMobile ? "fixed left-0 top-0 z-50" : "sticky top-0 z-30"} h-screen`}
                >
                  <Sidebar
                    notifications={unreadCount}
                    institute={institute}
                    user={user}
                    isMobile={isMobile}
                    onClose={() => setIsMobileMenuOpen(false)}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex min-w-0 flex-1 flex-col">
              <div className="hidden h-16 items-center justify-between border-b border-slate-200 bg-white/80 px-6 backdrop-blur lg:flex">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-950 text-sm font-semibold text-white">
                    {(institute?.name || "C").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-950">
                      {institute?.name || "Campus workspace"}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {user?.role ? `${user.role} access` : "Placement operations"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="hidden h-10 w-[320px] items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500 xl:flex">
                    <Search className="h-4 w-4" />
                    Search drives, companies, candidates
                  </div>
                  <Button
                    isIconOnly
                    variant="light"
                    aria-label={`${unreadCount} unread notifications`}
                    className="relative"
                    onClick={() => {
                      window.location.href = "/notifications";
                    }}
                  >
                    <Bell className="h-5 w-5 text-slate-600" />
                    {unreadCount > 0 && (
                      <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="min-h-[calc(100vh-4rem)] flex-1 overflow-y-auto">
                <Outlet
                  context={{
                    notifications,
                    setNotifications,
                    user,
                    institute,
                    setInstitute: updateInstitute,
                    rerender,
                  }}
                />
              </div>
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
