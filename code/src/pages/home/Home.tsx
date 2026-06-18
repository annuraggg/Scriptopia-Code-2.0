// src/components/Home.tsx

import { motion } from "framer-motion";
import Problems from "./Problems";
import StreakCalender from "./StreakCalendar";
import { useQuery } from "@tanstack/react-query";
import ax from "@/config/axios";
import Loader from "@/components/Loader";
import { useAuth } from "@/auth";

const Home = () => {
  const { getToken } = useAuth();
  const axios = ax(getToken);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-get-problems"],
    queryFn: async () => (await axios.get("/home")).data,
  });

  if (isLoading) return <Loader />;

  return (
    <>
      <div className="flex flex-col md:flex-row gap-10 pb-10 h-screen md:h-auto overflow-y-auto">
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full md:w-[80%] order-1 md:order-1"
        >
          <Problems
            problems={data?.data?.problems}
            tags={data?.data?.tags}
            solvedProblems={data?.data?.solvedProblems}
          />
        </motion.div>

        <motion.div
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full md:w-[20%] flex gap-5 flex-col order-2 md:order-2"
        >
          {data?.data?.streak ? (
            <StreakCalender dates={data?.data?.streak} />
          ) : (
            <p>No Streaks Yet</p>
          )}
        </motion.div>
      </div>
    </>
  );
};

export default Home;
