import { Tabs, Tab } from "@heroui/tabs";
import Analytics from "./Analytics";
import McqAssessmentResultsTable from "./MCQResultsTable";
import { useAuth } from "@/auth";
import ax from "@/config/axios";
import { useEffect, useState } from "react";
import { MCQAssessment } from "@shared-types/MCQAssessment";
import { MCQAssessmentSubmission } from "@shared-types/MCQAssessmentSubmission";
import { toast } from "sonner";
import Loader from "@/components/Loader";

const McqAssessmentResults = () => {
  const [loading, setLoading] = useState(true);
  const [assessment, setAssessment] = useState<MCQAssessment | null>(null);
  const [submissions, setSubmissions] = useState<MCQAssessmentSubmission[]>([]);

  const { getToken } = useAuth();
  const axios = ax(getToken);

  const fetchAssessmentData = () => {
    const id = window.location.pathname.split("/")[5];
    axios
      .get(`/assessments/${id}/get-mcq-submissions`)
      .then((res) => {
        setAssessment(res.data.data.assessment);
        setSubmissions(res.data.data.submissions);
      })
      .catch((err) => {
        toast.error(err?.response?.data?.message || "Failed to fetch data");
        console.error(err);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchAssessmentData();
  }, []);

  if (loading) return <Loader />;

  if (!assessment) return <div>No assessment found</div>;

  return (
    <div className="min-h-screen p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{assessment.name}</h1>
        <div className="text-sm text-gray-600 mt-2">
          Assessment Details: {assessment.description}
        </div>
      </div>

      <Tabs aria-label="Assessment data tabs" className="mb-6">
        <Tab key="results" title="Results">
          <McqAssessmentResultsTable
            assessment={assessment}
            submissions={submissions}
          />
        </Tab>

        <Tab key="analytics" title="Analytics">
          <Analytics assessment={assessment} submissions={submissions} />
        </Tab>
      </Tabs>
    </div>
  );
};

export default McqAssessmentResults;
