import {
  Button,
  Card,
  CardBody,
  CardHeader,
  DateValue,
  RangeValue,
  Tab,
  Tabs,
  TimeInputValue,
} from "@heroui/react";
import { useState, Key } from "react";
import General from "./General";
import Instructions from "./Instructions";
import Security from "./Security";
import Feedback from "./Feedback";
import Mcqs from "../mcq/createmcq/Mcqs";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  today,
  getLocalTimeZone,
  parseAbsoluteToLocal,
} from "@internationalized/date";
import { useAuth } from "@/auth";
import ax from "@/config/axios";
import { toast } from "sonner";
import {
  Section,
  Question,
  Candidate,
  MCQAssessment,
} from "@shared-types/MCQAssessment";
import Candidates from "./Candidates";

export interface AddQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddQuestion: (question: Question) => void;
  editingQuestion: Question | null;
}

export interface McqContentProps {
  selectedSection: Section | null;
}

export interface McqProps {
  sections: Section[];
  setSections: (sections: Section[]) => void;
  selectedSection: Section | null;
  setSelectedSection: (section: Section | null) => void;
}

const isPosting = new URLSearchParams(window.location.search).get("isPosting");
const postingId = new URLSearchParams(window.location.search).get("postingId");
const step = new URLSearchParams(window.location.search).get("step");

const tabsList = [
  "General",
  "MCQs",
  !postingId ? "Candidates" : null,
  "Instructions",
  "Security",
  "Feedback",
].filter(Boolean);

