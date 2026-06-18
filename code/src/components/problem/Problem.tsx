import { useEffect, useState } from "react";
import Editor from "./Editor/Editor";
import InfoPanel from "./InfoPanel";
import Statement from "./LeftPanel/Statement";
import Split from "@uiw/react-split";
import ax from "@/config/axios";
import confetti from "canvas-confetti";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button, Card, CardBody, Spinner } from "@heroui/react";
import { CpuIcon, TimerIcon, CoinsIcon } from "lucide-react";
import { Submission } from "@shared-types/Submission";
import { useAuth } from "@/auth";
import defaultLanguages from "@/data/languages";
import { Problem as ProblemType } from "@shared-types/Problem";
import { Delta } from "quill/core";
import starterGenerator from "@/functions/starterGenerator";
import { toast } from "sonner";

const RewardDrawer = ({
  isOpen,
  onClose,
  reward,
  difficulty,
}: {
  isOpen: boolean;
  onClose: () => void;
  reward: { earned: boolean; amount: number } | null;
  difficulty: string;
}) => {

  return (
    <Drawer open={isOpen} onClose={onClose}>
      <DrawerContent className="outline-none">
        <DrawerHeader>
          <DrawerTitle>
            {reward?.earned
              ? "Congratulations! You earned Scrypto tokens!"
              : "Solution Successful!"}
          </DrawerTitle>
          <DrawerDescription>
            {reward?.earned
              ? `You earned ${reward.amount} SCRYPTO tokens for solving this ${difficulty} problem!`
              : `You solved the problem correctly, but no tokens were earned this time.`}
          </DrawerDescription>
        </DrawerHeader>

        {reward?.earned && (
          <div className="flex justify-center py-6">
            <div className="flex flex-col items-center">
              <CoinsIcon size={50} className="text-yellow-400 mb-4" />
              <p className="text-2xl font-bold">{reward.amount} SCRYPTO</p>
              <p className="text-sm text-gray-500 mt-2">
                has been added to your wallet!
              </p>
            </div>
          </div>
        )}

        <DrawerFooter>
          <DrawerClose asChild>
            <Button className="w-fit mx-auto" onClick={onClose}>
              Close
            </Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

const Problem = ({
  loading,
  problem,
  submissions,
  setSubmissions,
  defaultLanguage = "javascript",
  languages = defaultLanguages,

  allowRun = true,
  allowSubmissionsTab = true,
  allowSubmit = true,
  allowExplain = true,
  allowHighlighting = true,

  onExternalPaste,

  submitOverride,

  setRefetch,
}: {
  loading: boolean;
  problem: ProblemType;
  submissions?: Submission[];
  setSubmissions?: (submissions: Submission[]) => void;
  defaultLanguage?: string;
  languages?: { name: string; abbr: string; available: boolean }[];

  allowRun?: boolean;
  allowSubmissionsTab?: boolean;
  allowSubmit?: boolean;
  allowExplain?: boolean;
  allowHighlighting?: boolean;

  onExternalPaste?: (pastedText: string) => void;

  submitOverride?: (code: string, language: string, problemId: string) => void;

  setRefetch?: any;
}) => {
  const { getToken } = useAuth();
  const axios = ax(getToken);

  const [code, setCode] = useState<string>("");
  const [language, setLanguage] = useState<string>(defaultLanguage);

  const [outputCases, setOutputCases] = useState([]);
  const [, /*codeError*/ setCodeError] = useState<string>("");
  const [runningCode, setRunningCode] = useState<boolean>(false);
  const [currentSub, setCurrentSub] = useState<Submission | null>(null);
  const [reward, setReward] = useState<{
    earned: boolean;
    amount: number;
  } | null>(null);

  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [leftPaneActTab, setLeftPaneActTab] = useState<string>("statement");
  const [componentLoading, setComponentLoading] = useState<boolean>(false);

  useEffect(() => {
    if (reward) {
      setRefetch((prev: boolean) => !prev);
    }
  }, [reward]);

  useEffect(() => {
    if (!problem.sdsl) return;
    const code = starterGenerator(problem.sdsl, language);
    if (code) setCode(code);
  }, [problem]);

  const runCode = async () => {
    setRunningCode(true);
    return axios
      .post("/submissions/run", { code, language, problemId: problem._id })
      .then((res) => {
        console.log(res.data.data);
        setOutputCases(
          res.data.data.results.filter((r: { isSample: boolean }) => r.isSample)
        );

        const firstError = res.data.data.results.find(
          (r: { error: any }) => r.error && r.error
        );

        let firstErrorFull = "";
        if (firstError)
          firstErrorFull = `${firstError.error.name}: ${firstError.error.message}`;

        setCodeError(firstErrorFull);

        if (res.data.data.STATUS === "ERROR") {
          setCodeError(res.data.data.message);
        }

        return { success: true, error: "", data: {} };
      })
      .catch((err) => {
        return { success: false, error: err, data: {} };
      })
      .finally(() => {
        setRunningCode(false);
      });
  };

  const submitCode = async () => {
    if (submitOverride) {
      submitOverride(code, language, problem._id as string);
      return new Promise<object>((resolve) =>
        resolve({ success: true, error: "", data: {} })
      );
    }

    setRunningCode(true);
    setComponentLoading(true);

    return axios
      .post("/submissions/submit", { code, language, problemId: problem._id })
      .then((res) => {
        console.log(res.data.data.result.results);
        setOutputCases(
          res.data.data.result.results.filter(
            (r: any) => r.isSample || (!r.isSample && !r.passed)
          )
        );

        const firstError = res.data.data.submission.results.find(
          (r: { error: any }) => r.error && r.error
        );

        let firstErrorFull = "";
        if (firstError)
          firstErrorFull = `${firstError.error.name}: ${firstError.error.message}`;

        setCodeError(firstErrorFull);

        setComponentLoading(false);

        if (res.data.data.submission.status !== "FAILED") {
          runConfetti("success");
          setLeftPaneActTab("submissions");
          const newSubmissions = [...(submissions || [])];
          newSubmissions.unshift(res.data.data.submission);
          if (setSubmissions) {
            setSubmissions(newSubmissions || []);
          }
          setCurrentSub(res.data.data.submission);

          if (res.data.data.reward) {
            setReward(res.data.data.reward);
          }

          setDrawerOpen(true);
        } else {
          toast.warning("Some test cases failed. Please try again.", {
            position: "top-center",
          });
        }

        return { success: true, error: "", data: {} };
      })
      .catch((err) => {
        setComponentLoading(false);
        console.log(err);
        return { success: false, error: err, data: {} };
      })
      .finally(() => setRunningCode(false));
  };

  const runConfetti = (type: "success" | "error") => {
    const end = Date.now() + 500;

    const successColors = ["#052814", "#12A150"];
    const errorColors = ["#8B0000", "#FF0000"];

    (function frame() {
      confetti({
        particleCount: 10,
        angle: 60,
        spread: 100,
        origin: { x: 0 },
        colors: type === "success" ? successColors : errorColors,
      });
      confetti({
        particleCount: 10,
        angle: 120,
        spread: 100,
        origin: { x: 1 },
        colors: type === "success" ? successColors : errorColors,
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    })();
  };

  if (loading)
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner />
      </div>
    );

  return (
    <>
      <Split
        className="flex overflow-hidden max-h-[88vh] w-full gap-2"
        vaul-drawer-wrapper=""
      >
        <Statement
          statement={problem.description as Delta}
          submissions={submissions || []}
          title={problem.title}
          setActiveTab={setLeftPaneActTab}
          activeTab={leftPaneActTab}
          loading={componentLoading}
          allowSubmissionsTab={allowSubmissionsTab}
        />
        <Split
          mode="vertical"
          className="w-full max-w-[45vw] overflow-y-auto max-h-[90vh]"
        >
          <Editor
            runCode={runCode}
            submitCode={submitCode}
            loading={componentLoading}
            code={code}
            setCode={setCode}
            language={language}
            setLanguage={setLanguage}
            languages={languages}
            allowRun={allowRun}
            allowExplain={allowExplain}
            allowSubmit={allowSubmit}
            allowHighlighting={allowHighlighting}
            onExternalPaste={onExternalPaste}
          />
          <InfoPanel runningCode={runningCode} cases={outputCases} />
        </Split>
      </Split>

      {drawerOpen &&
        (reward ? (
          <RewardDrawer
            isOpen={drawerOpen}
            onClose={() => {
              setDrawerOpen(false);
              setReward(null);
            }}
            reward={reward}
            difficulty={problem.difficulty}
          />
        ) : (
          <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
            <DrawerContent className="outline-none">
              <DrawerHeader>
                <DrawerTitle>Solution Submitted</DrawerTitle>
                <DrawerDescription>
                  Submitted at {new Date().toLocaleString()}
                </DrawerDescription>
              </DrawerHeader>
              <div className="flex gap-5 items-center justify-center">
                <Card className="px-10 py-5">
                  <CardBody>
                    <div className="flex gap-5 items-center">
                      <TimerIcon size={30} />
                      <div>
                        <h5>Time Taken</h5>
                        <p>{currentSub?.avgTime.toFixed(2)} ms</p>
                      </div>
                    </div>
                  </CardBody>
                </Card>

                <Card className="px-10 py-5">
                  <CardBody>
                    <div className="flex gap-5 items-center">
                      <CpuIcon size={30} />
                      <div>
                        <h5>Memory Used</h5>
                        <p>{(currentSub?.avgMemory || 0).toFixed(2)} MB</p>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              </div>
              <DrawerFooter>
                <DrawerClose asChild>
                  <Button
                    className="w-fit mx-auto"
                    onClick={() => setDrawerOpen(false)}
                  >
                    Close
                  </Button>
                </DrawerClose>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        ))}
    </>
  );
};

export default Problem;
