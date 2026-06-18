import { useLocation, useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import {
  Bell,
  BriefcaseBusiness,
  Building2,
  BarChart3,
  LayoutDashboard,
  LogOut,
  Settings,
  Users,
  UserRoundCheck,
} from "lucide-react";
import { useAuth, UserButton } from "@/auth";
import {
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@nextui-org/react";
import { MemberWithPermission } from "@shared-types/MemberWithPermission";
import { ExtendedInstitute } from "@shared-types/ExtendedInstitute";
import ax from "@/config/axios";
import { toast } from "sonner";
import { useState } from "react";
import { cn } from "@/lib/utils";

const Sidebar = ({
  notifications,
  institute,
  user,
  isMobile,
  onClose,
}: {
  notifications: number;
  institute: ExtendedInstitute;
  user: MemberWithPermission;
  isMobile: boolean;
  onClose?: () => void;
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [showFirstConfirmation, setShowFirstConfirmation] = useState(false);
  const [showFinalConfirmation, setShowFinalConfirmation] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  const { getToken } = useAuth();
  const axios = ax(getToken);

  const canManageDrives =
    user?.permissions?.includes("view_drive") ||
    user?.permissions?.includes("manage_drive");
  const canViewCandidates =
    canManageDrives || user?.permissions?.includes("verify_candidate");
  const canViewAnalytics =
    user?.permissions?.includes("view_analytics") ||
    user?.permissions?.includes("manage_institute");
  const canManageInstitute = user?.permissions?.includes("manage_institute");

  const navGroups = [
    {
      label: "Operations",
      items: [
        {
          icon: LayoutDashboard,
          label: "Dashboard",
          link: "/dashboard",
          visible: true,
          match: "dashboard",
        },
        {
          icon: BriefcaseBusiness,
          label: "Drives",
          link: "/drives",
          visible: canManageDrives,
          match: "drives",
        },
        {
          icon: Users,
          label: "Placement Groups",
          link: "/placement-groups",
          visible: canManageDrives,
          match: "placement-groups",
        },
        {
          icon: Building2,
          label: "Companies",
          link: "/companies",
          visible: canManageDrives,
          match: "companies",
        },
        {
          icon: UserRoundCheck,
          label: "Candidates",
          link: "/candidates/active",
          visible: canViewCandidates,
          match: "candidates",
        },
      ],
    },
    {
      label: "Insights",
      items: [
        {
          icon: BarChart3,
          label: "Analytics",
          link: "/analytics",
          visible: canViewAnalytics,
          match: "analytics",
        },
        {
          icon: Bell,
          label: "Notifications",
          link: "/notifications",
          visible: true,
          match: "notifications",
          length: notifications,
        },
        {
          icon: Settings,
          label: "Settings",
          link: "/settings/general",
          visible: canManageInstitute,
          match: "settings",
        },
      ],
    },
  ];

  const activeSegment = location.pathname.split("/")[1] || "dashboard";

  const leaveInstitute = async () => {
    setIsLeaving(true);
    axios
      .post("/institutes/leave")
      .then((res) => {
        if (res.status === 200) {
          toast.success("You have left the institute successfully.");
          window.location.href = "/";
        }
      })
      .catch((err) => {
        console.error("Error leaving institute:", err);
        toast.error(
          err.response?.data?.message ||
            "Failed to leave institute. Please try again later."
        );
      })
      .finally(() => {
        setIsLeaving(false);
        setShowFinalConfirmation(false);
      });
  };

  return (
    <>
      <aside className="flex h-screen w-[280px] flex-col border-r border-slate-200 bg-white">
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
          <button
            className="flex items-center gap-3 text-left"
            onClick={() => navigate("/dashboard")}
          >
            <img src="/logo.svg" alt="Scriptopia Campus" className="h-8" />
          </button>
          {isMobile && (
            <Button isIconOnly variant="light" onPress={onClose} aria-label="Close navigation">
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>

        <div className="border-b border-slate-200 px-4 py-4">
          <p className="truncate text-sm font-semibold text-slate-950">
            {institute?.name || "Campus workspace"}
          </p>
          <p className="mt-1 truncate text-xs text-slate-500">
            {user?.email || "Institute operations"}
          </p>
        </div>

        <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="px-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                {group.label}
              </p>
              <div className="mt-2 space-y-1">
                {group.items
                  .filter((item) => item.visible)
                  .map((item) => {
                    const isActive = activeSegment === item.match;
                    return (
                      <button
                        key={item.label}
                        className={cn(
                          "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition",
                          isActive
                            ? "bg-slate-950 text-white shadow-sm"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                        )}
                        onClick={() => {
                          navigate(item.link);
                          onClose?.();
                        }}
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </span>
                        {!!item.length && (
                          <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                            {item.length}
                          </span>
                        )}
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-200 p-4">
          <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-medium text-slate-500">Current role</p>
            <p className="mt-1 truncate text-sm font-semibold capitalize text-slate-950">
              {user?.role || "Member"}
            </p>
          </div>
          <div className="flex items-center justify-between">
            <UserButton>
              <UserButton.MenuItems>
                <UserButton.Action
                  label="Leave Institute"
                  labelIcon={<LogOut className="h-4 w-4 text-rose-500" />}
                  onClick={() => setShowFirstConfirmation(true)}
                />
              </UserButton.MenuItems>
            </UserButton>
            <Button
              size="sm"
              variant="light"
              color="danger"
              onPress={() => setShowFirstConfirmation(true)}
            >
              Leave
            </Button>
          </div>
        </div>
      </aside>

      <Modal
        isOpen={showFirstConfirmation}
        onClose={() => setShowFirstConfirmation(false)}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">Leave Institute</ModalHeader>
          <ModalBody>
            <p className="text-sm leading-6 text-slate-600">
              You will lose access to drives, candidates, company profiles, and
              placement analytics for this institute.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onPress={() => setShowFirstConfirmation(false)}>
              Cancel
            </Button>
            <Button
              color="danger"
              onPress={() => {
                setShowFirstConfirmation(false);
                setShowFinalConfirmation(true);
              }}
            >
              Continue
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal
        isOpen={showFinalConfirmation}
        onClose={() => setShowFinalConfirmation(false)}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">Final Confirmation</ModalHeader>
          <ModalBody>
            <p className="text-sm leading-6 text-slate-600">
              This action cannot be undone. You will need a new invitation to
              rejoin this institute.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="light"
              onPress={() => setShowFinalConfirmation(false)}
              isDisabled={isLeaving}
            >
              Cancel
            </Button>
            <Button color="danger" onPress={leaveInstitute} isLoading={isLeaving}>
              Leave Institute
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default Sidebar;
