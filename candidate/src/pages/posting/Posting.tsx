import { useEffect, useState } from "react";
import { useAuth, useUser } from "@/auth";
import { toast } from "sonner";
import ax from "@/config/axios";
import {
  Button,
  Card,
  CardBody,
  Chip,
  Divider,
  Progress,
  Tooltip,
  useDisclosure,
} from "@heroui/react";
import {
  IconBriefcase,
  IconBuilding,
  IconCalendar,
  IconClock,
  IconMapPin,
  IconCurrencyDollar,
  IconUsers,
  IconBuildingBank,
  IconStairs,
  IconArrowNarrowRight,
  IconCheck,
  IconExclamationCircle,
  IconGlobe,
  IconMail,
  IconExternalLink,
} from "@tabler/icons-react";
import {
  Posting as PostingType,
  AdditionalFieldConfig,
} from "@shared-types/Posting";
import { Organization } from "@shared-types/Organization";
import Quill from "quill";
import Loader from "@/components/Loader";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/react";
import { useOutletContext } from "react-router-dom";
import { Candidate } from "@shared-types/Candidate";

const routineMap = {
  full_time: "Full Time",
  part_time: "Part Time",
  internship: "Internship",
  contract: "Contract",
  freelance: "Freelance",
};

interface PostingOrganization extends Omit<PostingType, "organizationId"> {
  organizationId: Organization;
  createdOn: string;
}

type FieldPathInfo = {
  name: string;
  path: string[];
  userField: any[] | string | null;
};

