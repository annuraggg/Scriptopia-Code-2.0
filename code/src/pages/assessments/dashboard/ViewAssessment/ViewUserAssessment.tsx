// @ts-nocheck
import ViewUserAssessmentTop from "./ViewUserAssessmentTop";
import ViewUserAssessmentBottom from "./ViewUserAssessmentBottom";
import { motion } from "framer-motion";
import { useAuth } from "@/auth";
import ax from "@/config/axios";
import { useEffect, useState } from "react";
import { Assessment } from "@shared-types/Assessment";
import { AssessmentSubmissionsSchema as IAssessSub } from "@shared-types/AssessmentSubmission";
import { toast } from "sonner";

const ViewUserAssessment = () => {
  const [assessment, setAssessment] = useState<Assessment>({} as Assessment);
  const [submission, setSubmission] = useState<IAssessSub>({} as IAssessSub);

  const { getToken } = useAuth();

  useEffect(() => {
    const axios = ax(getToken);
    const submissionId = window.location.pathname.split("/")[4];
    const assessmentId = window.location.pathname.split("/")[2];

    axios
      .get(`/assessments/${assessmentId}/get-submissions/${submissionId}`)
      .then((res) => {
        setSubmission(res.data?.data?.submission);
        setAssessment(res?.data?.data?.assessment);
        console?.log(res?.data?.data);
      })
      .catch((err) => {
        toast.error(err?.response?.data?.message || "An error occurred");
      });
  }, []);

  return (
    <motion.div
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="w-full px-10 h-screen flex flex-col"
    >
      <ViewUserAssessmentTop submission={submission} assessment={assessment} />
      <ViewUserAssessmentBottom
        submission={submission}
        assessment={assessment}
      />
    </motion.div>
  );
};

export default ViewUserAssessment;
