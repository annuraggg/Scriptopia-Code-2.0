import React, { useState } from "react";
import { ChevronRight } from "lucide-react";
import CompanyDetailsTab from "./CompanyDetailsTab";
import CompanyHRTab from "./CompanyHRTab";
import CompanyStatsTab from "./CompanyStatsTab";
import { useAuth } from "@/auth";
import ax from "@/config/axios";
import { toast } from "sonner";
import { Company } from "@shared-types/Company";

interface CreateCompanyFormProps {
  onClose: () => void;
}

// Define interface for year-wise placement stats
interface YearlyStats {
  year: string;
  avgPackage: string;
  highestPackage: string;
  studentsHired: string;
}

const CreateCompanyForm: React.FC<CreateCompanyFormProps> = ({ onClose }) => {
  const [activeStep, setActiveStep] = useState(0);

  const [name, setName] = useState("");
  const [industry, setIndustry] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [rolesOffered, setRolesOffered] = useState<string[]>([]);

  const [hrName, setHrName] = useState("");
  const [hrEmail, setHrEmail] = useState("");
  const [hrPhone, setHrPhone] = useState("");
  const [hrWebsite, setHrWebsite] = useState("");
  const [yearlyStats, setYearlyStats] = useState<YearlyStats[]>([]);

  const { getToken } = useAuth();
  const axios = ax(getToken);
  const [loading, setLoading] = useState(false);

  // Function to update a specific stat for a specific year
  const updateYearlyStats = (
    year: string,
    field: keyof Omit<YearlyStats, "year">,
    value: string
  ) => {
    setYearlyStats((prevStats) =>
      prevStats.map((statItem) =>
        statItem.year === year ? { ...statItem, [field]: value } : statItem
      )
    );
  };

  // Function to add a new year to stats
  const addYearToStats = (year: string) => {
    if (yearlyStats.some((stat) => stat.year === year)) {
      toast.error("This year already exists in the stats");
      return;
    }
    setYearlyStats([
      ...yearlyStats,
      { year, avgPackage: "", highestPackage: "", studentsHired: "" },
    ]);
  };

  // Function to remove a year from stats
  const removeYearFromStats = (year: string) => {
    setYearlyStats(yearlyStats.filter((stat) => stat.year !== year));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      if (!name) {
        toast.error("Company name is required");
        setLoading(false);
        return;
      }

      // Validate that all yearly stats are filled
      const hasIncompleteStats = yearlyStats.some(
        (stat) =>
          !stat.avgPackage || !stat.highestPackage || !stat.studentsHired
      );

      if (hasIncompleteStats) {
        toast.error("All placement statistics are required for each year");
        setLoading(false);
        return;
      }

      // Transform yearly stats to the format needed for the API
      const placementStats = yearlyStats.map((stat) => ({
        year: stat.year,
        average: Number(stat.avgPackage),
        highest: Number(stat.highestPackage),
        hired: Number(stat.studentsHired),
      }));

      const companyData: Company = {
        name,
        description,
        hrContact: {
          name: hrName,
          email: hrEmail,
          phone: hrPhone,
          website: hrWebsite || "",
        },
        generalInfo: {
          industry: industry,
          yearStats: placementStats, // Now an array of yearly stats
          rolesOffered: rolesOffered,
        },
      };

      await axios.post("/companies/create", companyData);

      toast.success("Company profile created successfully!");

      onClose();

      window.location.href = "/companies";
    } catch (err: any) {
      console.error("Error creating company:", err);
      toast.error(
        err.response?.data?.message || "Error creating company profile"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-5 h-full py-8">
      <div className="flex flex-col space-y-4 px-4 w-[30%]">
        {[
          { id: 1, title: "Company Details" },
          { id: 2, title: "HR Contacts" },
          { id: 3, title: "Placement Stats" },
        ].map((step, index) => (
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
          <CompanyDetailsTab
            name={name}
            setName={setName}
            industry={industry}
            setIndustry={setIndustry}
            description={description}
            setDescription={setDescription}
            rolesOffered={rolesOffered}
            setRolesOffered={setRolesOffered}
            activeStep={activeStep}
            setActiveStep={setActiveStep}
          />
        )}
        {activeStep === 1 && (
          <CompanyHRTab
            hrName={hrName}
            setHrName={setHrName}
            hrEmail={hrEmail}
            setHrEmail={setHrEmail}
            hrPhone={hrPhone}
            setHrPhone={setHrPhone}
            hrWebsite={hrWebsite}
            setHrWebsite={setHrWebsite}
            activeStep={activeStep}
            setActiveStep={setActiveStep}
          />
        )}
        {activeStep === 2 && (
          <CompanyStatsTab
            yearlyStats={yearlyStats}
            updateYearlyStats={updateYearlyStats}
            addYearToStats={addYearToStats}
            removeYearFromStats={removeYearFromStats}
            activeStep={activeStep}
            setActiveStep={setActiveStep}
            onSave={handleSave}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
};

export default CreateCompanyForm;
