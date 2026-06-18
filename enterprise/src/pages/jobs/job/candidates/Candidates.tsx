import { motion } from "framer-motion";
import { DataTable } from "./DataTable";
import { useEffect, useState } from "react";
import { useAuth } from "@/auth";
import ax from "@/config/axios";

const Candidates = () => {
  const [candidatesData, setCandidatesData] = useState([]);

  const { getToken } = useAuth();
  const axios = ax(getToken);

  useEffect(() => {
    axios.get("/organizations/candidates").then((res) => {
      setCandidatesData(res.data.data);
    });
  }, []);

  const downloadResume = (candidateId: string) => {
    axios.get(`/organizations/candidate/${candidateId}/resume`).then((res) => {
      window.open(res.data.data.url);
    });
  };

  return (
    <div className="w-full p-10">
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {candidatesData?.length > 0 && (
          <DataTable data={candidatesData} downloadResume={downloadResume} />
        )}
      </motion.div>
    </div>
  );
};

export default Candidates;
