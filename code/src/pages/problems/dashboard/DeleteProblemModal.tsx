import { useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  useDisclosure,
  Spinner,
} from "@heroui/react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/auth";
import ax from "@/config/axios";

interface Assessment {
  _id: string;
  name: string;
  type: "mcq" | "code" | "mcqcode";
  openRange?: {
    start: Date;
    end: Date;
  };
}

interface DeleteProblemModalProps {
  problemId: string;
  problemTitle: string;
}

const DeleteProblemModal = ({
  problemId,
  problemTitle,
}: DeleteProblemModalProps) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [error, setError] = useState<string | null>(null);
  const { getToken } = useAuth();
  const queryClient = useQueryClient();
  const axios = ax(getToken);

  const {
    data,
    isLoading: isChecking,
    refetch,
  } = useQuery({
    queryKey: ["problem-dependencies", problemId],
    queryFn: async () => {
      const response = await axios.get(`/problems/${problemId}/dependencies`);
      return response.data.data;
    },
    enabled: false,
    retry: 1,
  });

  const activeAssessments =
    data?.assessments?.filter((assessment: Assessment) => {
      if (!assessment.openRange) return false;
      const now = new Date();
      const end = new Date(assessment.openRange.end);
      return end > now;
    }) ?? [];

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await axios.delete(`/problems/${problemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-problems"] });
      onClose();
    },
    onError: (err) => {
      setError("Failed to delete problem. Please try again.");
      console.error("Delete error:", err);
    },
  });

  const handleOpen = () => {
    setError(null);
    onOpen();
    refetch();
  };

  const handleDelete = () => {
    if (activeAssessments.length === 0) {
      deleteMutation.mutate();
      refetch();
    }
  };

  return (
    <>
      <button
        onClick={handleOpen}
        className="text-red-400 hover:text-red-600 transition-colors"
        aria-label={`Delete ${problemTitle}`}
      >
        Delete
      </button>

      <Modal
        isOpen={isOpen}
        onClose={onClose}
        aria-labelledby="delete-modal-title"
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            <h2 id="delete-modal-title">Delete Problem</h2>
          </ModalHeader>

          <ModalBody>
            {isChecking ? (
              <div className="flex items-center justify-center p-4">
                <Spinner className="mr-2" />
                <p>Checking dependencies...</p>
              </div>
            ) : error ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : (
              data && (
                <div className="space-y-4">
                  <p className="text-gray-600">
                    Are you sure you want to delete "
                    <span className="font-medium">{problemTitle}</span>"?
                  </p>

                  {activeAssessments.length > 0 ? (
                    <Alert className="bg-yellow-50 border-yellow-200">
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                      <AlertDescription className="text-yellow-800">
                        This problem cannot be deleted as it is currently in use
                        in the following active assessments:
                        <ul className="mt-2 list-disc list-inside">
                          {activeAssessments.map((assessment: Assessment) => (
                            <li key={assessment._id} className="ml-2">
                              {assessment.name} ({assessment.type.toUpperCase()}
                              )
                            </li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Alert className="bg-green-50 border-green-200">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800">
                        This problem can be safely deleted as it is not used in
                        any active assessments.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )
            )}
          </ModalBody>

          <ModalFooter>
            <Button
              variant="ghost"
              onClick={onClose}
              className="mr-2"
              disabled={deleteMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="solid"
              color="danger"
              onClick={handleDelete}
              disabled={
                isChecking ||
                activeAssessments.length > 0 ||
                deleteMutation.isPending
              }
              isLoading={deleteMutation.isPending}
            >
              Delete
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default DeleteProblemModal;
