import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import {
  RedirectToSignIn,
  SignedIn,
  SignedOut,
  useAuth,
} from "@/auth";
import { useEffect, useState } from "react";
import ax from "@/config/axios";
import { toast } from "sonner";
import { MemberWithPermission as MWP } from "@shared-types/MemberWithPermission";
import { OrganizationWithPostings as OWP } from "@/types/RootContext";
import { Menu } from "lucide-react";
import { Button } from "@heroui/button";
import { AnimatePresence, motion } from "framer-motion";

const Layout = () => {
  const [notifications, setNotifications] = useState([]);
  const [organization, setOrganization] = useState<OWP>({} as OWP);
  const [user, setUser] = useState<MWP>({} as MWP);
  const [rerender, setRerender] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const { getToken } = useAuth();
  const axios = ax(getToken);

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 640;
      setIsMobile(mobile);
      if (!mobile) {
        setIsMobileMenuOpen(false);
      }
    };

    checkMobile(); // Initial check
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    axios
      .get("/organizations")
      .then((res) => {
        setOrganization(res.data.data.organization);
        setUser(res.data.data.user);
        setNotifications(res.data.data.notifications);
      })
      .catch((err) => {
        if (err.response.status === 404) {
          return window.location.href = "/onboarding";
        }
        toast.error(err.response.data.message || "An error occurred");
      })
      .finally(() => {
        setRerender(!rerender);
      });
  }, []);

  const updateOrganization = (newOrganization: OWP) => {
    setOrganization(newOrganization);
    setRerender(!rerender);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <>
      <SignedIn>
        <div className="relative min-h-screen">
          {/* Mobile Header */}
          <div className="sm:hidden fixed top-0 left-0 right-0 h-16 border-b z-40 px-5 flex items-center justify-between">
            <img
              src="/logo.svg"
              alt="logo"
              className="h-6 cursor-pointer"
              onClick={() => {
                window.location.href = "/";
              }}
            />
            <Button
              isIconOnly
              variant="light"
              onClick={toggleMobileMenu}
              className="pr-4"
            >
              <Menu className="h-6 w-6" />
            </Button>
          </div>

          <div className="flex w-full">
            {/* Mobile Menu Overlay */}
            <AnimatePresence>
              {isMobileMenuOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.5 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-40 sm:hidden"
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
                  transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                  className={`${isMobile ? "fixed" : "relative"} z-50`}
                >
                  <Sidebar
                    notifications={notifications}
                    org={organization}
                    user={user}
                    isMobile={isMobile}
                    onClose={() => setIsMobileMenuOpen(false)}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <div
              className={`flex-1 min-h-screen bg-background max-h-screen overflow-y-auto ${isMobile ? "pt-16" : "px-5"}`}
            >
              <Outlet
                context={{
                  notifications,
                  user,
                  organization,
                  setOrganization: updateOrganization,
                  rerender,
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
