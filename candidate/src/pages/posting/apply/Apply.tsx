import { useEffect, useState } from "react";
import ContactInfo from "./ContactInfo";
import Resume from "./Resume";
import AdditionalQuestions from "./AdditionalQuestions";
import Review from "./Review";
import { Card, Progress, Button } from "@heroui/react";

import {
  CircleUserIcon,
  FileTextIcon,
  CircleHelpIcon,
  ScanSearchIcon,
} from "lucide-react";
import { useAuth, useUser } from "@/auth";
import ax from "@/config/axios";
import { toast } from "sonner";

interface StepCard {
  step: string;
  title: string;
  icon: JSX.Element;
  component: React.ReactNode;
}

const Apply = () => {
  const [currentStep, setCurrentStep] = useState(0);

  // state bindings - contact
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");

  // state bindings - resume
  const [resume, setResume] = useState<File | null>(null);

  // state bindings - additional
  const [query, setQuery] = useState("");

  const handleEdit = (section: string) => {
    let newStep: number;
    switch (section) {
      case "contact":
        newStep = 0;
        break;
      case "resume":
        newStep = 1;
        break;
      case "additional":
        newStep = 2;
        break;
      default:
        newStep = currentStep;
    }
    setCurrentStep(newStep);
  };

  const { user, isSignedIn } = useUser();
  const { getToken } = useAuth();
  const axios = ax(getToken);

  useEffect(() => {
    if (user && isSignedIn) {
      console.log(user?.primaryEmailAddress?.emailAddress);
      setEmail(user?.primaryEmailAddress?.emailAddress || "");
    }
  }, [isSignedIn, user]);

  useEffect(() => {
    axios
      .get(`/candidates/candidate`)
      .then((res) => {
        const data = res.data.data;

        setName(data.name);
        setPhone(data.phone);
        setWebsite(data.website);
      })
      .catch((err) => {
        toast.error("Failed to fetch candidate details");
        console.log(err.response.data);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cards: StepCard[] = [
    {
      step: "Step 1",
      title: "Contact Info",
      icon: <CircleUserIcon size={24} />,
      component: (
        <ContactInfo
          name={name}
          setName={setName}
          phone={phone}
          setPhone={setPhone}
          website={website}
          email={email}
          setWebsite={setWebsite}
        />
      ),
    },
    {
      step: "Step 2",
      title: "Resume",
      icon: <FileTextIcon size={24} />,
      component: <Resume resume={resume} setResume={setResume} />,
    },
    {
      step: "Step 3",
      title: "Additional Query",
      icon: <CircleHelpIcon size={24} />,
      component: <AdditionalQuestions query={query} setQuery={setQuery} />,
    },
    {
      step: "Step 4",
      title: "Review",
      icon: <ScanSearchIcon size={24} />,
      component: (
        <Review
          onEdit={handleEdit}
          name={name}
          phone={phone}
          email={email}
          website={website}
          resume={resume}
          query={query}
        />
      ),
    },
  ];

  const handleCardClick = (index: number) => {
    if (index <= currentStep) {
      setCurrentStep(index);
    }
  };

  const handleNextClick = () => {
    if (currentStep < cards.length - 1) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
    }
  };

  const handleBackClick = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const progressValue = (currentStep / cards.length) * 100;

  return (
    <div className="flex items-center justify-center h-[85vh]">
      <div className="flex flex-col items-center justify-start   h-screen w-[75%] p-16">
        <div className="flex flex-row w-full items-center justify-center ">
          <div className="flex flex-col items-start justify-between gap-2 w-full">
            <p className="text-neutral-400">
              Step {currentStep + 1} of {cards.length}
            </p>
            <Progress
              aria-label="Application Progress"
              size="md"
              value={progressValue}
              color="success"
              className="max-w-xl"
            />
          </div>
          <Button
            variant="flat"
            color="default"
            className=" mr-3"
            onClick={handleBackClick}
            isDisabled={currentStep === 0}
          >
            Back
          </Button>
          <Button
            variant="flat"
            color="success"
            onClick={handleNextClick}
            isDisabled={currentStep === cards.length - 1}
          >
            Next
          </Button>
        </div>
        <div className="flex gap-4 mt-10 w-full">
          {cards.map((card, index) => (
            <Card
              isPressable={true}
              key={index}
              className={`rounded-xl flex items-start justify-center w-full h-26 p-4 gap-6 cursor-pointer transition-colors duration-300 ${
                index < currentStep
                  ? "bg-green-600 bg-opacity-20 text-green-500"
                  : index === currentStep
                  ? "bg-blue-600 bg-opacity-20 text-blue-500"
                  : "text-gray-500"
              }`}
              onPress={() => handleCardClick(index)}
            >
              <h1
                className={`text-sm font-bold ${
                  index < currentStep
                    ? "text-green-500"
                    : index === currentStep
                    ? "text-blue-500"
                    : "text-gray-500"
                }`}
              >
                {card.step}
              </h1>
              <div className="flex flex-row items-center justify-center gap-2">
                {card.icon}
                <p className="">{card.title}</p>
              </div>
            </Card>
          ))}
        </div>
        <div className="flex  w-full items-center justify-center mt-10 rounded-xl">
          {cards[currentStep].component}
        </div>
      </div>
    </div>
  );
};

export default Apply;