const New = () => {
  const [activeTab, setActiveTab] = useState("0");

  const [assessmentName, setAssessmentName] = useState("");
  const [assessmentDescription, setAssessmentDescription] = useState("");
  const [timeLimit, setTimeLimit] = useState(0);
  const [passingPercentage, setPassingPercentage] = useState(0);

  const [testOpenRange, setTestOpenRange] = useState<RangeValue<DateValue>>({
    start: today(getLocalTimeZone()),
    end: today(getLocalTimeZone()).add({ weeks: 1 }),
  });
  const [focusedValue, setFocusedValue] = useState(today(getLocalTimeZone()));

  const [startTime, setStartTime] = useState<TimeInputValue>(
    parseAbsoluteToLocal(new Date().toISOString())
  );
  const [endTime, setEndTime] = useState<TimeInputValue>(
    parseAbsoluteToLocal(new Date().toISOString())
  );

  const [sections, setSections] = useState<Section[]>([]);

  const [selectedSectionIndex, setSelectedSectionIndex] = useState<
    number | null
  >(null);

  const [access, setAccess] = useState("all");
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  const [instructions, setInstructions] = useState("");

  // Security Tab States
  const [codePlayback, setCodePlayback] = useState(false);
  const [tabChangeDetection, setTabChangeDetection] = useState(false);
  const [copyPasteDetection, setCopyPasteDetection] = useState(false);

  const [feedbackEmail, setFeedbackEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleTabChange = (key: Key) => {
    setActiveTab(key.toString());
  };

  const addAssessment = (assessment: MCQAssessment) => {
    // import assessment form user
    setAssessmentName(assessment.name);
    setAssessmentDescription(assessment.description);
    setTimeLimit(assessment.timeLimit);
    setPassingPercentage(assessment.passingPercentage);
    setTestOpenRange({
      start: today(getLocalTimeZone()),
      end: today(getLocalTimeZone()).add({ weeks: 1 }),
    });
    setFocusedValue(today(getLocalTimeZone()));
    setStartTime(parseAbsoluteToLocal(new Date().toISOString()));
    setEndTime(parseAbsoluteToLocal(new Date().toISOString()));
    setSections(assessment.sections);
    setInstructions(assessment.instructions);
    setCodePlayback(assessment.security?.sessionPlayback || false);
    setTabChangeDetection(assessment?.security?.tabChangeDetection || false);
    setCopyPasteDetection(assessment?.security?.copyPasteDetection || false);
    setFeedbackEmail(assessment.feedbackEmail);
  };

  const { getToken } = useAuth();

  const getParam = (name: string) => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
  };

  const buildAssessmentData = () => {
    setLoading(true);
    const rangeStart = testOpenRange.start.toDate("UTC");
    const rangeEnd = testOpenRange.end.toDate("UTC");
    rangeStart.setHours(startTime.hour);
    rangeStart.setMinutes(startTime.minute);
    rangeEnd.setHours(endTime.hour);
    rangeEnd.setMinutes(endTime.minute);

    const redirectParam = getParam("returnUrl");

    const reqBody = {
      assessmentPostingName: assessmentName,
      name: assessmentName,
      isEnterprise: isPosting ? isPosting : false,
      description: assessmentDescription,
      timeLimit,
      passingPercentage,
      openRange: isPosting
        ? null
        : {
            start: rangeStart,
            end: rangeEnd,
          },
      sections: sections,
      candidates: isPosting ? [] : candidates,
      public: isPosting ? true : access === "all",
      instructions,
      security: {
        codePlayback,
        tabChangeDetection,
        copyPasteDetection,
      },
      feedbackEmail,
      postingId,
      step,
    };

    // const safeUrls = [
    //   "https://enterprise.scriptopia.tech/",
    //   "https://scriptopia.tech/",
    //   "https://campus.scriptopia.tech/",
    //   "https://candidate.scriptopia.tech/",
    //   "localhost:5172",
    //   "localhost:5173",
    //   "localhost:5174",
    //   "localhost:5175",
    // ];

    const axios = ax(getToken);
    axios
      .post("/assessments/mcq", reqBody)
      .then(() => {
        toast.success("Assessment created successfully");
        if (redirectParam) {
          // try {
          //   const redirectUrl = new URL(redirectParam);
          //   const isSafeUrl = safeUrls.some(
          //     (url) => redirectUrl.origin === url
          //   );
          //   if (isSafeUrl) {
          //     window.location.href = redirectParam;
          //   } else {
          //     console.warn("Unsafe redirect URL detected:", redirectParam);
          //     window.location.href = "/";
          //   }
          // } catch (error) {
          //   console.error("Invalid redirect URL:", redirectParam);
          //   window.location.href = "/";
          // }
          window.location.href = redirectParam;
        } else {
          window.location.href = window.location.pathname
            .split("/")
            .slice(0, -2)
            .join("/");
        }
      })
      .catch((err) => {
        console.error(err);
        toast.error("Error creating assessment");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const tabsComponents = [
    <General
      {...{
        assessmentName,
        setAssessmentName,
        assessmentDescription,
        setAssessmentDescription,
        timeLimit,
        setTimeLimit,
        passingPercentage,
        setPassingPercentage,
        testOpenRange,
        setTestOpenRange,
        startTime,
        setStartTime,
        endTime,
        setEndTime,
        focusedValue,
        setFocusedValue,
        addAssessment,
      }}
    />,
    <Mcqs
      sections={sections}
      setSections={setSections}
      selectedSectionIndex={selectedSectionIndex}
      setSelectedSectionIndex={setSelectedSectionIndex}
    />,
    !postingId && (
      <Candidates {...{ access, setAccess, candidates, setCandidates }} />
    ),
    <Instructions {...{ instructions, setInstructions }} />,
    <Security
      {...{
        codePlayback,
        setCodePlayback,
        tabChangeDetection,
        setTabChangeDetection,
        copyPasteDetection,
        setCopyPasteDetection,
      }}
    />,
    <Feedback
      {...{
        feedbackEmail,
        setFeedbackEmail,
        buildAssessmentData,
        loading,
      }}
    />,
  ].filter(Boolean);

  return (
    <div className="flex items-center justify-center flex-col relative w-full">
      <Tabs selectedKey={activeTab} onSelectionChange={handleTabChange}>
        {tabsList.map((tabItem, i) => (
          <Tab key={i} title={tabItem} className="w-full">
            <Card className="w-full h-[80vh]">
              <CardHeader className="border-b flex items-center justify-between">
                <p>{tabItem}</p>
                <div className="flex gap-2">
                  <Button
                    variant="shadow"
                    size="sm"
                    isIconOnly
                    onClick={() =>
                      handleTabChange((parseInt(activeTab) - 1).toString())
                    }
                    isDisabled={parseInt(activeTab) === 0}
                  >
                    <ChevronLeft />
                  </Button>
                  <Button
                    variant="shadow"
                    size="sm"
                    isIconOnly
                    onClick={() =>
                      handleTabChange((parseInt(activeTab) + 1).toString())
                    }
                    isDisabled={parseInt(activeTab) === tabsList.length - 1}
                  >
                    <ChevronRight />
                  </Button>
                </div>
              </CardHeader>
              <CardBody className="px-10 py-5">{tabsComponents[i]}</CardBody>
            </Card>
          </Tab>
        ))}
      </Tabs>
    </div>
  );
};

export default New;
