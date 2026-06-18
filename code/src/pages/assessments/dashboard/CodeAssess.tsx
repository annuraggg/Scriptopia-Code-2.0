import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Input,
} from "@heroui/react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import ax from "@/config/axios";
import { useAuth } from "@/auth";
import { CodeAssessment } from "@shared-types/CodeAssessment";
import confirmDelete from "@/components/ui/confirm-delete";
import { Chip } from "@heroui/react";
import {
  IconCalendarFilled,
  IconClockFilled,
  IconCode,
  IconEyeFilled,
  IconLink,
  IconTrashFilled,
} from "@tabler/icons-react";

const calculateStatus = (createdAssessment: CodeAssessment) => {
  const startDate = new Date(createdAssessment?.openRange?.start || "");
  const endDate = new Date(createdAssessment?.openRange?.end || "");
  const currentDate = new Date();

  if (currentDate < startDate) return "Upcoming";
  if (currentDate > endDate) return "Expired";
  return "Active";
};

const copyLink = (assessmentId: string) => {
  navigator.clipboard.writeText(
    `${window.location.origin}/assessments/c/${assessmentId}`
  );
  toast.success("Link copied to clipboard");
};

const CodeAssess = ({
  createdAssessments: initialCreatedAssessments,
}: {
  createdAssessments: CodeAssessment[];
}) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [createdAssessments, setCreatedAssessments] = useState<
    CodeAssessment[]
  >(initialCreatedAssessments);

  const filteredAssessments = useMemo(() => {
    return createdAssessments.filter((assessment) =>
      assessment.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [createdAssessments, searchTerm]);

  const { getToken } = useAuth();
  const axios = ax(getToken);

  const handleDelete = async (id: string) => {
    try {
      await axios.delete(`/assessments/code/${id}`);
      setCreatedAssessments((prevAssessments) =>
        prevAssessments.filter((assessment) => assessment._id !== id)
      );
    } catch (error) {
      console.error(
        "Error deleting assessment:",
        (error as any).response?.data || (error as any).message || error
      );
      throw new Error("Failed to delete assessment");
    }
  };

  if (filteredAssessments.length === 0) {
    return (
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full  px-10 py-3 h-[90vh] flex flex-col items-center justify-center"
      >
        <p className="text-white-200 text-lg">No Assessments Found</p>{" "}
        <div>
          <Button
            className="mt-5"
            variant="flat"
            onClick={() => navigate("/assessments/new/mcq")}
          >
            + Create MCQ Assessment
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="w-full  px-10 py-3 h-[90vh]"
    >
      <div>
        <div>
          <Input
            placeholder="Search Code Assessments"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div>
          <Button
            className="mt-5"
            variant="flat"
            onClick={() => navigate("/assessments/new/code")}
          >
            + Create Code Assessment
          </Button>
        </div>
        <div className="mt-5 flex gap-5 flex-wrap">
          {filteredAssessments.map((CreatedAssessment) => (
            <AssessmentCard
              key={CreatedAssessment._id ?? ""}
              assessment={CreatedAssessment}
              onView={() =>
                navigate(`/assessments/c/${CreatedAssessment._id ?? ""}`)
              }
              onDelete={() => {
                confirmDelete(() => handleDelete(CreatedAssessment._id ?? ""));
              }}
              onCopyLink={() => copyLink(CreatedAssessment._id ?? "")}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
};

const STATUS_COLORS = {
  Active: "success",
  Upcoming: "warning",
  Expired: "danger",
};

interface InfoRowProps {
  icon: React.ElementType;
  text: string;
}

const InfoRow = ({ icon: Icon, text }: InfoRowProps) => (
  <div className="flex items-center gap-2">
    <Icon size={16} className="text-default-400" strokeWidth={2} />
    <span className="text-sm text-default-500">{text}</span>
  </div>
);

interface AssessmentCardProps {
  assessment: CodeAssessment;
  onView: () => void;
  onDelete: () => void;
  onCopyLink: () => void;
}

const AssessmentCard = ({
  assessment,
  onView,
  onDelete,
  onCopyLink,
}: AssessmentCardProps) => {
  const status = calculateStatus(assessment);

  return (
    <Card className="w-[320px] bg-default-50/50 dark:bg-default-100/50 backdrop-blur-sm">
      <CardHeader className="px-4 pt-4 pb-0">
        <div className="flex justify-between items-start w-full">
          <h4 className="text-base font-medium line-clamp-1 flex-1 pr-2">
            {assessment?.name}
          </h4>
          <Chip
            color={STATUS_COLORS[status] as "success" | "warning" | "danger"}
            variant="flat"
            size="sm"
            classNames={{
              base: "text-xs",
              content: "font-medium px-2 py-1",
            }}
          >
            {status}
          </Chip>
        </div>
      </CardHeader>

      <CardBody className="px-4 py-3">
        <div className="flex flex-col gap-2">
          <InfoRow
            icon={IconCalendarFilled}
            text={
              assessment?.createdAt
                ? new Date(assessment.createdAt).toLocaleDateString()
                : "N/A"
            }
          />
          <InfoRow
            icon={IconClockFilled}
            text={`${assessment?.timeLimit} minutes`}
          />
          <InfoRow
            icon={IconCode}
            text={`${assessment?.problems?.length} problems`}
          />

          <div className="h-px bg-default-200/50 my-2" />

          <div className="space-y-1?.5">
            <p className="text-xs font-medium text-default-600">Time Range:</p>
            <p className="text-xs text-default-500">
              {new Date(assessment?.openRange?.start!)?.toLocaleString()}
            </p>
            <p className="text-xs text-default-500">
              {new Date(assessment?.openRange?.end!)?.toLocaleString()}
            </p>
          </div>
        </div>
      </CardBody>

      <CardFooter className="px-4 pb-4 pt-0 flex-col gap-2">
        <div className="flex gap-2 w-full">
          <Button
            className="w-1/2"
            variant="flat"
            size="sm"
            startContent={<IconEyeFilled size={16} strokeWidth={2} />}
            onClick={onView}
          >
            View
          </Button>
          <Button
            className="w-1/2"
            color="danger"
            variant="flat"
            size="sm"
            startContent={<IconTrashFilled size={16} strokeWidth={2} />}
            onClick={onDelete}
          >
            Delete
          </Button>
        </div>
        <Button
          className="w-full"
          color="success"
          variant="flat"
          size="sm"
          startContent={<IconLink size={16} strokeWidth={2} />}
          onClick={onCopyLink}
        >
          Copy Link
        </Button>
      </CardFooter>
    </Card>
  );
};

export default CodeAssess;
