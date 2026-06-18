import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "@/auth";
import { toast } from "sonner";
import {
  Phone,
  Mail,
  FileText,
  Calendar,
  Users,
  ChevronRight,
  ArrowUpRight,
  MoreHorizontal,
  Download,
  Search,
} from "lucide-react";
import ax from "@/config/axios";
import Loader from "@/components/Loader";
import { PostingContext } from "@/types/PostingContext";
import { ExtendedAppliedPosting } from "@shared-types/ExtendedAppliedPosting";

const Pipeline = () => {
  const [appliedPostings, setAppliedPostings] = useState<ExtendedAppliedPosting[]>(
    []
  );
  const { posting } = useOutletContext<PostingContext>();
  const [loading, setLoading] = useState(true);
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(
    null
  );
  const [searchTerm, setSearchTerm] = useState("");

  const { getToken } = useAuth();
  const axios = ax(getToken);

  useEffect(() => {
    const postingId = window.location.pathname.split("/")[2];

    axios
      .get(`/postings/${postingId}/applied`)
      .then((res) => {
        setAppliedPostings(res.data.data);
      })
      .catch((err) => {
        toast.error(
          err.response?.data?.message || "Error fetching applied postings"
        );
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  };

  const downloadCSV = () => {
    if (!posting?.workflow?.steps?.length) return;

    const headers = posting.workflow.steps.map((step) => {
      const status = step.status === "in-progress" ? "inprogress" : step.status;
      return `${step.name} (${status})`;
    });

    const csvRows = [headers.join(",")];
    const candidatesByStep: Record<number, string[]> = {};

    posting.workflow.steps.forEach((_, index) => {
      candidatesByStep[index] = [];
    });

    appliedPostings.forEach((applied) => {
      let stepIndex;
      if (applied.status === "inprogress") {
        stepIndex =
          posting.workflow?.steps?.findIndex(
            (step) => step.status === "in-progress"
          ) ?? -1;
      } else if (applied.status === "applied") {
        stepIndex = 0;
      } else {
        stepIndex = applied.disqualifiedStage;
      }

      if (
        posting.workflow &&
        typeof stepIndex === "number" &&
        stepIndex >= 0 &&
        stepIndex < posting.workflow.steps.length
      ) {
        candidatesByStep[stepIndex].push(applied.user.name);
      }
    });

    const maxCandidates = Math.max(
      ...Object.values(candidatesByStep).map((candidates) => candidates.length)
    );

    for (let i = 0; i < maxCandidates; i++) {
      const rowData = [];

      for (let j = 0; j < posting.workflow.steps.length; j++) {
        const candidatesInStep = candidatesByStep[j];
        rowData.push(
          i < candidatesInStep.length
            ? `"${candidatesInStep[i].replace(/"/g, '""')}"`
            : ""
        );
      }

      csvRows.push(rowData.join(","));
    }

    const csvString = csvRows.join("\n");
    const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `${posting?.title || "recruitment-posting"}-pipeline.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredAppliedPostings = appliedPostings.filter(
    (applied) =>
      applied.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      applied.user.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const CandidateCard = ({ applied }: { applied: ExtendedAppliedPosting }) => {
    const isSelected = selectedCandidate === applied._id;
    const candidateInitials = applied.user.name
      .split(" ")
      .map((name) => name[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();

    return (
      <div
        key={applied._id}
        className={`p-4 mb-4 border rounded-lg shadow-sm transition-all ${
          isSelected
            ? "bg-indigo-50 border-indigo-300"
            : "bg-white border-gray-200 hover:border-indigo-200 hover:shadow"
        }`}
        onClick={() =>
          setSelectedCandidate(isSelected ? null : applied._id || null)
        }
      >
        <div className="flex items-start gap-5 justify-between ">
          <div className="flex items-center justify-start gap-4">
            <div className="max-w-12 max-h-12 min-h-12 min-w-12 rounded-full bg-indigo-600 flex items-center justify-center text-white font-medium text-sm">
              {candidateInitials}
            </div>
            <div>
              <h5 className="font-semibold text-gray-900 text-base">
                {applied.user.name}
              </h5>
              <div className="flex items-center text-xs text-gray-500 mt-1">
                <Calendar className="w-3 h-3 mr-1.5" />
                <span>
                  Applied{" "}
                  {formatDate(
                    typeof applied.createdAt === "string"
                      ? applied.createdAt ?? ""
                      : applied.createdAt?.toISOString() ?? ""
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!isSelected && (
              <div
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  applied.status === "inprogress"
                    ? "bg-indigo-100 text-indigo-700"
                    : applied.status === "applied"
                    ? "bg-purple-100 text-purple-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {applied.status === "inprogress"
                  ? "In Progress"
                  : applied.status === "applied"
                  ? "Applied"
                  : "Disqualified"}
              </div>
            )}
          </div>
        </div>

        {isSelected && (
          <div className="mt-5 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-2 gap-5 mb-5">
              <div className="flex items-center text-sm text-gray-600">
                <Mail className="w-4 h-4 mr-3 text-indigo-500" />
                <span className="truncate">{applied.user.email}</span>
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <Phone className="w-4 h-4 mr-3 text-indigo-500" />
                <span>{applied.user.phone || "Not provided"}</span>
              </div>
              <div className="flex items-center text-sm text-gray-600">
                <Users className="w-4 h-4 mr-3 text-indigo-500" />
                <span>{applied.user.gender || "Not specified"}</span>
              </div>
              {applied.user.resumeUrl && (
                <div className="flex items-center text-sm text-indigo-600">
                  <FileText className="w-4 h-4 mr-3" />
                  <a
                    href={applied.user.resumeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate hover:underline"
                  >
                    View Resume
                  </a>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 mt-4">
              <button className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors flex items-center">
                <MoreHorizontal className="w-4 h-4 mr-2" />
                Options
              </button>
              <button className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors flex items-center">
                View Profile
                <ChevronRight className="w-4 h-4 ml-2" />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) return <Loader />;

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Candidate Pipeline
            </h1>
            <p className="text-gray-500 mt-1">
              {posting?.title || "Recruitment Posting"} · {appliedPostings.length}{" "}
              candidate{appliedPostings.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={downloadCSV}
              className="px-4 py-2 border border-gray-300 rounded-md bg-white hover:bg-gray-50 text-gray-700 flex items-center transition-colors shadow-sm"
            >
              <Download className="w-4 h-4 mr-2" />
              Download CSV
            </button>
            <button className="px-4 py-2 bg-indigo-600 rounded-md text-white hover:bg-indigo-700 flex items-center transition-colors shadow-sm">
              <ArrowUpRight className="w-4 h-4 mr-2" />
              View Posting Details
            </button>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <div className="relative max-w-lg">
          <Search className="w-5 h-5 absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search candidates..."
            className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300 shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {posting?.workflow?.steps?.map((step, index) => {
          const stageApplicants = filteredAppliedPostings.filter((applied) => {
            return step.status === "in-progress"
              ? applied.status === "inprogress" ||
                  applied.disqualifiedStage?.toString() ===
                    step._id?.toString() ||
                  (index === 0 && applied.status === "applied")
              : applied.disqualifiedStage?.toString() === step._id?.toString();
          });

          return (
            <div
              key={index}
              className="bg-white rounded-lg shadow-md overflow-hidden flex flex-col h-auto border border-gray-200"
            >
              <div
                className="h-2"
                style={{ backgroundColor: getStepColor(index) }}
              ></div>
              <div className="p-5 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-gray-900 text-lg">
                      {step.name}
                    </h3>
                    <div className="flex items-center">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-white font-medium"
                        style={{ backgroundColor: getStepColor(index) }}
                      >
                        {stageApplicants.length}
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {step.status === "in-progress"
                      ? "In Progress"
                      : step.status}
                  </p>
                </div>
              </div>

              <div
                className="overflow-y-auto p-4 flex-1"
                style={{ maxHeight: "500px" }}
              >
                {stageApplicants.length > 0 ? (
                  stageApplicants.map((applied) => (
                    <CandidateCard key={applied._id} applied={applied} />
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-center p-6 text-gray-400">
                    <Users className="w-10 h-10 mb-3 opacity-50" />
                    <p className="text-sm">No candidates in this stage</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const getStepColor = (index: number) => {
  const colors = [
    "#4f46e5", // Indigo
    "#7c3aed", // Purple
    "#ec4899", // Pink
    "#f59e0b", // Amber
  ];
  return colors[index % colors.length];
};

export default Pipeline;
