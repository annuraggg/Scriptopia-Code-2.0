import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import Sidebar from "./Sidebar";
import ProblemsList from "./ProblemsList";
import Dashboard from "./Dashboard";
import UserGenerated from "./UserGenerated";
import ConundrumCubes from "./ConundrumCubes";
import MyProblems from "./MyProblems";
import Loader from "@/components/Loader";
import ErrorPage from "@/components/ErrorPage";
import { useAuth } from "@clerk/clerk-react";
import ax from "@/config/axios";

const Problems = () => {
  const [active, setActive] = useState(0);

  const { getToken } = useAuth();
  const axios = ax(getToken);

  const data = useQueries({
    queries: [
      {
        queryKey: ["problems-section-get-problems"],
        queryFn: async () => (await axios.get("/problems/all/1")).data,
      },
      {
        queryKey: ["problems-section-get-user-problems"],
        queryFn: async () =>
          (await axios.get("/problems/user-generated/1")).data,
      },
      {
        queryKey: ["problems-section-get-my-problems"],
        queryFn: async () => (await axios.get("/problems/my-problems/1")).data,
      },
    ],
  });

  useEffect(() => {
    const hash = window.location.hash;
    switch (hash) {
      case "#problems":
        setActive(1);
        break;
      case "#user-generated":
        setActive(2);
        break;
      case "#my-problems":
        setActive(3);
        break;
      case "#conundrum-cubes":
        setActive(4);
        break;
      default:
        setActive(0);
    }
  }, []);

  if (data[0].isLoading || data[1].isLoading || data[2].isLoading)
    return <Loader />;
  if (data[0].error || data[1].error || data[2].error) return <ErrorPage />;

  return (
    <motion.div
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
      className=""
    >
      <div className="h-full flex gap-5">
        <Sidebar active={active} setActive={setActive} />
        {active === 0 && <Dashboard />} {/*myproblems={data[0]?.data.data || []}*/} 
        {active === 1 && <ProblemsList problems={data[0]?.data.data || []} />}
        {active === 2 && (
          <UserGenerated userproblems={data[2]?.data.data || []} />
        )}
        {active === 3 && <MyProblems myproblems={data[2]?.data.data || []} />}
        {active === 4 && <ConundrumCubes />}
      </div>
    </motion.div>
  );
};

export default Problems;
