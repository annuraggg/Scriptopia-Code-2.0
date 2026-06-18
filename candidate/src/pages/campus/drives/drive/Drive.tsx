// At the top of your file, keep the imports exactly as they were in your original code
import { useEffect, useState } from "react";
import { useAuth, useUser } from "@/auth";
import { toast } from "sonner";
import ax from "@/config/axios";
import {
  Button,
  Card,
  CardBody,
  Chip,
  Progress,
  useDisclosure,
  Avatar,
  Badge,
} from "@heroui/react";
import {
  IconBriefcase,
  IconBuilding,
  IconCalendar,
  IconClock,
  IconMapPin,
  IconCoin,
  IconUsers,
  IconStairs,
  IconArrowNarrowRight,
  IconExternalLink,
  IconCheck,
  IconInfoCircle,
  IconAlertTriangle,
  IconChartBar,
  IconFileCheck,
} from "@tabler/icons-react";
import Quill from "quill";
import Loader from "@/components/Loader";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/react";
import { Drive as IDrive } from "@shared-types/Drive";
import { useOutletContext } from "react-router-dom";
import { Candidate } from "@shared-types/Candidate";
import { Alert, AlertTitle } from "@/components/ui/alert";
import UploadOfferLetter from "./UploadOfferLetter";
import { Company } from "@shared-types/Company";
import clsx from "clsx";

enum StepType {
  RESUME_SCREENING = "RESUME_SCREENING",
  MCQ_ASSESSMENT = "MCQ_ASSESSMENT",
  CODING_ASSESSMENT = "CODING_ASSESSMENT",
  ASSIGNMENT = "ASSIGNMENT",
  INTERVIEW = "INTERVIEW",
  CUSTOM = "CUSTOM",
}

const routineMap: Record<string, string> = {
  full_time: "Full Time",
  part_time: "Part Time",
  internship: "Internship",
  contract: "Contract",
  freelance: "Freelance",
  temporary: "Temporary",
};

// Extend Company interface to include optional logo property
interface ExtendedCompany extends Company {
  logo?: string;
  website?: string;
  description?: string;
}

interface ExtendedDrive extends Omit<IDrive, "company"> {
  company: ExtendedCompany;
}

// Type for AdditionalFieldConfig with required properties
interface SafeAdditionalFieldConfig {
  required: boolean;
  allowEmpty: boolean;
}

