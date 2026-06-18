import { useState } from "react";
import { motion } from "framer-motion";
import {
  Button,
  Input,
  Textarea,
  Chip,
  Card,
  CardBody,
  CardHeader,
  Divider,
} from "@nextui-org/react";
import { Save, ArrowLeft, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/auth";
import ax from "@/config/axios";
import { Company, YearStats } from "@shared-types/Company";

interface EditCompanyModalProps {
  company: Company;
  onClose: () => void;
  onSave: () => void;
}

const EditCompanyModal = ({
  company,
  onClose,
  onSave,
}: EditCompanyModalProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<Company>({ ...company });
  const [roles, setRoles] = useState<string[]>(
    company.generalInfo.rolesOffered || []
  );
  const [industries, setIndustries] = useState<string[]>(
    company.generalInfo.industry || []
  );
  const [newRole, setNewRole] = useState("");
  const [newIndustry, setNewIndustry] = useState("");
  const [error, setError] = useState<string | null>(null);

  // For managing year stats
  const [yearStats, setYearStats] = useState<YearStats[]>(
    company.generalInfo.yearStats || []
  );
  const [newYearStat, setNewYearStat] = useState<YearStats>({
    year: "",
    hired: 0,
    highest: 0,
    average: 0,
  });

  const { getToken } = useAuth();
  const axios = ax(getToken);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    if (name.includes(".")) {
      const [parent, child] = name.split(".");
      setFormData((prev) => {
        const parentObj = {
          ...(prev[parent as keyof Company] as Record<string, any>),
        };
        parentObj[child] = value;

        return {
          ...prev,
          [parent]: parentObj,
        };
      });
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  // Handle changes to year stats form fields
  const handleYearStatChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    setNewYearStat((prev) => ({
      ...prev,
      [name]: name === "year" ? value : value === "" ? 0 : parseFloat(value),
    }));
  };

  // Handle changes to existing year stats
  const handleExistingYearStatChange = (
    index: number,
    field: keyof YearStats,
    value: string
  ) => {
    const updatedYearStats = [...yearStats];

    if (field === "year") {
      updatedYearStats[index][field] = value;
    } else {
      updatedYearStats[index][field] = value === "" ? 0 : parseFloat(value);
    }

    setYearStats(updatedYearStats);
    updateFormDataYearStats(updatedYearStats);
  };

  // Update the formData with new year stats
  const updateFormDataYearStats = (updatedYearStats: YearStats[]) => {
    setFormData((prev) => ({
      ...prev,
      generalInfo: {
        ...prev.generalInfo,
        yearStats: updatedYearStats,
      },
    }));
  };

  // Add a new year stat
  const addYearStat = () => {
    if (
      newYearStat.year &&
      !yearStats.some((stat) => stat.year === newYearStat.year)
    ) {
      const updatedYearStats = [...yearStats, newYearStat];
      setYearStats(updatedYearStats);
      updateFormDataYearStats(updatedYearStats);
      setNewYearStat({
        year: "",
        hired: 0,
        highest: 0,
        average: 0,
      });
    }
  };

  // Remove a year stat
  const removeYearStat = (yearToRemove: string) => {
    const updatedYearStats = yearStats.filter(
      (stat) => stat.year !== yearToRemove
    );
    setYearStats(updatedYearStats);
    updateFormDataYearStats(updatedYearStats);
  };

  const addRole = () => {
    if (newRole && !roles.includes(newRole)) {
      const updatedRoles = [...roles, newRole];
      setRoles(updatedRoles);
      setFormData((prev) => ({
        ...prev,
        generalInfo: {
          ...prev.generalInfo,
          rolesOffered: updatedRoles,
        },
      }));
      setNewRole("");
    }
  };

  const removeRole = (roleToRemove: string) => {
    const updatedRoles = roles.filter((role) => role !== roleToRemove);
    setRoles(updatedRoles);
    setFormData((prev) => ({
      ...prev,
      generalInfo: {
        ...prev.generalInfo,
        rolesOffered: updatedRoles,
      },
    }));
  };

  const addIndustry = () => {
    if (newIndustry && !industries.includes(newIndustry)) {
      const updatedIndustries = [...industries, newIndustry];
      setIndustries(updatedIndustries);
      setFormData((prev) => ({
        ...prev,
        generalInfo: {
          ...prev.generalInfo,
          industry: updatedIndustries,
        },
      }));
      setNewIndustry("");
    }
  };

  const removeIndustry = (industryToRemove: string) => {
    const updatedIndustries = industries.filter(
      (industry) => industry !== industryToRemove
    );
    setIndustries(updatedIndustries);
    setFormData((prev) => ({
      ...prev,
      generalInfo: {
        ...prev.generalInfo,
        industry: updatedIndustries,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      // No need to transform yearStats as they should already be in the correct format
      const preparedData = {
        ...formData,
      };

      const response = await axios.put("/companies/update", preparedData);

      if (response.status === 200) {
        onSave();
      } else {
        setError(
          "Failed to update company: " + response.data?.message ||
            "Unknown error"
        );
      }
    } catch (err: any) {
      console.error("Error updating company:", err);
      setError(err.response?.data?.message || "Failed to update company");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="bg-white dark:bg-gray-900 rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto"
      >
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 p-4 flex justify-between items-center border-b">
          <div className="flex items-center gap-2">
            <Button isIconOnly variant="light" onClick={onClose}>
              <ArrowLeft size={20} />
            </Button>
            <h2 className="text-xl font-bold">Edit Company Profile</h2>
          </div>
          <div className="flex gap-2">
            <Button variant="flat" onClick={onClose}>
              Cancel
            </Button>
            <Button
              color="primary"
              startContent={<Save size={18} />}
              onClick={handleSubmit}
              isLoading={isLoading}
            >
              Save Changes
            </Button>
          </div>
        </div>

        {error && (
          <div className="m-4 p-3 bg-danger-100 text-danger-700 dark:bg-danger-900 dark:text-danger-300 rounded-lg">
            {error}
          </div>
        )}

        <div className="p-4">
          <form onSubmit={handleSubmit} className="space-y-6">
            <Card className="p-4">
              <CardHeader className="pb-0 pt-0">
                <h3 className="text-lg font-semibold">Basic Information</h3>
              </CardHeader>
              <CardBody>
                <div className="space-y-4">
                  <Input
                    label="Company Name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    isRequired
                  />

                  <Textarea
                    label="Description"
                    name="description"
                    value={formData.description || ""}
                    onChange={handleInputChange}
                    minRows={3}
                  />
                </div>
              </CardBody>
            </Card>

            <Card className="p-4">
              <CardHeader className="pb-0 pt-0">
                <h3 className="text-lg font-semibold">Industry</h3>
              </CardHeader>
              <CardBody>
                <div className="space-y-4">
                  <div>
                    <div className="flex gap-2 mb-2">
                      <Input
                        label="Industry"
                        placeholder="e.g. Technology"
                        value={newIndustry}
                        onChange={(e) => setNewIndustry(e.target.value)}
                        className="flex-1"
                      />
                      <Button onClick={addIndustry} className="self-end">
                        Add
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {industries.map((industry) => (
                        <Chip
                          key={industry}
                          onClose={() => removeIndustry(industry)}
                          variant="flat"
                        >
                          {industry}
                        </Chip>
                      ))}
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card className="p-4">
              <CardHeader className="pb-0 pt-0">
                <h3 className="text-lg font-semibold">Year Statistics</h3>
              </CardHeader>
              <CardBody>
                <div className="space-y-6">
                  {/* Existing Year Stats */}
                  {yearStats.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="text-md font-medium">Existing Records</h4>
                      {yearStats.map((stat, index) => (
                        <div key={stat.year} className="p-3 border rounded-lg">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium">
                              Year: {stat.year}
                            </span>
                            <Button
                              isIconOnly
                              color="danger"
                              variant="light"
                              onClick={() => removeYearStat(stat.year)}
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <Input
                              type="number"
                              label="Students Hired"
                              value={stat.hired.toString()}
                              onChange={(e) =>
                                handleExistingYearStatChange(
                                  index,
                                  "hired",
                                  e.target.value
                                )
                              }
                            />
                            <Input
                              type="number"
                              label="Highest Package (₹)"
                              value={stat.highest.toString()}
                              onChange={(e) =>
                                handleExistingYearStatChange(
                                  index,
                                  "highest",
                                  e.target.value
                                )
                              }
                              startContent={
                                <span className="text-default-400">₹</span>
                              }
                            />
                            <Input
                              type="number"
                              label="Average Package (₹)"
                              value={stat.average.toString()}
                              onChange={(e) =>
                                handleExistingYearStatChange(
                                  index,
                                  "average",
                                  e.target.value
                                )
                              }
                              startContent={
                                <span className="text-default-400">₹</span>
                              }
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <Divider />

                  {/* Add New Year Stat */}
                  <div className="space-y-4">
                    <h4 className="text-md font-medium">Add New Year Record</h4>
                    <div className="p-3 border rounded-lg">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                        <Input
                          label="Year"
                          name="year"
                          placeholder="e.g. 2023"
                          value={newYearStat.year}
                          onChange={handleYearStatChange}
                        />
                        <Input
                          type="number"
                          label="Students Hired"
                          name="hired"
                          value={newYearStat.hired.toString()}
                          onChange={handleYearStatChange}
                        />
                        <Input
                          type="number"
                          label="Highest Package (₹)"
                          name="highest"
                          value={newYearStat.highest.toString()}
                          onChange={handleYearStatChange}
                          startContent={
                            <span className="text-default-400">₹</span>
                          }
                        />
                        <Input
                          type="number"
                          label="Average Package (₹)"
                          name="average"
                          value={newYearStat.average.toString()}
                          onChange={handleYearStatChange}
                          startContent={
                            <span className="text-default-400">₹</span>
                          }
                        />
                      </div>
                      <div className="flex justify-end">
                        <Button
                          color="primary"
                          startContent={<Plus size={18} />}
                          onClick={addYearStat}
                        >
                          Add Year Record
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card className="p-4">
              <CardHeader className="pb-0 pt-0">
                <h3 className="text-lg font-semibold">Roles Offered</h3>
              </CardHeader>
              <CardBody>
                <div className="space-y-4">
                  <div>
                    <div className="flex gap-2 mb-2">
                      <Input
                        label="Roles Offered"
                        placeholder="e.g. Software Engineer"
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value)}
                        className="flex-1"
                      />
                      <Button onClick={addRole} className="self-end">
                        Add
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {roles.map((role) => (
                        <Chip
                          key={role}
                          onClose={() => removeRole(role)}
                          variant="flat"
                        >
                          {role}
                        </Chip>
                      ))}
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card className="p-4">
              <CardHeader className="pb-0 pt-0">
                <h3 className="text-lg font-semibold">
                  HR Contact Information
                </h3>
              </CardHeader>
              <CardBody>
                <div className="space-y-4">
                  <Input
                    label="HR Name"
                    name="hrContact.name"
                    value={formData.hrContact?.name || ""}
                    onChange={handleInputChange}
                  />

                  <Input
                    label="HR Phone"
                    name="hrContact.phone"
                    value={formData.hrContact?.phone || ""}
                    onChange={handleInputChange}
                  />

                  <Input
                    label="HR Email"
                    name="hrContact.email"
                    type="email"
                    value={formData.hrContact?.email || ""}
                    onChange={handleInputChange}
                  />

                  <Input
                    label="Company Website"
                    name="hrContact.website"
                    value={formData.hrContact?.website || ""}
                    onChange={handleInputChange}
                  />
                </div>
              </CardBody>
            </Card>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

export default EditCompanyModal;
