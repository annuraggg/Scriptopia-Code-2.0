import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { Badge } from "@heroui/badge";
import { Skeleton } from "@heroui/skeleton";
import { Button } from "@heroui/button";
import { Tooltip } from "@heroui/tooltip";
import type { Drive } from "@shared-types/Drive";
import {
  IconLayoutDashboard,
  IconArrowsExchange,
  IconFileText,
  IconChartBar,
  IconDeviceLaptop,
  IconVideo,
  IconUsers,
  IconInfoCircle,
  IconJoinStraight,
  IconAdjustments,
  IconInbox,
  IconChartPie,
} from "@tabler/icons-react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";
import ax from "@/config/axios";
import { useAuth } from "@/auth";

interface SidebarProps {
  drive: Drive;
  loading: boolean;
  isMobile?: boolean;
  onClose?: () => void;
}

interface NavItem {
  icon: typeof IconLayoutDashboard;
  label: string;
  link: string;
  visible: boolean;
  badge?: number;
}

const Sidebar = ({ drive, loading, isMobile, onClose }: SidebarProps) => {
  const navigate = useNavigate();
  const [active, setActive] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  const workflowSteps = useMemo(() => drive?.workflow?.steps || [], [drive]);

  const { getToken } = useAuth();
  const axios = ax(getToken);

  const getFilteredStepsCount = (types: string[]): number =>
    workflowSteps.filter((step) => types.includes(step?.type)).length;

  const topItems = useMemo(
    (): NavItem[] => [
      {
        icon: IconInfoCircle,
        label: "Info",
        link: "/info",
        visible: true,
      },
      // {
      //   icon: IconLayoutDashboard,
      //   label: "Dashboard",
      //   link: "/dashboard",
      //   visible: true,
      //   badge: 0,
      // },
      {
        icon: IconArrowsExchange,
        label: "Workflow",
        link: "/workflow",
        visible: true,
        badge: workflowSteps.length ? 0 : 1,
      },
      {
        icon: IconJoinStraight,
        label: "Pipeline",
        link: "/pipeline",
        visible: true,
      },
      {
        icon: IconFileText,
        label: "ATS",
        link: "/ats",
        visible: getFilteredStepsCount(["RESUME_SCREENING"]) > 0,
        badge:
          getFilteredStepsCount(["RESUME_SCREENING"]) && drive?.ats ? 0 : 1,
      },
      {
        icon: IconChartBar,
        label: "Assessments",
        link: "/assessments",
        visible:
          getFilteredStepsCount(["CODING_ASSESSMENT", "MCQ_ASSESSMENT"]) > 0,
        badge:
          getFilteredStepsCount(["CODING_ASSESSMENT", "MCQ_ASSESSMENT"]) -
          ((drive?.codeAssessments?.length ?? 0) +
            (drive?.mcqAssessments?.length ?? 0)),
      },
      {
        icon: IconDeviceLaptop,
        label: "Assignments",
        link: "/assignments",
        visible: getFilteredStepsCount(["ASSIGNMENT"]) > 0,
        badge:
          getFilteredStepsCount(["ASSIGNMENT"]) -
          (drive?.assignments?.length || 0),
      },
      {
        icon: IconVideo,
        label: "Interviews",
        link: "/interviews",
        visible: getFilteredStepsCount(["INTERVIEW"]) > 0,
      },
      {
        icon: IconAdjustments,
        label: "Custom Steps",
        link: "/custom",
        visible: getFilteredStepsCount(["CUSTOM"]) > 0,
      },
      {
        icon: IconUsers,
        label: "Candidates",
        link: "/candidates",
        visible: true,
      },
      {
        icon: IconInbox,
        label: "Offer Letters",
        link: "/offer-letters",
        visible: drive?.hasEnded,
      },
      {
        icon: IconChartPie,
        label: "Analytics",
        link: "/analytics",
        visible: drive?.hasEnded,
      },
    ],
    [drive, workflowSteps]
  );

  useEffect(() => {
    const currentPath = window.location.pathname.split("/")[4];
    setActive(currentPath);
  }, []);

  const handleNavigation = (item: NavItem) => {
    if (!item.visible) {
      toast.warning(`${item.label} not configured for this drive`);
      return;
    }

    const path = window.location.pathname.split("/").slice(0, 3);
    navigate(path.join("/") + item.link);
    setActive(item.label.toLowerCase());
    if (isMobile) onClose?.();
  };

  const hasCompletedAllSteps = useMemo(() => {
    const steps = drive?.workflow?.steps || [];
    if (steps.length === 0) return -1;

    let totalCompleted = 0;
    steps.forEach((step) => {
      if (step.type === "RESUME_SCREENING" && drive?.ats) totalCompleted++;
      if (
        ["CODING_ASSESSMENT", "MCQ_ASSESSMENT"].includes(step.type) &&
        (drive?.codeAssessments?.some(
          (a) => a.workflowId.toString() === step?._id?.toString()
        )
          ? 1
          : 0) +
          (drive?.mcqAssessments?.some(
            (a) => a.workflowId.toString() === step?._id?.toString()
          )
            ? 1
            : 0)
      ) {
        totalCompleted++;
      }
      if (
        step.type === "ASSIGNMENT" &&
        drive?.assignments?.some(
          (a) => a.workflowId.toString() === step?._id?.toString()
        )
      ) {
        totalCompleted++;
      }
      if (step.type === "INTERVIEW" && drive?.interviews) totalCompleted++;
      if (step.type === "CUSTOM") totalCompleted++;
    });

    console.log(totalCompleted, steps.length);
    return totalCompleted === steps.length ? 1 : 0;
  }, [drive]);

  const copyLink = () => {
    navigator.clipboard.writeText(
      `${import.meta.env.VITE_CANDIDATE_URL}/campus/drives/${drive?._id}`
    );
    toast.success("Link copied to clipboard");
  };

  const publishDrive = () => {
    axios
      .post("/drives/publish", { id: drive._id })
      .then(() => {
        toast.success("Drive published successfully");
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      })
      .catch(() => {
        toast.error("Error publishing drive");
      });
  };

  const renderNavItem = (item: NavItem, index: number) => {
    if (loading) {
      return (
        <Skeleton key={index} className="rounded-lg bg-background/10">
          <div className="h-12 rounded-lg"></div>
        </Skeleton>
      );
    }

    return (
      <Tooltip
        key={index}
        content={item.label}
        placement="right"
        isDisabled={isMobile || !collapsed}
      >
        <div
          className={`${!item.visible ? "hidden" : ""}`}
          onClick={() => handleNavigation(item)}
        >
          <div
            className={`flex items-center p-2 py-3 rounded-lg cursor-pointer transition-colors duration-200
              ${
                active === item.label.toLowerCase()
                  ? "bg-primary text-foreground"
                  : "text-default hover:bg-accent/40"
              }`}
          >
            <div className="min-w-[24px] flex items-center justify-center">
              <Badge
                content={item.badge || 0}
                color="danger"
                className={!item.badge || item.badge < 0 ? "hidden" : ""}
              >
                <item.icon className="w-6 h-6" />
              </Badge>
            </div>
            {(!collapsed || isMobile) && (
              <span className="ml-3 text-sm font-medium">{item.label}</span>
            )}
          </div>
        </div>
      </Tooltip>
    );
  };

  const renderStatus = () => {
    if (loading) {
      return (
        <div className="space-y-3">
          <Skeleton className="rounded-lg bg-background/10">
            <div className="h-4 w-3/4"></div>
          </Skeleton>
          <Skeleton className="rounded-lg bg-background/10">
            <div className="h-9"></div>
          </Skeleton>
        </div>
      );
    }

    return (
      <>
        {hasCompletedAllSteps === 1 && drive.published && (
          <div className="mb-4">
            <div className="text-success-500 text-sm mb-2  items-center justify-center flex flex-col text-center">
              Drive is currently live 😊
            </div>
            <Button
              className="w-full"
              color="success"
              variant="flat"
              onPress={copyLink}
            >
              Copy link
            </Button>
          </div>
        )}

        {hasCompletedAllSteps === 1 && !drive.published && (
          <div className="mb-4 items-center justify-center flex flex-col text-center">
            <div className="text-warning-500 text-sm mb-2">
              Ready to publish
            </div>
            <Button className="w-full" color="warning" onPress={onOpen}>
              🚀 Publish
            </Button>
          </div>
        )}

        {hasCompletedAllSteps === 0 && (
          <div className="text-danger-500 text-sm mb-4  items-center justify-center flex flex-col text-center">
            Complete all workflow steps to publish
          </div>
        )}

        {hasCompletedAllSteps === -1 && (
          <div className="text-danger-500 text-sm mb-4">
            Workflow not initialized
          </div>
        )}
      </>
    );
  };

  const subNavbarRoutes = ["assessments", "custom"];

  return (
    <aside
      className={`h-[100vh] -ml-5 bg-foreground text-background  ${
        subNavbarRoutes.includes(window.location.pathname.split("/")[3])
          ? "border-r-background/10"
          : "rounded-r-2xl"
      } flex flex-col overflow-hidden transition-all duration-300
        ${isMobile ? "w-64" : collapsed ? "w-16" : "w-64"}
        ${isMobile ? "fixed left-0 top-0" : "relative"}`}
    >
      <nav className="flex flex-col gap-2 p-3 flex-grow">
        {topItems.map((item, index) => renderNavItem(item, index))}
      </nav>

      <div className="p-3">
        {(!collapsed || isMobile) && renderStatus()}

        {!isMobile && (
          <div className="flex">
            <Button
              isIconOnly
              variant="light"
              className="w-8 h-8"
              onPress={() => setCollapsed(!collapsed)}
              disabled={loading}
            >
              <ChevronRight
                className={`h-5 w-5 transition-transform duration-200 text-background
                  ${!collapsed ? "rotate-180" : ""}`}
              />
            </Button>
          </div>
        )}
      </div>

      <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Publish Drive</ModalHeader>
              <ModalBody>
                Are you sure you want to publish this drive? This action cannot
                be undone.
              </ModalBody>
              <ModalFooter>
                <Button color="danger" variant="light" onPress={onClose}>
                  Close
                </Button>
                <Button color="success" onPress={publishDrive}>
                  Publish
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </aside>
  );
};

export default Sidebar;
