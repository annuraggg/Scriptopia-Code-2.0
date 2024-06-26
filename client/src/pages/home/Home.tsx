import { motion } from "framer-motion";
import Problems from "./Problems";
import ProblemsChart from "./ProblemsChart";
import StreakCalender from "./StreakCalender";
import Timer from "./Timer";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import Loader from "@/components/Loader";
import ErrorPage from "@/components/ErrorPage";

const Home = () => {
  const { error, data, isLoading } = useQuery({
    queryKey: ["dashboard-get-problems"],
    queryFn: async () => (await axios.get("/home")).data,
  });

  if (isLoading) return <Loader />;
  if (error) return <ErrorPage />;

  console.log(data);

  return (
    <motion.div
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="flex gap-10 pb-10"
    >
      <div className="w-[80%]">
        <Problems
          problems={data?.data?.problems}
          tags={data?.data?.tags}
          solvedProblems={data?.data?.solvedProblems}
        />
      </div>
      <motion.div
        initial={{ x: -50, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="flex gap-5 flex-col w-[20%]"
      >
        <StreakCalender dates={data?.data?.streak} />
        <Timer />
        <ProblemsChart easy={data?.data?.problemsCount.easy} medium={data?.data?.problemsCount.medium} hard={data?.data?.problemsCount.hard} />
      </motion.div>
    </motion.div>
  );
};

export default Home;
