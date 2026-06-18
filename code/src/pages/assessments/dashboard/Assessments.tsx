import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import AssessmentsTaken from "./AssessmentsTaken";
import { useQueries } from "@tanstack/react-query";
import ax from "@/config/axios";
import Loader from "@/components/Loader";
import ErrorPage from "@/components/ErrorPage";
import { useAuth } from "@/auth";
import MCQAssess from "./MCQAssess";
import CodeAssess from "./CodeAssess";

const Assessments = () => {
  const [active, setActive] = useState(0);

  const { getToken } = useAuth();
  const axios = ax(getToken);

  const data = useQueries({
    queries: [
      {
        queryKey: ["taken-assessments"],
        queryFn: async () => (await axios.get("/assessments/mcq/taken")).data,
      },
      {
        queryKey: ["mcq-created-assessments"],
        queryFn: async () => (await axios.get("/assessments/mcq/created")).data,
      },
      {
        queryKey: ["code-created-assessments"],
        queryFn: async () =>
          (await axios.get("/assessments/code/created")).data,
      },
    ],
  });

  useEffect(() => {
    const hash = window.location.hash;
    switch (hash) {
      case "#taken":
        setActive(0);
        break;
      case "#mcqcreated":
        setActive(1);
        break;
      case "#codecreated":
        setActive(2);
        break;
      default:
        setActive(0);
    }
  }, []);

  const renderContent = () => {
    if (data[active].isLoading) return <Loader />;
    if (data[active].error) return <ErrorPage />;
    if (active === 0)
      return <AssessmentsTaken takenAssessments={data[0]?.data.data || []} />;
    if (active === 1)
      return <MCQAssess createdAssessments={data[1]?.data.data || []}  />;
    if (active === 2)
      return <CodeAssess createdAssessments={data[2]?.data.data || []} />;
  };

  return (
    <motion.div
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className=""
    >
      <div className="h-full flex gap-5">
        <Sidebar active={active} setActive={setActive} />
        {renderContent()}
      </div>
    </motion.div>
  );
};

export default Assessments;
