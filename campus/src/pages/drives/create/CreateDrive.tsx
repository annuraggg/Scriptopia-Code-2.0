import { useState } from "react";
import Sidebar from "./Sidebar";
import DriveDetails from "./DriveDetails";
import Workflow from "./Workflow";
import { today, getLocalTimeZone, DateValue } from "@internationalized/date";
import Summary from "./Summary";
import { useAuth } from "@/auth";
import ax from "@/config/axios";
import {
  Drive,
  AdditionalDetails as AdditionalDetailsType,
  StepType,
  StepStatus,
  DriveType,
} from "@shared-types/Drive";
import { toast } from "sonner";
import Loader from "@/components/Loader";
import AdditionalDetails, { FIELD_CATEGORIES } from "./AdditionalDetails";
import { useNavigate, useOutletContext } from "react-router-dom";
import { RootContext } from "@/types/RootContext";
// import WorkflowSchedule from "./WorkflowSchedule";
import type { RangeValue } from "@react-types/shared";
import Access from "./Access";
interface Component {
  icon: React.ElementType;
  label: string;
  name: string;
  id: string;
}

const componentMap: Record<string, string> = {
  "Resume Screening": "RESUME_SCREENING",
  "MCQ Assessment": "MCQ_ASSESSMENT",
  "Code Assessment": "CODING_ASSESSMENT",
  Assignment: "ASSIGNMENT",
  Interview: "INTERVIEW",
  "Custom Step": "CUSTOM",
};

const CreateDrive = () => {
  const [active, setActive] = useState(0);

  // Drive Details States
  const [title, setTitle] = useState<string>("");
  const [link, setLink] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [openings, setOpenings] = useState<number>(0);
  const [selectedPlacementGroups, setSelectedPlacementGroups] = useState<string>("");
  const [applicationRange, setApplicationRange] = useState<
    RangeValue<DateValue>
  >({
    start: today(getLocalTimeZone()),
    end: today(getLocalTimeZone()).add({ weeks: 1 }),
  });
  const [currency, setCurrency] = useState<string>("");
  const [minSalary, setMinSalary] = useState<number>(0);
  const [maxSalary, setMaxSalary] = useState<number>(0);
  const [skills, setSkills] = useState<string[]>([]);
  const [description, setDescription] = useState<Record<string, unknown>>({});
  const [company, setCompany] = useState<string>("");

  // Additional Details States
  const [requiredFields, setRequiredFields] = useState<string[]>([]);
  const [allowNoEntries, setAllowNoEntries] = useState<string[]>([]);
  const [additionalDetails, setAdditionalDetails] =
    useState<AdditionalDetailsType>({});

  // Workflow States
  const [addedComponents, setAddedComponents] = useState<Component[]>([]);

  const { getToken } = useAuth();
  const axios = ax(getToken);
  const [loading, setLoading] = useState(false);
  const { institute, setInstitute } = useOutletContext() as RootContext;
  const navigate = useNavigate();

  const handleSave = () => {
    setLoading(true);

    const formattedData = {
      steps: addedComponents.map((component) => ({
        name: component.name, 
        type: componentMap[component.label] as StepType || "CUSTOM",
        status: "pending" as StepStatus,
        timestamp: new Date(),
      })),
      currentStep: -1,
    };

    // Format additional details
    const formattedAdditionalDetails: { [key: string]: any } = {};
    Object.entries(FIELD_CATEGORIES).forEach(([category, fields]) => {
      formattedAdditionalDetails[category] = {};
      fields.forEach((field) => {
        formattedAdditionalDetails[category][field] = {
          required: requiredFields.includes(field),
          allowEmpty: allowNoEntries.includes(field),
        };
      });
    });

    const drive: Drive = {
      title,
      link,
      description,
      location,
      company,
      type: category as DriveType,
      openings,
      applicationRange: {
        start: applicationRange.start.toDate(getLocalTimeZone()),
        end: applicationRange.end.toDate(getLocalTimeZone()),
      },
      skills,
      salary: {
        min: minSalary,
        max: maxSalary,
        currency,
      },
      workflow: formattedData,
      additionalDetails: formattedAdditionalDetails,
      placementGroup: selectedPlacementGroups,
      published: false,
      hasEnded: false,
    };

    axios
      .post("/drives", drive)
      .then((res) => {
        toast.success("Drive created successfully");
        const newInstitute = { ...institute };
        newInstitute.drives?.push(res.data.data);
        setInstitute(newInstitute);
        console.log(newInstitute);
        navigate("/drives");
      })
      .catch((err) => {
        console.error(err);
        toast.error("Failed to create drive");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  if (loading) return <Loader />;

  return (
    <div className="flex h-screen">
      <Sidebar active={active} setActive={setActive} />
      <div className="float-right overflow-y-auto w-full px-10 py-10">
        {active === 0 && (
          <DriveDetails
            setAction={setActive}
            title={title}
            setTitle={setTitle}
            link={link}
            setLink={setLink}
            category={category}
            setCategory={setCategory}
            openings={openings}
            setOpenings={setOpenings}
            applicationRange={applicationRange}
            setApplicationRange={setApplicationRange}
            currency={currency}
            setCurrency={setCurrency}
            minSalary={minSalary}
            setMinSalary={setMinSalary}
            maxSalary={maxSalary}
            setMaxSalary={setMaxSalary}
            skills={skills}
            setSkills={setSkills}
            description={description}
            setDescription={setDescription}
            location={location}
            setLocation={setLocation}
            company={company}
            setCompany={setCompany}
          />
        )}
        {active === 1 && (
          <AdditionalDetails
            setAction={setActive}
            required={requiredFields}
            onRequiredChange={setRequiredFields}
            allowedEmpty={allowNoEntries}
            onAllowedEmptyChange={setAllowNoEntries}
            additionalDetails={additionalDetails}
            setAdditionalDetails={setAdditionalDetails}
          />
        )}
        {active === 2 && (
          <Access
            setAction={setActive}
            placementGroups={institute?.placementGroups || []}
            selectedGroup={selectedPlacementGroups}
            onSelectGroup={setSelectedPlacementGroups}
          />
        )}
        {active === 3 && (
          <Workflow
            setAction={setActive}
            addedComponents={addedComponents}
            setAddedComponents={setAddedComponents}
          />
        )}
        {/* {active === 3 && <WorkflowSchedule addedComponents={addedComponents} />} */}
        {active === 4 && (
          <Summary
            setAction={setActive}
            title={title}
            category={category}
            company={company}
            openings={openings}
            applicationRange={applicationRange}
            currency={currency}
            minSalary={minSalary}
            maxSalary={maxSalary}
            skills={skills}
            description={description}
            addedComponents={addedComponents}
            location={location}
            handleSave={handleSave}
          />
        )}
      </div>
    </div>
  );
};

export default CreateDrive;
