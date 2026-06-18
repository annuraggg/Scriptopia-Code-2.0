import { Tab, Tabs } from "@heroui/tabs";
import Overview from "./Overview";
import { useEffect, useState } from "react";
import { ExtendedMCQAssessmentSubmission as EMAS } from "@shared-types/ExtendedMCQAssessmentSubmission";
import { useAuth } from "@/auth";
import ax from "@/config/axios";
import { toast } from "sonner";
import Result from "./Result";
import Loader from "@/components/Loader";

const View = () => {
  const [submission, setSubmission] = useState<EMAS | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refetch, setRefetch] = useState<boolean>(false);

  const { getToken } = useAuth();
  const axios = ax(getToken);

  useEffect(() => {
    const fetchSubmission = async (): Promise<void> => {
      try {
        const pathParts = window.location.pathname.split("/");
        const assessmentId = pathParts[5];
        const submissionId = pathParts[7];

        const response = await axios.get(
          `/assessments/${assessmentId}/get-mcq-submissions/${submissionId}`
        );

        setSubmission(response.data.data);
      } catch (error) {
        console.error(error);
        toast.error("Failed to fetch assessment submission");
      } finally {
        setLoading(false);
      }
    };

    fetchSubmission();
  }, [getToken, refetch]);

  if (loading) {
    return <Loader />;
  }

  return (
    <div className="p-5">
      <Tabs aria-label="Options">
        <Tab key="overview" title="Overview">
          <Overview
            submission={submission}
            loading={loading}
            setRefetch={setRefetch}
          />
        </Tab>
        <Tab key="answers" title="Answers">
          <Result submission={submission!} />
        </Tab>
      </Tabs>
    </div>
  );
};

export default View;
