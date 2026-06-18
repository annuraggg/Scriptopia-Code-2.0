import React from "react";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Button } from "@heroui/button";
import { ChevronRight } from "lucide-react";
import { useOutletContext } from "react-router-dom";
import { RootContext } from "@/types/RootContext";

interface GroupDetailsTabProps {
  name: string;
  setName: (name: string) => void;
  startYear: string;
  setStartYear: (year: string) => void;
  endYear: string;
  setEndYear: (year: string) => void;
  selectedDepartments: string[];
  setSelectedDepartments: (departments: string[]) => void;
  purpose: string;
  setPurpose: (purpose: string) => void;
  expiryDate: string;
  setExpiryDate: (date: string) => void;
  activeStep: number;
  setActiveStep: (step: number) => void;
}

const generateYears = () => {
  const currentYear = new Date().getFullYear();
  const startYear = 2000;
  const endYear = currentYear + 4;
  return Array.from(
    { length: endYear - startYear + 1 },
    (_, i) => `${startYear + i}`,
  );
};

const GroupDetailsTab: React.FC<GroupDetailsTabProps> = ({
  name,
  setName,
  startYear,
  setStartYear,
  endYear,
  setEndYear,
  selectedDepartments,
  setSelectedDepartments,
  purpose,
  setPurpose,
  expiryDate,
  setExpiryDate,
  activeStep,
  setActiveStep,
}) => {
  const { institute } = useOutletContext<RootContext>();

  const toggleDepartment = (departmentId: string) => {
    setSelectedDepartments(
      selectedDepartments?.includes(departmentId)
        ? selectedDepartments.filter((id) => id !== departmentId)
        : [...(selectedDepartments || []), departmentId],
    );
  };

  const DepartmentChip: React.FC<{
    department: { _id?: string; name: string };
    isSelected: boolean;
    onToggle: () => void;
  }> = ({ department, isSelected, onToggle }) => {
    return (
      <div
        className={`
       rounded-full cursor-pointer transition-all duration-200 ease-in-out p-1 px-3
          ${
            isSelected
              ? "bg-blue-500 text-white hover:bg-blue-600"
              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          }
          flex items-center gap-2
        `}
        onClick={onToggle}
      >
        {department.name}
        {isSelected && <span className="text-sm">✕</span>}
      </div>
    );
  };

  return (
    <div className="flex justify-between flex-col h-full">
      <div className="w-full">
        <div className="flex justify-between">
          <div className="text-sm w-[30%]">
            <p>Group Name</p>
            <p className="opacity-50">
              Choose a descriptive name for your student placement group
            </p>
          </div>
          <div>
            <Input
              placeholder="e.g. College Batch 2023-24"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-[500px]"
            />
          </div>
        </div>

        <div className="flex justify-between mt-7">
          <div className="text-sm w-[30%]">
            <p>Academic Years</p>
            <p className="opacity-50">
              Select the start and end years for this group
            </p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <Select
              label="Start Year"
              selectedKeys={startYear ? [startYear] : []}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as string;
                setStartYear(selected);
              }}
              className="w-[500px]"
            >
              {generateYears()?.map((year) => (
                <SelectItem key={year}>{year}</SelectItem>
              ))}
            </Select>

            <Select
              label="End Year"
              selectedKeys={endYear ? [endYear] : []}
              onSelectionChange={(keys) => {
                const selected = Array.from(keys)[0] as string;
                setEndYear(selected);
              }}
              className="w-[500px]"
            >
              {generateYears()?.map((year) => (
                <SelectItem key={year}>{year}</SelectItem>
              ))}
            </Select>
          </div>
        </div>

        <div className="flex justify-between mt-7">
          <div className="text-sm w-[30%]">
            <p>Departments</p>
            <p className="opacity-50">Select the departments for this group</p>
          </div>
          <div className="flex flex-col items-end w-[500px]">
            <div className="flex flex-wrap gap-2">
              {institute.departments?.map((department) => (
                <DepartmentChip
                  key={department._id}
                  department={department}
                  isSelected={selectedDepartments.includes(department._id!)}
                  onToggle={() => {
                    console.log("Toggling department:", department);
                    toggleDepartment(department._id!);
                  }}
                />
              ))}
            </div>
            {selectedDepartments.length > 0 && (
              <p className="text-sm text-gray-500 mt-2">
                {selectedDepartments.length} department(s) selected
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-between mt-7">
          <div className="text-sm w-[30%]">
            <p>Group Purpose</p>
            <p className="opacity-50">
              Describe the main objective of this student placement group
            </p>
          </div>
          <div>
            <Input
              placeholder="e.g. Organizing placement activities for final-year students"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="w-[500px]"
            />
          </div>
        </div>

        <div className="flex justify-between mt-7">
          <div className="text-sm w-[30%]">
            <p>Group Expiry</p>
            <p className="opacity-50">
              Select the date when this group will become inactive
            </p>
          </div>
          <div>
            <Input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="w-[500px]"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-5 justify-end mt-5">
        <Button
          variant="flat"
          color="success"
          endContent={<ChevronRight size={20} />}
          className="mt-5 float-right"
          onPress={() => setActiveStep(activeStep + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
};

export default GroupDetailsTab;
