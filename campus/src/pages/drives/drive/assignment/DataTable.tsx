"use client";

import { useState, useEffect } from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/dropdown";
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import { Button } from "@heroui/button";
import { Checkbox } from "@heroui/checkbox";
import { Input } from "@heroui/input";
import { Badge } from "@heroui/badge";
import { NumberInput } from "@heroui/number-input";
import AssignmentSubmissionVanilla from "@shared-types/AssignmentSubmission";
import { IconChevronDown, IconMenu2 } from "@tabler/icons-react";
import { toast } from "sonner";
import { useAuth } from "@/auth";
import ax from "@/config/axios";

interface AssignmentSubmission extends AssignmentSubmissionVanilla {
  grade?: number;
  candidate: {
    _id: string;
    userId: string;
    name: string;
    email: string;
    status: string;
  };
}

interface DataTableProps {
  data: AssignmentSubmission[];
  driveId: string;
  assignmentId: string;
  onGradeSubmission: (submission: AssignmentSubmission, grade: number) => void;
  onViewSubmission?: (submission: AssignmentSubmission) => void;
}

export default function DataTable({
  data,
  driveId,
  onGradeSubmission,
  onViewSubmission,
}: DataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [processedData, setProcessedData] = useState<any[]>([]);
  const [gradeInputs, setGradeInputs] = useState<Record<string, string>>({});
  const { getToken } = useAuth();
  const axios = ax(getToken);

  useEffect(() => {
    // Process the data to match the table structure
    const processed = data.map((submission) => {
      return {
        id: submission._id,
        userId: submission.candidate?.userId,
        candidateId: submission.candidate?._id,
        name: submission.candidate?.name,
        email: submission.candidate?.email,
        received: submission.createdAt
          ? new Date(submission.createdAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "Unknown",
        submissionType: getSubmissionType(submission),
        grade: submission.grade !== undefined ? submission.grade : null,
        status: submission.candidate?.status,
        rawSubmission: submission, // Keep the original data for reference
      };
    });
    setProcessedData(processed);

    // Initialize grade inputs with current values
    const initialGradeInputs: Record<string, string> = {};
    processed.forEach((item) => {
      if (item.id) {
        initialGradeInputs[item.id] =
          item.grade !== null ? item.grade.toString() : "";
      }
    });
    setGradeInputs(initialGradeInputs);
  }, [data]);

  // Helper function to determine submission type
  const getSubmissionType = (submission: AssignmentSubmission) => {
    if (submission.fileSubmission) return "file";
    if (submission.textSubmission) return "text";
    if (submission.linkSubmission) return "link";
    return "unknown";
  };

  // Handler for grading a submission
  const handleGradeSubmission = (
    submission: AssignmentSubmission,
    id: string
  ) => {
    const gradeValue = parseInt(gradeInputs[id] || "0", 10);
    if (isNaN(gradeValue) || gradeValue < 0 || gradeValue > 100) {
      return;
    }

    if (onGradeSubmission) {
      onGradeSubmission(submission, gradeValue);
    } else {
      console.log("Grade submission:", submission, gradeValue);
      // Update the local state for immediate feedback
      setProcessedData((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, grade: gradeValue } : item
        )
      );
    }
  };

  // Handler for viewing a submission
  const handleViewSubmission = (submission: AssignmentSubmission) => {
    if (onViewSubmission) {
      onViewSubmission(submission);
    } else {
      console.log("View submission:", submission);
    }
  };

  // Handle grade input change
  const handleGradeInputChange = (id: string, value: string) => {
    setGradeInputs((prev) => ({ ...prev, [id]: value }));
  };

  // Single candidate qualification
  const selectCand = (candidateId: string) => {
    const newData = [...processedData];
    const index = newData.findIndex((c) => c.userId === candidateId);
    if (index !== -1) {
      newData[index].status = "inprogress";
      setProcessedData(newData);
    }

    axios
      .put("drives/candidate/qualify", {
        _id: candidateId,
        driveId: driveId,
      })
      .then(() => {
        toast.success("Candidate qualified successfully");
      })
      .catch((err) => {
        toast.error(
          err.response?.data?.message || "Failed to qualify candidate"
        );
        console.error(err);

        const revertData = [...processedData];
        const revertIndex = revertData.findIndex(
          (c) => c.userId === candidateId
        );
        if (revertIndex !== -1) {
          revertData[revertIndex].status = "pending";
          setProcessedData(revertData);
        }
      });
  };

  // Single candidate disqualification
  const disqualify = (candidateId: string) => {
    const newData = [...processedData];
    const index = newData.findIndex((c) => c.userId === candidateId);
    if (index !== -1) {
      newData[index].status = "rejected";
      setProcessedData(newData);
    }

    axios
      .put("drives/candidate/disqualify", {
        _id: candidateId,
        driveId: driveId,
      })
      .then(() => {
        toast.success("Candidate disqualified successfully");
      })
      .catch((err) => {
        toast.error(
          err.response?.data?.message || "Failed to disqualify candidate"
        );
        console.error(err);

        const revertData = [...processedData];
        const revertIndex = revertData.findIndex(
          (c) => c.userId === candidateId
        );
        if (revertIndex !== -1) {
          revertData[revertIndex].status = "pending";
          setProcessedData(revertData);
        }
      });
  };

  // Bulk qualification
  const qualifyAllSelected = () => {
    const selectedRows = table.getFilteredSelectedRowModel().rows;
    const selectedIds = selectedRows.map((row) => row.original.candidateId);

    if (selectedIds.length === 0) {
      toast.warning("No candidates selected");
      return;
    }

    const newData = [...processedData];
    selectedIds.forEach((id) => {
      const index = newData.findIndex((c) => c.userId === id);
      if (index !== -1) {
        newData[index].status = "inprogress";
      }
    });
    setProcessedData(newData);

    axios
      .put("drives/candidate/qualify/bulk", {
        candidateIds: selectedIds,
        driveId: driveId,
      })
      .then(() => {
        toast.success("Selected candidates qualified successfully");
      })
      .catch((err) => {
        toast.error(
          err.response?.data?.message || "Failed to qualify selected candidates"
        );
        console.error(err);

        const revertedData = [...processedData];
        selectedIds.forEach((id) => {
          const index = revertedData.findIndex((c) => c.userId === id);
          if (index !== -1) {
            revertedData[index].status = "pending";
          }
        });
        setProcessedData(revertedData);
      });
  };

  // Bulk disqualification
  const disqualifyAllSelected = () => {
    const selectedRows = table.getFilteredSelectedRowModel().rows;
    const selectedIds = selectedRows.map((row) => row.original.candidateId);

    if (selectedIds.length === 0) {
      toast.warning("No candidates selected");
      return;
    }

    const newData = [...processedData];
    selectedIds.forEach((id) => {
      const index = newData.findIndex((c) => c.userId === id);
      if (index !== -1) {
        newData[index].status = "rejected";
      }
    });
    setProcessedData(newData);

    axios
      .put("drives/candidate/disqualify/bulk", {
        candidateIds: selectedIds,
        driveId: driveId,
      })
      .then(() => {
        toast.success("Selected candidates disqualified successfully");
      })
      .catch((err) => {
        toast.error(
          err.response?.data?.message ||
            "Failed to disqualify selected candidates"
        );
        console.error(err);

        const revertedData = [...processedData];
        selectedIds.forEach((id) => {
          const index = revertedData.findIndex((c) => c.userId === id);
          if (index !== -1) {
            revertedData[index].status = "pending";
          }
        });
        setProcessedData(revertedData);
      });
  };

  // Select candidates with grade above threshold
  const selectAllAboveThreshold = (threshold: number = 70) => {
    const eligibleRows = processedData.filter(
      (row) => row.grade !== null && row.grade >= threshold
    );

    if (eligibleRows.length === 0) {
      toast.info("No candidates with grades above threshold");
      return;
    }

    const eligibleIds = new Set(eligibleRows.map((row) => row.id));
    table.toggleAllRowsSelected(false); // Clear current selection

    // Select rows with grades above threshold
    table.getRowModel().rows.forEach((row) => {
      if (eligibleIds.has(row.original.id)) {
        row.toggleSelected(true);
      }
    });

    toast.success(
      `Selected ${eligibleIds.size} candidates with grades above ${threshold}%`
    );
  };

  const columns: ColumnDef<any>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          isSelected={
            (table.getIsAllPageRowsSelected() as boolean) ||
            table.getIsSomePageRowsSelected()
          }
          onValueChange={(value) => table.toggleAllPageRowsSelected(value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          isSelected={row.getIsSelected()}
          onValueChange={(value) => row.toggleSelected(value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "name",
      header: ({ column }) => {
        return (
          <Button
            variant="light"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Candidate
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => (
        <div className="font-medium">{row.getValue("name")}</div>
      ),
    },
    {
      accessorKey: "email",
      header: ({ column }) => {
        return (
          <Button
            variant="light"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Email
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
    },
    {
      accessorKey: "status",
      header: ({ column }) => {
        return (
          <Button
            variant="light"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Status
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        const getStatusColor = (status: string) => {
          switch (status) {
            case "inprogress":
              return "bg-blue-100 text-blue-800";
            case "rejected":
              return "bg-red-100 text-red-800";
            default:
              return "bg-gray-100 text-gray-800";
          }
        };

        return (
          <span
            className={`
              px-2 py-1 rounded-full text-xs font-medium capitalize
              ${getStatusColor(status)}
            `}
          >
            {status}
          </span>
        );
      },
    },
    {
      accessorKey: "received",
      header: ({ column }) => {
        return (
          <Button
            variant="light"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Submitted On
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        );
      },
    },
    {
      id: "view",
      header: "View",
      cell: ({ row }) => {
        const submission = row.original.rawSubmission;

        return (
          <Button
            isIconOnly
            variant="light"
            className="h-8 w-8 p-0 text-blue-500"
            onClick={() => handleViewSubmission(submission)}
            aria-label="View submission"
          >
            <Eye className="h-4 w-4" />
          </Button>
        );
      },
    },
    {
      id: "direct-grading",
      header: "Grade Input",
      cell: ({ row }) => {
        const submission = row.original.rawSubmission;
        const id = row.original.id;

        return (
          <div className="flex items-center space-x-1">
            <NumberInput
              minValue={0}
              size="sm"
              maxValue={100}
              placeholder="0-100"
              className="w-24"
              value={Number(gradeInputs[id] || 0)}
              onValueChange={(e) => handleGradeInputChange(id, e.toString())}
              aria-label="Enter grade"
              onBlur={() => handleGradeSubmission(submission, id)}
            />
          </div>
        );
      },
    },
    {
      id: "actions",
      header: "More",
      cell: ({ row }) => {
        const candidateId = row.original.userId;
        const status = row.original.status;

        return (
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
              {status !== "inprogress" ? (
                <DropdownItem
                  key="qualify"
                  onPress={() => selectCand(candidateId)}
                  startContent={<UserCheck size={16} />}
                  className="text-green-600 hover:bg-green-50"
                >
                  Qualify Candidate
                </DropdownItem>
              ) : null}
              {status !== "rejected" ? (
                <DropdownItem
                  key="disqualify"
                  onPress={() => disqualify(candidateId)}
                  startContent={<UserX size={16} />}
                  className="text-red-600 hover:bg-red-50"
                >
                  Disqualify Candidate
                </DropdownItem>
              ) : null}
            </DropdownMenu>
          </Dropdown>
        );
      },
    },
  ];

  const table = useReactTable({
    data: processedData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: {
      sorting,
      columnFilters,
      pagination: { pageSize: 10, pageIndex: pageIndex },
    },
  });

  return (
    <div className="rounded-md">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-500">
            {table.getFilteredRowModel().rows.length} submissions
          </span>
          <Badge color="default">
            {table.getFilteredSelectedRowModel().rows.length} selected
          </Badge>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <Input
            placeholder="Filter by email..."
            value={(table.getColumn("email")?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              table.getColumn("email")?.setFilterValue(event.target.value)
            }
            className="w-full sm:max-w-xs"
            startContent={
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            }
          />

          <div className="flex items-center gap-2">
            <Dropdown>
              <DropdownTrigger>
                <Button variant="bordered" className="flex items-center gap-2">
                  Bulk Actions <IconChevronDown size={16} />
                </Button>
              </DropdownTrigger>
              <DropdownMenu>
                <DropdownItem
                  key="qualify"
                  onPress={qualifyAllSelected}
                  className="text-green-600 hover:bg-green-50"
                >
                  Qualify Selected
                </DropdownItem>
                <DropdownItem
                  key="disqualify"
                  onPress={disqualifyAllSelected}
                  className="text-red-600 hover:bg-red-50"
                >
                  Disqualify Selected
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>

            <Button
              variant="bordered"
              onPress={() => selectAllAboveThreshold(70)}
              className="flex items-center gap-2"
            >
              <Users size={16} />
              Select Above 70%
            </Button>
          </div>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden bg-white h-full">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id} className="bg-gray-50">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="hover:bg-gray-50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No submissions found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4 text-sm text-gray-500 flex justify-between items-center">
        <div>
          Showing {table.getRowModel().rows.length} of {processedData.length}{" "}
          submissions
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={() => setPageIndex(pageIndex - 1)}
            isDisabled={!table.getCanPreviousPage()}
            isIconOnly
            aria-label="Previous page"
            variant="light"
          >
            <ChevronLeft size={16} />
          </Button>
          <span className="text-sm text-gray-600 min-w-20">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount()}
          </span>
          <Button
            onClick={() => setPageIndex(pageIndex + 1)}
            isDisabled={!table.getCanNextPage()}
            isIconOnly
            aria-label="Next page"
            variant="light"
          >
            <ChevronRight size={16} />
          </Button>
          <span>Rows per page:</span>
          <select
            value={table.getState().pagination.pageSize}
            onChange={(e) => {
              table.setPageSize(Number(e.target.value));
            }}
            className="px-2 py-1 rounded border border-gray-300"
          >
            {[10, 20, 30, 40, 50].map((pageSize) => (
              <option key={pageSize} value={pageSize}>
                {pageSize}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
