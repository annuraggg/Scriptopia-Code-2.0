import React, { useState, useMemo } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import { Button } from "@heroui/button";
import { Input, Textarea } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { useAuth } from "@/auth";
import ax from "@/config/axios";
import { toast } from "sonner";
import { Department } from "@shared-types/Organization";

const currencies = [
  { key: "usd", label: "USD $" },
  { key: "eur", label: "EUR €" },
  { key: "gbp", label: "GBP £" },
  { key: "inr", label: "INR ₹" },
  { key: "jpy", label: "JPY ¥" },
  { key: "aud", label: "AUD A$" },
  { key: "cad", label: "CAD C$" },
  { key: "chf", label: "CHF Fr" },
  { key: "cny", label: "CNY ¥" },
  { key: "sek", label: "SEK kr" },
  { key: "nzd", label: "NZD $" },
  { key: "mxn", label: "MXN $" },
  { key: "sgd", label: "SGD $" },
  { key: "hkd", label: "HKD $" },
  { key: "nok", label: "NOK kr" },
  { key: "krw", label: "KRW ₩" },
  { key: "try", label: "TRY ₺" },
  { key: "rub", label: "RUB ₽" },
  { key: "brl", label: "BRL R$" },
  { key: "zar", label: "ZAR R" },
];

interface createJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  deparments: Department[];
}

