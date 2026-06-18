import React, { useState } from "react";
import { ExtendedMCQAssessmentSubmission } from "@shared-types/ExtendedMCQAssessmentSubmission";
import { CheckCircle, XCircle, User, Mail } from "lucide-react";
import { Option } from "@shared-types/MCQAssessment";
import { useAuth } from "@/auth";
import ax from "@/config/axios";
import { toast } from "sonner";
import { NumberInput } from "@heroui/number-input";

interface AssessmentResultsProps {
  submission: ExtendedMCQAssessmentSubmission;
}

const AssessmentResults: React.FC<AssessmentResultsProps> = ({
  submission,
}) => {
  const {
    name,
    email,
    mcqSubmissions = [],
    obtainedGrades,
    assessmentId,
  } = submission;

  // Helper function to find a question by id
  const findQuestionById = (questionId: string) => {
    for (const section of assessmentId.sections) {
      const question = section.questions.find((q) => q._id === questionId);
      if (question) return question;
    }
    return null;
  };

  // Local state for grades that can be edited
  const [grades, setGrades] = useState<Record<string, number>>(
    obtainedGrades?.mcq?.reduce((acc, grade) => {
      acc[grade.mcqId] = grade.obtainedMarks;
      return acc;
    }, {} as Record<string, number>) || {}
  );

  // Calculate summary statistics
  const totalQuestions = assessmentId.sections.reduce(
    (acc, section) => acc + section.questions.length,
    0
  );

  const totalAnswered = mcqSubmissions.length || 0;

  // Helper function to check if an answer is correct based on question type
  const isAnswerCorrect = (question: any, userSubmission: any): boolean => {
    if (!question || !userSubmission) return false;

    switch (question.type) {
      case "single-select":
      case "multi-select":
      case "true-false":
        // Check if all selected options are correct and all correct options are selected
        const selectedOptionIds = userSubmission.selectedOptions || [];
        const correctOptionIds =
          question.options
            ?.filter((o: Option) => o.isCorrect)
            .map((o: Option) => o.option) || [];

        if (question.type === "single-select") {
          return (
            selectedOptionIds.length === 1 &&
            question.options?.find(
              (o: Option) => o.option === selectedOptionIds[0]
            )?.isCorrect === true
          );
        } else if (question.type === "true-false") {
          return (
            selectedOptionIds.length === 1 &&
            question.options?.find(
              (o: Option) =>
                o.option.toLocaleLowerCase() ===
                selectedOptionIds[0].toLowerCase()
            )?.isCorrect === true
          );
        } else {
          // For multi-select: all correct must be selected and no incorrect ones
          const allCorrectSelected = correctOptionIds.every((id: string) =>
            selectedOptionIds.includes(id)
          );
          const noIncorrectSelected = selectedOptionIds.every((id: string) =>
            correctOptionIds.includes(id)
          );
          return allCorrectSelected && noIncorrectSelected;
        }

      case "matching":
        // For matching, check if all pairs match correctly
        const selectedPairs = userSubmission.selectedOptions || [];
        const allOptions: Option[] = question.options || [];

        const isCorrect = allOptions.every((option: Option, idx: number) => {
          return option.matchingPairText === selectedPairs[idx];
        });

        return isCorrect;

      case "fill-in-blanks":
        // Compare each answer with the corresponding blank
        const userAnswers = userSubmission.selectedOptions || [];
        const correctAnswers = question.fillInBlankAnswers || [];

        return (
          userAnswers.length === correctAnswers.length &&
          userAnswers.every(
            (answer: string, idx: number) =>
              answer.trim().toLowerCase() ===
              correctAnswers[idx].trim().toLowerCase()
          )
        );

      case "short-answer":
      case "long-answer":
      case "visual":
      case "output":
      case "peer-review":
        // These are manually graded, so check if they have marks assigned
        const grade = obtainedGrades?.mcq?.find(
          (g) => g.mcqId === question._id
        );
        return grade !== undefined && grade.obtainedMarks > 0;

      default:
        return false;
    }
  };

  // Count correct answers
  const correctAnswers = mcqSubmissions.filter((submission) => {
    const question = findQuestionById(submission.mcqId);
    return isAnswerCorrect(question, submission);
  }).length;

  const incorrectAnswers = totalAnswered - correctAnswers;

  const totalScore = obtainedGrades?.total || 0;
  const maxPossibleScore = assessmentId.obtainableScore;
  const scorePercentage =
    maxPossibleScore > 0
      ? Math.round((totalScore / maxPossibleScore) * 100)
      : 0;

  const isPassed = scorePercentage >= assessmentId.passingPercentage;

  const { getToken } = useAuth();
  const axios = ax(getToken);

  // Handle local state update without sending to server
  const handleGradeChange = (mcqId: string, newGrade: number) => {
    setGrades((prev) => ({
      ...prev,
      [mcqId]: newGrade,
    }));
  };

  // Send grade update to server only when input loses focus
  const handleGradeBlur = (mcqId: string) => {
    const newGrade = grades[mcqId] || 0;
    const submissionId = submission._id;

    axios
      .post(`assessments/mcq/grade`, {
        submissionId,
        mcqId,
        grade: newGrade,
      })
      .then((res) => {
        console.log(res.data);
        toast.success("Grade updated successfully");
      })
      .catch((err) => {
        console.log(err);
        toast.error("Failed to grade answer");
      });
  };

  // Group submissions by section
  const getSubmissionsBySection = () => {
    const sectionMap: Record<
      string,
      {
        sectionName: string;
        submissions: Array<{
          submission: any;
          question: any;
          grade: any;
          sectionName: string;
          isCorrect: boolean;
        }>;
      }
    > = {};

    mcqSubmissions.forEach((submission) => {
      let sectionName = "";
      let question = null;

      // Find the section and question
      for (const section of assessmentId.sections) {
        const foundQuestion = section.questions.find(
          (q) => q._id === submission.mcqId
        );
        if (foundQuestion) {
          sectionName = section.name;
          question = foundQuestion;
          break;
        }
      }

      if (!sectionName) return;

      const grade = obtainedGrades?.mcq?.find(
        (g) => g.mcqId === submission.mcqId
      );

      if (!sectionMap[sectionName]) {
        sectionMap[sectionName] = {
          sectionName,
          submissions: [],
        };
      }

      const isCorrect = isAnswerCorrect(question, submission);

      sectionMap[sectionName].submissions.push({
        submission,
        question,
        grade,
        sectionName,
        isCorrect,
      });
    });

    return Object.values(sectionMap);
  };

  const sections = getSubmissionsBySection();

  return (
    <div className="container mx-auto py-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">
            {assessmentId.name} - Results
          </h1>
        </div>

        {/* Candidate Info */}
        <div className="p-6 bg-gray-50 border-b border-gray-200">
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-gray-500" />
              <span className="text-gray-700">{name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-gray-500" />
              <span className="text-gray-700">{email}</span>
            </div>
          </div>
        </div>

        {/* Score Summary */}
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="font-medium text-gray-500">Total Score</div>
              <div className="text-3xl font-bold mt-1">
                {totalScore} / {maxPossibleScore}
              </div>
              <div className="text-lg font-semibold mt-1">
                {scorePercentage}%
              </div>
              <div
                className={`text-sm font-medium mt-2 inline-block px-2 py-1 rounded-full ${
                  isPassed
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {isPassed ? "PASSED" : "FAILED"}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="font-medium text-gray-500">Correct Answers</div>
              <div className="text-3xl font-bold mt-1 text-green-600">
                {correctAnswers}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                out of {totalQuestions} questions
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="font-medium text-gray-500">Incorrect Answers</div>
              <div className="text-3xl font-bold mt-1 text-red-600">
                {incorrectAnswers}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                out of {totalQuestions} questions
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="font-medium text-gray-500">
                Passing Percentage
              </div>
              <div className="text-3xl font-bold mt-1">
                {assessmentId.passingPercentage}%
              </div>
              <div className="text-sm text-gray-500 mt-1">Required to pass</div>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Results By Section */}
      {sections.map((section, sectionIndex) => (
        <div
          key={`section-${sectionIndex}`}
          className="bg-white rounded-lg shadow-md overflow-hidden mb-6"
        >
          <div className="p-6 border-b border-gray-200 bg-gray-50">
            <h2 className="text-xl font-bold text-gray-900">
              {section.sectionName}
            </h2>
          </div>

          <div className="divide-y divide-gray-200">
            {section.submissions.map(
              ({ submission, question, isCorrect }, index) => {
                const maxGrade = question?.grade || 0;

                return (
                  <div key={submission.mcqId} className="p-6">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-gray-200 text-gray-700 text-sm font-medium">
                          {index + 1}
                        </span>
                        <span className="text-sm text-gray-500">
                          Question Type: {question?.type}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex items-center gap-1 ${
                            isCorrect ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {isCorrect ? (
                            <CheckCircle className="h-5 w-5" />
                          ) : (
                            <XCircle className="h-5 w-5" />
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <NumberInput
                            className="w-32"
                            value={grades[submission.mcqId] || 0}
                            minValue={0}
                            maxValue={maxGrade}
                            onValueChange={(e) => {
                              const newGrade = parseFloat(e.toString());
                              handleGradeChange(submission.mcqId, newGrade);
                            }}
                            onBlur={() => handleGradeBlur(submission.mcqId)}
                            size="sm"
                          />
                          <span className="text-gray-600">/ {maxGrade}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mb-6">
                      <div className="font-medium text-gray-900 mb-3">
                        {question?.question || "Question not found"}
                      </div>

                      {/* Code snippet if available */}
                      {question?.codeSnippet && (
                        <div className="bg-gray-800 text-white p-4 rounded-md mb-4 font-mono text-sm overflow-x-auto">
                          <pre>{question.codeSnippet}</pre>
                        </div>
                      )}

                      {/* Image if available */}
                      {question?.imageSource && (
                        <div className="mb-4">
                          <img
                            src={question.imageSource}
                            alt="Question visual"
                            className="max-w-full h-auto rounded-md border border-gray-200 max-h-96"
                          />
                        </div>
                      )}

                      {/* Different question types */}
                      {(question?.type === "single-select" ||
                        question?.type === "multi-select") && (
                        <div className="space-y-2 ml-4">
                          <div className="text-sm font-medium text-gray-500 mb-2">
                            {question.type === "single-select"
                              ? "Select one option:"
                              : "Select all that apply:"}
                          </div>
                          {question.options?.map((option: Option) => {
                            const isSelected =
                              submission.selectedOptions.includes(
                                option._id || ""
                              );
                            const isCorrectOption = option.isCorrect;

                            let optionClass =
                              "flex items-center p-2 rounded-md ";

                            if (isSelected && isCorrectOption) {
                              optionClass +=
                                "bg-green-50 border border-green-200";
                            } else if (isSelected && !isCorrectOption) {
                              optionClass += "bg-red-50 border border-red-200";
                            } else if (!isSelected && isCorrectOption) {
                              optionClass +=
                                "bg-blue-50 border border-blue-200";
                            } else {
                              optionClass +=
                                "bg-gray-50 border border-gray-200";
                            }

                            return (
                              <div key={option._id} className={optionClass}>
                                <div className="flex-1">{option.option}</div>
                                {isSelected && (
                                  <div className="ml-2">
                                    {isCorrectOption ? (
                                      <CheckCircle className="h-5 w-5 text-green-600" />
                                    ) : (
                                      <XCircle className="h-5 w-5 text-red-600" />
                                    )}
                                  </div>
                                )}
                                {!isSelected && isCorrectOption && (
                                  <div className="ml-2">
                                    <CheckCircle className="h-5 w-5 text-blue-600" />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* True/False Questions */}
                      {question?.type === "true-false" && (
                        <div className="space-y-2 ml-4">
                          <div className="text-sm font-medium text-gray-500 mb-2">
                            True or False:
                          </div>
                          {question.options?.map((option: Option) => {
                            const isSelected =
                              submission.selectedOptions.includes(
                                option._id || ""
                              );
                            const isCorrectOption = option.isCorrect;

                            let optionClass =
                              "flex items-center p-2 rounded-md ";

                            if (isSelected && isCorrectOption) {
                              optionClass +=
                                "bg-green-50 border border-green-200";
                            } else if (isSelected && !isCorrectOption) {
                              optionClass += "bg-red-50 border border-red-200";
                            } else if (!isSelected && isCorrectOption) {
                              optionClass +=
                                "bg-blue-50 border border-blue-200";
                            } else {
                              optionClass +=
                                "bg-gray-50 border border-gray-200";
                            }

                            return (
                              <div key={option._id} className={optionClass}>
                                <div className="flex-1">{option.option}</div>
                                {isSelected && (
                                  <div className="ml-2">
                                    {isCorrectOption ? (
                                      <CheckCircle className="h-5 w-5 text-green-600" />
                                    ) : (
                                      <XCircle className="h-5 w-5 text-red-600" />
                                    )}
                                  </div>
                                )}
                                {!isSelected && isCorrectOption && (
                                  <div className="ml-2">
                                    <CheckCircle className="h-5 w-5 text-blue-600" />
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Short and Long Answer Questions */}
                      {(question?.type === "short-answer" ||
                        question?.type === "long-answer") && (
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-500 mb-2">
                            Candidate's Answer:
                          </div>
                          <div className="p-3 bg-gray-50 border border-gray-200 rounded-md mb-3">
                            {submission.selectedOptions[0] ||
                              "No answer provided"}
                          </div>

                          {question.correct && (
                            <>
                              <div className="text-sm font-medium text-gray-500 mb-2">
                                Correct Answer:
                              </div>
                              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                                {question.correct}
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {/* Fill in the Blanks */}
                      {question?.type === "fill-in-blanks" && (
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-500 mb-2">
                            Candidate's Answers:
                          </div>
                          <div className="space-y-2 mb-3">
                            {submission.selectedOptions.map(
                              (answer: string, i: number) => {
                                const correctAnswer =
                                  question.fillInBlankAnswers?.[i];
                                const isAnswerCorrect =
                                  correctAnswer &&
                                  answer.trim().toLowerCase() ===
                                    correctAnswer.trim().toLowerCase();

                                return (
                                  <div
                                    key={`fill-${i}`}
                                    className={`flex items-center gap-3 p-2 rounded-md ${
                                      isAnswerCorrect
                                        ? "bg-green-50 border border-green-200"
                                        : "bg-red-50 border border-red-200"
                                    }`}
                                  >
                                    <span className="text-sm font-medium">
                                      Blank {i + 1}:
                                    </span>
                                    <span className="p-2 rounded-md bg-white border border-gray-200">
                                      {answer || "(empty)"}
                                    </span>
                                    <div className="ml-auto">
                                      {isAnswerCorrect ? (
                                        <CheckCircle className="h-5 w-5 text-green-600" />
                                      ) : (
                                        <XCircle className="h-5 w-5 text-red-600" />
                                      )}
                                    </div>
                                  </div>
                                );
                              }
                            )}
                          </div>

                          {question.fillInBlankAnswers &&
                            question.fillInBlankAnswers.length > 0 && (
                              <>
                                <div className="text-sm font-medium text-gray-500 mb-2">
                                  Correct Answers:
                                </div>
                                <div className="space-y-2">
                                  {question.fillInBlankAnswers.map(
                                    (answer: string, i: number) => (
                                      <div
                                        key={`correct-fill-${i}`}
                                        className="flex items-center gap-3"
                                      >
                                        <span className="text-sm font-medium">
                                          Blank {i + 1}:
                                        </span>
                                        <span className="p-2 bg-blue-50 border border-blue-200 rounded-md">
                                          {answer}
                                        </span>
                                      </div>
                                    )
                                  )}
                                </div>
                              </>
                            )}
                        </div>
                      )}

                      {/* Matching Pairs */}
                      {question?.type === "matching" && (
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-500 mb-2">
                            Candidate's Matching Pairs:
                          </div>
                          <div className="space-y-2 mb-4">
                            {question.options?.map(
                              (option: Option, idx: number) => {
                                // Find the matching pair for this option

                                const submittedPair =
                                  submission.selectedOptions[idx];

                                if (!submittedPair) {
                                  return (
                                    <div
                                      key={`match-${idx}`}
                                      className="p-3 rounded-md flex items-center justify-between bg-red-50 border border-red-200"
                                    >
                                      <div>
                                        <span className="font-medium">
                                          {option.option}
                                        </span>
                                        <span className="mx-2">→</span>
                                        <span>Not matched</span>
                                      </div>
                                      <div>
                                        <XCircle className="h-5 w-5 text-red-600" />
                                      </div>
                                    </div>
                                  );
                                }

                                // Check if this is the correct match
                                const isCorrectMatch =
                                  option.matchingPairText === submittedPair;

                                return (
                                  <div
                                    key={`match-${idx}`}
                                    className={`p-3 rounded-md flex items-center justify-between ${
                                      isCorrectMatch
                                        ? "bg-green-50 border border-green-200"
                                        : "bg-red-50 border border-red-200"
                                    }`}
                                  >
                                    <div>
                                      <span className="font-medium">
                                        {option.option}
                                      </span>
                                      <span className="mx-2">→</span>
                                      <span>
                                        {submittedPair
                                          ? submittedPair
                                          : "Not matched"}
                                      </span>
                                    </div>
                                    <div>
                                      {isCorrectMatch ? (
                                        <CheckCircle className="h-5 w-5 text-green-600" />
                                      ) : (
                                        <XCircle className="h-5 w-5 text-red-600" />
                                      )}
                                    </div>
                                  </div>
                                );
                              }
                            )}
                          </div>

                          <div className="text-sm font-medium text-gray-500 mb-2">
                            Correct Pairs:
                          </div>
                          <div className="space-y-2">
                            {question.options?.map(
                              (option: Option, idx: number) => (
                                <div
                                  key={`correct-match-${idx}`}
                                  className="p-3 bg-blue-50 border border-blue-200 rounded-md"
                                >
                                  <span className="font-medium">
                                    {option.option}
                                  </span>
                                  <span className="mx-2">→</span>
                                  <span>{option.matchingPairText}</span>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}

                      {/* Visual/Output/Peer-review */}
                      {(question?.type === "visual" ||
                        question?.type === "output" ||
                        question?.type === "peer-review") && (
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-500 mb-2">
                            Candidate's Response:
                          </div>
                          <div className="p-3 bg-gray-50 border border-gray-200 rounded-md mb-3">
                            {submission.selectedOptions.length > 0
                              ? submission.selectedOptions.join("\n")
                              : "No response provided"}
                          </div>

                          {question.correct && (
                            <>
                              <div className="text-sm font-medium text-gray-500 mb-2">
                                Expected Response:
                              </div>
                              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                                {question.correct}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </div>
      ))}

      {/* If no submissions */}
      {(!mcqSubmissions || mcqSubmissions.length === 0) && (
        <div className="bg-white rounded-lg shadow-md p-6 text-center text-gray-500">
          No question submissions found
        </div>
      )}
    </div>
  );
};

export default AssessmentResults;
