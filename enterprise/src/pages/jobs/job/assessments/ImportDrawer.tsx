import ax from "@/config/axios";
import { useAuth } from "@/auth";
import {
  Drawer as HeroDrawer,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerFooter,
} from "@heroui/drawer";
import { Button } from "@heroui/button";
import { Card, CardHeader, CardBody, CardFooter } from "@heroui/card";
import { Spinner } from "@heroui/spinner";
import { CodeAssessment } from "@shared-types/CodeAssessment";
import { MCQAssessment } from "@shared-types/MCQAssessment";
import { Posting, StepType } from "@shared-types/Posting";
import {
  IconCalendarFilled,
  IconClockFilled,
  IconCode,
  IconDownload,
  IconLayoutFilled,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";

interface DrawerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onOpen: () => void;
  type: StepType | null;
  posting: Posting;
  step: number | null;
  addToConfiguredAssessments: () => void;
}

interface InfoRowProps {
  icon: React.ElementType;
  text: string;
}

const Drawer = ({
  isOpen,
  onOpenChange,
  type,
  posting,
  step,
  addToConfiguredAssessments,
}: DrawerProps) => {
  const { getToken } = useAuth();
  const axios = ax(getToken);

  const [mcqAssessments, setMCQAssessments] = useState<MCQAssessment[]>([]);
  const [codeAssessments, setCodeAssessments] = useState<CodeAssessment[]>([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<
    string | null
  >(null);
  const [loading, setLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);

  const {
    isOpen: modalIsOpen,
    onOpenChange: onModalOpenChange,
    onOpen: onModalOpen,
    onClose: onModalClose,
  } = useDisclosure();

  useEffect(() => {
    if (!type) return;
    setLoading(true);

    console.log("Step: ", step);

    let url = "";
    if (type === "CODING_ASSESSMENT") url = "/assessments/code/created";
    if (type === "MCQ_ASSESSMENT") url = "/assessments/mcq/created";

    axios
      .get(url)
      .then((res) => {
        const data = res.data.data;
        if (type === "CODING_ASSESSMENT") setCodeAssessments(data);
        if (type === "MCQ_ASSESSMENT") setMCQAssessments(data);
      })
      .catch((err) => {
        toast.error("Failed to fetch assessments");
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, [type]);

  const importAssessment = async () => {
    if (!selectedAssessmentId) return;
    setImportLoading(true);
    let finalAssessment = null;

    if (type === "CODING_ASSESSMENT") {
      const selectedAssessment = codeAssessments.find(
        (assessment) => assessment._id === selectedAssessmentId
      );

      if (!selectedAssessment) return;

      finalAssessment = {
        ...selectedAssessment,
        _id: undefined,
        isEnterprise: true,
        isCampus: false,
        openRange: undefined,
        candidates: [],
        public: true,
        postingId: posting?._id || "",
        step: step,
      };
    }

    if (type === "MCQ_ASSESSMENT") {
      const selectedAssessment = mcqAssessments.find(
        (assessment) => assessment._id === selectedAssessmentId
      );

      if (!selectedAssessment) return;

      finalAssessment = {
        ...selectedAssessment,
        _id: undefined,
        isEnterprise: true,
        isCampus: false,
        openRange: undefined,
        candidates: [],
        public: true,
        postingId: posting?._id || "",
        step: step,
      };
    }

    let url = "";
    if (type === "CODING_ASSESSMENT") url = "/assessments/code";
    if (type === "MCQ_ASSESSMENT") url = "/assessments/mcq";

    try {
      await axios.post(url, finalAssessment);
      toast.success("Assessment imported successfully");
      console.log("Assessment imported successfully");
      addToConfiguredAssessments();
      onModalClose();
    } catch (err) {
      toast.error("Failed to import assessment");
      console.error(err);
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <>
      <HeroDrawer isOpen={isOpen} onOpenChange={onOpenChange}>
        <DrawerContent>
          {(onClose) => (
            <>
              <DrawerHeader className="flex flex-col gap-1">
                Import Assessment
              </DrawerHeader>
              <DrawerBody>
                {loading ? (
                  <div className="flex items-center justify-center mt-10">
                    <Spinner />
                  </div>
                ) : (
                  <>
                    {type === "CODING_ASSESSMENT" &&
                      codeAssessments.map((assessment) => (
                        <CodeAssessmentCard
                          key={assessment._id}
                          assessment={assessment}
                          setSelectedAssessmentId={setSelectedAssessmentId}
                          onOpen={onModalOpen}
                        />
                      ))}
                    {type === "MCQ_ASSESSMENT" &&
                      mcqAssessments.map((assessment) => (
                        <MCQAssessmentCard
                          key={assessment._id}
                          assessment={assessment}
                          setSelectedAssessmentId={setSelectedAssessmentId}
                          onOpen={onModalOpen}
                        />
                      ))}
                  </>
                )}
              </DrawerBody>
              <DrawerFooter>
                <Button color="danger" variant="light" onPress={onClose}>
                  Close
                </Button>
              </DrawerFooter>
            </>
          )}
        </DrawerContent>
      </HeroDrawer>
      <Modal isOpen={modalIsOpen} onOpenChange={onModalOpenChange}>
        <ModalContent>
          {(onModalClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                Confirm Import
              </ModalHeader>
              <ModalBody>
                Do you want to import this assessment? It will import this
                assessment as is. You cannot modify the assessment after
                importing.
              </ModalBody>
              <ModalFooter>
                <Button
                  color="danger"
                  variant="light"
                  onPress={onModalClose}
                  isDisabled={importLoading}
                >
                  Cancel
                </Button>
                <Button
                  color="primary"
                  onPress={importAssessment}
                  isLoading={importLoading}
                >
                  Import
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
      ;
    </>
  );
};

const CodeAssessmentCard = ({
  assessment,
  setSelectedAssessmentId,
  onOpen,
}: {
  assessment: CodeAssessment;
  setSelectedAssessmentId: (id: string) => void;
  onOpen: () => void;
}) => {
  return (
    <Card className="min-h-fit bg-default-50/50 dark:bg-default-100/50 backdrop-blur-sm">
      <CardHeader className="px-4 pt-4 pb-0">
        <div className="flex justify-between items-start w-full">
          <h4 className="text-base font-medium line-clamp-1 flex-1 pr-2">
            {assessment?.name}
          </h4>
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
        </div>
      </CardBody>

      <CardFooter className="px-4 pb-4 pt-0 flex-col gap-2">
        <Button
          className="w-full"
          color="success"
          variant="flat"
          size="sm"
          startContent={<IconDownload size={16} strokeWidth={2} />}
          onPress={() => {
            setSelectedAssessmentId(assessment._id || "");
            onOpen();
          }}
        >
          Import
        </Button>
      </CardFooter>
    </Card>
  );
};

const MCQAssessmentCard = ({
  assessment,
  setSelectedAssessmentId,
  onOpen,
}: {
  assessment: MCQAssessment;
  setSelectedAssessmentId: (id: string) => void;
  onOpen: () => void;
}) => {
  return (
    <Card className=" bg-default-50/50 dark:bg-default-100/50 backdrop-blur-sm min-h-fit">
      <CardHeader className="px-4 pt-4 pb-0">
        <div className="flex justify-between items-start w-full">
          <h4 className="text-base font-medium line-clamp-1 flex-1 pr-2">
            {assessment.name}
          </h4>
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
            text={`${assessment.timeLimit} minutes`}
          />
          <InfoRow
            icon={IconLayoutFilled}
            text={`${assessment.sections.length} sections`}
          />

          <div className="h-px bg-default-200/50 my-2" />

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-default-600">Time Range:</p>
            <p className="text-xs text-default-500">
              {new Date(assessment.openRange?.start!).toLocaleString()}
            </p>
            <p className="text-xs text-default-500">
              {new Date(assessment.openRange?.end!).toLocaleString()}
            </p>
          </div>
        </div>
      </CardBody>

      <CardFooter className="px-4 pb-4 pt-0 flex-col gap-2">
        <Button
          className="w-full"
          color="success"
          variant="flat"
          size="sm"
          startContent={<IconDownload size={16} />}
          onPress={() => {
            setSelectedAssessmentId(assessment._id || "");
            onOpen();
          }}
        >
          Import
        </Button>
      </CardFooter>
    </Card>
  );
};

const InfoRow = ({ icon: Icon, text }: InfoRowProps) => (
  <div className="flex items-center gap-2">
    <Icon size={16} className="text-default-400" strokeWidth={2} />
    <span className="text-sm text-default-500">{text}</span>
  </div>
);

export default Drawer;
