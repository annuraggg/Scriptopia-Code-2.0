import { useEffect, useMemo, useState } from "react";
import {
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
} from "@heroui/dropdown";
import {
  Selection,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/table";
import { Eye, UserCheck, UserX, Users } from "lucide-react";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { useAuth } from "@/auth";
import ax from "@/config/axios";
import { toast } from "sonner";
import { IconChevronDown, IconMenu2 } from "@tabler/icons-react";
import { Pagination } from "@heroui/pagination";
import { MCQAssessment } from "@shared-types/MCQAssessment";
import {
  MCQAssessmentSubmission,
  Offense,
} from "@shared-types/MCQAssessmentSubmission";
import { useNavigate, useOutletContext } from "react-router-dom";
import { ExtendedDrive } from "@shared-types/ExtendedDrive";

export interface CandidateSubmissionTable {
  _id: string;
  submissionId: string;
  candidate: string;
  email: string;
  status: string;
  driveStatus: string;
  score: number;
  time: string;
  cheating: boolean;
  submitted: string;
}

interface DataTableProps {
  assessment: MCQAssessment;
  submissions: MCQAssessmentSubmission[];
}

const rowsPerPage = 7;

const McqAssessmentResultsTable = ({
  assessment,
  submissions: vanillaData,
}: DataTableProps) => {
  const navigate = useNavigate();
  const [selectedRows, setSelectedRows] = useState<Selection>(
    new Set<string>()
  );
  const [page, setPage] = useState(1);
  const [data, setData] = useState<CandidateSubmissionTable[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  const { drive } = useOutletContext() as { drive: ExtendedDrive };

  const isCheating = (offenses: Offense | null): boolean => {
    if (!offenses) {
      return false;
    }

    const totalTabChanges = offenses.tabChange || 0;
    const totalCopyPastes = offenses.copyPaste || 0;

    return totalTabChanges > 5 || totalCopyPastes > 3;
  };

  // Transform submissions to match the table interface
  useEffect(() => {
    const transformedData: CandidateSubmissionTable[] = vanillaData.map(
      (submission) => ({
        submissionId: submission._id!,
        _id: drive?.candidates.find((c) => c.email === submission.email)
          ?._id!,
        candidate: submission.name,
        email: submission.email,
        status: submission.status!,
        driveStatus: drive?.candidates
          .find((c) => c.email === submission.email)
          ?.appliedDrives.find(
            (ap) => (ap.drive as unknown as string) === drive._id
          )?.status!,
        score:
          ((submission.obtainedGrades?.total || 0) /
            assessment.obtainableScore) *
          100,
        time: new Date(submission.createdAt!).toLocaleString(),
        cheating: isCheating(submission.offenses!),
        submitted: new Date(submission.createdAt!).toLocaleDateString(),
      })
    );

    setData(transformedData);
  }, [vanillaData]);

  const { getToken } = useAuth();
  const axios = ax(getToken);

  // Filtering logic
  const filteredData = useMemo(() => {
    return data.filter(
      (item) =>
        item.candidate.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.status.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [data, searchTerm]);

  // Pagination logic
  const pages = Math.ceil(filteredData.length / rowsPerPage);
  const items = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;

    return filteredData.slice(start, end);
  }, [page, filteredData]);

  const viewSubmission = (_id: string) => {
    navigate(_id);
  };

  const qualifySubmission = (_id: string) => {
    const newData = [...data] as CandidateSubmissionTable[];
    const index = newData.findIndex((c) => c._id === _id);
    newData[index].driveStatus = "qualified";
    setData(newData);

    axios
      .put("drives/candidate/qualify", {
        _id: _id,
        driveId: drive?._id,
      })
      .catch((err) => {
        toast.error(
          err.response.data.message || "Failed to qualify submission"
        );
        console.error(err);

        const revertedData = [...data] as CandidateSubmissionTable[];
        const index = revertedData.findIndex((c) => c._id === _id);
        revertedData[index].status = "pending";
        setData(revertedData);
      });
  };

  const disqualifySubmission = (_id: string) => {
    const newData = [...data] as CandidateSubmissionTable[];
    const index = newData.findIndex((c) => c._id === _id);
    newData[index].driveStatus = "rejected";
    setData(newData);

    axios
      .put("drives/candidate/disqualify", {
        _id: _id,
        driveId: drive?._id,
      })
      .catch((err) => {
        toast.error(
          err.response.data.message || "Failed to disqualify submission"
        );
        console.error(err);

        const revertedData = [...data] as CandidateSubmissionTable[];
        const index = revertedData.findIndex((c) => c._id === _id);
        revertedData[index].status = "pending";
        setData(revertedData);
      });
  };

  const qualifyAllSelected = () => {
    const selectedIds = Array.from(selectedRows);

    // Optimistically update the state
    const newData = [...data] as CandidateSubmissionTable[];
    selectedIds.forEach((id) => {
      const index = newData.findIndex((c) => c._id === id);
      if (index !== -1) {
        newData[index].driveStatus = "inprogress";
      }
    });
    setData(newData);

    axios
      .put("drives/candidate/qualify/bulk", {
        candidateIds: selectedIds,
        driveId: drive?._id,
      })
      .then(() => {
        toast.success("Selected submissions qualified successfully");
      })
      .catch((err) => {
        toast.error(
          err.response.data.message || "Failed to qualify selected submissions"
        );
        console.error(err);

        // Revert the optimistic update if the API call fails
        const revertedData = [...data] as CandidateSubmissionTable[];
        selectedIds.forEach((id) => {
          const index = revertedData.findIndex((c) => c._id === id);
          if (index !== -1) {
            revertedData[index].status = "pending";
          }
        });
        setData(revertedData);
      });
  };

  const disqualifyAllSelected = () => {
    const selectedIds = Array.from(selectedRows);

    // Optimistically update the state
    const newData = [...data] as CandidateSubmissionTable[];
    selectedIds.forEach((id) => {
      const index = newData.findIndex((c) => c._id === id);
      if (index !== -1) {
        newData[index].driveStatus = "disqualified";
      }
    });
    setData(newData);

    axios
      .put("drives/candidate/disqualify/bulk", {
        candidateIds: selectedIds,
        driveId: drive?._id,
      })
      .then(() => {
        toast.success("Selected submissions disqualified successfully");
      })
      .catch((err) => {
        toast.error(
          err.response.data.message ||
            "Failed to disqualify selected submissions"
        );
        console.error(err);

        // Revert the optimistic update if the API call fails
        const revertedData = [...data] as CandidateSubmissionTable[];
        selectedIds.forEach((id) => {
          const index = revertedData.findIndex((c) => c._id === id);
          if (index !== -1) {
            revertedData[index].status = "pending";
          }
        });
        setData(revertedData);
      });
  };

  const selectAllAboveThreshold = () => {
    const threshold = assessment?.passingPercentage || 0;
    const newData = [...data] as CandidateSubmissionTable[];
    const newSelect = new Set(selectedRows);
    newData.forEach((c) => {
      if (c.score >= threshold) {
        newSelect.add(c._id);
      }
    });
    setSelectedRows(newSelect);
  };

  return (
    <div>
      <div className="flex items-center gap-5 flex-wrap mb-4">
        <Input
          placeholder="Filter candidates..."
          className="max-w-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <Dropdown>
          <DropdownTrigger>
            <Button endContent={<IconChevronDown size={20} />}>
              Bulk Actions
            </Button>
          </DropdownTrigger>
          <DropdownMenu aria-label="Static Actions">
            <DropdownItem key="qualify" onPress={qualifyAllSelected}>
              Qualify Selected
            </DropdownItem>
            <DropdownItem key="disqualify" onPress={disqualifyAllSelected}>
              Disqualify Selected
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>

        <Button onPress={selectAllAboveThreshold}>
          <Users className="mr-2 h-4 w-4" />
          Select All Above {assessment?.passingPercentage || 0}%
        </Button>
      </div>

      <Table
        selectionMode="multiple"
        color="secondary"
        onSelectionChange={setSelectedRows}
        selectedKeys={selectedRows}
        bottomContent={
          <div className="flex w-full justify-center">
            <Pagination
              isCompact
              showControls
              showShadow
              color="secondary"
              page={page}
              total={pages}
              onChange={(page) => setPage(page)}
            />
          </div>
        }
      >
        <TableHeader>
          <TableColumn>Candidate</TableColumn>
          <TableColumn>Status</TableColumn>
          <TableColumn>Drive Status</TableColumn>
          <TableColumn>Score</TableColumn>
          <TableColumn>Time</TableColumn>
          <TableColumn>Cheating</TableColumn>
          <TableColumn>Submitted</TableColumn>
          <TableColumn>Actions</TableColumn>
        </TableHeader>
        <TableBody>
          {items?.map((row) => (
            <TableRow key={row._id} onClick={() => viewSubmission(row.submissionId)}>
              <TableCell>{row.candidate}</TableCell>
              <TableCell>
                {row.status.slice(0, 1).toUpperCase() + row.status.slice(1)}
              </TableCell>
              <TableCell>{row.driveStatus}</TableCell>
              <TableCell>{row.score}%</TableCell>
              <TableCell>{row.time}</TableCell>
              <TableCell>{row.cheating ? "Yes" : "No"}</TableCell>
              <TableCell>{row.submitted}</TableCell>
              <TableCell>
                <Dropdown>
                  <DropdownTrigger>
                    <Button variant="light" isIconOnly>
                      <IconMenu2 size={18} />
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu aria-label="Submission Actions">
                    <DropdownItem
                      key="view"
                      onPress={() => viewSubmission(row.submissionId)}
                      startContent={<Eye size={16} className="mr-2" />}
                    >
                      View Submission
                    </DropdownItem>
                    {row.driveStatus === "rejected" ? (
                      <DropdownItem
                        key="qualify"
                        onPress={() => qualifySubmission(row._id)}
                        startContent={<UserCheck size={16} className="mr-2" />}
                        className={row.status === "qualified" ? "hidden" : ""}
                      >
                        Qualify Candidate
                      </DropdownItem>
                    ) : null}

                    {row.driveStatus === "inprogress" ? (
                      <DropdownItem
                        key="disqualify"
                        onPress={() => disqualifySubmission(row._id)}
                        startContent={<UserX size={16} className="mr-2" />}
                        className={
                          row.status === "disqualified" ? "hidden" : ""
                        }
                      >
                        Disqualify Candidate
                      </DropdownItem>
                    ) : null}
                  </DropdownMenu>
                </Dropdown>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default McqAssessmentResultsTable;