const Posting = () => {
  const { getToken } = useAuth();
  const axios = ax(getToken);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState<PostingOrganization>(
    {} as PostingOrganization
  );
  const [applied, setApplied] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");
  const [areApplicationsOpen, setAreApplicationsOpen] = useState(false);
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [applyLoading, setApplyLoading] = useState(false);

  const { user } = useUser();
  const { user: userDoc } = useOutletContext() as { user: Candidate };

  useEffect(() => {
    const filter = posting?.candidates?.filter(
      (candidate: any) => candidate._id?.toString() === userDoc?._id?.toString()
    );

    if (filter && filter.length > 0) {
      setApplied(true);
    }
  }, [user, posting, userDoc]);

  useEffect(() => {
    setLoading(true);
    const postingId = window.location.pathname.split("/")[2];
    axios
      .get(`/postings/slug/${postingId}`)
      .then((res) => {
        setPosting(res.data.data);
        updateTimeLeft(res.data.data.applicationRange.end);

        // Check if applications are open
        const now = new Date();
        const startDate = new Date(res.data.data.applicationRange.start);
        const endDate = new Date(res.data.data.applicationRange.end);
        setAreApplicationsOpen(
          now >= startDate && now <= endDate && res.data.data.active
        );

        // Initialize Quill editor after a short delay
        setTimeout(() => {
          const quill = new Quill("#editor-div", {
            readOnly: true,
            theme: "bubble",
            modules: { toolbar: false },
          });
          quill.setContents(res.data.data.description);
        }, 100);
      })
      .catch((err) => {
        toast.error("Failed to fetch posting details");
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, []);

  const updateTimeLeft = (endDate: string) => {
    const now = new Date();
    const end = new Date(endDate);

    if (isNaN(end.getTime())) {
      console.error("Invalid endDate");
      return;
    }

    const diff = end.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    setTimeLeft(`${days} days`);
  };

  const applyToJob = () => {
    setApplyLoading(true);
    axios
      .post(`/candidates/apply`, { postingId: posting?._id })
      .then(() => {
        setApplied(true);
        toast.success("Application submitted successfully");
        onOpenChange();
      })
      .catch((err) => {
        toast.error(
          err.response.data.message || "Failed to submit application"
        );
        console.error(err);
      })
      .finally(() => setApplyLoading(false));
  };

  if (loading) {
    return <Loader />;
  }

  const isJobOpen = new Date(posting?.applicationRange?.end) > new Date();
  const daysLeft = parseInt(timeLeft);

  // Type-safe function to get nested field config
  const getFieldConfig = (
    details: PostingType["additionalDetails"],
    category: string,
    field: string
  ): AdditionalFieldConfig | undefined => {
    if (!details) return undefined;

    const categoryObj = details[category as keyof typeof details];
    if (!categoryObj) return undefined;

    return categoryObj[
      field as keyof typeof categoryObj
    ] as AdditionalFieldConfig;
  };

  const getRequiredFieldsMissingCount = () => {
    let count = 0;
    const details = posting?.additionalDetails;

    if (!details) return 0;

    // Basic fields
    const summaryConfig = getFieldConfig(details, "basic", "summary");
    if (
      summaryConfig?.required &&
      !userDoc?.summary &&
      !summaryConfig.allowEmpty
    )
      count++;

    // Links fields
    const socialLinksConfig = getFieldConfig(details, "links", "socialLinks");
    if (
      socialLinksConfig?.required &&
      (userDoc?.socialLinks?.length ?? 0) <= 0 &&
      !socialLinksConfig.allowEmpty
    )
      count++;

    // Background fields
    const educationConfig = getFieldConfig(details, "background", "education");
    if (
      educationConfig?.required &&
      (userDoc?.education?.length ?? 0) <= 0 &&
      !educationConfig.allowEmpty
    )
      count++;

    const workExperienceConfig = getFieldConfig(
      details,
      "background",
      "workExperience"
    );
    if (
      workExperienceConfig?.required &&
      (userDoc?.workExperience?.length ?? 0) <= 0 &&
      !workExperienceConfig.allowEmpty
    )
      count++;

    // Skills fields
    const technicalSkillsConfig = getFieldConfig(
      details,
      "skills",
      "technicalSkills"
    );
    if (
      technicalSkillsConfig?.required &&
      (userDoc?.technicalSkills?.length ?? 0) <= 0 &&
      !technicalSkillsConfig.allowEmpty
    )
      count++;

    const languagesConfig = getFieldConfig(details, "skills", "languages");
    if (
      languagesConfig?.required &&
      (userDoc?.languages?.length ?? 0) <= 0 &&
      !languagesConfig.allowEmpty
    )
      count++;

    const subjectsConfig = getFieldConfig(details, "skills", "subjects");
    if (
      subjectsConfig?.required &&
      (userDoc?.subjects?.length ?? 0) <= 0 &&
      !subjectsConfig.allowEmpty
    )
      count++;

    // Experience fields
    const responsibilitiesConfig = getFieldConfig(
      details,
      "experience",
      "responsibilities"
    );
    if (
      responsibilitiesConfig?.required &&
      (userDoc?.responsibilities?.length ?? 0) <= 0 &&
      !responsibilitiesConfig.allowEmpty
    )
      count++;

    const projectsConfig = getFieldConfig(details, "experience", "projects");
    if (
      projectsConfig?.required &&
      (userDoc?.projects?.length ?? 0) <= 0 &&
      !projectsConfig.allowEmpty
    )
      count++;

    // Achievement fields
    const awardsConfig = getFieldConfig(details, "achievements", "awards");
    if (
      awardsConfig?.required &&
      (userDoc?.awards?.length ?? 0) <= 0 &&
      !awardsConfig.allowEmpty
    )
      count++;

    const certificatesConfig = getFieldConfig(
      details,
      "achievements",
      "certificates"
    );
    if (
      certificatesConfig?.required &&
      (userDoc?.certificates?.length ?? 0) <= 0 &&
      !certificatesConfig.allowEmpty
    )
      count++;

    const competitionsConfig = getFieldConfig(
      details,
      "achievements",
      "competitions"
    );
    if (
      competitionsConfig?.required &&
      (userDoc?.competitions?.length ?? 0) <= 0 &&
      !competitionsConfig.allowEmpty
    )
      count++;

    return count;
  };

  // Format currency with proper symbol
  const getCurrencySymbol = (currency: string = "USD") => {
    const symbols: Record<string, string> = {
      USD: "$",
      EUR: "€",
      GBP: "£",
      JPY: "¥",
      INR: "₹",
    };
    return symbols[currency.toUpperCase()] || currency.toUpperCase();
  };

  // Helper function to get field status for application modal
  const getFieldStatus = (
    fieldConfig: AdditionalFieldConfig | undefined,
    isEmpty: boolean
  ) => {
    if (!fieldConfig?.required) return null;

    if (isEmpty) {
      if (fieldConfig?.allowEmpty) {
        return { status: "warning", text: "Optional" };
      }
      return { status: "danger", text: "Required" };
    }
    return { status: "success", text: "Complete" };
  };

  const missingFieldsCount = getRequiredFieldsMissingCount();

  // Pre-define the field paths for more type safety
  const fieldPaths: FieldPathInfo[] = [
    {
      name: "Summary",
      path: ["basic", "summary"],
      userField: userDoc?.summary ?? null,
    },
    {
      name: "Social Links",
      path: ["links", "socialLinks"],
      userField: userDoc?.socialLinks ?? null,
    },
    {
      name: "Education",
      path: ["background", "education"],
      userField: userDoc?.education ?? null,
    },
    {
      name: "Work Experience",
      path: ["background", "workExperience"],
      userField: userDoc?.workExperience ?? null,
    },
    {
      name: "Technical Skills",
      path: ["skills", "technicalSkills"],
      userField: userDoc?.technicalSkills ?? null,
    },
    {
      name: "Languages",
      path: ["skills", "languages"],
      userField: userDoc?.languages ?? null,
    },
    {
      name: "Subjects",
      path: ["skills", "subjects"],
      userField: userDoc?.subjects ?? null,
    },
    {
      name: "Responsibilities",
      path: ["experience", "responsibilities"],
      userField: userDoc?.responsibilities ?? null,
    },
    {
      name: "Projects",
      path: ["experience", "projects"],
      userField: userDoc?.projects ?? null,
    },
    {
      name: "Awards",
      path: ["achievements", "awards"],
      userField: userDoc?.awards ?? null,
    },
    {
      name: "Certificates",
      path: ["achievements", "certificates"],
      userField: userDoc?.certificates ?? null,
    },
    {
      name: "Competitions",
      path: ["achievements", "competitions"],
      userField: userDoc?.competitions ?? null,
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 bg-gradient-to-b from-gray-50 to-white min-h-screen">
      {/* Hero Section */}
      <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-6">
          <div className="space-y-6 flex-1">
            {/* Company Logo and Basic Info */}
            <div className="flex items-center gap-5">
              <div className="h-20 w-20 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-xl flex items-center justify-center shadow-sm">
                {posting?.organizationId?.logo ? (
                  <img
                    src={posting.organizationId.logo}
                    alt={`${posting.organizationId.name} logo`}
                    className="h-16 w-16 object-contain rounded-lg"
                  />
                ) : (
                  <IconBuilding className="h-10 w-10 text-indigo-500" />
                )}
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800 mb-1">
                  {posting?.title}
                </h1>
                <div className="flex items-center text-gray-600">
                  <span className="font-medium">
                    {posting?.organizationId?.name}
                  </span>
                </div>
              </div>
            </div>

            {/* Key Info Chips */}
            <div className="flex gap-3 flex-wrap">
              <Chip
                startContent={<IconClock size={16} />}
                color={isJobOpen ? "success" : "danger"}
                variant="flat"
                className="py-1 px-3"
              >
                {isJobOpen ? "Active" : "Closed"}
              </Chip>
              <Chip
                startContent={<IconBriefcase size={16} />}
                color="primary"
                variant="flat"
                className="py-1 px-3"
              >
                {/* @ts-expect-error */}
                {routineMap[posting?.type]}
              </Chip>
              <Chip
                startContent={<IconMapPin size={16} />}
                color="secondary"
                variant="flat"
                className="py-1 px-3"
              >
                {posting?.location}
              </Chip>
              {posting?.department && (
                <Chip
                  startContent={<IconBuildingBank size={16} />}
                  color="warning"
                  variant="flat"
                  className="py-1 px-3"
                >
                  {posting?.organizationId?.departments?.find(
                    (d) => d._id === posting?.department
                  )?.name || "Department"}
                </Chip>
              )}
              <Chip
                startContent={<IconCalendar size={16} />}
                color="default"
                variant="flat"
                className="py-1 px-3"
              >
                {new Date(posting?.createdAt || "").toLocaleDateString()}
              </Chip>
            </div>
          </div>

          {/* Application Button */}
          <div className="flex flex-col items-center gap-3">
            {applied ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center flex flex-col items-center">
                <div className="bg-green-100 h-10 w-10 rounded-full flex items-center justify-center mb-2">
                  <IconCheck className="h-6 w-6 text-green-600" />
                </div>
                <span className="text-green-700 font-medium">
                  Application Submitted
                </span>
                <span className="text-green-500 text-sm">
                  You've already applied
                </span>
              </div>
            ) : areApplicationsOpen ? (
              <Button
                onClick={onOpen}
                color="primary"
                className="font-semibold min-w-[200px]"
                size="lg"
                endContent={<IconArrowNarrowRight size={18} />}
                variant="shadow"
              >
                Apply Now
              </Button>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
                <div className="bg-gray-100 h-10 w-10 rounded-full mx-auto flex items-center justify-center mb-2">
                  <IconClock className="h-6 w-6 text-gray-500" />
                </div>
                <span className="text-gray-700 font-medium">
                  Applications Closed
                </span>
              </div>
            )}

            {areApplicationsOpen && (
              <Tooltip
                content={`Application deadline: ${new Date(
                  posting?.applicationRange?.end || ""
                ).toLocaleDateString()}`}
              >
                <div className="text-center w-full">
                  <span className="text-sm font-medium text-gray-600 mb-1 block">
                    {daysLeft > 0 ? (
                      <>
                        Closes in{" "}
                        <span
                          className={`${
                            daysLeft < 7 ? "text-red-600" : "text-blue-600"
                          } font-semibold`}
                        >
                          {timeLeft}
                        </span>
                      </>
                    ) : (
                      "Closed"
                    )}
                  </span>
                  <Progress
                    value={100 - Math.min(100, Math.max(0, daysLeft * 3))}
                    color={
                      daysLeft < 3
                        ? "danger"
                        : daysLeft < 7
                        ? "warning"
                        : "primary"
                    }
                    size="sm"
                    radius="sm"
                    className="max-w-[200px]"
                  />
                </div>
              </Tooltip>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Main Content - Left 2 Columns */}
        <div className="lg:col-span-2 space-y-6">
          {/* Timeline Card */}
          <Card className="shadow-sm border border-gray-100 overflow-visible">
            <CardBody className="p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="bg-blue-50 p-2 rounded-md">
                  <IconCalendar className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800">
                  Application Timeline
                </h3>
              </div>

              <div className="relative">
                <div className="absolute top-1/2 left-[90px] right-[90px] h-2 bg-gray-100 transform -translate-y-1/2 rounded-full"></div>
                <div className="flex items-center justify-between relative z-10">
                  <div className="bg-white p-1 rounded-lg shadow-sm border border-gray-100">
                    <div className="text-center p-3">
                      <div className="bg-blue-100 h-12 w-12 rounded-full mx-auto flex items-center justify-center mb-2">
                        <IconCalendar className="h-6 w-6 text-blue-600" />
                      </div>
                      <p className="text-sm font-semibold text-gray-800">
                        Posted On
                      </p>
                      <p className="text-base text-blue-600 font-medium">
                        {new Date(
                          posting?.createdAt || ""
                        ).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="bg-white p-1 rounded-lg shadow-sm border border-gray-100">
                    <div className="text-center p-3">
                      <div
                        className={`${
                          isJobOpen ? "bg-amber-100" : "bg-red-100"
                        } h-12 w-12 rounded-full mx-auto flex items-center justify-center mb-2`}
                      >
                        <IconClock
                          className={`h-6 w-6 ${
                            isJobOpen ? "text-amber-600" : "text-red-600"
                          }`}
                        />
                      </div>
                      <p className="text-sm font-semibold text-gray-800">
                        Deadline
                      </p>
                      <p
                        className={`text-base font-medium ${
                          isJobOpen ? "text-amber-600" : "text-red-600"
                        }`}
                      >
                        {new Date(
                          posting?.applicationRange?.end || ""
                        ).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Job Description */}
          <Card className="shadow-sm border border-gray-100">
            <CardBody className="p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="bg-indigo-50 p-2 rounded-md">
                  <IconBriefcase className="h-5 w-5 text-indigo-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800">
                  Job Description
                </h3>
              </div>
              <div className="bg-gray-50 rounded-xl p-6">
                <div id="editor-div" className="prose max-w-none" />
              </div>
            </CardBody>
          </Card>

          {/* Application Process */}
          <Card className="shadow-sm border border-gray-100">
            <CardBody className="p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="bg-green-50 p-2 rounded-md">
                  <IconStairs className="h-5 w-5 text-green-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800">
                  Application Process
                </h3>
              </div>

              <div className="space-y-6 px-2">
                {posting?.workflow?.steps?.map((step, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="bg-gradient-to-br from-blue-500 to-indigo-500 min-w-[36px] h-9 rounded-full text-white flex items-center justify-center font-semibold text-lg">
                      {index + 1}
                    </div>
                    <div className="bg-gray-50 p-4 rounded-xl flex-1">
                      <h6 className="text-lg font-semibold text-gray-700">
                        {step.name}
                      </h6>
                      <p className="text-gray-500 text-sm mt-1">
                        {step.type === "RESUME_SCREENING" &&
                          "Your resume will be evaluated based on job requirements"}
                        {step.type === "MCQ_ASSESSMENT" &&
                          "Complete a multiple-choice questionnaire to assess your knowledge"}
                        {step.type === "CODING_ASSESSMENT" &&
                          "Demonstrate your coding skills through practical challenges"}
                        {step.type === "ASSIGNMENT" &&
                          "Complete a specific assignment to showcase your abilities"}
                        {step.type === "INTERVIEW" &&
                          "Meet with the team for a personalized interview session"}
                        {step.type === "CUSTOM" &&
                          "Special evaluation process specific to this position"}
                      </p>
                    </div>
                  </div>
                ))}

                {(!posting?.workflow?.steps ||
                  posting.workflow.steps.length === 0) && (
                  <div className="text-center py-6 text-gray-500">
                    No application process steps defined.
                  </div>
                )}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* Right Column - Job Details */}
        <div className="space-y-6">
          {/* Job Overview Card */}
          <Card className="shadow-sm border border-gray-100">
            <CardBody className="p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="bg-purple-50 p-2 rounded-md">
                  <IconBriefcase className="h-5 w-5 text-purple-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800">
                  Job Overview
                </h3>
              </div>

              <div className="space-y-5">
                {/* Salary Range */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="bg-green-100 p-2 rounded-lg mt-1">
                      <IconCurrencyDollar className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-gray-500 text-sm">Salary Range</p>
                      <p className="text-lg font-semibold mt-1 text-gray-800">
                        {getCurrencySymbol(posting?.salary?.currency)}{" "}
                        {posting?.salary?.min?.toLocaleString()} -{" "}
                        {posting?.salary?.max?.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Number of Openings */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="bg-blue-100 p-2 rounded-lg mt-1">
                      <IconUsers className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-gray-500 text-sm">
                        Number of Openings
                      </p>
                      <p className="text-lg font-semibold mt-1 text-gray-800">
                        {posting?.openings} position
                        {posting?.openings !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Department */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="bg-indigo-100 p-2 rounded-lg mt-1">
                      <IconBuildingBank className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-gray-500 text-sm">Department</p>
                      <p className="text-lg font-semibold mt-1 text-gray-800">
                        {posting?.organizationId?.departments?.find(
                          (d) => d._id === posting?.department
                        )?.name || "Not specified"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Required Skills */}
                {posting?.skills && posting.skills.length > 0 && (
                  <>
                    <Divider className="my-4" />
                    <div>
                      <p className="text-gray-700 font-medium mb-3">
                        Required Skills
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {posting.skills.map((skill, index) => (
                          <Chip
                            key={index}
                            color="primary"
                            variant="flat"
                            size="sm"
                          >
                            {skill}
                          </Chip>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </CardBody>
          </Card>

          {/* About the Company */}
          <Card className="shadow-sm border border-gray-100">
            <CardBody className="p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="bg-amber-50 p-2 rounded-md">
                  <IconBuilding className="h-5 w-5 text-amber-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800">
                  About the Company
                </h3>
              </div>

              <div className="flex flex-col items-center text-center mb-4">
                <div className="bg-gray-50 p-4 rounded-xl w-full mb-4 flex justify-center">
                  <img
                    src={
                      posting?.organizationId?.logo ||
                      "/api/placeholder/200/100"
                    }
                    alt="Company logo"
                    className="rounded-lg h-20 object-contain"
                  />
                </div>
                <h4 className="font-semibold text-xl text-gray-800 mb-1">
                  {posting?.organizationId?.name}
                </h4>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 text-gray-600">
                  <IconMail className="h-5 w-5 text-blue-500 flex-shrink-0" />
                  <a
                    className="hover:underline hover:text-primary"
                    href={`mailto:${posting?.organizationId?.email}`}
                  >
                    {posting?.organizationId?.email}
                  </a>
                </div>

                <div className="flex items-center gap-2 text-gray-600">
                  <IconGlobe className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <a
                    className="hover:underline hover:text-primary"
                    href={posting?.organizationId?.website}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {posting?.organizationId?.website}
                  </a>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Application Modal */}
      <Modal size="lg" isOpen={isOpen} onOpenChange={onOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <div className="flex items-center gap-3">
                  <IconBriefcase className="h-6 w-6 text-primary" />
                  <span>Apply for {posting?.title}</span>
                </div>
              </ModalHeader>
              <ModalBody>
                <div className="space-y-6">
                  {/* Profile Completeness */}
                  <div className="bg-blue-50 rounded-xl p-4">
                    <div className="flex justify-between items-center mb-2">
                      <div className="font-medium text-blue-700">
                        Profile Completion
                      </div>
                      <div className="text-sm text-blue-700">
                        {missingFieldsCount === 0
                          ? "Ready to apply!"
                          : `${missingFieldsCount} required field${
                              missingFieldsCount > 1 ? "s" : ""
                            } missing`}
                      </div>
                    </div>
                    <Progress
                      value={100 - missingFieldsCount * 10}
                      color={missingFieldsCount > 0 ? "warning" : "success"}
                      className="h-2"
                    />
                  </div>

                  <div className="text-gray-600">
                    The following information from your profile will be shared
                    with the employer:
                  </div>

                  {/* Required Fields Section */}
                  <div className="space-y-3">
                    {fieldPaths.map((field) => {
                      const [category, fieldName] = field.path;
                      const fieldConfig = getFieldConfig(
                        posting?.additionalDetails,
                        category,
                        fieldName
                      );

                      if (!fieldConfig?.required) return null;

                      const isEmpty =
                        !field.userField ||
                        (Array.isArray(field.userField) &&
                          field.userField.length === 0);

                      const status = getFieldStatus(
                        fieldConfig,
                        isEmpty
                      );

                      if (!status) return null;

                      return (
                        <div
                          key={`${category}-${fieldName}`}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="font-medium">{field.name}</div>
                          <Chip
                            color={
                              status.status === "success"
                                ? "success"
                                : status.status === "warning"
                                ? "warning"
                                : "danger"
                            }
                            variant="flat"
                            startContent={
                              status.status === "success" ? (
                                <IconCheck size={14} />
                              ) : status.status === "warning" ? (
                                <IconExclamationCircle size={14} />
                              ) : (
                                <IconExclamationCircle size={14} />
                              )
                            }
                          >
                            {status.text}
                          </Chip>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-2 text-sm">
                    <IconExternalLink size={16} />
                    <a
                      href="/profile"
                      target="_blank"
                      className="text-blue-600 hover:underline"
                    >
                      Update your profile
                    </a>
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button color="default" variant="light" onPress={onClose}>
                  Cancel
                </Button>
                <Button
                  color="primary"
                  onPress={applyToJob}
                  isDisabled={missingFieldsCount > 0}
                  isLoading={applyLoading}
                  className="font-medium"
                  endContent={<IconArrowNarrowRight size={16} />}
                >
                  Submit Application
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
};

export default Posting;
