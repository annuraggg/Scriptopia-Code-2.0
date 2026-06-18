import Loader from "@/components/Loader";
import ax from "@/config/axios";
import { useAuth } from "@/auth";
import { PlacementGroup } from "@shared-types/PlacementGroup";
import { Candidate } from "@shared-types/Candidate";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Card,
  CardBody,
  Tabs,
  Tab,
  Button,
  Input,
  Pagination,
} from "@heroui/react";
import { DataTable } from "./DataTable";
import { motion } from "framer-motion";
// import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";

interface PaginationInfo {
  total: number;
  page: number;
  pages: number;
  limit: number;
}

const PlacementGroups = () => {
  const [placementGroups, setPlacementGroups] = useState<PlacementGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<PlacementGroup | null>(
    null
  );
  const [selected, setSelected] = useState("details");
  const [searchQuery, setSearchQuery] = useState("");
  const [pagination, setPagination] = useState<PaginationInfo>({
    total: 0,
    page: 1,
    pages: 0,
    limit: 10,
  });

  const { getToken } = useAuth();
  const axios = ax(getToken);

  useEffect(() => {
    fetchPlacementGroups();
  }, []);

  const fetchPlacementGroups = (page = 1) => {
    setLoading(true);
    axios
      .get(`/candidates/placement-groups?page=${page}`)
      .then((res) => {
        console.log(res.data.data);
        // Extract groups array and pagination info from the new structure
        const { groups, pagination } = res.data.data;
        setPlacementGroups(groups || []);
        setPagination(
          pagination || {
            total: 0,
            page: 1,
            pages: 0,
            limit: 10,
          }
        );
        setSelectedGroup(null);
      })
      .catch((err) => {
        console.error(err);
        toast.error(
          err.response?.data?.message ||
            "An error occurred while fetching groups"
        );
      })
      .finally(() => setLoading(false));
  };

  const formatDate = (date: string | Date) => {
    return format(new Date(date), "MMM dd, yyyy");
  };

  const handleGroupSelect = (group: PlacementGroup) => {
    setSelectedGroup(group);
    setSelected("details");
  };

  const handlePageChange = (page: number) => {
    fetchPlacementGroups(page);
  };

  if (loading) {
    return <Loader />;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6"
    >
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Student Placement Groups
        </h1>
      </div>

      {!selectedGroup ? (
        <div>
          <div className="lg:col-span-3">
            {/* Top Bar with Search */}
            <div className="flex mb-6">
              <div className="w-full">
                <Input
                  placeholder="Search Group"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  startContent={<Search size={18} />}
                  className="w-full"
                />
              </div>
            </div>

            {/* Groups List */}
            {placementGroups.length === 0 ? (
              <div className="text-center py-8 bg-default-50 rounded-lg p-8">
                <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                  No placement groups found
                </p>
                <p className="text-gray-500 dark:text-gray-400 mb-6">
                  No groups match your current filters
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {placementGroups.map((group) => (
                  <Card
                    key={group._id}
                    className="cursor-pointer hover:shadow-md transition-shadow w-full"
                    isPressable
                    onClick={() => handleGroupSelect(group)}
                  >
                    <CardBody className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h2 className="text-lg font-semibold">
                              {group.name}
                            </h2>
                            <span
                              className={`px-2 py-0.5 text-xs rounded-full ${
                                new Date(group.expiryDate) > new Date()
                                  ? "bg-success/20 text-success"
                                  : "bg-default-200 text-default-600"
                              }`}
                            >
                              {new Date(group.expiryDate) > new Date()
                                ? "Active"
                                : "Archived"}
                            </span>
                          </div>
                          <div className="text-sm text-default-500">
                            {group.academicYear.start} -{" "}
                            {group.academicYear.end}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm text-default-500">
                            Created:{" "}
                            {formatDate(group.createdAt || new Date(0))}
                          </div>
                        </div>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex justify-center mt-6">
                <Pagination
                  total={pagination.pages}
                  initialPage={pagination.page}
                  page={pagination.page}
                  onChange={handlePageChange}
                  color="primary"
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="w-full">
          {/* Back Button */}
          <Button
            variant="light"
            color="default"
            className="mb-4"
            onClick={() => setSelectedGroup(null)}
          >
            ← Back to groups
          </Button>

          <div className="flex items-center justify-between p-2 mb-4">
            <h1 className="text-xl font-bold">{selectedGroup.name}</h1>
          </div>

          {/* Tabs */}
          <Tabs
            selectedKey={selected}
            onSelectionChange={setSelected as any}
            variant="underlined"
            color="primary"
            className="mt-4"
          >
            {/* Group Details Tab */}
            <Tab key="details" title="Group Details">
              <div className="space-y-6 mt-5">
                <Card className="bg-default-50 p-2">
                  <CardBody>
                    <h3 className="text-xl font-semibold mb-4">
                      Group Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="mx-2">
                        <p className="text-sm text-default-500 mb-1">
                          Group Name
                        </p>
                        <p className="text-base font-medium">
                          {selectedGroup.name}
                        </p>
                      </div>

                      <div className="mx-2">
                        <p className="text-sm text-default-500 mb-1">
                          College Batch
                        </p>
                        <p className="text-base font-medium">
                          {selectedGroup.academicYear.start} -{" "}
                          {selectedGroup.academicYear.end}
                        </p>
                      </div>

                      <div className="mx-2">
                        <p className="text-sm text-default-500 mb-1">
                          Expiry Date
                        </p>
                        <p className="text-base font-medium">
                          {formatDate(selectedGroup.expiryDate)}
                        </p>
                      </div>

                      <div className="mx-2 md:col-span-2">
                        <p className="text-sm text-default-500 mb-1">
                          Group Purpose
                        </p>
                        <p className="text-base font-medium">
                          {selectedGroup.purpose || "No purpose specified"}
                        </p>
                      </div>
                    </div>
                  </CardBody>
                </Card>

                <Card className="bg-default-50 p-2">
                  <CardBody>
                    <h3 className="text-xl font-semibold mb-4">
                      Group Statistics
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="mx-2 p-4 rounded-lg bg-primary/10 text-center">
                        <p className="text-2xl font-bold text-primary">
                          {selectedGroup.candidates.length}
                        </p>
                        <p className="text-sm text-default-600">
                          Total Candidates
                        </p>
                      </div>

                      <div className="mx-2 p-4 rounded-lg bg-success/10 text-center">
                        <p className="text-2xl font-bold text-success">
                          {selectedGroup.createdAt
                            ? formatDate(selectedGroup.createdAt)
                            : "N/A"}
                        </p>
                        <p className="text-sm text-default-600">Created On</p>
                      </div>

                      <div className="mx-2 p-4 rounded-lg bg-warning/10 text-center">
                        <p className="text-2xl font-bold text-warning">
                          {formatDate(selectedGroup.expiryDate)}
                        </p>
                        <p className="text-sm text-default-600">Expires On</p>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              </div>
            </Tab>

            {/* Students Tab */}
            <Tab key="students" title="Student Details">
              <div className="mt-5">
                {selectedGroup.candidates &&
                selectedGroup.candidates.length > 0 ? (
                  <DataTable
                    data={selectedGroup.candidates.map(
                      (candidateId) =>
                        ({ id: candidateId } as unknown as Candidate)
                    )}
                    type="active"
                    onDataUpdate={fetchPlacementGroups}
                  />
                ) : (
                  <Card className="bg-default-50 p-6 text-center">
                    <p className="text-lg">No candidates in this group yet</p>
                  </Card>
                )}
              </div>
            </Tab>
          </Tabs>
        </div>
      )}
    </motion.div>
  );
};

export default PlacementGroups;