const CreateJobModal: React.FC<createJobModalProps> = ({
  isOpen,
  onClose,
  deparments,
}) => {
  const [jobTitle, setjobTitle] = useState("");
  const [location, setLocation] = useState("");
  const [expectedSkills, setExpectedSkills] = useState("");
  const [minSalary, setMinSalary] = useState("");
  const [maxSalary, setMaxSalary] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [deadlineDate, setDeadlineDate] = useState("");
  const [deadlineTime, setDeadlineTime] = useState("");
  const [qualifications, setQualifications] = useState("");
  const [currency, setCurrency] = useState<Set<string>>(new Set());
  const [department, setDepartment] = useState<Set<string>>(new Set());
  const [jobType, setJobType] = useState<Set<string>>(new Set());
  const [about, setAbout] = useState("");
  const [openings, setOpening] = useState("");
  const [salaryError, setSalaryError] = useState("");

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { getToken } = useAuth();
  const axios = ax(getToken);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!jobTitle) newErrors.jobTitle = "Please enter a job title";
    if (!openings) newErrors.openings = "Please enter the number of openings";
    if (department.size === 0)
      newErrors.department = "Please select a department";
    if (!location) newErrors.location = "Please enter a job location";
    if (jobType.size === 0) newErrors.jobType = "Please select a job type";
    if (!expectedSkills)
      newErrors.expectedSkills = "Please enter expected skills";
    if (!minSalary) newErrors.minSalary = "Please enter minimum salary";
    if (!maxSalary) newErrors.maxSalary = "Please enter maximum salary";
    if (currency.size === 0) newErrors.currency = "Please select a currency";
    if (!startDate) newErrors.startDate = "Please enter a start date";
    if (!startTime) newErrors.startTime = "Please enter a start time";
    if (!deadlineDate) newErrors.deadlineDate = "Please enter a deadline date";
    if (!deadlineTime) newErrors.deadlineTime = "Please enter a deadline time";
    if (!qualifications)
      newErrors.qualifications = "Please enter qualifications";
    if (!about) newErrors.about = "Please enter a job description";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateSalaryRange = (min: string, max: string) => {
    const minVal = parseFloat(min);
    const maxVal = parseFloat(max);
    return !isNaN(minVal) && !isNaN(maxVal) && maxVal > minVal;
  };

  const handleMaxSalaryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newMaxSalary = e.target.value;
    setMaxSalary(newMaxSalary);

    if (minSalary && newMaxSalary) {
      const minVal = parseFloat(minSalary);
      const maxVal = parseFloat(newMaxSalary);
      if (!isNaN(minVal) && !isNaN(maxVal) && maxVal <= minVal) {
        setSalaryError("Maximum salary must be greater than minimum salary");
      } else {
        setSalaryError("");
      }
    }
  };

  const handleMinSalaryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newMinSalary = e.target.value;
    setMinSalary(newMinSalary);

    if (maxSalary && newMinSalary) {
      const minVal = parseFloat(newMinSalary);
      const maxVal = parseFloat(maxSalary);
      if (!isNaN(minVal) && !isNaN(maxVal) && maxVal <= minVal) {
        setSalaryError("Maximum salary must be greater than minimum salary");
      } else {
        setSalaryError("");
      }
    }
  };

  const createJob = () => {
    if (!validateForm()) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);

    axios
      .post("/postings/create", {
        title: jobTitle,
        description: about,
        department: Array.from(department)[0],
        openings,
        location,
        type: Array.from(jobType)[0],
        salary: {
          min: minSalary,
          max: maxSalary,
          currency: Array.from(currency)[0],
        },
        applicationRange: {
          start: new Date(`${startDate}T${startTime}`),
          end: new Date(`${deadlineDate}T${deadlineTime}`),
        },
        skills: expectedSkills.split(","),
        qualifications,
      })
      .then(() => {
        toast.success("Job created successfully");
        onClose();
        window.location.reload();
      })
      .catch((err) => {
        console.log(err);
        toast.error(err.response.data);
        setLoading(false);
      });
  };

  const isFormValid = useMemo(() => {
    return (
      jobTitle &&
      openings &&
      department.size > 0 &&
      location &&
      jobType.size > 0 &&
      expectedSkills &&
      minSalary &&
      maxSalary &&
      validateSalaryRange(minSalary, maxSalary) &&
      !salaryError &&
      currency.size > 0 &&
      startDate &&
      startTime &&
      deadlineDate &&
      deadlineTime &&
      qualifications &&
      about
    );
  }, [
    jobTitle,
    openings,
    department,
    location,
    jobType,
    expectedSkills,
    minSalary,
    maxSalary,
    salaryError,
    currency,
    startDate,
    startTime,
    deadlineDate,
    deadlineTime,
    qualifications,
    about,
  ]);

  return (
    <Modal
      size="xl"
      isOpen={isOpen}
      onClose={onClose}
      placement="center"
      backdrop="blur"
      scrollBehavior="inside"
    >
      <ModalContent>
        <ModalHeader className="flex flex-col px-10 bg-zinc-800/40">
          Create job
        </ModalHeader>
        <div className="p-2"></div>
        <ModalBody className="flex flex-col space-y-4 px-10">
          <div className="w-full">
            <Input
              type="text"
              placeholder="Enter the job title"
              label="Job Title"
              labelPlacement="outside"
              isRequired
              value={jobTitle}
              onChange={(e) => setjobTitle(e.target.value)}
            />
            {errors.jobTitle && (
              <p className="text-red-500 text-xs mt-1">{errors.jobTitle}</p>
            )}
          </div>
          <div className="w-full flex gap-3">
            <Input
              type="number"
              placeholder="Enter the number of openings"
              label="Number of Openings"
              labelPlacement="outside"
              isRequired
              value={openings}
              onChange={(e) => setOpening(e.target.value)}
            />
            {errors.openings && (
              <p className="text-red-500 text-xs mt-1">{errors.openings}</p>
            )}
          </div>
          <div className="w-full">
            <Select
              label="Department"
              placeholder="Select department"
              selectedKeys={department}
              onSelectionChange={(keys) =>
                setDepartment(new Set(keys as unknown as string[]))
              }
              labelPlacement="outside"
              isRequired
            >
              {deparments?.map((department) => (
                <SelectItem key={department._id!}>{department.name}</SelectItem>
              ))}
            </Select>
            {errors.department && (
              <p className="text-red-500 text-xs mt-1">{errors.department}</p>
            )}
          </div>
          <div className="w-full flex gap-3">
            <Input
              type="text"
              placeholder="Enter the location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              isRequired
              label="Job Location"
              labelPlacement="outside"
            />
            {errors.location && (
              <p className="text-red-500 text-xs mt-1">{errors.location}</p>
            )}

            <Select
              label="Job Type"
              placeholder="Select job type"
              className="max-w-xs"
              labelPlacement="outside"
              selectedKeys={jobType}
              onSelectionChange={(e) =>
                setJobType(new Set(e as unknown as string[]))
              }
              isRequired
            >
              <SelectItem key={"part_time"}>Part Time</SelectItem>
              <SelectItem key={"full_time"}>Full Time</SelectItem>
              <SelectItem key={"internship"}>Internship</SelectItem>
            </Select>
            {errors.jobType && (
              <p className="text-red-500 text-xs mt-1">{errors.jobType}</p>
            )}
          </div>

          <div className="w-full">
            <Textarea
              label="Expected Skills"
              labelPlacement="outside"
              variant="flat"
              placeholder="List needed skills"
              disableAnimation
              disableAutosize
              isRequired
              value={expectedSkills}
              onChange={(e) => setExpectedSkills(e.target.value)}
            />
            {errors.expectedSkills && (
              <p className="text-red-500 text-xs mt-1">
                {errors.expectedSkills}
              </p>
            )}
          </div>

          <div className="w-full">
            <div className="flex space-x-2">
              <Textarea
                placeholder="starts at"
                maxRows={1}
                isRequired
                label="Minimum Salary"
                labelPlacement="outside"
                value={minSalary}
                onChange={handleMinSalaryChange}
              />
              {errors.minSalary && (
                <p className="text-red-500 text-xs mt-1">{errors.minSalary}</p>
              )}
              <Textarea
                placeholder="ends at"
                maxRows={1}
                isRequired
                label="Maximum Salary"
                labelPlacement="outside"
                value={maxSalary}
                onChange={handleMaxSalaryChange}
              />
            </div>
            {salaryError && (
              <p className="text-red-500 text-xs mt-1">{salaryError}</p>
            )}
          </div>

          <div className="w-full flex items-end justify-between">
            <Select
              label="Currency"
              placeholder="Select currency"
              selectedKeys={currency}
              onSelectionChange={(keys) =>
                setCurrency(new Set(keys as unknown as string[]))
              }
              labelPlacement="outside"
              isRequired
            >
              {currencies.map((currency) => (
                <SelectItem key={currency.key}>{currency.label}</SelectItem>
              ))}
            </Select>
            {errors.currency && (
              <p className="text-red-500 text-xs mt-1">{errors.currency}</p>
            )}
          </div>

          <div className="w-full">
            <div className="flex space-x-2">
              <Input
                type="date"
                isRequired
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full"
                label="Job Applications Start Date"
                labelPlacement="outside"
              />
              {errors.startDate && (
                <p className="text-red-500 text-xs mt-1">{errors.startDate}</p>
              )}
              <Input
                type="time"
                isRequired
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full"
                label="Job Applications Start Time"
                labelPlacement="outside"
              />
              {errors.startTime && (
                <p className="text-red-500 text-xs mt-1">{errors.startTime}</p>
              )}
            </div>
          </div>

          <div className="w-full">
            <div className="flex space-x-2">
              <Input
                type="date"
                isRequired
                value={deadlineDate}
                onChange={(e) => setDeadlineDate(e.target.value)}
                className="w-full"
                label="Job Applications Deadline Date"
                labelPlacement="outside"
              />
              {errors.deadlineDate && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.deadlineDate}
                </p>
              )}
              <Input
                type="time"
                isRequired
                value={deadlineTime}
                onChange={(e) => setDeadlineTime(e.target.value)}
                className="w-full"
                label="Job Applications Deadline Time"
                labelPlacement="outside"
              />
              {errors.deadlineTime && (
                <p className="text-red-500 text-xs mt-1">
                  {errors.deadlineTime}
                </p>
              )}
            </div>
          </div>

          <div className="w-full">
            <Textarea
              label="Qualifications/Responsibilities"
              labelPlacement="outside"
              variant="flat"
              placeholder="List needed qualifications and obligations"
              disableAnimation
              disableAutosize
              isRequired
              value={qualifications}
              onChange={(e) => setQualifications(e.target.value)}
            />
            {errors.qualifications && (
              <p className="text-red-500 text-xs mt-1">
                {errors.qualifications}
              </p>
            )}
          </div>

          <div className="w-full">
            <Textarea
              label="About"
              labelPlacement="outside"
              variant="flat"
              placeholder="Enter a brief description of the job"
              disableAnimation
              disableAutosize
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              isRequired
            />
            {errors.about && (
              <p className="text-red-500 text-xs mt-1">{errors.about}</p>
            )}
          </div>

          <div className="w-full text-xs text-gray-500">
            All fields are required. Once saved and published, only text fields
            can be edited.
          </div>
        </ModalBody>
        <div className="p-2"></div>
        <ModalFooter className="flex flex-row px-10 bg-zinc-800/40">
          <Button
            color="danger"
            variant="light"
            onPress={onClose}
            isDisabled={loading}
          >
            Close
          </Button>
          <Button
            color="success"
            className=""
            onPress={createJob}
            isLoading={loading}
            isDisabled={!isFormValid}
          >
            Save
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default CreateJobModal;
