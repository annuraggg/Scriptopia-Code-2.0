import React, { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import GroupDetailsTab from "./Details";
import CandidatesTab from "./Candidates";
import { useAuth } from "@/auth";
import ax from "@/config/axios";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import Criteria from "./Criteria";
import { PlacementGroupRule } from "@shared-types/PlacementGroup";

const CreateGroupForm: React.FC = () => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);

  // Group Details States
  const [name, setName] = useState("");
  const [startYear, setStartYear] = useState("");
  const [endYear, setEndYear] = useState("");
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [purpose, setPurpose] = useState("");
  const [expiryDate, setExpiryDate] = useState("");

  // Criteria State
  const [rules, setRules] = useState<PlacementGroupRule[]>([]);

  // Candidates State
  const [candidates, setCandidates] = useState<string[]>([]);

  const { getToken } = useAuth();
  const axios = ax(getToken);
  const [loading, setLoading] = useState(false);

  const handleSave = () => {
    if (!selectedDepartments.length) {
      toast.error("Please select at least one department");
      return;
    }

    setLoading(true);
    axios
      .post("/placement-groups", {
        name,
        academicYear: { start: startYear, end: endYear },
        departments: selectedDepartments,
        criteria: rules,
        purpose,
        expiryDate,
        candidates,
      })
      .then(() => {
        toast.success("Group created successfully!");
        navigate("/placement-groups", { replace: true });
      })
      .catch((err) => {
        toast.error("Error creating group: " + err.message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    console.log(selectedDepartments, "selectedDepartments");
  }, [selectedDepartments]);

  return (
    <div className="flex gap-5 h-full p-5 py-10">
      <div className="flex flex-col space-y-4 px-4 w-[30%]">
        {[
          { id: 1, title: "Group Details" },
          { id: 3, title: "Group Criteria" },
          { id: 4, title: "Add Candidates" },
        ]?.map((step, index) => (
          <div
            key={step.id}
            className={`
              flex items-center justify-between 
              px-4 py-3 
              rounded-lg 
              transition-all duration-300 ease-in-out 
              ${
                activeStep === index
                  ? "bg-foreground text-background"
                  : "bg-background text-foreground"
              }
              cursor-pointer group
            `}
            onClick={() => {
              setActiveStep(index);
            }}
          >
            <div className="flex items-center space-x-4">
              <div
                className={`
                  w-10 h-1 
                  rounded-full 
                  transition-all duration-300 
                  ${activeStep === index ? "bg-background" : "bg-foreground"}
                `}
              ></div>
              <span className={`font-medium text-sm w-full`}>{step.title}</span>
            </div>
            <ChevronRight
              className={`
                text-white 
                opacity-0 group-hover:opacity-100 
                transition-opacity duration-300
                ${activeStep === index ? "opacity-100" : ""}
              `}
              size={20}
            />
          </div>
        ))}
      </div>

      <div className="w-full overflow-y-auto h-full">
        {activeStep === 0 && (
          <GroupDetailsTab
            name={name}
            setName={setName}
            startYear={startYear}
            setStartYear={setStartYear}
            endYear={endYear}
            setEndYear={setEndYear}
            selectedDepartments={selectedDepartments}
            setSelectedDepartments={setSelectedDepartments}
            purpose={purpose}
            setPurpose={setPurpose}
            expiryDate={expiryDate}
            setExpiryDate={setExpiryDate}
            activeStep={activeStep}
            setActiveStep={setActiveStep}
          />
        )}
        {activeStep === 1 && (
          <Criteria
            activeStep={activeStep}
            setActiveStep={setActiveStep}
            rules={rules}
            setRules={setRules}
          />
        )}
        {activeStep === 2 && (
          <CandidatesTab
            candidates={candidates}
            setCandidates={setCandidates}
            activeStep={activeStep}
            setActiveStep={setActiveStep}
            onSave={handleSave}
            loading={loading}
            rules={rules}
          />
        )}
      </div>
    </div>
  );
};

export default CreateGroupForm;
