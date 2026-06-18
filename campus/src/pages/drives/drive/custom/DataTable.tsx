import { useEffect, useMemo, useState } from "react";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/dropdown";
import {
  Selection,
  SortDescriptor,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";
import { Download, UserCheck, UserX, Search, User } from "lucide-react";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Skeleton } from "@heroui/skeleton";
import { useAuth } from "@/auth";
import ax from "@/config/axios";
import { toast } from "sonner";
import { useOutletContext, useNavigate } from "react-router-dom";
import { Drive } from "@shared-types/Drive";
import { IconChevronDown, IconMenu2 } from "@tabler/icons-react";
import { Pagination } from "@heroui/pagination";
import { ExtendedCandidate } from "@shared-types/ExtendedCandidate";
import { Tabs, Tab } from "@heroui/tabs";
import { Badge } from "@heroui/badge";
import { Card } from "@heroui/card";
import { AppliedDrive } from "@shared-types/AppliedDrive";

interface DataTableProps {
  data: ExtendedCandidate[];
  refetch?: () => void;
  readOnly?: boolean;
  stepId?: string;
  index?: number; // Add index prop to determine if this is the last stage
}

// Define a type for historical status to avoid type mismatches
type HistoricalStatus = "accepted" | "rejected";

const rowsPerPage = 10;

