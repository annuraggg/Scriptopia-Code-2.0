import { motion } from "framer-motion";
import {
  Card,
  CardHeader,
  CardBody,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Button,
} from "@heroui/react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/auth";
import ax from "@/config/axios";
import { toast } from "sonner";

const ViewAssessment = () => {
  const navigate = useNavigate();
  const [assessmentsSubmissions, setAssessmentsSubmissions] = useState([]);
  const [totalSubmissions, setTotalSubmissions] = useState(0);
  const [qualified, setQualified] = useState(0);
  const [cheating, setCheating] = useState({ no: 0, light: 0, heavy: 0 });

  const { getToken, isLoaded } = useAuth();
  useEffect(() => {
    if (isLoaded) {
      const id = window.location.pathname.split("/")[2];
      const axios = ax(getToken);
      axios
        .get(`/assessments/${id}/get-submissions`)
        .then((res) => {
          setAssessmentsSubmissions(res?.data?.data?.submissions);
          setTotalSubmissions(res?.data?.data?.totalSubmissions);
          setQualified(res?.data?.data?.qualified);
          setCheating(res?.data?.data?.cheating);
        })
        .catch((err) => {
          toast?.error(err?.response?.data?.message || "Error");
        });
    }
  }, [getToken, isLoaded]);

  const calculateTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    return `${minutes}m ${seconds}s`;
  };

  return (
    <motion.div
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="w-full p-10 h-screen flex flex-col gap-8"
    >
      <div className="flex flex-row justify-center items-center gap-10 w-full">
        <Card className="h-36 w-full">
          <CardHeader className="text-center flex justify-center text-gray-400 pb-0 pt-11">
            <p className="text-2xl">{totalSubmissions}</p>
          </CardHeader>
          <CardBody className="flex justify-center items-center gap-2 flex-row pt-0 pb-8">
            <p className="text-lg">Total Submissions</p>
          </CardBody>
        </Card>
        <Card className="h-36 w-full">
          <CardHeader className="text-center flex justify-center text-gray-400 pb-0 pt-11">
            <p className="text-2xl">{qualified}</p>
          </CardHeader>
          <CardBody className="flex justify-center items-center gap-2 flex-row pt-0 pb-8">
            <p className="text-lg">Total Qualified</p>
          </CardBody>
        </Card>
        <Card className="h-36 w-full p-2">
          <CardHeader className=" flex justify-start items-start pb-1 pt-1">
            <p className="text-xl">Cheating</p>
          </CardHeader>
          <CardBody className="flex justify-center items-start gap-2 flex-col">
            <p className="text-xs text-green-500">No Copying: {cheating?.no}</p>
            <p className="text-xs text-yellow-500">
              Light Copying: {cheating?.light}
            </p>
            <p className="text-xs text-red-500">
              Heavy Copying: {cheating?.heavy}
            </p>
          </CardBody>
        </Card>
      </div>
      <div className="w-full h-screen">
        <Table isStriped aria-label="Code Results">
          <TableHeader>
            <TableColumn className="text-sm">Name</TableColumn>
            <TableColumn className="text-sm">Email</TableColumn>
            <TableColumn className="text-sm">Date</TableColumn>
            <TableColumn className="text-sm">Time Taken</TableColumn>
            <TableColumn className="text-sm">Score</TableColumn>
            <TableColumn className="text-sm">Cheating</TableColumn>
            <TableColumn className="text-sm">Action</TableColumn>
          </TableHeader>
          <TableBody>
            {assessmentsSubmissions?.map((submission: any) => (
              <TableRow className="h-14" key={submission?._id}>
                <TableCell className="w-full md:w-auto">
                  {submission?.name}
                </TableCell>
                <TableCell className="w-full md:w-auto">
                  {submission?.email}
                </TableCell>
                <TableCell className="w-full md:w-auto">
                  {submission?.date}
                </TableCell>
                <TableCell className="w-full md:w-auto">
                  {calculateTime(submission?.timer)}
                </TableCell>
                <TableCell className="w-full md:w-auto">
                  {submission?.score?.total}
                </TableCell>
                <TableCell className="w-full md:w-auto">
                  {submission?.cheating}
                </TableCell>
                <TableCell className="w-full md:w-auto">
                  <Button
                    variant="light"
                    className="text-green-500"
                    onClick={() => navigate(`${submission?._id}`)}
                  >
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </motion.div>
  );
};

export default ViewAssessment;
