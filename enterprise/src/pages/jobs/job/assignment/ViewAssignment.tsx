import { Assignment } from "@shared-types/Posting";
import { AppliedPosting } from "@shared-types/AppliedPosting";
import { useEffect, useState, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import DataTable from "./DataTable";
import {
  ClipboardCheck,
  Calendar,
  FileText,
  Users,
  Clock,
  CheckSquare,
  XSquare,
  BarChart2,
} from "lucide-react";
import { ExtendedPosting } from "@shared-types/ExtendedPosting";
import AssignmentSubmissionVanilla from "@shared-types/AssignmentSubmission";
import { toast } from "sonner";
import { useAuth } from "@/auth";
import ax from "@/config/axios";

type AssignmentSubmission = AssignmentSubmissionVanilla & {
  grade?: number;
  candidate: {
    _id: string;
    userId: string;
    name: string;
    email: string;
    status: string;
  };
};

const ViewAssignment = () => {
  const { posting } = useOutletContext() as { posting: ExtendedPosting };
  const [assignment, setAssignment] = useState<Assignment>({} as Assignment);
  const [submissions, setSubmissions] = useState<AssignmentSubmission[]>([]);
  const [activeTab, setActiveTab] = useState("overview");

  const { getToken } = useAuth();
  const axios = ax(getToken);

  useEffect(() => {
    if (posting) {
      const assignmentId = window.location.pathname.split("/").pop();
      const assignment = posting?.assignments?.find(
        (a) => a._id === assignmentId
      );

      if (assignment) {
        const submissionsWithGrades: AssignmentSubmission[] = [];

        assignment?.submissions?.forEach((submissionId) => {
          const submission = submissionId as unknown as AssignmentSubmission;

          const appliedPosting = posting.candidates?.find(
            (ap) => (ap as unknown as AppliedPosting).posting === posting._id
          );

          if (appliedPosting) {
            const currentAssignmentScore = (
              appliedPosting as unknown as AppliedPosting
            ).scores?.find((score) => score.stageId === assignment._id);

            if (currentAssignmentScore) {
              submission.grade = currentAssignmentScore.score;
            }
          }

          const candidate = posting.candidates?.find(
            (c) => c.userId.toString() === submission.candidateId
          );

          const status = candidate?.appliedPostings?.find(
            (ap) => ap.posting === posting._id
          )?.status;
          console.log(candidate?.appliedPostings);
          console.log(posting._id);
          console.log(status);

          submission.candidate = {
            _id: submission.candidateId,
            userId: candidate?._id || "Unknown",
            name: candidate?.name || "Unknown",
            email: candidate?.email || "Unknown",
            status: status || "Unknown",
          };

          submissionsWithGrades.push(submission);
        });

        setAssignment(assignment);
        setSubmissions(submissionsWithGrades);
      }
    }
  }, [posting]);

  // Analytics calculations
  const analytics = useMemo(() => {
    if (!submissions || submissions.length === 0) {
      return {
        totalSubmissions: 0,
        graded: 0,
        ungraded: 0,
        averageGrade: 0,
        submissionRate: 0,
        highestGrade: 0,
        lowestGrade: 0,
        gradedDistribution: {
          excellent: 0, // 90-100
          good: 0, // 80-89
          average: 0, // 70-79
          belowAverage: 0, // 60-69
          poor: 0, // Below 60
        },
      };
    }

    const totalCandidates = posting.candidates?.length || 0;
    const totalSubmissions = submissions.length;

    console.log(totalCandidates, totalSubmissions);
    const gradedSubmissions = submissions.filter((s) => s.grade !== undefined);

    const grades = gradedSubmissions.map((s) => s.grade as number);
    const averageGrade = grades.length
      ? grades.reduce((a, b) => a + b, 0) / grades.length
      : 0;

    // Distribution calculation
    const gradedDistribution = {
      excellent: 0,
      good: 0,
      average: 0,
      belowAverage: 0,
      poor: 0,
    };

    grades.forEach((grade) => {
      if (grade >= 90) gradedDistribution.excellent++;
      else if (grade >= 80) gradedDistribution.good++;
      else if (grade >= 70) gradedDistribution.average++;
      else if (grade >= 60) gradedDistribution.belowAverage++;
      else gradedDistribution.poor++;
    });

    return {
      totalSubmissions,
      graded: gradedSubmissions.length,
      ungraded: totalSubmissions - gradedSubmissions.length,
      averageGrade: parseFloat(averageGrade.toFixed(1)),
      submissionRate: totalCandidates
        ? parseFloat(((totalSubmissions / totalCandidates) * 100).toFixed(1))
        : 0,
      highestGrade: grades.length ? Math.max(...grades) : 0,
      lowestGrade: grades.length ? Math.min(...grades) : 0,
      gradedDistribution,
    };
  }, [submissions, posting.candidates]);

  const submitGrade = (submission: AssignmentSubmission, grade: number) => {
    axios
      .post(`postings/${posting._id}/assignment/${assignment._id}/grade`, {
        cid: submission.candidateId,
        grade,
      })
      .then(() => {
        toast.success("Grade submitted successfully");
      })
      .catch(() => {
        toast.error("Failed to submit grade");
      });
  };

  const viewSubmission = (submission: AssignmentSubmission) => {
    if (assignment.submissionType === "file") {
      axios
        .get(
          `postings/${posting._id}/assignment/${assignment._id}/submission/${submission.candidateId}`
        )
        .then((res) => {
          window.open(res.data.data.url, "_blank");
        })
        .catch(() => {
          toast.error("Failed to view submission");
        });
    }

    if (assignment.submissionType === "link") {
      window.open(submission.linkSubmission, "_blank");
    }

    if (assignment.submissionType === "text") {
      window.open(submission.textSubmission, "_blank");
    }
  };

  return (
    <div className="mx-auto p-10 bg-gray-50 min-h-screen">
      <div className="flex items-center mb-6">
        <ClipboardCheck className="mr-3 text-indigo-600" size={28} />
        <h1 className="text-2xl font-bold text-gray-800">Assignment Details</h1>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-2">
          {assignment.name}
        </h2>
        <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-3">
          <div className="flex items-center">
            <Calendar size={16} className="mr-1" />
            <span>
              Due: {assignment._id ? new Date().toLocaleDateString() : "N/A"}
            </span>
          </div>
          <div className="flex items-center">
            <FileText size={16} className="mr-1" />
            <span>Type: {assignment.submissionType || "Unknown"}</span>
          </div>
          <div className="flex items-center">
            <Users size={16} className="mr-1" />
            <span>Candidates: {posting.candidates?.length || 0}</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex" aria-label="Tabs">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-6 py-4 text-sm font-medium ${
                activeTab === "overview"
                  ? "border-b-2 border-indigo-500 text-indigo-600"
                  : "text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Overview & Analytics
            </button>
            <button
              onClick={() => setActiveTab("submissions")}
              className={`px-6 py-4 text-sm font-medium ${
                activeTab === "submissions"
                  ? "border-b-2 border-indigo-500 text-indigo-600"
                  : "text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Submissions
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === "overview" ? (
            <div>
              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-800 mb-4">
                  Description
                </h3>
                <div className="prose max-w-none text-gray-600">
                  {assignment.description}
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-lg font-medium text-gray-800 mb-4 flex items-center">
                  <BarChart2 size={20} className="mr-2 text-indigo-500" />
                  Analytics
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <div className="bg-indigo-50 rounded-lg p-4">
                    <p className="text-sm text-indigo-700 font-medium">
                      Submission Rate
                    </p>
                    <p className="text-2xl font-bold text-indigo-900">
                      {analytics.submissionRate}%
                    </p>
                    <p className="text-xs text-indigo-700 mt-1">
                      {analytics.totalSubmissions} of{" "}
                      {posting.candidates?.length || 0} candidates
                    </p>
                  </div>

                  <div className="bg-green-50 rounded-lg p-4">
                    <p className="text-sm text-green-700 font-medium">
                      Average Grade
                    </p>
                    <p className="text-2xl font-bold text-green-900">
                      {analytics.averageGrade}
                    </p>
                    <p className="text-xs text-green-700 mt-1">
                      Range: {analytics.lowestGrade} - {analytics.highestGrade}
                    </p>
                  </div>

                  <div className="bg-blue-50 rounded-lg p-4">
                    <p className="text-sm text-blue-700 font-medium">Graded</p>
                    <p className="text-2xl font-bold text-blue-900">
                      {analytics.graded}
                    </p>
                    <p className="text-xs text-blue-700 mt-1">
                      {analytics.graded} of {analytics.totalSubmissions}{" "}
                      submissions
                    </p>
                  </div>

                  <div className="bg-amber-50 rounded-lg p-4">
                    <p className="text-sm text-amber-700 font-medium">
                      Pending Grades
                    </p>
                    <p className="text-2xl font-bold text-amber-900">
                      {analytics.ungraded}
                    </p>
                    <p className="text-xs text-amber-700 mt-1">
                      {(
                        (analytics.ungraded /
                          (analytics.totalSubmissions || 1)) *
                        100
                      ).toFixed(1)}
                      % of submissions
                    </p>
                  </div>
                </div>

                {analytics.totalSubmissions > 0 && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="border border-gray-200 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">
                        Grade Distribution
                      </h4>
                      <div className="space-y-2">
                        <div>
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>Excellent (90-100)</span>
                            <span>
                              {analytics.gradedDistribution.excellent}{" "}
                              submissions
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-green-500 h-2 rounded-full"
                              style={{
                                width: `${
                                  analytics.graded
                                    ? (analytics.gradedDistribution.excellent /
                                        analytics.graded) *
                                      100
                                    : 0
                                }%`,
                              }}
                            ></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>Good (80-89)</span>
                            <span>
                              {analytics.gradedDistribution.good} submissions
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-500 h-2 rounded-full"
                              style={{
                                width: `${
                                  analytics.graded
                                    ? (analytics.gradedDistribution.good /
                                        analytics.graded) *
                                      100
                                    : 0
                                }%`,
                              }}
                            ></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>Average (70-79)</span>
                            <span>
                              {analytics.gradedDistribution.average} submissions
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-yellow-500 h-2 rounded-full"
                              style={{
                                width: `${
                                  analytics.graded
                                    ? (analytics.gradedDistribution.average /
                                        analytics.graded) *
                                      100
                                    : 0
                                }%`,
                              }}
                            ></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>Below Average (60-69)</span>
                            <span>
                              {analytics.gradedDistribution.belowAverage}{" "}
                              submissions
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-orange-500 h-2 rounded-full"
                              style={{
                                width: `${
                                  analytics.graded
                                    ? (analytics.gradedDistribution
                                        .belowAverage /
                                        analytics.graded) *
                                      100
                                    : 0
                                }%`,
                              }}
                            ></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>Poor (below 60)</span>
                            <span>
                              {analytics.gradedDistribution.poor} submissions
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-red-500 h-2 rounded-full"
                              style={{
                                width: `${
                                  analytics.graded
                                    ? (analytics.gradedDistribution.poor /
                                        analytics.graded) *
                                      100
                                    : 0
                                }%`,
                              }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="border border-gray-200 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">
                        Submission Status
                      </h4>
                      <div className="relative pt-1">
                        <div className="flex mb-2 items-center justify-between">
                          <div>
                            <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-blue-600 bg-blue-200">
                              Progress
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs font-semibold inline-block text-blue-600">
                              {analytics.submissionRate}%
                            </span>
                          </div>
                        </div>
                        <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-gray-200">
                          <div
                            style={{ width: `${analytics.submissionRate}%` }}
                            className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500"
                          ></div>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-4">
                        <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                          <CheckSquare
                            className="text-green-500 mr-3"
                            size={20}
                          />
                          <div>
                            <p className="text-xs text-gray-500">Submitted</p>
                            <p className="text-lg font-semibold">
                              {analytics.totalSubmissions}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                          <XSquare className="text-red-500 mr-3" size={20} />
                          <div>
                            <p className="text-xs text-gray-500">
                              Not Submitted
                            </p>
                            <p className="text-lg font-semibold">
                              {(posting.candidates?.length || 0) -
                                analytics.totalSubmissions}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                          <Clock className="text-amber-500 mr-3" size={20} />
                          <div>
                            <p className="text-xs text-gray-500">
                              Avg. Submission Time
                            </p>
                            <p className="text-lg font-semibold">2.3 days</p>
                          </div>
                        </div>

                        <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                          <FileText
                            className="text-indigo-500 mr-3"
                            size={20}
                          />
                          <div>
                            <p className="text-xs text-gray-500">Type</p>
                            <p className="text-lg font-semibold capitalize">
                              {assignment.submissionType || "N/A"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <DataTable
              data={submissions}
              postingId={posting._id!}
              assignmentId={assignment._id!}
              onGradeSubmission={submitGrade}
              onViewSubmission={viewSubmission}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ViewAssignment;
