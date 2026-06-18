import { NavLink, Outlet, useParams } from "react-router-dom";
import { Drive } from "@shared-types/Drive";
import { useAuth } from "@/auth";
import ax from "@/config/axios";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Spinner, useDisclosure } from "@nextui-org/react";
import {
  BarChart3,
  ClipboardCopy,
  FileCheck2,
  GitBranch,
  Info,
  Inbox,
  LayoutDashboard,
  ListChecks,
  MonitorCheck,
  Route,
  Send,
  SlidersHorizontal,
  UserRoundCheck,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusPill } from "@/components/campus/StatusPill";

const Layout = () => {
  const [drive, setDrive] = useState<Drive>({} as Drive);
  const [driveLoading, setDriveLoading] = useState(true);
  const [refetch, setRefetch] = useState(false);
  const { id } = useParams();
  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  const { getToken } = useAuth();
  const axios = ax(getToken);

  useEffect(() => {
    setDriveLoading(true);
    axios
      .get(`/drives/${id}`)
      .then((res) => setDrive(res.data.data))
      .catch((err) => {
        toast.error(err.response?.data?.message || "Something went wrong");
      })
      .finally(() => setDriveLoading(false));
  }, [id, refetch]);

  const workflowSteps = useMemo(() => drive?.workflow?.steps || [], [drive]);
  const getFilteredStepsCount = (types: string[]): number =>
    workflowSteps.filter((step) => types.includes(step?.type)).length;

  const hasCompletedAllSteps = useMemo(() => {
    const steps = drive?.workflow?.steps || [];
    if (steps.length === 0) return -1;

    let totalCompleted = 0;
    steps.forEach((step) => {
      if (step.type === "RESUME_SCREENING" && drive?.ats) totalCompleted++;
      if (
        ["CODING_ASSESSMENT", "MCQ_ASSESSMENT"].includes(step.type) &&
        ((drive?.codeAssessments?.some(
          (assessment) => assessment.workflowId.toString() === step?._id?.toString()
        )
          ? 1
          : 0) +
          (drive?.mcqAssessments?.some(
            (assessment) => assessment.workflowId.toString() === step?._id?.toString()
          )
            ? 1
            : 0))
      ) {
        totalCompleted++;
      }
      if (
        step.type === "ASSIGNMENT" &&
        drive?.assignments?.some(
          (assignment) => assignment.workflowId.toString() === step?._id?.toString()
        )
      ) {
        totalCompleted++;
      }
      if (step.type === "INTERVIEW" && drive?.interviews) totalCompleted++;
      if (step.type === "CUSTOM") totalCompleted++;
    });

    return totalCompleted === steps.length ? 1 : 0;
  }, [drive]);

  const tabs = [
    { icon: Info, label: "Info", to: "info", visible: true },
    { icon: LayoutDashboard, label: "Dashboard", to: "dashboard", visible: true },
    { icon: GitBranch, label: "Workflow", to: "workflow", visible: true },
    { icon: Route, label: "Pipeline", to: "pipeline", visible: true },
    {
      icon: FileCheck2,
      label: "ATS",
      to: "ats",
      visible: getFilteredStepsCount(["RESUME_SCREENING"]) > 0,
    },
    {
      icon: MonitorCheck,
      label: "Assessments",
      to: "assessments",
      visible: getFilteredStepsCount(["CODING_ASSESSMENT", "MCQ_ASSESSMENT"]) > 0,
    },
    {
      icon: ListChecks,
      label: "Assignments",
      to: "assignments",
      visible: getFilteredStepsCount(["ASSIGNMENT"]) > 0,
    },
    {
      icon: Video,
      label: "Interviews",
      to: "interviews",
      visible: getFilteredStepsCount(["INTERVIEW"]) > 0,
    },
    {
      icon: SlidersHorizontal,
      label: "Custom",
      to: "custom",
      visible: getFilteredStepsCount(["CUSTOM"]) > 0,
    },
    { icon: UserRoundCheck, label: "Candidates", to: "candidates", visible: true },
    { icon: Inbox, label: "Offers", to: "offer-letters", visible: drive?.hasEnded },
    { icon: BarChart3, label: "Analytics", to: "analytics", visible: drive?.hasEnded },
  ];

  const copyLink = () => {
    navigator.clipboard.writeText(
      `${import.meta.env.VITE_CANDIDATE_URL}/campus/drives/${drive?._id}`
    );
    toast.success("Drive link copied");
  };

  const publishDrive = () => {
    axios
      .post("/drives/publish", { id: drive._id })
      .then(() => {
        toast.success("Drive published successfully");
        setRefetch((current) => !current);
      })
      .catch(() => toast.error("Error publishing drive"));
  };

  const renderStatus = () => {
    if (hasCompletedAllSteps === 1 && drive.published) {
      return <StatusPill tone="success">Live</StatusPill>;
    }
    if (hasCompletedAllSteps === 1 && !drive.published) {
      return <StatusPill tone="warning">Ready to publish</StatusPill>;
    }
    if (hasCompletedAllSteps === 0) {
      return <StatusPill tone="danger">Setup incomplete</StatusPill>;
    }
    return <StatusPill tone="neutral">Workflow not initialized</StatusPill>;
  };

  if (driveLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-semibold tracking-tight text-slate-950">
                  {drive.title || "Drive"}
                </h1>
                {renderStatus()}
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {workflowSteps.length} workflow steps · {drive?.candidates?.length || 0} candidates
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {drive.published && (
                <Button
                  variant="flat"
                  startContent={<ClipboardCopy size={16} />}
                  onPress={copyLink}
                >
                  Copy link
                </Button>
              )}
              {hasCompletedAllSteps === 1 && !drive.published && (
                <Button
                  color="primary"
                  startContent={<Send size={16} />}
                  onPress={onOpen}
                >
                  Publish
                </Button>
              )}
            </div>
          </div>

          <nav className="flex gap-2 overflow-x-auto pb-1">
            {tabs
              .filter((tab) => tab.visible)
              .map((tab) => (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  className={({ isActive }) =>
                    cn(
                      "inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition",
                      isActive
                        ? "bg-slate-950 text-white"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                    )
                  }
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </NavLink>
              ))}
          </nav>
        </div>
      </header>

      <Outlet
        context={{
          drive,
          setDrive,
          refetch: () => setRefetch((current) => !current),
        }}
      />

      <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Publish Drive</ModalHeader>
              <ModalBody>
                <p className="text-sm leading-6 text-slate-600">
                  Publishing makes this drive visible to candidates. Confirm
                  that the workflow, assessments, and access rules are ready.
                </p>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>
                  Cancel
                </Button>
                <Button color="primary" onPress={publishDrive}>
                  Publish
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
};

export default Layout;