const DataTable = ({
  data: vanillaData,
  readOnly = false,
  stepId,
  index,
}: DataTableProps) => {
  const [selectedRows, setSelectedRows] = useState<Selection>(
    new Set<string>()
  );
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ExtendedCandidate[]>([]);
  const [filterValue, setFilterValue] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
    column: "receivedOn",
    direction: "descending",
  });

  const navigate = useNavigate();
  const { getToken } = useAuth();
  const axios = ax(getToken);
  const { drive } = useOutletContext() as { drive: Drive };

  // Remove current date time functionality
  // The useEffect for updating currentDateTime has been removed

  useEffect(() => {
    setData(vanillaData);
    // Simulate loading with a short delay
    setTimeout(() => {
      setIsLoading(false);
    }, 500);
  }, [vanillaData]);

  // Determine if this is the last stage in the workflow
  const isLastStage = useMemo(() => {
    return (
      drive?.workflow &&
      drive?.workflow.steps[drive?.workflow.steps.length - 1]?._id === stepId
    );
  }, [drive?.workflow, index]);

  // Special handling for historical data view
  const getHistoricalStatus = (
    candidate: ExtendedCandidate
  ): HistoricalStatus => {
    const appliedDrive = candidate.appliedDrives.find(
      (ap) => ap.drive === drive?._id
    ) as AppliedDrive | undefined;
    if (!appliedDrive) return "rejected";

    if (
      appliedDrive.status === "rejected" &&
      appliedDrive.disqualifiedStage === stepId
    ) {
      return "rejected";
    }

    // If not rejected at this step, or in any other status, consider them accepted
    return "accepted";
  };

  // Filter by tab selection (status)
  const filteredData = useMemo(() => {
    let filtered = [...data];

    // Special handling for historical data
    if (readOnly) {
      if (activeTab === "accepted") {
        filtered = filtered.filter(
          (candidate) => getHistoricalStatus(candidate) === "accepted"
        );
      } else if (activeTab === "rejected") {
        filtered = filtered.filter(
          (candidate) => getHistoricalStatus(candidate) === "rejected"
        );
      }
    }
    // Normal filtering for active steps
    else if (activeTab !== "all") {
      filtered = filtered.filter((candidate) => {
        const appliedDrive = candidate.appliedDrives.find(
          (ap) => ap.drive === drive?._id
        );
        return appliedDrive?.status === activeTab;
      });
    }

    // Filter by search term
    if (filterValue) {
      const lowerFilter = filterValue.toLowerCase();
      filtered = filtered.filter(
        (candidate) =>
          candidate.name.toLowerCase().includes(lowerFilter) ||
          candidate.email.toLowerCase().includes(lowerFilter) ||
          candidate.phone?.toLowerCase().includes(lowerFilter)
      );
    }

    // Sort data
    if (sortDescriptor.column && sortDescriptor.direction) {
      filtered.sort((a, b) => {
        let first: any = a[(sortDescriptor.column as keyof typeof a) || ""];
        let second: any = b[(sortDescriptor.column as keyof typeof b) || ""];

        // Handle nested properties for status
        if (sortDescriptor.column === "status") {
          if (readOnly) {
            first = getHistoricalStatus(a);
            second = getHistoricalStatus(b);
          } else {
            first =
              a.appliedDrives.find((ap) => ap.drive === drive?._id)?.status ||
              "";
            second =
              b.appliedDrives.find((ap) => ap.drive === drive?._id)?.status ||
              "";
          }
        }

        if (first === undefined) first = "";
        if (second === undefined) second = "";

        const cmp = first < second ? -1 : first > second ? 1 : 0;

        return sortDescriptor.direction === "descending" ? -cmp : cmp;
      });
    }

    return filtered;
  }, [
    data,
    activeTab,
    filterValue,
    sortDescriptor,
    drive?._id,
    readOnly,
    stepId,
  ]);

  // Calculate pagination
  const pages = Math.ceil(filteredData.length / rowsPerPage);

  // Get current page items
  const currentPageItems = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return filteredData.slice(start, end);
  }, [page, filteredData]);

  // Count by status (accommodates both historical and active views)
  const statusCounts = useMemo(() => {
    if (readOnly) {
      // For historical view, just count accepted and rejected
      const counts = {
        all: data.length,
        accepted: 0,
        rejected: 0,
      };

      data.forEach((candidate) => {
        const status = getHistoricalStatus(candidate);
        counts[status] = (counts[status] || 0) + 1;
      });

      return counts;
    } else {
      // Normal counting for active steps
      const counts: Record<string, number> = {
        all: data.length,
        inprogress: 0,
        applied: 0,
        rejected: 0,
      };

      // Only add hired count if this is the last stage
      if (isLastStage) {
        counts["hired"] = 0;
      }

      data.forEach((candidate) => {
        const status =
          candidate.appliedDrives.find((ap) => ap.drive === drive?._id)
            ?.status || "applied";

        // Only count hired status if it's the last stage
        if (status === "hired" && !isLastStage) {
          // Skip counting for non-last stages
          return;
        }

        counts[status] = (counts[status] || 0) + 1;
      });

      return counts;
    }
  }, [data, drive?._id, readOnly, stepId, isLastStage]);

  const downloadResume = (_id: string) => {
    setIsLoading(true);
    axios
      .get(`drives/candidate/${_id}/resume`)
      .then((res) => window.open(res.data.data.url, "_blank"))
      .catch((err) => {
        toast.error(err.response.data.message || "Failed to download resume");
        console.error(err);
      })
      .finally(() => setIsLoading(false));
  };

  const viewCandidateProfile = (candidateId: string) => {
    navigate(`/c/${candidateId}`);
  };

  const updateCandidateStatus = (_id: string, newStatus: string) => {
    setIsLoading(true);

    // Optimistically update the UI first
    const newData = [...data] as ExtendedCandidate[];
    const candidate = newData.find((c) => c._id === _id);
    const appliedDrive = candidate?.appliedDrives.find(
      (p) => p.drive === drive?._id
    );

    if (!appliedDrive) {
      console.error("Applied drive not found for candidate:", _id);
      setIsLoading(false);
      return;
    }

    // Store the old status for rollback if needed
    const oldStatus = appliedDrive.status;
    // Cast to any to avoid TypeScript errors - the API handles the correct status type
    (appliedDrive as any).status = newStatus;

    // Update local state immediately
    setData(newData);

    // Determine which API endpoint to use
    const endpoint =
      newStatus === "rejected"
        ? "drives/candidate/disqualify"
        : "drives/candidate/qualify";

    // Make the API call
    axios
      .put(endpoint, {
        _id: _id,
        driveId: drive?._id,
      })
      .then(() => {
        toast.success(
          `Candidate ${
            newStatus === "rejected" ? "disqualified" : "qualified"
          } successfully`
        );
        // No need to refetch the entire data
      })
      .catch((err) => {
        toast.error(
          err.response.data.message || `Failed to update candidate status`
        );
        console.error(err);

        // Revert UI change on error
        const revertData = [...data] as ExtendedCandidate[];
        const candidate = revertData.find((c) => c._id === _id);
        const appliedDrive = candidate?.appliedDrives.find(
          (p) => p.drive === drive?._id
        );
        if (appliedDrive) {
          // Cast to any to avoid TypeScript errors
          (appliedDrive as any).status = oldStatus;
          setData(revertData);
        }
      })
      .finally(() => setIsLoading(false));
  };

  const disqualify = (_id: string) => {
    updateCandidateStatus(_id, "rejected");
  };

  const selectCand = (_id: string) => {
    updateCandidateStatus(_id, "inprogress");
  };

  const bulkAction = (action: "qualify" | "disqualify") => {
    const selectedKeysArray = Array.from(selectedRows);
    if (typeof selectedRows === "object" && selectedKeysArray.length === 0) {
      toast.warning("Please select candidates first");
      return;
    }

    setIsLoading(true);
    const selectedIds = selectedKeysArray;
    const newData = [...data] as ExtendedCandidate[];

    // Store the old statuses for rollback
    const oldStatuses = new Map<string, string>();

    // Update local state
    const newStatus = action === "qualify" ? "inprogress" : "rejected";

    selectedIds.forEach((id) => {
      const candidate = newData.find((c) => c._id === id?.toString());
      const appliedDrive = candidate?.appliedDrives.find(
        (p) => p.drive === drive?._id
      );
      if (!appliedDrive) return;

      // Store old status before changing
      oldStatuses.set(id?.toString() || "", appliedDrive.status);

      // Update status - cast to any to avoid TypeScript errors
      (appliedDrive as any).status = newStatus;
    });

    // Update UI immediately
    setData(newData);

    // API call
    const endpoint = `drives/candidate/${action}/bulk`;
    axios
      .put(endpoint, {
        candidateIds: selectedIds.map((id) => id?.toString()),
        driveId: drive?._id,
      })
      .then(() => {
        toast.success(
          `Selected candidates ${
            action === "qualify" ? "qualified" : "disqualified"
          } successfully`
        );
        setSelectedRows(new Set());
      })
      .catch((err) => {
        toast.error(
          err.response.data.message || `Failed to ${action} selected candidates`
        );
        console.error(err);

        // Revert on error
        const revertedData = [...data] as ExtendedCandidate[];
        selectedIds.forEach((id) => {
          const candidate = revertedData.find((c) => c._id === id?.toString());
          const appliedDrive = candidate?.appliedDrives.find(
            (p) => p.drive === drive?._id
          );
          if (!appliedDrive) return;

          // Restore previous status - cast to any to avoid TypeScript errors
          const oldStatus = oldStatuses.get(id?.toString() || "");
          if (oldStatus) {
            (appliedDrive as any).status = oldStatus;
          }
        });

        setData(revertedData);
      })
      .finally(() => setIsLoading(false));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "inprogress":
      case "accepted":
        return "bg-blue-100 text-blue-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      case "hired":
        return "bg-green-100 text-green-800";
      case "applied":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "inprogress":
      case "accepted":
        return <div className="w-2 h-2 rounded-full bg-blue-500 mr-2"></div>;
      case "rejected":
        return <div className="w-2 h-2 rounded-full bg-red-500 mr-2"></div>;
      case "hired":
        return <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>;
      case "applied":
        return <div className="w-2 h-2 rounded-full bg-purple-500 mr-2"></div>;
      default:
        return <div className="w-2 h-2 rounded-full bg-gray-500 mr-2"></div>;
    }
  };

  const handleSort = (descriptor: SortDescriptor) => {
    setSortDescriptor(descriptor);
  };

  const renderTabWithBadge = (key: string, label: string) => (
    <Tab
      key={key}
      title={
        <div className="flex items-center gap-2">
          {label}
          <Badge variant="flat" className="ml-1">
            {/* Use optional chaining to safely access the count */}
            {statusCounts &&
            typeof statusCounts === "object" &&
            key in statusCounts
              ? (statusCounts as any)[key] || 0
              : 0}
          </Badge>
        </div>
      }
    />
  );

  // Update the helper functions to recognize "all" selection
  const hasSelectedRows = (): boolean => {
    return (
      selectedRows === "all" ||
      (selectedRows instanceof Set && selectedRows.size > 0)
    );
  };

  const getSelectedRowsCount = (): number => {
    if (selectedRows === "all") {
      return currentPageItems.length; // Count of visible items
    }
    return selectedRows instanceof Set ? selectedRows.size : 0;
  };

  // Calculate showing records text
  const startRecord =
    filteredData.length > 0 ? (page - 1) * rowsPerPage + 1 : 0;
  const endRecord = Math.min(page * rowsPerPage, filteredData.length);
  const showingRecordsText =
    filteredData.length > 0
      ? `Showing ${startRecord}-${endRecord} of ${filteredData.length} candidates`
      : "No candidates found";

  // Custom table skeleton component
  const TableSkeletonLoader = () => (
    <div className="w-full">
      <div className="flex flex-col gap-4">
        <div className="h-10 bg-gray-200 rounded-md w-full animate-pulse" />
        {Array(rowsPerPage)
          .fill(0)
          .map((_, index) => (
            <div key={index} className="flex items-center gap-4 h-14">
              <Skeleton className="h-5 w-5" />
              <Skeleton className="h-12 flex-1" />
            </div>
          ))}
      </div>
    </div>
  );

  return (
    <Card className="rounded-lg p-4 bg-transparent shadow-none">
      <div className="space-y-4">
        {/* Status Tabs - Different tabs for historical vs active view */}
        <Tabs
          selectedKey={activeTab}
          onSelectionChange={setActiveTab as any}
          className="w-full"
          aria-label="Candidate status tabs"
        >
          {readOnly ? (
            // Historical view tabs
            <>
              {renderTabWithBadge("all", "All Candidates")}
              {renderTabWithBadge("accepted", "Accepted")}
              {renderTabWithBadge("rejected", "Rejected")}
            </>
          ) : (
            // Active view tabs
            <>
              {renderTabWithBadge("all", "All Candidates")}
              {renderTabWithBadge("applied", "Applied")}
              {renderTabWithBadge("inprogress", "In Progress")}
              {/* Only show hired tab if this is the last stage */}
              {isLastStage && renderTabWithBadge("hired", "Hired")}
              {renderTabWithBadge("rejected", "Rejected")}
            </>
          )}
        </Tabs>

        {/* Search and Actions Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-1">
            <div className="relative max-w-xs w-full">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search candidates..."
                className="pl-9 w-full"
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
              />
            </div>

            {filterValue && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setFilterValue("")}
                className="text-gray-500"
              >
                Clear
              </Button>
            )}
          </div>

          {!readOnly && (
            <div className="flex items-center space-x-2">
              <Dropdown>
                <DropdownTrigger>
                  <Button
                    variant="bordered"
                    className="flex items-center gap-2"
                    disabled={!hasSelectedRows()}
                  >
                    Bulk Actions ({getSelectedRowsCount()}){" "}
                    <IconChevronDown size={16} />
                  </Button>
                </DropdownTrigger>
                <DropdownMenu>
                  <DropdownItem
                    key="qualify"
                    onPress={() => bulkAction("qualify")}
                    className="text-blue-600 hover:bg-blue-50"
                  >
                    Mark as In Progress
                  </DropdownItem>
                  <DropdownItem
                    key="disqualify"
                    onPress={() => bulkAction("disqualify")}
                    className="text-red-600 hover:bg-red-50"
                  >
                    Disqualify Candidates
                  </DropdownItem>
                </DropdownMenu>
              </Dropdown>
            </div>
          )}
        </div>

        {/* Status indicator and record count */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-sm text-gray-500">
          <div>{showingRecordsText}</div>
        </div>

        {/* Table */}
        {isLoading ? (
          <TableSkeletonLoader />
        ) : (
          <Table
            selectionMode={readOnly ? "none" : "multiple"}
            aria-label="Candidates table"
            sortDescriptor={sortDescriptor}
            onSortChange={handleSort}
            className="w-full"
            onSelectionChange={setSelectedRows}
            selectedKeys={selectedRows}
            bottomContent={
              pages > 1 && (
                <div className="flex justify-between items-center w-full px-2 py-2">
                  <div className="text-sm text-gray-500">
                    {showingRecordsText}
                  </div>
                  <Pagination
                    showControls
                    color="primary"
                    page={page}
                    total={pages}
                    onChange={(page) => setPage(page)}
                    className="flex justify-center"
                  />
                </div>
              )
            }
            classNames={{
              th: "bg-gray-50",
              td: "py-3",
            }}
            isHeaderSticky
          >
            <TableHeader>
              <TableColumn key="name" className="text-left" allowsSorting>
                <span>Name</span>
              </TableColumn>
              <TableColumn key="email" className="text-left" allowsSorting>
                Email
              </TableColumn>
              <TableColumn
                key="receivedOn"
                className="text-right"
                allowsSorting
              >
                Received On
              </TableColumn>
              <TableColumn key="status" className="text-left" allowsSorting>
                Status
              </TableColumn>
              <TableColumn key="actions" className="text-center">
                Actions
              </TableColumn>
            </TableHeader>
            <TableBody>
              {currentPageItems.length > 0 ? (
                currentPageItems.map((row) => {
                  // Get the status based on whether we're in historical or active mode
                  const status = readOnly
                    ? getHistoricalStatus(row)
                    : row.appliedDrives.find((ap) => ap.drive === drive?._id)
                        ?.status || "applied";

                  return (
                    <TableRow
                      key={row._id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <TableCell className="font-medium text-gray-900">
                        {row.name}
                      </TableCell>
                      <TableCell className="text-gray-600">
                        {row.email}
                      </TableCell>
                      <TableCell className="text-right text-gray-600">
                        {new Date(
                          row.createdAt || Date.now()
                        ).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          {getStatusIcon(status)}
                          <span
                            className={`
                            px-2 py-1 rounded-full text-xs font-medium capitalize
                            ${getStatusColor(status)}
                          `}
                          >
                            {status}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Dropdown>
                          <DropdownTrigger>
                            <Button
                              variant="light"
                              size="sm"
                              isIconOnly
                              className="hover:bg-gray-100"
                            >
                              <IconMenu2 size={16} />
                            </Button>
                          </DropdownTrigger>
                          <DropdownMenu>
                            <DropdownItem
                              key="viewProfile"
                              onPress={() => viewCandidateProfile(row._id!)}
                              startContent={<User size={16} />}
                              className="text-gray-600 hover:bg-gray-50"
                            >
                              View Profile
                            </DropdownItem>

                            {!readOnly && status !== "inprogress" ? (
                              <DropdownItem
                                key="qualify"
                                onPress={() => selectCand(row._id!)}
                                startContent={<UserCheck size={16} />}
                                className="text-blue-600 hover:bg-blue-50"
                              >
                                Mark as In Progress
                              </DropdownItem>
                            ) : null}

                            {!readOnly && status !== "rejected" ? (
                              <DropdownItem
                                key="disqualify"
                                onPress={() => disqualify(row._id!)}
                                startContent={<UserX size={16} />}
                                className="text-red-600 hover:bg-red-50"
                              >
                                Disqualify Candidate
                              </DropdownItem>
                            ) : null}

                            {row.resumeUrl ? (
                              <DropdownItem
                                key="download"
                                onPress={() => downloadResume(row._id!)}
                                startContent={<Download size={16} />}
                                className="text-blue-600 hover:bg-blue-50"
                              >
                                Download Resume
                              </DropdownItem>
                            ) : null}
                          </DropdownMenu>
                        </Dropdown>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : filterValue ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10">
                    <div className="flex flex-col items-center justify-center text-gray-500">
                      <Search className="h-8 w-8 mb-2" />
                      <p>No candidates found matching "{filterValue}"</p>
                      <Button
                        variant="light"
                        onClick={() => setFilterValue("")}
                        className="mt-2"
                      >
                        Clear Search
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-10">
                    <div className="flex flex-col items-center justify-center text-gray-500">
                      <p>No candidates available in this category</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </Card>
  );
};

export default DataTable;
