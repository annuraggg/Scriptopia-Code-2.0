import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import ax from "@/config/axios";
import { useAuth } from "@/auth";
import MCQAssess from "./MCQAssess";
import CodeAssess from "./CodeAssess";
import { toast } from "sonner";
import { CodeAssessment } from "@shared-types/CodeAssessment";
import { MCQAssessment } from "@shared-types/MCQAssessment";
import Loader from "@/components/Loader";

const Assessments = () => {
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);

  const { getToken } = useAuth();
  const axios = ax(getToken);

  const [data, setData] = useState<{
    mcqCreatedAssessments: MCQAssessment[];
    codeCreatedAssessments: CodeAssessment[];
  }>({
    mcqCreatedAssessments: [],
    codeCreatedAssessments: [],
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const driveId = window.location.pathname.split("/")[2];
      try {
        const mcqCreatedAssessments = await axios.get(
          "/assessments/mcq/created/campus/" + driveId
        );
        const codeCreatedAssessments = await axios.get(
          "/assessments/code/created/campus/" + driveId
        );

        setData({
          mcqCreatedAssessments: mcqCreatedAssessments.data.data,
          codeCreatedAssessments: codeCreatedAssessments.data.data,
        });
      } catch (error) {
        toast.error("Failed to fetch assessments");
        console.error("Error fetching assessments:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    const hash = window.location.hash;
    switch (hash) {
      case "#mcqcreated":
        setActive(0);
        break;
      case "#codecreated":
        setActive(1);
        break;
      case "#mcqcodecreated":
        setActive(2);
        break;
      default:
        setActive(0);
    }
  }, []);

  return (
    <motion.div
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="h-full flex gap-5 w-full">
        <Sidebar active={active} setActive={setActive} />
        {loading ? (
          <div className="w-full">
            <Loader />
          </div>
        ) : (
          active === 0 && (
            <MCQAssess createdAssessments={data.mcqCreatedAssessments || []} />
          )
        )}
        {active === 1 && (
          <CodeAssess createdAssessments={data.codeCreatedAssessments || []} />
        )}
      </div>
    </motion.div>
  );
};

export default Assessments;
