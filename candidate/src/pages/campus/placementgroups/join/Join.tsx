import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardBody, Button } from "@heroui/react";
import { motion } from "framer-motion";
import Loader from "@/components/Loader";
import { PlacementGroup } from "@shared-types/PlacementGroup";
import { useAuth } from "@/auth";
import ax from "@/config/axios";
import { toast } from "sonner";
// Main Component
const GroupDetails: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const { id } = useParams<{ id: string }>();
  const { getToken } = useAuth();
  const axios = ax(getToken);

  const [group, setGroup] = useState<PlacementGroup | null>(null);

  const joinGroup = () => {
    setLoading(true);
    axios
      .post(`/placement-groups/${id}/join`)
      .then((res) => {
        toast.success(res.data.message);
        window.location.href = "/campus/placement-groups";
      })
      .catch((err) => {
        toast.error(err.response.data.message || "An error occurred");
        console.error(err);
        setLoading(false);
      });
  };

  useEffect(() => {
    axios
      .get(`/placement-groups/${id}`)
      .then((res) => {
        setGroup(res.data.data);
      })
      .catch((err) => {
        toast.error("Error fetching group details");
        console.error(err);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader />;

  if (!group) {
    return (
      <div className="flex items-center justify-center h-screen">
        Placement Group not found
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6"
    >
      <div className="space-y-6 mt-5">
        {/* Group Information Display */}
        <Card className="bg-default-50 p-2">
          <CardBody>
            <h3 className="text-xl font-semibold mb-4">Group Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="mx-2">
                <p className="text-sm text-default-500 mb-1">Group Name</p>
                <p className="text-base font-medium">{group.name}</p>
              </div>

              <div className="mx-2">
                <p className="text-sm text-default-500 mb-1">College Batch</p>
                <p className="text-base font-medium">
                  {group.academicYear.start} - {group.academicYear.end}
                </p>
              </div>

              <div className="mx-2 md:col-span-2">
                <p className="text-sm text-default-500 mb-1">Group Purpose</p>
                <p className="text-base font-medium">{group.purpose}</p>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Additional sections can continue below if needed */}
        {/* <Card className="bg-default-50 p-2">
              <CardBody>
                <h3 className="text-xl font-semibold mb-4">
                  Participating Companies
                </h3>
                <div className="space-y-3">
                  {group.companies.map((company) => (
                    <Card
                      key={company.id}
                      className="border border-default-200"
                    >
                      <CardBody className="p-3">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-semibold">{company.name}</p>
                            <p className="text-small text-default-500">
                              {company.industry}
                            </p>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-small text-default-500">
                                Openings
                              </p>
                              <p className="font-semibold">
                                {company.openings}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-small text-default-500">
                                Package
                              </p>
                              <p className="font-semibold">{company.package}</p>
                            </div>
                            <Button size="sm" variant="flat" color="primary">
                              View
                            </Button>
                          </div>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>

                <div className="mt-4 text-center">
                  <Button variant="light" color="primary">
                    View All Companies
                  </Button>
                </div>
              </CardBody>
            </Card> */}
      </div>

      <Button className="mt-3 float-right" onClick={joinGroup}>
        Join Placement Group
      </Button>
    </motion.div>
  );
};

export default GroupDetails;
