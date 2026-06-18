import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { DataTable } from "./DataTable";
import { RootState } from "@/types/Reducer";
import { Breadcrumbs, BreadcrumbItem } from "@heroui/breadcrumbs";
import { useSelector } from "react-redux";
import { useAuth } from "@/auth";
import ax from "@/config/axios";
import { Spinner } from "@heroui/spinner";

interface Candidate {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  resumeUrl: string;
  queries?: string[];
  status?: string;
  receivedDate?: string;
}

const Candidates = () => {
  const org = useSelector((state: RootState) => state.organization);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { getToken } = useAuth();
  useEffect(() => {
    const axios = ax(getToken);
    axios
      .get("/organizations/candidates")
      .then((response) => {
        setCandidates(response.data.data || []);
        setLoading(false);
      })
      .catch((error) => {
        console.error(error);
        setError("Failed to fetch candidates");
        setLoading(false);
      });
  }, []);

  const tableData = candidates.map((candidate) => ({
    name: `${candidate.firstName} ${candidate.lastName}`,
    email: candidate.email,
    received: candidate.receivedDate || "N/A",
    status: candidate.status || "N/A",
  }));

  if (loading)
    return (
      <div className="flex items-center justify-center h-full">
        <Spinner />
      </div>
    );
  if (error) return <div>Error: {error}</div>;

  return (
    <>
      <div className="mt-5 ml-5">
        <Breadcrumbs>
          <BreadcrumbItem>{org.name}</BreadcrumbItem>
          <BreadcrumbItem href={"/candidates"}>Candidates</BreadcrumbItem>
        </Breadcrumbs>
      </div>
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className=""
      >
        <div className="p-5">
          <DataTable data={tableData} />
        </div>
      </motion.div>
    </>
  );
};

export default Candidates;
