import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import { Button, Card, CardBody, CardHeader } from "@heroui/react";
import Details from "./Details";
import TestCases from "./TestCases";
import QualityGate from "./QualityGate";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Delta } from "quill/core";
import { useAuth } from "@/auth";
import ax from "@/config/axios";
import { CustomStub as CustomSDSL, TestCase } from "@shared-types/Problem";
import Sdsl from "./Sdsl";
import { useNavigate } from "react-router-dom";

const steps = [
  {
    title: "Step 1",
    description: "Question Details",
  },
  {
    title: "Step 2",
    description: "SDSL Code Stub",
  },
  {
    title: "Step 3",
    description: "Test Cases",
  },
  {
    title: "Step 4",
    description: "Quality Gate",
  },
];

const NewProblem = () => {
  const navigate = useNavigate();

  const [completed, setCompleted] = useState<boolean[]>([false, false, false]);
  const [activeStep, setActiveStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Details State
  const [title, setTitle] = useState("");
  const [isPrivate, setIsPrivate] = useState<boolean>(true);
  const [difficulty, setDifficulty] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [description, setDescription] = useState<Delta>({} as Delta);

  // SDSL State
  const [sdsl, setSdsl] = useState("");
  const [customCodeState, setCustomCodeState] = useState<CustomSDSL[]>([
    { stub: "", language: "javascript" },
    { stub: "", language: "python" },
    { stub: "", language: "c" },
    { stub: "", language: "cpp" },
    { stub: "", language: "typescript" },
  ]);

  // Test Cases State
  const [testCases, setTestCases] = useState<TestCase[]>([]);

  // Quality Gate State
  const [minimumFiveCases, setMinimumFiveCases] = useState(false);
  const [minimumThreeSampleCases, setMinimumThreeSampleCases] = useState(false);
  const [minimumTwoTags, setMinimumTwoTags] = useState(false);
  const [minimum100Words, setMinimum100Words] = useState(false);

  const { getToken } = useAuth();
  const buildRequestData = () => {
    const axios = ax(getToken);
    setLoading(true);

    return axios
      .post("/problems", {
        title,
        isPrivate,
        difficulty,
        tags,
        description,
        sdsl: sdsl.split("\n"),
        customSdsl: customCodeState,
        testCases: testCases,
        minimumFiveCases,
        minimumThreeSampleCases,
        minimumTwoTags,
        minimum100Words,
      })
      .then(() => {
        toast.success("Problem created successfully");
        navigate("/problems#my-problems");
      })
      .catch(() => {
        toast.error("Error creating problem");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const step1Completed =
      title &&
      difficulty &&
      tags.length > 0 &&
      // @ts-expect-error - TODO: Fix this
      description?.ops?.[0]?.insert?.trim();
    setCompleted((prev) => {
      const newCompleted = [...prev];
      newCompleted[0] = !!step1Completed;
      return newCompleted;
    });
  }, [title, difficulty, tags, description]);

  useEffect(() => {
    const step2Completed = sdsl.length > 0;
    setCompleted((prev) => {
      const newCompleted = [...prev];
      newCompleted[1] = !!step2Completed;
      return newCompleted;
    });
  }, [sdsl]);

  useEffect(() => {
    const step4Completed = testCases.length >= 5;
    setCompleted((prev) => {
      const newCompleted = [...prev];
      newCompleted[2] = !!step4Completed;
      return newCompleted;
    });
  }, [testCases]);

  useEffect(() => {
    calculateQualityGate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, difficulty, tags, description, testCases.length]);

  const calculateQualityGate = () => {
    if (testCases.length >= 5) setMinimumFiveCases(true);
    else setMinimumFiveCases(false);

    if (
      testCases.length >= 3 &&
      testCases.filter((i) => i.isSample).length >= 2
    )
      setMinimumThreeSampleCases(true);
    else setMinimumThreeSampleCases(false);

    if (tags.length >= 2) setMinimumTwoTags(true);
    else setMinimumTwoTags(false);

    const statementLength = description?.ops
      ?.map((op) => op?.insert)
      ?.join("")?.length;
    if (statementLength >= 100) setMinimum100Words(true);
    else setMinimum100Words(false);
  };

  return (
    <motion.div
      initial={{ x: -50, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className=""
    >
      <div className="h-full w-full flex flex-col">
        <h5>Create a Problem</h5>
        <div className="flex gap-5 mt-5 h-full">
          <Sidebar
            completed={completed}
            steps={steps}
            activeStep={activeStep}
            setActiveStep={setActiveStep}
          />
          <Card className="border h-[82.2vh] w-full">
            <CardHeader className="border-b flex justify-between">
              <p>{steps[activeStep - 1]?.description}</p>
              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    if (activeStep === 1)
                      return toast.error("You have reached the start");
                    setActiveStep((prev) => prev - 1);
                  }}
                  variant="flat"
                  isIconOnly
                >
                  <ChevronLeft />
                </Button>
                <Button
                  onClick={() => {
                    if (activeStep === steps.length)
                      return toast.error("You have reached the end");
                    setActiveStep((prev) => prev + 1);
                  }}
                  variant="flat"
                  isIconOnly
                >
                  <ChevronRight />
                </Button>
              </div>
            </CardHeader>
            <CardBody>
              {activeStep === 1 && (
                <Details
                  {...{
                    title,
                    setTitle,
                    isPrivate,
                    setIsPrivate,
                    difficulty,
                    setDifficulty,
                    tags,
                    setTags,
                    description,
                    setDescription,
                  }}
                />
              )}
              {activeStep === 2 && (
                <Sdsl
                  {...{
                    sdsl,
                    setSdsl,
                    customCodeState,
                    setCustomCodeState,
                  }}
                />
              )}
              {activeStep === 3 && (
                <TestCases
                  {...{
                    testCases,
                    setTestCases,
                    sdsl,
                  }}
                />
              )}
              {activeStep === 4 && (
                <QualityGate
                  {...{
                    minimumFiveCases,
                    minimumThreeSampleCases,
                    minimumTwoTags,
                    minimum100Words,
                    completed,
                    buildRequestData,
                    loading,
                  }}
                />
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </motion.div>
  );
};

export default NewProblem;
