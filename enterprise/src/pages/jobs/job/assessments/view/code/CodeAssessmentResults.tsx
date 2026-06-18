import React, { useEffect, useState } from "react";
import { Tabs, Tab } from "@heroui/tabs";
import { CodeAssessment } from "@shared-types/CodeAssessment";
import { CodeAssessmentSubmission } from "@shared-types/CodeAssessmentSubmission";
import { useAuth } from "@/auth";
import ax from "@/config/axios";
import { toast } from "sonner";
import Loader from "@/components/Loader";
import Analytics from "./Analytics";
import Results from "./Results";

const AnalyticsDashboard: React.FC = () => {
  const [assessment, setAssessment] = useState<CodeAssessment | null>(null);
  const [submissions, setSubmissions] = useState<CodeAssessmentSubmission[]>(
    []
  );
  const [loading, setLoading] = useState(true);

  const { getToken } = useAuth();
  const axios = ax(getToken);

  useEffect(() => {
    const id = window.location.pathname.split("/")[5];
    axios
      .get(`/assessments/${id}/get-code-submissions`)
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
  }, []);

  if (loading) return <Loader />;

  return (
    <div className="container mx-auto px-4 py-8">
      <Tabs className="mb-8">
        {assessment && (
          <>
            <Tab title="Analytics">
              <Analytics assessment={assessment} submissions={submissions} />
            </Tab>
            <Tab title="Results">
              <Results assessment={assessment} submissions={submissions} />
            </Tab>
          </>
        )}
      </Tabs>
    </div>
  );
};

export default AnalyticsDashboard;
