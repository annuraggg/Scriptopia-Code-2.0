import {
  BreadcrumbItem,
  Breadcrumbs,
  Input,
  Textarea,
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Spinner,
  Tooltip,
  Card,
  CardHeader,
  CardBody,
  Divider,
  Badge,
} from "@heroui/react";
import { DateInput } from "@heroui/date-input";
import { useEffect, useState, useCallback } from "react";
import { parseDate, CalendarDate, today } from "@internationalized/date";
import {
  Check,
  Edit2,
  SquareArrowOutUpRight,
  X,
  Save,
  User,
  Calendar,
  Mail,
  Phone,
  MapPin,
  FileText,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { useOutletContext } from "react-router-dom";
import { Candidate } from "@shared-types/Candidate";
import { useAuth } from "@/auth";
import ax from "@/config/axios";
import { debounce } from "lodash";

// Validation schemas
const phoneRegex = /^\+?[1-9]\d{1,14}$/;

const formSchema = z.object({
  email: z.string().email("Invalid email format"),
  phone: z.string().regex(phoneRegex, "Invalid phone number"),
  address: z
    .string()
    .min(10, "Please enter a complete address with at least 10 characters"),
  summary: z
    .string()
    .max(1000, "Summary should not exceed 1000 characters")
    .optional(),
});

const General = () => {
  const [candidate, setCandidate] = useState<Candidate>({} as Candidate);
  const [saving, setSaving] = useState<boolean>(false);
  const [editSummary, setEditSummary] = useState<string>("");
  const [errors, setErrors] = useState<
    Partial<Record<keyof Candidate, string>>
  >({});
  const [resumeUploadLoading, setResumeUploadLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isFocused, setIsFocused] = useState<Partial<Record<string, boolean>>>(
    {}
  );

  const { isOpen, onOpen, onClose } = useDisclosure();
  const { user, setUser } = useOutletContext<{
    user: Candidate;
    setUser: (user: Candidate) => void;
  }>();
  const { getToken } = useAuth();
  const axios = ax(getToken);

  useEffect(() => {
    try {
      if (user) {
        setCandidate(user);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error("Invalid data format");
      }
    }
  }, [user]);

  const validateField = (name: keyof Candidate, value: string) => {
    try {
      // @ts-expect-error
      formSchema.shape[name]?.parse(value);
      setErrors((prev) => ({ ...prev, [name]: undefined }));
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        setErrors((prev) => ({ ...prev, [name]: error.errors[0].message }));
        return false;
      }
      return false;
    }
  };

  const saveChanges = async (updatedCandidate: Candidate) => {
    try {
      setSaving(true);
      formSchema.parse(updatedCandidate);
      setUser(updatedCandidate);
      setHasChanges(false);
    } catch (error) {
      if (error instanceof z.ZodError) {
        error.errors.forEach((err) => {
          toast.error(`${err.path.join(".")}: ${err.message}`);
        });
      } else {
        toast.error("Failed to save changes");
      }
    } finally {
      setSaving(false);
    }
  };

  const debouncedSave = useCallback(
    debounce((data: Candidate) => {
      saveChanges(data);
    }, 1000),
    []
  );

  const handleInputChange = (
    name: keyof Candidate,
    value: string | CalendarDate
  ) => {
    const sanitizedValue =
      typeof value === "string" && name !== "address" ? value.trim() : value;

    const updatedCandidate = { ...candidate, [name]: sanitizedValue };
    setCandidate(updatedCandidate);
    setHasChanges(true);

    if (typeof value === "string") {
      const isValid = validateField(name, value);
      if (isValid) {
        debouncedSave(updatedCandidate);
      }
    }
  };

  const handleSaveSummary = () => {
    if (validateField("summary", editSummary)) {
      const updatedCandidate = { ...candidate, summary: editSummary };
      setCandidate(updatedCandidate);
      saveChanges(updatedCandidate);
      onClose();
    }
  };

  const uploadResume = (file?: File) => {
    if (!file) return toast.error("No file selected");

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return toast.error("File size exceeds 5MB limit");
    }

    // Check file type
    const validFileTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!validFileTypes.includes(file.type)) {
      return toast.error("File must be PDF or Word document (.doc, .docx)");
    }

    setResumeUploadLoading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append("resume", file as Blob);

    axios
      .put("/candidates/resume", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploadProgress(percentCompleted);
          }
        },
      })
      .then((res) => {
        const updatedCandidate = { ...candidate, resumeUrl: res.data.data.url };
        setCandidate(updatedCandidate);
        setUser(updatedCandidate);
        toast.success("Resume uploaded successfully");
      })
      .catch((err) => {
        console.error(err);
        toast.error(err.response?.data?.message || "Failed to upload resume");
      })
      .finally(() => {
        setResumeUploadLoading(false);
        setUploadProgress(0);
      });
  };

  const getAndOpenResume = () => {
    if (!candidate.resumeUrl) {
      return toast.error("No resume uploaded yet");
    }

    axios
      .get("/candidates/resume")
      .then((res) => {
        window.open(res.data.data.url, "_blank");
      })
      .catch((err) => {
        console.error(err);
        toast.error("Failed to retrieve resume URL");
      });
  };

  // Format personal information for better display
  const formatGender = (gender?: string) => {
    if (!gender) return "";
    return gender.charAt(0).toUpperCase() + gender.slice(1).toLowerCase();
  };


  return (
    <div>
      <Breadcrumbs className="mb-6">
        <BreadcrumbItem href="/profile">Profile</BreadcrumbItem>
        <BreadcrumbItem href="/profile">General Information</BreadcrumbItem>
      </Breadcrumbs>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <CardHeader className="bg-gray-50/50 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <User size={18} className="text-primary" />
              <h3 className="text-lg font-medium">Personal Information</h3>
            </div>
            {(saving || hasChanges) && (
              <div className="flex items-center gap-2">
                {saving ? (
                  <Spinner size="sm" />
                ) : (
                  <Save size={16} className="text-primary" />
                )}
                <span className="text-xs text-gray-500">
                  {saving ? "Saving..." : "Unsaved changes"}
                </span>
              </div>
            )}
          </CardHeader>

          <Divider />

          <CardBody className="py-6 px-6">
            <div className="flex flex-col gap-5 w-full">
              <div className="grid grid-cols-[120px_1fr] items-center gap-3">
                <label className="text-sm text-gray-500 justify-self-end">
                  Full Name
                </label>
                <div>
                  <Input
                    value={candidate.name || ""}
                    aria-label="Name"
                    readOnly
                    startContent={<User size={16} className="text-gray-400" />}
                    classNames={{
                      input: "bg-gray-50",
                    }}
                  />
                  <p className="text-amber-500 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle size={12} />
                    This field cannot be changed
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-[120px_1fr] items-center gap-3">
                <label className="text-sm text-gray-500 justify-self-end">
                  Date of Birth
                </label>
                <div>
                  <DateInput
                    value={
                      candidate?.dob?.toString()
                        ? parseDate(candidate?.dob?.toString()?.split("T")[0])
                        : today("IST")
                    }
                    maxValue={today("IST")}
                    startContent={
                      <Calendar size={16} className="text-gray-400" />
                    }
                    classNames={{
                      base: "bg-gray-50",
                    }}
                    isReadOnly
                  />
                  <p className="text-amber-500 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle size={12} />
                    This field cannot be changed
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-[120px_1fr] items-center gap-3">
                <label className="text-sm text-gray-500 justify-self-end">
                  Gender
                </label>
                <div>
                  <Input
                    readOnly
                    value={formatGender(candidate.gender)}
                    aria-label="Gender"
                    startContent={<User size={16} className="text-gray-400" />}
                    classNames={{
                      input: "bg-gray-50",
                    }}
                  />
                  <p className="text-amber-500 text-xs mt-1 flex items-center gap-1">
                    <AlertCircle size={12} />
                    This field cannot be changed
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-[120px_1fr] items-center gap-3">
                <label className="text-sm text-gray-500 justify-self-end">
                  Email Address
                </label>
                <div>
                  <Input
                    value={candidate.email || ""}
                    aria-label="Email"
                    type="email"
                    autoComplete="email"
                    readOnly
                    startContent={<Mail size={16} className="text-gray-400" />}
                    classNames={{
                      input: "bg-gray-50",
                    }}
                  />
                  <p className="text-gray-500 text-xs mt-1">
                    Email can be updated in account settings
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-[120px_1fr] items-center gap-3">
                <label className="text-sm text-gray-500 justify-self-end">
                  Phone Number
                </label>
                <Input
                  value={candidate.phone || ""}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  isInvalid={!!errors.phone}
                  errorMessage={errors.phone}
                  aria-label="Phone"
                  type="tel"
                  autoComplete="tel"
                  startContent={<Phone size={16} className="text-gray-400" />}
                  onFocus={() => setIsFocused({ ...isFocused, phone: true })}
                  onBlur={() => setIsFocused({ ...isFocused, phone: false })}
                  description={
                    isFocused.phone
                      ? "Enter your phone number with country code"
                      : undefined
                  }
                />
              </div>

              <div className="grid grid-cols-[120px_1fr] items-start gap-3">
                <label className="text-sm text-gray-500 justify-self-end pt-2">
                  Address
                </label>
                <Textarea
                  value={candidate.address || ""}
                  onChange={(e) => handleInputChange("address", e.target.value)}
                  isInvalid={!!errors.address}
                  errorMessage={errors.address}
                  aria-label="Address"
                  autoComplete="street-address"
                  minRows={3}
                  maxRows={5}
                  startContent={
                    <MapPin size={16} className="text-gray-400 mt-1" />
                  }
                  onFocus={() => setIsFocused({ ...isFocused, address: true })}
                  onBlur={() => setIsFocused({ ...isFocused, address: false })}
                  description={
                    isFocused.address
                      ? "Include street, city, state/province, and postal code"
                      : undefined
                  }
                />
              </div>
            </div>
          </CardBody>
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="shadow-sm">
            <CardHeader className="bg-gray-50/50 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-primary" />
                <h3 className="text-lg font-medium">Professional Summary</h3>
              </div>
              <Tooltip content="Edit summary">
                <Button
                  isIconOnly
                  variant="light"
                  size="sm"
                  onClick={() => {
                    setEditSummary(candidate?.summary || "");
                    onOpen();
                  }}
                  aria-label="Edit summary"
                >
                  <Edit2 size={16} />
                </Button>
              </Tooltip>
            </CardHeader>

            <Divider />

            <CardBody className="min-h-[220px] px-6 py-6">
              {candidate.summary ? (
                <div className="whitespace-pre-wrap break-words">
                  {candidate.summary}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center h-full gap-3">
                  <FileText size={24} className="text-gray-400" />
                  <div>
                    <p className="text-gray-600 mb-2">
                      No professional summary added yet
                    </p>
                    <p className="text-gray-500 text-sm mb-4">
                      A good summary highlights your skills, experience, and
                      career goals
                    </p>
                    <Button
                      size="sm"
                      color="primary"
                      variant="flat"
                      onClick={() => {
                        setEditSummary("");
                        onOpen();
                      }}
                      startContent={<Edit2 size={14} />}
                    >
                      Add Summary
                    </Button>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="bg-gray-50/50 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-primary" />
                <h3 className="text-lg font-medium">Resume/CV</h3>
              </div>
              {candidate?.resumeUrl && (
                <Tooltip content="View resume">
                  <Button
                    isIconOnly
                    variant="light"
                    size="sm"
                    onClick={getAndOpenResume}
                    aria-label="View resume"
                  >
                    <SquareArrowOutUpRight size={16} />
                  </Button>
                </Tooltip>
              )}
            </CardHeader>

            <Divider />

            <CardBody className="p-6">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                    {candidate?.resumeUrl ? (
                      <Check size={18} className="text-success" />
                    ) : (
                      <X size={18} className="text-danger" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium">
                      {candidate?.resumeUrl
                        ? "Resume uploaded successfully"
                        : "No resume uploaded yet"}
                    </p>
                  </div>
                </div>

                <div className="mt-2">
                  <div className="flex flex-col gap-2">
                    <Input
                      type="file"
                      variant="flat"
                      onChange={(e) => uploadResume(e.target.files?.[0])}
                      isDisabled={resumeUploadLoading}
                      accept=".pdf,.doc,.docx"
                      aria-label="Upload resume"
                      classNames={{
                        input: "cursor-pointer",
                      }}
                      label="Upload or replace your resume"
                      description="Accepted formats: PDF, DOC, DOCX (max 5MB)"
                      size="sm"
                    />

                    {resumeUploadLoading && (
                      <div className="w-full bg-gray-200 rounded-full my-3">
                        <div
                          className="bg-primary h-2.5 rounded-full"
                          style={{ width: `${uploadProgress}%` }}
                        ></div>
                        <p className="text-xs text-gray-500">
                          Uploading: {uploadProgress}%
                        </p>
                      </div>
                    )}

                    {candidate?.resumeUrl && (
                      <div className="mt-2 flex gap-2">
                        <Button
                          color="primary"
                          variant="flat"
                          startContent={<SquareArrowOutUpRight size={14} />}
                          onClick={getAndOpenResume}
                        >
                          View Resume
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Edit Summary Modal */}
      <Modal
isDismissable={false}        isOpen={isOpen}
        onClose={onClose}
        size="2xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          {(onClose) => (
            <div>
              <ModalHeader className="flex flex-col gap-1 border-b">
                <h3 className="text-lg">Edit Professional Summary</h3>
                <p className="text-sm text-gray-500">
                  Provide an overview of your professional background and skills
                </p>
              </ModalHeader>
              <ModalBody className="py-6">
                <Textarea
                  value={editSummary}
                  onChange={(e) => setEditSummary(e.target.value)}
                  placeholder="Enter a concise summary of your professional background, key skills, and career objectives. This will appear at the top of your profile and make a strong first impression on employers."
                  minRows={8}
                  maxRows={12}
                  isInvalid={!!errors.summary}
                  errorMessage={errors.summary}
                  aria-label="Professional summary"
                />
                <div className="flex justify-between items-center mt-2">
                  <p className="text-xs text-gray-500">
                    Write a brief, compelling summary of your professional
                    background
                  </p>
                  <Badge
                    color={editSummary.length > 900 ? "warning" : "default"}
                    variant="flat"
                  >
                    {editSummary.length}/1000 characters
                  </Badge>
                </div>
              </ModalBody>
              <ModalFooter className="border-t">
                <Button color="danger" variant="light" onPress={onClose}>
                  Cancel
                </Button>
                <Button
                  color="primary"
                  onPress={handleSaveSummary}
                  isDisabled={editSummary.length > 1000}
                >
                  Save
                </Button>
              </ModalFooter>
            </div>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
};

export default General;