const Drive: React.FC = () => {
  const { getToken } = useAuth();
  const axios = ax(getToken);
  const [loading, setLoading] = useState<boolean>(true);
  const [drive, setDrive] = useState<ExtendedDrive>({} as ExtendedDrive);
  const [applied, setApplied] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number }>({
    days: 0,
    hours: 0,
  });
  const { isOpen, onOpen, onOpenChange, onClose } = useDisclosure();
  const [successModalOpen, setSuccessModalOpen] = useState<boolean>(false);
  const [uploadModalOpen, setUploadModalOpen] = useState<boolean>(false);

  const { user } = useUser();
  const { user: userDoc } = useOutletContext() as { user: Candidate };

  useEffect(() => {
    const filter = drive?.candidates?.filter(
      (candidate: any) => candidate?.toString() === userDoc?._id?.toString()
    );

    if (filter && filter.length > 0) {
      setApplied(true);
    }
  }, [user, drive, userDoc?._id]);

  useEffect(() => {
    setLoading(true);
    const driveId = window.location.pathname.split("/")[3];
    axios
      .get(`/candidates/drives/${driveId}`)
      .then((res) => {
        if (!res.data.data.drive) {
          toast.error("Drive not found");
          return;
        }
        setDrive(res.data.data.drive);
        updateTimeLeft(res.data.data.drive.applicationRange.end);

        setTimeout(() => {
          const quill = new Quill("#editor-div", {
            readOnly: true,
            theme: "bubble",
            modules: {
              toolbar: false,
            },
          });
          quill.setContents(res.data.data.drive.description);
        }, 100);
      })
      .catch((err) => {
        toast.error("Failed to fetch drive details");
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, []);

  const updateTimeLeft = (endDate: string): void => {
    const now = new Date();
    const end = new Date(endDate);

    if (isNaN(end.getTime())) {
      console.error("Invalid endDate");
      return;
    }

    const diff = end.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    setTimeLeft({ days, hours });
  };

  const apply = (): void => {
    onOpen();
  };

  const [applyLoading, setApplyLoading] = useState<boolean>(false);
  const applyToJob = (): void => {
    setApplyLoading(true);
    axios
      .post(`/candidates/drive/apply`, { driveId: drive?._id })
      .then(() => {
        setApplied(true);
        toast.success("Application submitted successfully");
        onClose();
        setSuccessModalOpen(true);
      })
      .catch((err) => {
        toast.error(
          err.response.data.message || "Failed to submit application"
        );
        console.error(err);
      })
      .finally(() => setApplyLoading(false));
  };

  const closeSuccessModal = (): void => {
    setSuccessModalOpen(false);
  };

  const [uploadLoading, setUploadLoading] = useState<boolean>(false);

  const handleFileUpload = (file: File, ctc: string): void => {
    setUploadLoading(true);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("driveId", drive._id!);
    formData.append("candidateId", userDoc._id!);
    formData.append("ctc", ctc);

    axios
      .post("/drives/upload-offer-letter", formData)
      .then(() => {
        toast.success("Offer letter uploaded successfully!");
        setDrive({
          ...drive,
          offerLetters: [...(drive.offerLetters || []), userDoc._id ?? ""],
        });
        setUploadModalOpen(false);
      })
      .catch((error) => {
        toast.error(
          error.response.data.message || "Failed to upload offer letter"
        );
        console.error(error);
      })
      .finally(() => {
        setUploadLoading(false);
      });
  };

  // Helper function to safely check array length accounting for undefined
  const safeArrayLength = (arr: any[] | undefined): number => {
    return arr?.length || 0;
  };

  // Safe getter for additionalDetails properties
  const getFieldConfig = (
    sectionPath: string[],
    fieldName: string
  ): SafeAdditionalFieldConfig => {
    try {
      let section: any = drive?.additionalDetails;
      for (const path of sectionPath) {
        section = section?.[path];
      }
      return {
        required: !!section?.[fieldName]?.required,
        allowEmpty: !!section?.[fieldName]?.allowEmpty,
      };
    } catch (e) {
      return { required: false, allowEmpty: true };
    }
  };

  const getRequiredFieldsMissingCount = (): number => {
    let count = 0;

    // Basic
    const summaryConfig = getFieldConfig(["basic"], "summary");
    if (
      summaryConfig.required &&
      !userDoc?.summary &&
      !summaryConfig.allowEmpty
    ) {
      count++;
    }

    // Links
    const socialLinksConfig = getFieldConfig(["links"], "socialLinks");
    if (
      socialLinksConfig.required &&
      safeArrayLength(userDoc?.socialLinks) === 0 &&
      !socialLinksConfig.allowEmpty
    ) {
      count++;
    }

    // Background
    const educationConfig = getFieldConfig(["background"], "education");
    if (
      educationConfig.required &&
      safeArrayLength(userDoc?.education) === 0 &&
      !educationConfig.allowEmpty
    ) {
      count++;
    }

    const workExperienceConfig = getFieldConfig(
      ["background"],
      "workExperience"
    );
    if (
      workExperienceConfig.required &&
      safeArrayLength(userDoc?.workExperience) === 0 &&
      !workExperienceConfig.allowEmpty
    ) {
      count++;
    }

    // Skills
    const technicalSkillsConfig = getFieldConfig(["skills"], "technicalSkills");
    if (
      technicalSkillsConfig.required &&
      safeArrayLength(userDoc?.technicalSkills) === 0 &&
      !technicalSkillsConfig.allowEmpty
    ) {
      count++;
    }

    const languagesConfig = getFieldConfig(["skills"], "languages");
    if (
      languagesConfig.required &&
      safeArrayLength(userDoc?.languages) === 0 &&
      !languagesConfig.allowEmpty
    ) {
      count++;
    }

    const subjectsConfig = getFieldConfig(["skills"], "subjects");
    if (
      subjectsConfig.required &&
      safeArrayLength(userDoc?.subjects) === 0 &&
      !subjectsConfig.allowEmpty
    ) {
      count++;
    }

    // Experience
    const responsibilitiesConfig = getFieldConfig(
      ["experience"],
      "responsibilities"
    );
    if (
      responsibilitiesConfig.required &&
      safeArrayLength(userDoc?.responsibilities) === 0 &&
      !responsibilitiesConfig.allowEmpty
    ) {
      count++;
    }

    const projectsConfig = getFieldConfig(["experience"], "projects");
    if (
      projectsConfig.required &&
      safeArrayLength(userDoc?.projects) === 0 &&
      !projectsConfig.allowEmpty
    ) {
      count++;
    }

    // Achievements
    const awardsConfig = getFieldConfig(["achievements"], "awards");
    if (
      awardsConfig.required &&
      safeArrayLength(userDoc?.awards) === 0 &&
      !awardsConfig.allowEmpty
    ) {
      count++;
    }

    const certificatesConfig = getFieldConfig(["achievements"], "certificates");
    if (
      certificatesConfig.required &&
      safeArrayLength(userDoc?.certificates) === 0 &&
      !certificatesConfig.allowEmpty
    ) {
      count++;
    }

    const competitionsConfig = getFieldConfig(["achievements"], "competitions");
    if (
      competitionsConfig.required &&
      safeArrayLength(userDoc?.competitions) === 0 &&
      !competitionsConfig.allowEmpty
    ) {
      count++;
    }

    return count;
  };

  // Calculate required fields statistics
  const totalRequiredFields = Object.keys(
    drive?.additionalDetails || {}
  ).length;
  const missingFieldsCount = getRequiredFieldsMissingCount();
  const completedFieldsPercentage =
    totalRequiredFields > 0
      ? Math.round(
          ((totalRequiredFields - missingFieldsCount) / totalRequiredFields) *
            100
        )
      : 100;

  const isJobOpen = new Date(drive?.applicationRange?.end) > new Date();
  const isHired = drive?.hiredCandidates?.includes(userDoc?._id!);
  const hasUploadedOfferLetter = drive?.offerLetters?.includes(userDoc?._id!);

  // Function to get icon for workflow step type
  const getStepIcon = (type: StepType) => {
    switch (type) {
      case StepType.RESUME_SCREENING:
        return <IconFileCheck size={16} />;
      case StepType.MCQ_ASSESSMENT:
      case StepType.CODING_ASSESSMENT:
      case StepType.ASSIGNMENT:
        return <IconChartBar size={16} />;
      case StepType.INTERVIEW:
        return <IconUsers size={16} />;
      default:
        return <IconCheck size={16} />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader />
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen pb-16">
      {/* Sticky header with application status */}
      {applied && (
        <div className="sticky top-0 z-10 w-full bg-white shadow-sm border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div
                  className={clsx(
                    "h-8 w-8 rounded-full flex items-center justify-center text-white",
                    isHired ? "bg-green-500" : "bg-blue-500"
                  )}
                >
                  <IconCheck size={18} />
                </div>
                <span className="font-medium">
                  {isHired ? "You've been hired!" : "Application submitted"}
                </span>
              </div>

              {drive?.link && (
                <a
                  href={drive.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
                >
                  <span>Registration Link</span>
                  <IconExternalLink size={16} />
                </a>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Alert banners */}
        {!isJobOpen && (
          <Alert className="bg-red-50 border-red-200 text-red-800">
            <AlertTitle className="flex items-center gap-2">
              This Drive is no longer accepting registerations
            </AlertTitle>
          </Alert>
        )}
        <div className="space-y-4 mb-6">
          {isHired && (
            <Alert className="bg-green-50 border-green-200 text-green-800">
              <AlertTitle className="flex items-center gap-2">
                <IconCheck className="h-5 w-5" />
                Congratulations! You've been hired for this position.
              </AlertTitle>
            </Alert>
          )}

          {isHired && !hasUploadedOfferLetter && (
            <Alert className="bg-amber-50 border-amber-200 text-amber-800">
              <AlertTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <IconAlertTriangle className="h-5 w-5" />
                  Please upload your offer letter to complete the process.
                </div>
                <Button
                  color="warning"
                  size="sm"
                  onPress={() => setUploadModalOpen(true)}
                >
                  Upload Letter
                </Button>
              </AlertTitle>
            </Alert>
          )}
        </div>

        {/* Header section with job title and company */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6 border border-gray-100">
          <div className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex gap-5">
                {drive?.company?.logo ? (
                  <Avatar
                    src={drive.company.logo}
                    className="h-16 w-16 rounded-xl"
                    alt={drive?.company?.name}
                    fallback={
                      <IconBuilding className="h-8 w-8 text-gray-400" />
                    }
                  />
                ) : (
                  <div className="h-16 w-16 bg-gray-100 rounded-xl flex items-center justify-center">
                    <IconBuilding className="h-8 w-8 text-gray-600" />
                  </div>
                )}
                <div>
                  <div className="flex gap-2 mb-2">
                    <Badge
                      color={isJobOpen ? "success" : "danger"}
                      variant="flat"
                      size="sm"
                    >
                      {isJobOpen ? "Active" : "Closed"}
                    </Badge>
                    <Badge color="primary" variant="flat" size="sm">
                      {routineMap[drive?.type] || drive?.type}
                    </Badge>
                  </div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {drive?.title}
                  </h1>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-gray-600 font-medium">
                      {drive?.company?.name}
                    </span>
                    <span className="text-gray-400">•</span>
                    <span className="text-gray-600 flex items-center gap-1">
                      <IconMapPin size={14} />
                      {drive?.location}
                    </span>
                  </div>
                </div>
              </div>

              <div className="md:flex-shrink-0">
                {applied ? (
                  <Button
                    color="success"
                    variant="flat"
                    disabled
                    className="h-10 px-4 font-medium"
                    startContent={<IconCheck size={16} />}
                  >
                    Applied
                  </Button>
                ) : (
                  <Button
                    color="primary"
                    onPress={apply}
                    className="h-10 px-6 font-medium"
                    disabled={!isJobOpen}
                  >
                    Apply Now
                  </Button>
                )}
              </div>
            </div>

            {/* Timeline progress bar */}
            {isJobOpen && (
              <div className="mt-6">
                <div className="flex justify-between text-sm font-medium mb-1.5">
                  <span className="text-gray-600">Application Period</span>
                  <div className="flex items-center text-gray-800 gap-1.5">
                    <IconClock size={15} className="text-primary-600" />
                    {timeLeft.days > 0 ? (
                      <span>
                        {timeLeft.days} day{timeLeft.days !== 1 ? "s" : ""},{" "}
                        {timeLeft.hours} hour{timeLeft.hours !== 1 ? "s" : ""}{" "}
                        remaining
                      </span>
                    ) : (
                      <span className="text-danger-600 font-semibold">
                        Closed
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-1.5">
                  <div>
                    <p className="text-xs text-gray-500">Posted On</p>
                    <p className="font-medium">
                      {new Date(drive?.createdAt || "").toLocaleDateString(
                        undefined,
                        {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        }
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Deadline</p>
                    <p className="font-medium">
                      {new Date(
                        drive?.applicationRange?.end || ""
                      ).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>

                <Progress
                  color={timeLeft.days < 3 ? "warning" : "primary"}
                  aria-label="Application period"
                  size="md"
                  value={
                    timeLeft.days > 0
                      ? ((new Date().getTime() -
                          new Date(drive?.applicationRange?.start).getTime()) /
                          (new Date(drive?.applicationRange?.end).getTime() -
                            new Date(
                              drive?.applicationRange?.start
                            ).getTime())) *
                        100
                      : 100
                  }
                  className="mt-1"
                />
              </div>
            )}
          </div>
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column - Job details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Job description */}
            <Card className="shadow-sm border border-gray-100">
              <CardBody className="p-0">
                <div className="p-6 border-b border-gray-100">
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <IconBriefcase className="h-5 w-5 text-gray-600" />
                    About the Role
                  </h2>
                </div>
                <div className="p-6">
                  <div id="editor-div" className="prose max-w-none" />
                </div>
              </CardBody>
            </Card>

            {/* Application Process */}
            <Card className="shadow-sm border border-gray-100">
              <CardBody className="p-0">
                <div className="p-6 border-b border-gray-100">
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <IconStairs className="h-5 w-5 text-gray-600" />
                    Application Process
                  </h2>
                </div>

                <div className="p-6">
                  <div className="relative">
                    {drive?.workflow?.steps &&
                    drive.workflow.steps.length > 0 ? (
                      <div className="space-y-4">
                        {/* Timeline connector */}
                        <div className="absolute top-0 bottom-0 left-5 w-0.5 bg-gray-200 z-0"></div>

                        {drive.workflow.steps.map((step, index) => (
                          <div
                            key={index}
                            className="flex items-start gap-4 relative z-10"
                          >
                            <div className="h-10 w-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold flex-shrink-0">
                              {index + 1}
                            </div>
                            <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100 flex-1">
                              <div className="flex justify-between items-center mb-1">
                                <h3 className="font-semibold text-gray-900">
                                  {step.name}
                                </h3>
                                <Chip
                                  startContent={getStepIcon(step.type)}
                                  size="sm"
                                  variant="flat"
                                  color="primary"
                                >
                                  {step.type
                                    .split("_")
                                    .map(
                                      (word) =>
                                        word.charAt(0).toUpperCase() +
                                        word.slice(1).toLowerCase()
                                    )
                                    .join(" ")}
                                </Chip>
                              </div>
                              <p className="text-sm text-gray-600">
                                {step.status === "completed"
                                  ? "Completed"
                                  : step.status === "in-progress"
                                  ? "In Progress"
                                  : "Pending"}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 bg-gray-50 rounded-lg">
                        <p className="text-gray-500">
                          No process steps defined yet.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Required Skills */}
            {drive?.skills && drive.skills.length > 0 && (
              <Card className="shadow-sm border border-gray-100">
                <CardBody className="p-0">
                  <div className="p-6 border-b border-gray-100">
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                      <IconChartBar className="h-5 w-5 text-gray-600" />
                      Required Skills
                    </h2>
                  </div>

                  <div className="p-6">
                    <div className="flex flex-wrap gap-2">
                      {drive.skills.map((skill, index) => (
                        <Chip key={index} variant="flat" color="secondary">
                          {skill}
                        </Chip>
                      ))}
                    </div>
                  </div>
                </CardBody>
              </Card>
            )}
          </div>

          {/* Right column - Application details */}
          <div className="space-y-6">
            {/* Profile Completion Card */}
            <Card className="shadow-sm border border-gray-100">
              <CardBody className="p-0">
                <div className="p-6 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <IconInfoCircle className="h-5 w-5 text-gray-600" />
                    Application Requirements
                  </h2>
                </div>

                <div className="p-6">
                  <div className="mb-6">
                    <div className="flex justify-between mb-2">
                      <span className="text-sm font-medium">
                        Profile Completion
                      </span>
                      <span className="text-sm font-semibold">
                        {completedFieldsPercentage}%
                      </span>
                    </div>
                    <Progress
                      aria-label="Profile completion"
                      value={completedFieldsPercentage}
                      color={
                        completedFieldsPercentage < 70
                          ? "danger"
                          : completedFieldsPercentage < 100
                          ? "warning"
                          : "success"
                      }
                      className="h-3 rounded-lg"
                    />

                    <div className="mt-2 flex justify-between text-xs">
                      <span className="text-gray-500">
                        Required Fields: {totalRequiredFields}
                      </span>
                      <span className="text-gray-500">
                        Missing: {missingFieldsCount}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3 mt-4 max-h-[320px] overflow-auto pr-2 custom-scrollbar">
                    {Object.entries(drive?.additionalDetails || {}).map(
                      ([sectionKey, section], idx) => {
                        // Filter out empty sections
                        const sectionFields = Object.entries(
                          section || {}
                        ).filter(
                          ([_, config]: [string, any]) => config?.required
                        );

                        if (sectionFields.length === 0) return null;

                        return (
                          <div
                            key={idx}
                            className="border border-gray-100 rounded-lg p-3"
                          >
                            <h3 className="font-medium text-gray-800 capitalize mb-2">
                              {sectionKey.replace(/([A-Z])/g, " $1").trim()}
                            </h3>
                            <div className="space-y-2">
                              {sectionFields.map(
                                (
                                  [fieldKey, fieldConfig]: [string, any],
                                  fidx
                                ) => {
                                  // Convert field name for display
                                  const displayName = fieldKey
                                    .replace(/([A-Z])/g, " $1")
                                    .toLowerCase()
                                    .replace(/^\w/, (c: string) =>
                                      c.toUpperCase()
                                    );

                                  // Determine field status
                                  const fieldValue =
                                    userDoc?.[fieldKey as keyof typeof userDoc];
                                  const isEmpty = Array.isArray(fieldValue)
                                    ? safeArrayLength(fieldValue as any[]) <= 0
                                    : !fieldValue;
                                  const isRequired =
                                    fieldConfig?.required &&
                                    !fieldConfig?.allowEmpty;
                                  const isMissing = isEmpty && isRequired;

                                  return (
                                    <div
                                      key={fidx}
                                      className="flex items-center justify-between text-sm p-2 rounded-md border border-gray-100"
                                    >
                                      <span>{displayName}</span>
                                      <Chip
                                        size="sm"
                                        color={
                                          isMissing
                                            ? "danger"
                                            : isEmpty
                                            ? "warning"
                                            : "success"
                                        }
                                        variant="flat"
                                      >
                                        {isMissing
                                          ? "Required"
                                          : isEmpty
                                          ? "Empty"
                                          : "Complete"}
                                      </Chip>
                                    </div>
                                  );
                                }
                              )}
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>

                  <div className="mt-6">
                    <a
                      href="/profile"
                      target="_blank"
                      className="w-full inline-flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors"
                    >
                      Update Your Profile
                      <IconArrowNarrowRight size={16} />
                    </a>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Quick Info Card */}
            <Card className="shadow-sm border border-gray-100">
              <CardBody className="p-0">
                <div className="p-6 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-900">
                    Key Details
                  </h2>
                </div>

                <div className="p-6 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <IconBriefcase className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Job Type</p>
                      <p className="font-medium mt-0.5 text-gray-900">
                        {routineMap[drive?.type] || drive?.type}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <IconCoin className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Salary Range</p>
                      <p className="font-medium mt-0.5 text-gray-900">
                        {drive?.salary?.min?.toLocaleString()} -{" "}
                        {drive?.salary?.max?.toLocaleString()}{" "}
                        {drive?.salary?.currency?.toUpperCase()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <IconUsers className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Openings</p>
                      <p className="font-medium mt-0.5 text-gray-900">
                        {drive?.openings} positions
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <IconMapPin className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Location</p>
                      <p className="font-medium mt-0.5 text-gray-900">
                        {drive?.location}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <IconCalendar className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">
                        Application Deadline
                      </p>
                      <p className="font-medium mt-0.5 text-gray-900">
                        {new Date(
                          drive?.applicationRange?.end || ""
                        ).toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>

            {/* Company Card */}
            <Card className="shadow-sm border border-gray-100">
              <CardBody className="p-0">
                <div className="p-6 border-b border-gray-100">
                  <h2 className="text-lg font-bold text-gray-900">
                    About the Company
                  </h2>
                </div>

                <div className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    {drive?.company?.logo ? (
                      <Avatar
                        src={drive.company.logo}
                        className="h-12 w-12"
                        alt={drive?.company?.name}
                      />
                    ) : (
                      <div className="h-12 w-12 bg-gray-100 rounded-full flex items-center justify-center">
                        <IconBuilding className="h-6 w-6 text-gray-500" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-medium text-lg">
                        {drive?.company?.name}
                      </h3>
                    </div>
                  </div>

                  <p className="text-gray-600 text-sm line-clamp-4 mb-4">
                    {drive?.company?.description ||
                      "A leading company in the industry"}
                  </p>

                  {drive?.company?.website && (
                    <a
                      href={drive.company.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-600 hover:text-primary-800 text-sm font-medium flex items-center gap-1.5"
                    >
                      Visit Company Website
                      <IconExternalLink size={14} />
                    </a>
                  )}
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
      {/* Application Modal */}
      <Modal
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        size="lg"
        scrollBehavior="outside"
        classNames={{
          base: "max-w-2xl",
        }}
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="border-b pb-4">
                <h2 className="text-xl font-bold">Apply for this Position</h2>
              </ModalHeader>
              <ModalBody className="py-6">
                <div className="space-y-5">
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <IconInfoCircle className="h-5 w-5 text-blue-600" />
                      </div>
                      <p className="text-blue-800">
                        Your profile details will be submitted with this
                        application. Please ensure all required information is
                        complete.
                      </p>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-medium text-gray-900 mb-3">
                      Required Information
                    </h3>

                    <div className="space-y-3">
                      {/* Summary of required fields with statuses */}
                      <Card className="shadow-sm border">
                        <CardBody className="p-4">
                          <div className="grid gap-3">
                            {Object.entries(drive?.additionalDetails || {}).map(
                              ([section, fields]) => {
                                const requiredFields = Object.entries(
                                  fields || {}
                                ).filter(
                                  ([_, config]: [string, any]) =>
                                    config?.required && !config?.allowEmpty
                                );

                                if (requiredFields.length === 0) return null;

                                return requiredFields.map(
                                  ([field, _]: [string, any]) => {
                                    // Convert field name to display name
                                    const displayName = field
                                      .replace(/([A-Z])/g, " $1")
                                      .toLowerCase()
                                      .replace(/^\w/, (c: string) =>
                                        c.toUpperCase()
                                      );

                                    // Check if field is provided in user data
                                    const fieldValue =
                                      userDoc?.[field as keyof typeof userDoc];
                                    const isProvided = Array.isArray(fieldValue)
                                      ? safeArrayLength(fieldValue as any[]) > 0
                                      : Boolean(fieldValue);

                                    return (
                                      <div
                                        key={`${section}-${field}`}
                                        className="flex items-center justify-between p-2 border border-gray-100 rounded-md bg-gray-50"
                                      >
                                        <span className="text-sm text-gray-700">
                                          {displayName}
                                        </span>
                                        <Chip
                                          color={
                                            isProvided ? "success" : "danger"
                                          }
                                          size="sm"
                                          variant={isProvided ? "dot" : "flat"}
                                        >
                                          {isProvided ? "Provided" : "Missing"}
                                        </Chip>
                                      </div>
                                    );
                                  }
                                );
                              }
                            )}
                          </div>
                        </CardBody>
                      </Card>

                      {getRequiredFieldsMissingCount() > 0 && (
                        <div className="mt-3 text-center p-4 bg-danger-50 rounded-lg border border-danger-100">
                          <p className="text-danger-700 mb-3">
                            {getRequiredFieldsMissingCount()} required{" "}
                            {getRequiredFieldsMissingCount() === 1
                              ? "field is"
                              : "fields are"}{" "}
                            missing from your profile
                          </p>
                          <a
                            href="/profile"
                            target="_blank"
                            className="inline-flex items-center justify-center gap-2 bg-danger-100 hover:bg-danger-200 text-danger-700 font-medium py-2 px-4 rounded-lg transition-colors"
                          >
                            Complete your profile
                            <IconArrowNarrowRight size={16} />
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </ModalBody>
              <ModalFooter className="border-t pt-4">
                <Button color="default" variant="light" onPress={onClose}>
                  Cancel
                </Button>
                <Button
                  color="primary"
                  onPress={applyToJob}
                  isDisabled={getRequiredFieldsMissingCount() > 0}
                  isLoading={applyLoading}
                  className="px-6"
                >
                  Submit Application
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
      {/* Success Modal with Registration Link */}
      <Modal
        isOpen={successModalOpen}
        onOpenChange={closeSuccessModal}
        size="md"
      >
        <ModalContent>
          {(onClose) => (
            <>
              <ModalBody className="py-8">
                <div className="flex flex-col items-center">
                  <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
                    <IconCheck className="h-10 w-10 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-center mb-2">
                    Application Submitted!
                  </h2>
                  <p className="text-center text-gray-600 mb-6 max-w-md">
                    You've successfully applied to{" "}
                    <span className="font-medium">{drive?.title}</span> at{" "}
                    <span className="font-medium">{drive?.company?.name}</span>.
                  </p>

                  {drive?.link ? (
                    <div className="w-full bg-blue-50 p-5 rounded-lg border border-blue-200 mb-4">
                      <p className="text-center font-medium text-blue-700 mb-4">
                        Please complete your registration using the link below:
                      </p>
                      <a
                        href={drive.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <IconExternalLink size={18} />
                        Complete Registration
                      </a>
                    </div>
                  ) : (
                    <div className="w-full bg-green-50 p-5 rounded-lg border border-green-200 mb-4">
                      <p className="text-center text-green-700">
                        We'll notify you about the next steps in the application
                        process.
                      </p>
                    </div>
                  )}
                </div>
              </ModalBody>
              <ModalFooter className="pb-6 justify-center">
                <Button color="primary" onPress={onClose} className="w-full">
                  Close
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
      {/* Upload Offer Letter Modal */}
      <UploadOfferLetter
        isOpen={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        onUpload={handleFileUpload}
        title="Upload Offer Letter"
        isLoading={uploadLoading}
        currency={drive?.salary?.currency}
      />
    </div>
  );
};

export default Drive;
