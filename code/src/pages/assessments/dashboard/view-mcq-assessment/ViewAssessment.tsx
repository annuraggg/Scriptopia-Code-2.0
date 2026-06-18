// @ts-nocheck
import Top from "./Top";
import Bottom from "./Bottom";
import { motion } from "framer-motion";
import { useAuth } from "@/auth";
import ax from "@/config/axios";
import { useEffect, useState } from "react";
import { MCQAssessment } from "@shared-types/MCQAssessment";
import { MCQAssessmentSubmissionsSchema as IAssessSub } from "@shared-types/MCQAssessmentSubmission";
import { toast } from "sonner";

const ViewAssessment = () => {
  const [assessment, setAssessment] = useState<MCQAssessment>({} as MCQAssessment);
  const [submission, setSubmission] = useState<IAssessSub>({} as IAssessSub);

  const { getToken } = useAuth();

  useEffect(() => {
    const axios = ax(getToken);
    const assessmentId = window.location.pathname.split("/")[3];
    const submissionId = window.location.pathname.split("/")[5];

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
      <Top submission={submission} assessment={assessment} />
      <Bottom submission={submission} assessment={assessment} />
    </motion.div>
  );
};

export default ViewAssessment;
