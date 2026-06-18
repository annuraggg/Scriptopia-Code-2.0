import React, { useState } from "react";
import { motion } from "framer-motion";

import { Card } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Progress } from "@heroui/progress";
import { Alert } from "@heroui/alert";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";
import { useAuth } from "@/auth";
import { useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import ax from "@/config/axios";
import { WorkflowStep, StepType } from "@shared-types/Posting";
import {
  IconBook,
  IconCode,
  IconDeviceDesktopPause,
  IconFileCv,
  IconFrustum,
  IconQuestionMark,
} from "@tabler/icons-react";
import { PostingContext } from "@/types/PostingContext";

interface ShowProps {
  workflowData: WorkflowStep[];
}

const stepTypeMap: Record<StepType, string> = {
  RESUME_SCREENING: "Resume Screening",
  MCQ_ASSESSMENT: "MCQ Assessment",
  CODING_ASSESSMENT: "Coding Assessment",
  ASSIGNMENT: "Assignment",
  INTERVIEW: "Interview",
  CUSTOM: "Custom",
};

const getStepIcon = (type: StepType): JSX.Element => {
  const iconProps = { size: 24, strokeWidth: 1.5 };
  switch (type) {
    case "RESUME_SCREENING":
      return <IconFileCv {...iconProps} />;
    case "MCQ_ASSESSMENT":
      return <IconQuestionMark {...iconProps} />;
    case "CODING_ASSESSMENT":
      return <IconCode {...iconProps} />;
    case "ASSIGNMENT":
      return <IconBook {...iconProps} />;
    case "INTERVIEW":
      return <IconDeviceDesktopPause {...iconProps} />;
    case "CUSTOM":
      return <IconFrustum {...iconProps} />;
    default:
      return <IconFrustum {...iconProps} />;
  }
};

const getStepStyles = (type: StepType, status: string) => {
  const baseClasses =
    "w-14 h-14 rounded-lg flex items-center justify-center border-2 transition-all";
  const colorMap = {
    RESUME_SCREENING: {
      bg: status === "in-progress" ? "bg-blue-50" : "bg-blue-100/50",
      border: "border-blue-500",
      text: "text-blue-500",
    },
    MCQ_ASSESSMENT: {
      bg: status === "in-progress" ? "bg-green-50" : "bg-green-100/50",
      border: "border-green-500",
      text: "text-green-500",
    },
    CODING_ASSESSMENT: {
      bg: status === "in-progress" ? "bg-yellow-50" : "bg-yellow-100/50",
      border: "border-yellow-500",
      text: "text-yellow-500",
    },
    ASSIGNMENT: {
      bg: status === "in-progress" ? "bg-purple-50" : "bg-purple-100/50",
      border: "border-purple-500",
      text: "text-purple-500",
    },
    INTERVIEW: {
      bg: status === "in-progress" ? "bg-red-50" : "bg-red-100/50",
      border: "border-red-500",
      text: "text-red-500",
    },
    CUSTOM: {
      bg: status === "in-progress" ? "bg-gray-50" : "bg-gray-100/50",
      border: "border-gray-500",
      text: "text-gray-500",
    },
  };

  const stepColors = colorMap[type] || colorMap.CUSTOM;
  return `${baseClasses} ${stepColors.bg} ${stepColors.border} ${stepColors.text}`;
};

const Show: React.FC<ShowProps> = ({ workflowData }) => {
  const { posting, setPosting, refetch } = useOutletContext() as PostingContext;
  const [loading, setLoading] = useState<boolean>(false);
  const { getToken } = useAuth();
  const axios = ax(getToken);

  const {
    isOpen: isAdvanceModalOpen,
    onClose: onAdvanceModalClose,
    onOpen: onAdvanceModalOpen,
    onOpenChange: onAdvanceModalOpenChange,
  } = useDisclosure();

  const {
    isOpen: isScheduleModalOpen,
    onClose: onScheduleModalClose,
    onOpen: onScheduleModalOpen,
    onOpenChange: onScheduleModalOpenChange,
  } = useDisclosure();

  const {
    isOpen: isEndModalOpen,
    onClose: onEndModalClose,
    onOpen: onEndModalOpen,
    onOpenChange: onEndModalOpenChange,
  } = useDisclosure();

  const {
    isOpen: isLessThanTwoModalOpen,
    onClose: onLessThanTwoModalClose,
    onOpen: onLessThanTwoModalOpen,
    onOpenChange: onLessThanTwoModalOpenChange,
  } = useDisclosure();

  const [selectedStep, setSelectedStep] = useState<{
    step: WorkflowStep;
    index: number;
  } | null>(null);
  const [scheduleData, setScheduleData] = useState({
    startTime: "",
    endTime: "",
  });

  const completedSteps =
    posting.workflow?.steps.filter((s) => s.status === "completed").length || 0;
  const totalSteps = workflowData.length;
  const progress = (completedSteps / totalSteps) * 100;

  const advance = async (step: number): Promise<void> => {
    onAdvanceModalOpen();
    setSelectedStep({ step: workflowData[step], index: step });
  };

  const handleSchedule = async () => {
    if (!selectedStep || !scheduleData.startTime || !scheduleData.endTime)
      return;
    setLoading(true);

    try {
      await axios.post("/postings/schedule-step", {
        postingId: posting._id,
        stepId: selectedStep.step._id,
        schedule: {
          startTime: new Date(scheduleData.startTime),
          endTime: new Date(scheduleData.endTime),
        },
      });

      toast.success("Step scheduled successfully");
      onScheduleModalClose();
      setScheduleData({ startTime: "", endTime: "" });
      setSelectedStep(null);

      setTimeout(() => {
        window.location.reload();
        setLoading(false);
      }, 500);
    } catch (err) {
      console.error(err);
      toast.error("Failed to schedule step");
      setLoading(false);
    }
  };

  const cancelAdvance = () => {
    onLessThanTwoModalClose();
    onAdvanceModalClose();
  };

  const handleAdvanceConfirm = async () => {
    if (!selectedStep) return;

    if (!isLessThanTwoModalOpen) {
      const allAppliedPostings = posting?.candidates?.map((candidate) =>
        candidate.appliedPostings.find(
          (appliedPosting) => appliedPosting.posting === posting._id
        )
      );

      const qualifiedCandidates = allAppliedPostings?.filter(
        (appliedPosting) => appliedPosting?.status === "inprogress"
      );

      if (qualifiedCandidates?.length < 2) {
        onLessThanTwoModalOpen();
        return;
      }
    }

    onLessThanTwoModalClose();

    setLoading(true);
    if (!posting.published) {
      toast.error("Posting is not published");
      setLoading(false);
      return;
    }

    await axios
      .post("/postings/advance-workflow", {
        _id: posting._id,
        step: selectedStep.index,
      })
      .then((res) => {
        toast.success("Workflow advanced successfully");
        onAdvanceModalClose();
        setSelectedStep(null);
        setPosting(res.data.data);
        refetch()
      })
      .catch((err) => {
        console.error(err);
        toast.error("Failed to advance workflow");
        setLoading(false);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const getStepStatus = (step: WorkflowStep): string => {
    const currentStepIndex = workflowData.findIndex(
      (s) => s.status === "in-progress"
    );

    const nextStep = workflowData[currentStepIndex + 1];
    if (nextStep && nextStep._id === step._id) return "upcoming";

    return step.status;
  };

  return (
    <div className="mx-auto px-16 py-8 space-y-6">
      {posting.published && (
        <div className="bg-white shadow-sm rounded-lg overflow-hidden">
          <Progress value={progress} className="h-2" color="primary" />
        </div>
      )}

      {/* Alert for workflow status */}
      {(!posting.published ||
        posting.workflow?.steps[0].status === "pending") && (
        <Alert
          color="secondary"
          title={
            !posting.published
              ? "Posting Not Published"
              : "Workflow Not Started"
          }
          description={
            !posting.published
              ? "Publish this posting to begin workflow operations"
              : "Start the workflow by advancing the first step"
          }
          className="rounded-lg shadow-sm"
        />
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-4"
      >
        {workflowData.map((step, index) => {
          const status = getStepStatus(step);
          return (
            <motion.div
              key={step._id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <div className="flex items-center space-x-4">
                {/* Status Indicator */}
                <div className="flex-shrink-0">
                  {status === "completed" && (
                    <div className="w-8 h-8 bg-green-100 border-2 border-green-500 rounded-full flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-green-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  )}
                  {status === "in-progress" && (
                    <div className="w-8 h-8 bg-blue-100 border-2 border-blue-500 rounded-full flex items-center justify-center">
                      <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
                    </div>
                  )}
                  {(status === "pending" || status === "upcoming") && (
                    <div className="w-8 h-8 bg-gray-100 border-2 border-gray-300 rounded-full" />
                  )}
                </div>

                {/* Step Card */}
                <Card
                  className={`flex-1 p-4 rounded-lg shadow-sm transition-all 
                    ${
                      status === "in-progress"
                        ? "border-2 border-blue-500/20 bg-blue-50/50"
                        : "border border-gray-200"
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      {/* Step Icon */}
                      <div className={getStepStyles(step.type, status)}>
                        {getStepIcon(step.type)}
                      </div>

                      {/* Step Details */}
                      <div>
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-xs font-medium text-gray-500">
                            Step {index + 1}
                          </span>
                          {status === "in-progress" && (
                            <Chip
                              color="success"
                              variant="flat"
                              size="sm"
                              className="!text-xs"
                            >
                              Current
                            </Chip>
                          )}
                        </div>
                        <h3 className="text-base font-semibold text-gray-800">
                          {step.name}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {stepTypeMap[step.type]}
                        </p>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-2">
                      {status === "upcoming" && posting.published && (
                        <>
                          <Button
                            color="primary"
                            size="sm"
                            onPress={() => advance(index)}
                            isLoading={loading}
                            className="shadow-sm"
                          >
                            Advance
                          </Button>
                          {step.type !== "CUSTOM" &&
                            step.type !== "INTERVIEW" &&
                            step.type !== "RESUME_SCREENING" && (
                              <Button
                                variant="bordered"
                                size="sm"
                                onPress={() => {
                                  setSelectedStep({ step, index });
                                  onScheduleModalOpen();
                                }}
                                isLoading={loading}
                                className="shadow-sm"
                              >
                                Schedule
                              </Button>
                            )}
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              </div>
            </motion.div>
          );
        })}

        {/* End Workflow Button */}
        {completedSteps === totalSteps - 1 && (
          <div className="flex justify-end mt-4">
            <Button
              color="success"
              variant="flat"
              onPress={onEndModalOpen}
              isLoading={loading}
            >
              End Workflow
            </Button>
          </div>
        )}
      </motion.div>

      {/* End Workflow Modal */}
      <Modal
        isOpen={isEndModalOpen}
        onOpenChange={onEndModalOpenChange}
        backdrop="blur"
      >
        <ModalContent>
          <ModalHeader>
            <h3 className="text-lg font-semibold">End Workflow?</h3>
          </ModalHeader>
          <ModalBody>
            <p>
              Are you sure you want to end the workflow? You will still be able
              to access and manage the candidates in the posting. This action
              will mark all rounds as completed.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              color="default"
              variant="flat"
              onPress={() => onEndModalClose()}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              color="danger"
              onPress={() => onEndModalClose()}
              isLoading={loading}
            >
              End Workflow
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Advance Confirmation Modal */}
      <Modal
        isOpen={isAdvanceModalOpen}
        onOpenChange={onAdvanceModalOpenChange}
        backdrop="blur"
      >
        <ModalContent>
          <ModalHeader>
            <h3 className="text-lg font-semibold">Advance to Next Step?</h3>
          </ModalHeader>
          <ModalBody>
            <p>
              Are you sure you want to mark this step as complete and advance to
              the next step?
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              color="default"
              variant="flat"
              onPress={() => onAdvanceModalClose()}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              onPress={handleAdvanceConfirm}
              isLoading={loading}
            >
              Advance Step
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Schedule Modal */}
      <Modal
        isOpen={isScheduleModalOpen}
        onOpenChange={onScheduleModalOpenChange}
        backdrop="blur"
      >
        <ModalContent>
          <ModalHeader>
            <h3 className="text-lg font-semibold">Schedule Step</h3>
          </ModalHeader>
          <ModalBody>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Start Time
                </label>
                <input
                  type="datetime-local"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={scheduleData.startTime}
                  onChange={(e) =>
                    setScheduleData((prev) => ({
                      ...prev,
                      startTime: e.target.value,
                    }))
                  }
                  min={new Date().toISOString().slice(0, 16)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  End Time
                </label>
                <input
                  type="datetime-local"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={scheduleData.endTime}
                  onChange={(e) =>
                    setScheduleData((prev) => ({
                      ...prev,
                      endTime: e.target.value,
                    }))
                  }
                  min={
                    scheduleData.startTime ||
                    new Date().toISOString().slice(0, 16)
                  }
                />
              </div>
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              color="default"
              variant="flat"
              onPress={() => onScheduleModalClose()}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              onPress={handleSchedule}
              isLoading={loading}
              disabled={!scheduleData.startTime || !scheduleData.endTime}
            >
              Schedule
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Less than 2 Modal */}
      <Modal
        isOpen={isLessThanTwoModalOpen}
        onOpenChange={onLessThanTwoModalOpenChange}
        backdrop="blur"
      >
        <ModalContent>
          <ModalHeader>
            <h3 className="text-lg font-semibold">Less than 2 Candidates</h3>
          </ModalHeader>
          <ModalBody>
            <p>
              There are less than 2 candidates in this posting. You can continue
              to hire the candidate without next workflow steps. Do you still
              want to continue?
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              color="default"
              variant="flat"
              onPress={() => cancelAdvance()}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              onPress={handleAdvanceConfirm}
              isLoading={loading}
            >
              Continue
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
};

export default Show;
