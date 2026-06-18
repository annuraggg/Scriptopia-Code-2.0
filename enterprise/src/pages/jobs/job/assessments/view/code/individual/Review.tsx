import { Button } from "@heroui/button";
import { Divider } from "@heroui/divider";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import { Pagination } from "@heroui/pagination";
import { ExtendedMCQAssessmentSubmission } from "@shared-types/ExtendedMCQAssessmentSubmission";
import { useEffect, useState } from "react";
import { NumberInput } from "@heroui/number-input";
import { useAuth } from "@/auth";
import ax from "@/config/axios";
import { toast } from "sonner";

interface ReviewProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  submission: ExtendedMCQAssessmentSubmission;
  onReviewSave: () => void;
}

interface ReviewAnswer {
  _id?: string;
  question: string;
  code?: string;
  answer: string;
  obtainableGrades: number;
  obtainedGrades: number;
  section: string;
}

const Review = ({
  isOpen,
  onOpenChange,
  submission,
  onReviewSave,
}: ReviewProps) => {
  const [reviewAnswers, setReviewAnswers] = useState<ReviewAnswer[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState<number>(1);

  useEffect(() => {
    if (submission) {
      const answers: ReviewAnswer[] = [];

      submission.assessmentId?.sections.forEach((section) => {
        section.questions.forEach((question) => {
          if (question.type === "long-answer" || question.type === "output") {
            console.log("Long Answer or Output");
            const answer = submission.mcqSubmissions?.find(
              (mcqSubmission) =>
                mcqSubmission.mcqId.toString() === question._id?.toString()
            );

            const obtainedGrades =
              submission.obtainedGrades?.mcq?.find(
                (grade) => grade.mcqId === question._id
              )?.obtainedMarks || 0;

            if (answer) {
              const obj = {
                _id: question._id,
                question: question.question,
                code: question?.codeSnippet,
                answer: answer.selectedOptions[0],
                obtainableGrades: question.grade || 0,
                obtainedGrades: obtainedGrades,
                section: section.name,
              };

              answers.push(obj);
              console.log(obj);
            }
          }
        });
      });

      setReviewAnswers(answers);
    }
  }, [submission]);

  const { getToken } = useAuth();
  const axios = ax(getToken);

  const pushToServer = () => {
    const submissionId = submission._id;
    const mcqId = reviewAnswers[currentAnswer - 1]._id;
    const grade = reviewAnswers[currentAnswer - 1].obtainedGrades;

    axios
      .post(`assessments/mcq/grade`, {
        submissionId,
        mcqId,
        grade,
      })
      .then((res) => {
        console.log(res.data);
      })
      .catch((err) => {
        console.log(err);
        toast.error("Failed to grade answer");
      });
  };

  const changePage = (page: number) => {
    setCurrentAnswer(page);
    pushToServer();
  };

  const saveReview = () => {
    const submissionId = submission._id;
    pushToServer();

    axios
      .post(`assessments/mcq/save-review`, {
        submissionId,
      })
      .then(() => {
        onOpenChange(false);
        onReviewSave();
        toast.success("Grades saved successfully");
      })
      .catch((err) => {
        console.log(err);
        toast.error("Failed to grade answer");
      });
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="full">
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1">
              Review Manual Questions
            </ModalHeader>
            <ModalBody className="h-[80vh] flex flex-col justify-between items-start overflow-y-auto">
              <div className="flex flex-col w-full">
                <h4 className="font-semibold">
                  {reviewAnswers[currentAnswer - 1].section}
                </h4>
                <Divider className="my-5 w-full" />
                <h3 className="font-semibold">
                  {reviewAnswers[currentAnswer - 1].question}
                </h3>
                {reviewAnswers[currentAnswer - 1].code && (
                  <pre className="text-white bg-black p-3 rounded-xl mt-3">
                    {reviewAnswers[currentAnswer - 1].code}
                  </pre>
                )}

                <p className="mt-5 mb-3">Answer Given By User:</p>
                <p className="p-5 bg-gray-300 rounded-xl h-[20vh] overflow-y-auto">
                  {reviewAnswers[currentAnswer - 1].answer}
                </p>
                <div className="flex items-center gap-3 justify-end mt-5">
                  <NumberInput
                    hideStepper
                    aria-label="Grades"
                    className="max-w-xs"
                    size="sm"
                    description={`Between 0 and ${
                      reviewAnswers[currentAnswer - 1].obtainableGrades
                    }`}
                    minValue={0}
                    maxValue={reviewAnswers[currentAnswer - 1].obtainableGrades}
                    placeholder="Enter Grade"
                    value={reviewAnswers[currentAnswer - 1].obtainedGrades}
                    onValueChange={(value) => {
                      console.log(Number(value));
                      const answers = [...reviewAnswers];
                      answers[currentAnswer - 1].obtainedGrades = Number(value);
                      setReviewAnswers(answers);
                    }}
                  />
                  <p>/</p>
                  <p>{reviewAnswers[currentAnswer - 1].obtainableGrades}</p>
                </div>
              </div>
              <div className="flex items-center justify-center w-full">
                <Pagination
                  total={reviewAnswers.length}
                  page={currentAnswer}
                  onChange={changePage}
                  showControls
                />
              </div>
            </ModalBody>
            <ModalFooter>
              <Button color="danger" variant="light" onPress={onClose}>
                Close
              </Button>
              <Button color="success" variant="flat" onPress={saveReview}>
                Finish Grading{" "}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};

export default Review;
