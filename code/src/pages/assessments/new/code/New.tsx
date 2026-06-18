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
import { useEffect, useState } from "react";
import General from "./General";
import Questions from "./Questions";
import Grading from "./Grading";
import Instructions from "./Instructions";
import Security from "./Security";
import Feedback from "./Feedback";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  today,
  getLocalTimeZone,
  parseAbsoluteToLocal,
} from "@internationalized/date";
import Languages from "./Languages";
import { useAuth } from "@/auth";
import ax from "@/config/axios";
import { toast } from "sonner";
import { Problem as VanillaProblem } from "@shared-types/Problem";
import { Problem as ProblemAssessment } from "@shared-types/CodeAssessment";
import { Key } from "react";
import { Delta } from "quill/core";
import Candidates from "./Candidates";

interface Problem extends VanillaProblem {
  description: Delta;
}

const isPosting = new URLSearchParams(window.location.search).get("isPosting");
const postingId = new URLSearchParams(window.location.search).get("postingId");
const step = new URLSearchParams(window.location.search).get("step");

const tabsList = [
  "General",
  "Languages",
  "Problems",
  "Grading",
  !postingId ? "Candidates" : null,
  "Instructions",
  "Security",
  "Feedback",
].filter(Boolean);

interface Candidate {
  name: string;
  email: string;
}

const New = () => {
  const [activeTab, setActiveTab] = useState("0");

  // General Tab States
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

  // Languages Tab States
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);

  const [selectedQuestions, setSelectedQuestions] = useState<Problem[]>([]);
  const [availableQuestions, setAvailableQuestions] = useState<Problem[]>([]);

  const [isLoading, setIsLoading] = useState(true);

  // Grading Tab States
  const [gradingMetric, setGradingMetric] = useState("questions");
  const [testCaseGrading, setTestCaseGrading] = useState({
    easy: 0,
    medium: 0,
    hard: 0,
  });
  const [questionsGrading, setQuestionsGrading] = useState<ProblemAssessment[]>(
    []
  );

  const [access, setAccess] = useState("all");
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  // Instructions Tab States
  const [instructions, setInstructions] = useState("");

  // Security Tab States
  const [codePlayback, setCodePlayback] = useState(false);
  const [codeExecution, setCodeExecution] = useState(false);
  const [tabChangeDetection, setTabChangeDetection] = useState(false);
  const [copyPasteDetection, setCopyPasteDetection] = useState(false);
  const [autocomplete, setAutocomplete] = useState(false);
  const [runCode, setRunCode] = useState(false);
  const [syntaxHighlighting, setSyntaxHighlighting] = useState(false);

  // Feedback Tab States
  const [feedbackEmail, setFeedbackEmail] = useState("");

  const [submitting, setSubmitting] = useState(false);

  const { getToken } = useAuth();

  useEffect(() => {
    setIsLoading(true);
    const axios = ax(getToken);
    axios
      .get("/problems/all/1")
      .then((data) => {
        setAvailableQuestions(data.data.data);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const getParam = (name: string) => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
  };

  const buildAssessmentData = () => {
    setSubmitting(true);
    const redirectParam = getParam("returnUrl");

    const rangeStart = testOpenRange.start.toDate("UTC");
    const rangeEnd = testOpenRange.end.toDate("UTC");
    rangeStart.setHours(startTime.hour);
    rangeStart.setMinutes(startTime.minute);
    rangeEnd.setHours(endTime.hour);
    rangeEnd.setMinutes(endTime.minute);

    const reqBody = {
      name: assessmentName,
      description: assessmentDescription,
      timeLimit,
      passingPercentage,
      isEnterprise: isPosting ? isPosting : false,
      openRange: isPosting ? null : { start: rangeStart, end: rangeEnd },
      languages: selectedLanguages,
      problems: selectedQuestions.map((q) => q._id),
      grading:
        gradingMetric === "testcase"
          ? { type: "testcase", testcases: testCaseGrading }
          : { type: "problem", problem: questionsGrading },
      candidates: isPosting ? [] : candidates,
      public: access === "all",
      instructions,
      security: {
        codePlayback,
        codeExecution,
        tabChangeDetection,
        copyPasteDetection,
        allowAutocomplete: autocomplete,
        allowRunningCode: runCode,
        enableSyntaxHighlighting: syntaxHighlighting,
      },
      feedbackEmail,
      postingId,
      step,
    };

    const axios = ax(getToken);
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

    axios
      .post("/assessments/code", reqBody)
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
      .finally(() => setSubmitting(false));
  };

  const handleTabChange = (key: Key) => {
    const newTabIndex = typeof key === "string" ? parseInt(key) : key;
    setActiveTab(newTabIndex.toString());
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
      }}
    />,
    <Languages {...{ selectedLanguages, setSelectedLanguages }} />,
    <Questions
      {...{
        availableQuestions,
        setAvailableQuestions,
        selectedQuestions,
        setSelectedQuestions,
        testCaseGrading,
        setTestCaseGrading,
        isLoading,
      }}
    />,
    <Grading
      {...{
        gradingMetric,
        setGradingMetric,
        selectedQuestions,
        testCaseGrading,
        setTestCaseGrading,
        questionsGrading,
        setQuestionsGrading,
      }}
    />,
    !postingId && (
      <Candidates {...{ access, setAccess, candidates, setCandidates }} />
    ),
    <Instructions {...{ instructions, setInstructions, errors: {} }} />,
    <Security
      {...{
        codePlayback,
        setCodePlayback,
        codeExecution,
        setCodeExecution,
        tabChangeDetection,
        setTabChangeDetection,
        copyPasteDetection,
        setCopyPasteDetection,
        autocomplete,
        setAutocomplete,
        runCode,
        setRunCode,
        syntaxHighlighting,
        setSyntaxHighlighting,
      }}
    />,
    <Feedback
      {...{
        feedbackEmail,
        setFeedbackEmail,
        buildAssessmentData,
        submitting,
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
                    isDisabled={parseInt(activeTab) === 0 || submitting}
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
                    isDisabled={
                      parseInt(activeTab) === tabsList.length - 1 || submitting
                    }
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
