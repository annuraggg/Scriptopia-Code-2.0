import { useEffect, useState } from "react";
import "./Onboarding.css";
import Info from "./Info";
import Contact from "./Contact";
import { Button } from "@heroui/react";
import { CalendarDate } from "@internationalized/date";
import { toast } from "sonner";
import {
  RedirectToSignIn,
  SignedIn,
  SignedOut,
  SignOutButton,
  useAuth,
  useUser,
} from "@/auth";
import ax from "@/config/axios";
import Address from "./Address";
import Loader from "@/components/Loader";

const Onboarding = () => {
  const [currentStep, setCurrentStep] = useState(0);

  const [name, setName] = useState<string>("");
  const [dob, setDob] = useState<CalendarDate | undefined>();
  const [gender, setGender] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [address, setAddress] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const { user, isLoaded } = useUser();

  useEffect(() => {
    const axios = ax(getToken);
    axios
      .get("candidates/candidate")
      .then(() => (window.location.href = "/dashboard"))
      .catch(() => setLoading(false));
  }, []);

  const steps = [
    {
      name: "Candidate Info",
      description: "Tell us about your organization",
      component: (
        <Info
          name={name}
          setName={setName}
          dob={dob}
          setDob={setDob}
          gender={gender}
          setGender={setGender}
        />
      ),
    },
    {
      name: "Candidate Contact",
      description: "Contact details of yourself",
      component: (
        <Contact
          email={user?.emailAddresses[0].emailAddress || ""}
          phone={phone}
          setPhone={setPhone}
        />
      ),
    },
    {
      name: "Address",
      description: "Tell us about your address",
      component: <Address address={address} setAddress={setAddress} />,
    },
  ];

  const validate = () => {
    if (!name || !dob || gender === "") {
      toast.error("Please fill in all fields");
      return false;
    }

    if (!phone) {
      toast.error("Please enter a phone number");
      return false;
    }

    if (!address) {
      toast.error("Please enter your address");
      return false;
    }

    return true;
  };

  const { getToken } = useAuth();

  const submit = () => {
    if (!validate()) return;

    const axios = ax(getToken);
    setLoading(true);
    axios
      .post("/candidates/candidate", {
        name,
        dob: dob?.toDate("UTC"),
        gender,
        email: user?.emailAddresses[0].emailAddress,
        phone,
        address,
      })
      .then(() => {
        setLoading(false);
        toast.success("Profile Created successfully");
        window.location.href = "/dashboard";
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
        toast.error(err.response.data.message || "Failed to create profile");
      });
  };

  if (loading || !isLoaded) return <Loader />;

  return (
    <>
      <SignedIn>
        {" "}
        <div className="flex items-center justify-center h-screen p-10">
          <div className="min-w-[60%] pr-10">
            <img src="logo.svg" alt="logo" className="w-14 h-14" />
            <div className="flex gap-3 mt-10">
              {steps.map((_s, i) => (
                <div
                  className={`w-14 h-3 rounded-full transition-colors
              ${
                currentStep === i
                  ? "bg-success-200"
                  : currentStep > i
                  ? "bg-success-300"
                  : "bg-gray-700 opacity-50"
              }
              `}
                ></div>
              ))}
            </div>
            <p className="mt-3 opacity-50">
              {currentStep + 1} of {steps.length}
            </p>

            <div className="mt-5 flex gap-2">
              <p>Signed in as {user?.emailAddresses[0].emailAddress}</p>
              <SignOutButton>
                <p className="text-danger underline cursor-pointer">Logout</p>
              </SignOutButton>
            </div>

            <div className="h-[65%]">{steps[currentStep].component}</div>

            <div className="flex items-center gap-3 justify-end self-end">
              <Button
                onClick={() => setCurrentStep(currentStep - 1)}
                color="default"
                isDisabled={currentStep === 0 || loading}
              >
                Back
              </Button>
              <Button
                onClick={() => {
                  if (currentStep === steps.length - 1) {
                    submit();
                  } else {
                    setCurrentStep(currentStep + 1);
                  }
                }}
                color="success"
                isLoading={loading}
              >
                {currentStep === steps.length - 1 ? "Continue" : "Next"}
              </Button>
            </div>
          </div>
          <div className="container h-full w-full rounded-3xl mix-blend-difference"></div>
        </div>
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
};

export default Onboarding;
