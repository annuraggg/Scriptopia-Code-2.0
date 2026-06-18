import React, { useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Select,
  SelectItem,
  Chip,
} from "@nextui-org/react";
import { PlacementGroup } from "@shared-types/PlacementGroup";
import { Department } from "@shared-types/Institute";
import { Candidate as CandidateType } from "@shared-types/Candidate";
import { useAuth } from "@/auth";
import ax from "@/config/axios";
import { toast } from "sonner";
interface EditGroupModalProps {
  group: PlacementGroup;
  instituteDepartments: Department[];
  instituteCandidates: CandidateType[];
  onClose: () => void;
  onSave: (updatedGroup: PlacementGroup) => void;
}

const EditGroupModal: React.FC<EditGroupModalProps> = ({
  group,
  instituteDepartments,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(group.name);
  const [startYear, setStartYear] = useState(group.academicYear.start);
  const [endYear, setEndYear] = useState(group.academicYear.end);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>(
    group.departments
  );
  const [purpose, setPurpose] = useState(group.purpose);
  const [expiryDate, setExpiryDate] = useState(
    new Date(group.expiryDate).toISOString().split("T")[0]
  );
  const [selectedCandidates] = useState<string[]>(group.candidates);
  const [loading, setLoading] = useState(false);

  const { getToken } = useAuth();
  const axios = ax(getToken);

  const generateYears = () => {
    const currentYear = new Date().getFullYear();
    const startYear = 2000;
    const endYear = currentYear + 4;
    return Array.from(
      { length: endYear - startYear + 1 },
      (_, i) => `${startYear + i}`
    );
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const response = await axios.put(`/placement-groups/${group._id}`, {
        name,
        academicYear: { start: startYear, end: endYear },
        departments: selectedDepartments,
        purpose,
        expiryDate,
        candidates: selectedCandidates,
      });

      onSave(response.data);
      toast.success("Group updated successfully!");
      onClose();
    } catch (err) {
      if (err instanceof Error) {
        toast.error("Error updating group: " + err.message);
      } else {
        toast.error("Error updating group: An unknown error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleDepartment = (departmentId: string) => {
    setSelectedDepartments(
      selectedDepartments.includes(departmentId)
        ? selectedDepartments.filter((id) => id !== departmentId)
        : [...selectedDepartments, departmentId]
    );
  };

  return (
    <Modal isOpen={true} onClose={onClose} size="4xl" className="max-h-[90vh]">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          Edit Placement Group
        </ModalHeader>
        <ModalBody className="overflow-y-auto">
          <div className="space-y-6">
            <Input
              label="Group Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
            />

            <div className="flex gap-4">
              <Select
                label="Start Year"
                selectedKeys={[startYear]}
                onChange={(e) => setStartYear(e.target.value)}
                className="flex-1"
              >
                {generateYears().map((year) => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </Select>

              <Select
                label="End Year"
                selectedKeys={[endYear]}
                onChange={(e) => setEndYear(e.target.value)}
                className="flex-1"
              >
                {generateYears().map((year) => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </Select>
            </div>

            <div>
              <p className="text-sm mb-2">Departments</p>
              <div className="flex flex-wrap gap-2">
                {instituteDepartments.map((dept) => (
                  <Chip
                    key={dept._id}
                    color={
                      selectedDepartments.includes(dept._id!)
                        ? "primary"
                        : "default"
                    }
                    onClose={
                      selectedDepartments.includes(dept._id!)
                        ? () => toggleDepartment(dept._id!)
                        : undefined
                    }
                    onClick={() => toggleDepartment(dept._id!)}
                    className="cursor-pointer"
                  >
                    {dept.name}
                  </Chip>
                ))}
              </div>
            </div>

            <Input
              label="Purpose"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              fullWidth
            />

            <Input
              type="date"
              label="Expiry Date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              fullWidth
            />

            {/* 
                        <Divider /> */}

            {/* <div className="space-y-4">
                            <h3 className="font-medium">Manage Candidates</h3>
                            <DataTable
                                data={instituteCandidates}
                                selectedCandidates={selectedCandidates}
                                setSelectedCandidates={setSelectedCandidates}
                            />
                        </div> */}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button color="danger" variant="light" onPress={onClose}>
            Cancel
          </Button>
          <Button color="primary" onPress={handleSubmit} isLoading={loading}>
            Save Changes
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default EditGroupModal;
