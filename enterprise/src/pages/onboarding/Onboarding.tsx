import { useState } from "react";
import "./Onboarding.css";
import Info from "./Info";
import Contact from "./Contact";
import Team from "./Team";
import { Button } from "@heroui/button";
import { toast } from "sonner";
import { useAuth, useUser } from "@/auth";
import { setOrganization } from "@/reducers/organizationReducer";
import { useDispatch } from "react-redux";
import ax from "@/config/axios";
interface InvitedMember {
  email: string;
  invited: string;
  role: string;
}

const Onboarding = () => {
  const [currentStep, setCurrentStep] = useState(0);

  const [companyName, setCompanyName] = useState<string>("");
  const [companyEmail, setCompanyEmail] = useState<string>("");
  const [companyWebsite, setCompanyWebsite] = useState<string>("");

  const [invitedMembers, setInvitedMembers] = useState<InvitedMember[]>([]);

  const [loading, setLoading] = useState(false);

  const steps = [
    {
      name: "Organization Info",
      description: "Tell us about your organization",
      component: (
        <Info companyName={companyName} setCompanyName={setCompanyName} />
      ),
    },
    {
      name: "Organization Contact",
      description: "Contact details of your organization",
      component: (
        <Contact
          companyEmail={companyEmail}
          setCompanyEmail={setCompanyEmail}
          companyWebsite={companyWebsite}
          setCompanyWebsite={setCompanyWebsite}
        />
      ),
    },
    {
      name: "Team",
      description: "Add your team members",
      component: (
        <Team
          invitedMembers={invitedMembers}
          setInvitedMembers={setInvitedMembers}
          loading={loading}
        />
      ),
    },
  ];

  const validate = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const websiteRegex = /^(http|https):\/\/[^ "]+$/;

    if (!companyName || !companyEmail || !companyWebsite) {
      toast.error("Please fill all fields");
      return false;
    }

    if (!emailRegex.test(companyEmail)) {
      toast.error("Invalid email");
      return false;
    }

    if (!websiteRegex.test(companyWebsite)) {
      toast.error("Invalid website");
      return false;
    }

    return true;
  };

  const { getToken } = useAuth();
  const { user } = useUser();
  const dispatch = useDispatch();

  const submit = () => {
    if (!validate()) return;

    const axios = ax(getToken);
    setLoading(true);
    axios
      .post("/organizations/create", {
        name: companyName,
        email: companyEmail,
        website: companyWebsite,
        members: invitedMembers,
      })
      .then(() => {
        setLoading(false);
        toast.success("Organization created successfully");
        window.location.href = "/dashboard";
        const data = {
          _id: user?.publicMetadata?.orgId,
          role: user?.publicMetadata?.roleName,
          permissions: user?.publicMetadata?.permissions,
        };
        dispatch(setOrganization(data));
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
        toast.error(
          err.response.data.message || "Failed to create organization"
        );
      });
  };

  return (
    <div className="flex items-center justify-center h-screen p-10">
      <div className="min-w-[60%] h-full pr-10">
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

        <div className="mt-5 h-[65%]">{steps[currentStep].component}</div>

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
  );
};

export default Onboarding;
