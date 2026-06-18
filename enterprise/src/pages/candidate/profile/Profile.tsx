import Loader from "@/components/Loader";
import ax from "@/config/axios";
import { useAuth } from "@/auth";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Candidate } from "@shared-types/Candidate";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const Profile = () => {
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(true);

  const { getToken } = useAuth();
  const axios = ax(getToken);

  useEffect(() => {
    const id = window.location.pathname.split("/").pop();
    axios
      .get(`/candidates/candidate/${id}`)
      .then((res) => {
        setCandidate(res.data.data);
        setLoading(false);
      })
      .catch((err) => {
        console.log(err);
        toast.error("Failed to fetch candidate profile");
        setLoading(false);
      });
  }, []);

  if (loading) return <Loader />;

  return <div className="p-5">
    <Card>
        <CardHeader className="text-xl font-bold">{candidate?.name}</CardHeader>
        <CardBody>
            {candidate?.dob && (<p>DOB: {new Date(candidate?.dob).toLocaleDateString()}</p>)}
        </CardBody>
    </Card>
  </div>;
};

export default Profile;
