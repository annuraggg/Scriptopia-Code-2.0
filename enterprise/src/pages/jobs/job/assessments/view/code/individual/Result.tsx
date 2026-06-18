import React, { useState } from "react";
import { ExtendedCodeAssessmentSubmission } from "@shared-types/ExtendedCodeAssessmentSubmission";
import { User, Mail, CheckCircle, XCircle } from "lucide-react";
import { useAuth } from "@/auth";
import ax from "@/config/axios";
import { toast } from "sonner";
import { NumberInput } from "@heroui/number-input";

interface CodeAssessmentResultsProps {
  submission: ExtendedCodeAssessmentSubmission;
}

const CodeAssessmentResults: React.FC<CodeAssessmentResultsProps> = ({
  submission,
}) => {
  const {
    name,
    email,
    submissions = [],
    obtainedGrades,
    assessmentId,
    offenses,
    timer,
  } = submission;

  const { getToken } = useAuth();
  const axios = ax(getToken);

  // Local state for grades that can be edited
  const [grades, setGrades] = useState<Record<string, number>>(
    obtainedGrades?.problem?.reduce((acc, grade) => {
      acc[grade.problemId] = grade.obtainedMarks;
      return acc;
    }, {} as Record<string, number>) || {}
  );

  // Calculate total score and performance
  const totalScore = obtainedGrades?.total || 0;
  const maxPossibleScore = assessmentId.obtainableScore;
  const scorePercentage =
    maxPossibleScore > 0
      ? Math.round((totalScore / maxPossibleScore) * 100)
      : 0;

  const isPassed = scorePercentage >= assessmentId.passingPercentage;

  // Handle local state update without sending to server
  const handleGradeChange = (problemId: string, newGrade: number) => {
    setGrades((prev) => ({
      ...prev,
      [problemId]: newGrade,
    }));
  };

  // Send grade update to server only when input loses focus
  const handleGradeBlur = (problemId: string) => {
    const newGrade = grades[problemId] || 0;
    const submissionId = submission._id;

    axios
      .post(`assessments/code/grade`, {
        submissionId,
        problemId,
        grade: newGrade,
      })
      .then((res) => {
        console.log(res.data);
        toast.success("Grade updated successfully");
      })
      .catch((err) => {
        console.log(err);
        toast.error("Failed to grade submission");
      });
  };

  // Analyze problem submissions
  const analyzeProblemSubmissions = () => {
    return (
      submissions?.map((submission) => {
        const problem = assessmentId.problems.find(
          (p) => p._id === submission.problemId._id
        );

        const passedTestCases =
          submission.results?.filter((result) => result.passed).length || 0;
        const totalTestCases = submission.results?.length || 0;
        const testCasePercentage =
          totalTestCases > 0
            ? Math.round((passedTestCases / totalTestCases) * 100)
            : 0;

        // Calculate points based on grading type
        let earnedPoints = 0;
        let problemPoints = 0;

        if (assessmentId.grading?.type === "problem") {
          // For "problem" type: all or nothing points
          problemPoints =
            assessmentId.grading?.problem?.find(
              (p) => p.problemId === submission.problemId._id
            )?.points || 0;

          // Only award points if all test cases passed
          earnedPoints =
            passedTestCases === totalTestCases && totalTestCases > 0
              ? problemPoints
              : 0;
        } else if (assessmentId.grading?.type === "testcase") {
          // For "testcase" type: points are proportional to passed test cases

          // Maps each result to its corresponding test case to get the difficulty
          const resultsWithDifficulty =
            submission.results?.map((result) => {
              // Find the matching test case in the problem based on caseId
              const testCase = problem?.testCases.find(
                (tc) => tc._id === result.caseId
              );
              return {
                ...result,
                difficulty: testCase?.difficulty || "medium", // Default to medium if not found
              };
            }) || [];

          // Count test cases by difficulty
          const easyPassed = resultsWithDifficulty.filter(
            (result) => result.difficulty === "easy" && result.passed
          ).length;

          const mediumPassed = resultsWithDifficulty.filter(
            (result) => result.difficulty === "medium" && result.passed
          ).length;

          const hardPassed = resultsWithDifficulty.filter(
            (result) => result.difficulty === "hard" && result.passed
          ).length;

          const easyTotal = resultsWithDifficulty.filter(
            (r) => r.difficulty === "easy"
          ).length;

          const mediumTotal = resultsWithDifficulty.filter(
            (r) => r.difficulty === "medium"
          ).length;

          const hardTotal = resultsWithDifficulty.filter(
            (r) => r.difficulty === "hard"
          ).length;

          // Calculate points based on testcase configuration
          const easyPoints = assessmentId.grading?.testcases?.easy || 0;
          const mediumPoints = assessmentId.grading?.testcases?.medium || 0;
          const hardPoints = assessmentId.grading?.testcases?.hard || 0;

          // Calculate earned points for each difficulty level
          const earnedEasyPoints =
            easyTotal > 0
              ? (easyPassed / easyTotal) * easyPoints * easyTotal
              : 0;

          const earnedMediumPoints =
            mediumTotal > 0
              ? (mediumPassed / mediumTotal) * mediumPoints * mediumTotal
              : 0;

          const earnedHardPoints =
            hardTotal > 0
              ? (hardPassed / hardTotal) * hardPoints * hardTotal
              : 0;

          earnedPoints =
            earnedEasyPoints + earnedMediumPoints + earnedHardPoints;

          problemPoints =
            easyPoints * easyTotal +
            mediumPoints * mediumTotal +
            hardPoints * hardTotal;
        }

        return {
          ...submission,
          problem,
          problemPoints,
          earnedPoints,
          passedTestCases,
          totalTestCases,
          testCasePercentage,
        };
      }) || []
    );
  };

  const getClockTime = (time: number, subtractFactor?: number): string => {
    if (subtractFactor) {
      const newTime = subtractFactor - time;
      const newMinutes = Math.floor(newTime / 60);
      const newSeconds = newTime % 60;
      return `${newMinutes}m ${newSeconds}s`;
    }

    const minutes = Math.floor(time / 60);
    const seconds = time % 60;

    return `${minutes}m ${seconds}s`;
  };

  interface Offense {
    _id?: string;
    tabChange?: { problemId: string; times: number }[];
    copyPaste?: { problemId: string; times: number }[];
  }

  const getCheatingStatus = (offenses: Offense | null | undefined) => {
    // If no offenses object is provided, return "No Copying"
    if (!offenses) {
      return "No Copying";
    }

    // Calculate total tab changes and copy-paste actions across all problems
    const totalTabChanges =
      offenses.tabChange?.reduce((sum, change) => sum + change.times, 0) || 0;
    const totalCopyPastes =
      offenses.copyPaste?.reduce((sum, paste) => sum + paste.times, 0) || 0;

    // Check for heavy copying conditions
    if (totalTabChanges > 5 || totalCopyPastes > 3) {
      return "Heavy Copying";
    }

    // Check for light copying conditions
    if (totalTabChanges > 2 || totalCopyPastes > 1) {
      return "Light Copying";
    }

    // If no significant offenses are detected
    return "No Copying";
  };
  const problemSubmissions = analyzeProblemSubmissions();

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

        {/* Assessment Summary */}
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
              <div className="font-medium text-gray-500">Time Used</div>
              <div className="text-3xl font-bold mt-1">
                {getClockTime(timer, assessmentId.timeLimit * 60)}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                Total Assessment Time
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
              <div className="font-medium text-gray-500">Cheating Status</div>
              <div
                className={`text-2xl font-bold mt-1 ${
                  getCheatingStatus(offenses) === "No Copying"
                    ? "text-green-600"
                    : getCheatingStatus(offenses) === "Light Copying"
                    ? "text-yellow-600"
                    : "text-red-600"
                }`}
              >
                {getCheatingStatus(offenses)}
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

      {/* Offenses */}
      {offenses && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
          <div className="p-6 border-b border-gray-200 bg-gray-50">
            <h2 className="text-xl font-bold text-gray-900">
              Assessment Offenses
            </h2>
          </div>
          <div className="p-6">
            {offenses.tabChange && offenses.tabChange.length > 0 && (
              <div className="mb-4">
                <h3 className="font-medium text-gray-700 mb-2">Tab Changes</h3>
                {offenses.tabChange.map((tabChange, index) => (
                  <div
                    key={`tab-change-${index}`}
                    className="bg-yellow-50 border border-yellow-200 p-3 rounded-md mb-2"
                  >
                    Problem{" "}
                    {
                      submissions.find(
                        (s) => s.problemId._id === tabChange.problemId
                      )?.problemId.title
                    }
                    : {tabChange.times} tab changes
                  </div>
                ))}
              </div>
            )}

            {offenses.copyPaste && offenses.copyPaste.length > 0 && (
              <div>
                <h3 className="font-medium text-gray-700 mb-2">
                  Copy-Paste Incidents
                </h3>
                {offenses.copyPaste.map((copyPaste, index) => (
                  <div
                    key={`copy-paste-${index}`}
                    className="bg-red-50 border border-red-200 p-3 rounded-md mb-2"
                  >
                    Problem{" "}
                    {
                      submissions.find(
                        (s) => s.problemId._id === copyPaste.problemId
                      )?.problemId.title
                    }
                    : {copyPaste.times} copy-paste incidents
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Problem Submissions */}
      {problemSubmissions.map((submission, index) => (
        <div
          key={`problem-${submission.problemId}`}
          className="bg-white rounded-lg shadow-md overflow-hidden mb-6"
        >
          <div className="p-6 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-900">
              Problem {index + 1}
            </h2>
            <div className="flex items-center gap-3">
              <div className="font-medium text-gray-600">
                Language: {submission.language}
              </div>
              <div className="font-medium text-gray-600">
                Points: {submission.problemPoints}
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-500">
                  Test Cases:
                </span>
                <div
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    submission.testCasePercentage >= 75
                      ? "bg-green-100 text-green-800"
                      : submission.testCasePercentage >= 50
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {submission.passedTestCases} / {submission.totalTestCases}(
                  {submission.testCasePercentage}%)
                </div>
              </div>

              <div className="flex items-center gap-2">
                <NumberInput
                  className="w-32"
                  value={grades[submission.problemId._id!] || 0}
                  minValue={0}
                  maxValue={submission.problemPoints}
                  onValueChange={(e) => {
                    const newGrade = parseFloat(e.toString());
                    handleGradeChange(submission.problemId._id!, newGrade);
                  }}
                  onBlur={() => handleGradeBlur(submission.problemId._id!)}
                  size="sm"
                />
                <span className="text-gray-600">
                  / {submission.problemPoints}
                </span>
              </div>
            </div>

            {/* Code Display */}
            <div className="bg-gray-800 text-white p-4 rounded-md mb-4 font-mono text-sm overflow-x-auto">
              <pre>{submission.code}</pre>
            </div>

            {/* Test Case Results */}
            <div className="mt-4">
              <h3 className="text-md font-semibold text-gray-700 mb-2">
                Test Case Results
              </h3>
              {submission.results?.map((result, resultIndex) => (
                <div
                  key={`result-${resultIndex}`}
                  className={`p-3 rounded-md mb-2 ${
                    result.passed
                      ? "bg-green-50 border border-green-200"
                      : "bg-red-50 border border-red-200"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-medium mr-2">
                        Test Case {result.caseNo}
                      </span>
                      {result.isSample && (
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                          Sample
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {result.passed ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600" />
                      )}
                      <span className="text-sm text-gray-600">
                        {result.passed ? "Passed" : "Failed"}
                      </span>
                    </div>
                  </div>

                  {/* Additional Test Case Details */}
                  <div className="mt-2 text-sm text-gray-600">
                    <div>Memory: {result.memory.toFixed(2)} KB</div>
                    <div>Time: {result.time.toFixed(2)} ms</div>
                    {result.output && (
                      <div className="mt-2">
                        <span className="font-medium">Output:</span>
                        <pre className="bg-gray-100 p-2 rounded-md mt-1 overflow-x-auto">
                          {result.output}
                        </pre>
                      </div>
                    )}
                    {result.errorMessage && (
                      <div className="mt-2">
                        <span className="font-medium text-red-600">Error:</span>
                        <pre className="bg-red-50 p-2 rounded-md mt-1 text-red-800 overflow-x-auto">
                          {result.errorMessage}
                        </pre>
                      </div>
                    )}
                    {result.console && (
                      <div className="mt-2">
                        <span className="font-medium">Console:</span>
                        <pre className="bg-gray-100 p-2 rounded-md mt-1 overflow-x-auto">
                          {result.console}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}

      {/* If no submissions */}
      {(!submissions || submissions.length === 0) && (
        <div className="bg-white rounded-lg shadow-md p-6 text-center text-gray-500">
          No problem submissions found
        </div>
      )}
    </div>
  );
};

export default CodeAssessmentResults;
