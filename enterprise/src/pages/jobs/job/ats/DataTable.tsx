import React, { useEffect, useMemo } from "react";
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
import { Download, UserCheck, UserX, Users } from "lucide-react";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { useState } from "react";
import { useAuth } from "@/auth";
import ax from "@/config/axios";
import { toast } from "sonner";
import { useOutletContext } from "react-router-dom";
import { Posting } from "@shared-types/Posting";
import { IconChevronDown, IconMenu2 } from "@tabler/icons-react";
import { Pagination } from "@heroui/pagination";

export interface CandidateTable {
  _id: string;
  name: string;
  email: string;
  received: string;
  match: string;
  status: string;
}

interface DataTableProps {
  data: CandidateTable[];
  setData: React.Dispatch<React.SetStateAction<CandidateTable[]>>;
}

const rowsPerPage = 7;

const DataTableNew = ({ data: vanillaData }: DataTableProps) => {
  const [selectedRows, setSelectedRows] = useState<Selection>(
    new Set<string>()
  );
  const [page, setPage] = useState(1);
  const [data, setData] = useState<CandidateTable[]>([]);

  useEffect(() => {
    setData(vanillaData);
  }, [vanillaData]);

  const pages = Math.ceil(data.length / rowsPerPage);
  const { getToken } = useAuth();
  const axios = ax(getToken);
  const { posting } = useOutletContext() as { posting: Posting };

  const items = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;

    return data.slice(start, end);
  }, [page, data]);

  const downloadResume = (_id: string) => {
    axios
      .get(`postings/candidate/${_id}/resume`)
      .then((res) => window.open(res.data.data.url, "_blank"))
      .catch((err) => {
        toast.error(err.response.data.message || "Failed to download resume");
        console.error(err);
      });
  };

  const disqualify = (_id: string) => {
    const newData = [...data] as CandidateTable[];
    const index = newData.findIndex((c) => c._id === _id);
    newData[index].status = "rejected";
    setData(newData);

    axios
      .put("postings/candidate/disqualify", {
        _id: _id,
        postingId: posting?._id,
      })
      .catch((err) => {
        toast.error(
          err.response.data.message || "Failed to disqualify candidate"
        );
        console.error(err);

        const newData = [...data] as CandidateTable[];
        const index = newData.findIndex((c) => c._id === _id);
        newData[index].status = "pending";
        setData(newData);
      });
  };

  const selectCand = (_id: string) => {
    const newData = [...data] as CandidateTable[];
    const index = newData.findIndex((c) => c._id === _id);
    newData[index].status = "inprogress";
    setData(newData);

    axios
      .put("postings/candidate/qualify", {
        _id: _id,
        postingId: posting?._id,
      })
      .catch((err) => {
        toast.error(err.response.data.message || "Failed to select candidate");
        console.error(err);

        const newData = [...data] as CandidateTable[];
        const index = newData.findIndex((c) => c._id === _id);
        newData[index].status = "pending";
        setData(newData);
      });
  };

  const disqualifyAllSelected = () => {
    const selectedIds = Array.from(selectedRows);
    const newData = [...data] as CandidateTable[];
    selectedIds.forEach((id) => {
      const index = newData.findIndex((c) => c._id === id);
      if (index !== -1) {
        newData[index].status = "rejected";
      }
    });
    setData(newData);

    axios
      .put("postings/candidate/disqualify/bulk", {
        candidateIds: selectedIds,
        postingId: posting?._id,
      })
      .then(() => {
        toast.success("Selected candidates disqualified successfully");
      })
      .catch((err) => {
        toast.error(
          err.response.data.message ||
            "Failed to disqualify selected candidates"
        );
        console.error(err);

        const revertedData = [...data] as CandidateTable[];
        selectedIds.forEach((id) => {
          const index = revertedData.findIndex((c) => c._id === id);
          if (index !== -1) {
            revertedData[index].status = "pending";
          }
        });
        setData(revertedData);
      });
  };

  const qualifyAllSelected = () => {
    const selectedIds = Array.from(selectedRows);

    const newData = [...data] as CandidateTable[];
    selectedIds.forEach((id) => {
      const index = newData.findIndex((c) => c._id === id);
      if (index !== -1) {
        newData[index].status = "inprogress";
      }
    });
    setData(newData);

    axios
      .put("postings/candidate/qualify/bulk", {
        candidateIds: selectedIds,
        postingId: posting?._id,
      })
      .then(() => {
        toast.success("Selected candidates qualified successfully");
      })
      .catch((err) => {
        toast.error(
          err.response.data.message || "Failed to qualify selected candidates"
        );
        console.error(err);

        const revertedData = [...data] as CandidateTable[];
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
    const threshold = posting?.ats?.minimumScore || 0;
    const newData = [...data] as CandidateTable[];
    const newSelect = new Set(selectedRows);
    newData.forEach((c) => {
      if (parseInt(c.match) >= threshold) {
        newSelect.add(c._id);
      }
    });
    setSelectedRows(newSelect);
  };

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
    <div className="rounded-lg space-y-4">
      <div className="flex items-center justify-between gap-4 mb-5 flex-wrap">
        <Input
          placeholder="Filter by email..."
          className="w-full max-w-xs"
          onChange={(e) => {
            const value = e.target.value;
            if (!value) {
              setData(vanillaData);
              return;
            }
            const newData = vanillaData.filter((d) =>
              d.email.toLowerCase().includes(value.toLowerCase())
            );
            setData(newData);
          }}
        />

        <div className="flex items-center space-x-2">
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
            onPress={selectAllAboveThreshold}
            className="flex items-center gap-2"
          >
            <Users size={16} />
            Select Above {posting?.ats?.minimumScore}%
          </Button>
        </div>
      </div>

      <Table
        selectionMode="multiple"
        removeWrapper
        className="w-full"
        onSelectionChange={setSelectedRows}
        selectedKeys={selectedRows}
        bottomContent={
          <div className="flex justify-center mt-4">
            <Pagination
              isCompact
              showControls
              color="secondary"
              page={page}
              total={pages}
              onChange={(page) => setPage(page)}
            />
          </div>
        }
      >
        <TableHeader>
          <TableColumn className="text-left">Name</TableColumn>
          <TableColumn className="text-left">Email</TableColumn>
          <TableColumn className="text-right">Received On</TableColumn>
          <TableColumn className="text-right">JD Match %</TableColumn>
          <TableColumn className="text-left">Status</TableColumn>
          <TableColumn className="text-center">Actions</TableColumn>
        </TableHeader>
        <TableBody>
          {items?.map((row) => (
            <TableRow
              key={row._id}
              className="hover:bg-gray-50 transition-colors"
            >
              <TableCell className="font-medium text-gray-900">
                {row.name}
              </TableCell>
              <TableCell className="text-gray-600">{row.email}</TableCell>
              <TableCell className="text-right text-gray-600">
                {row.received}
              </TableCell>
              <TableCell className="text-right font-semibold text-gray-800">
                {row.match}%
              </TableCell>
              <TableCell>
                <span
                  className={`
                  px-2 py-1 rounded-full text-xs font-medium capitalize
                  ${getStatusColor(row.status)}
                `}
                >
                  {row.status}
                </span>
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
                    {row.status !== "inprogress" ? (
                      <DropdownItem
                        key="qualify"
                        onPress={() => selectCand(row._id)}
                        startContent={<UserCheck size={16} />}
                        className="text-green-600 hover:bg-green-50"
                      >
                        Qualify Candidate
                      </DropdownItem>
                    ) : null}
                    {row.status !== "rejected" ? (
                      <DropdownItem
                        key="disqualify"
                        onPress={() => disqualify(row._id)}
                        startContent={<UserX size={16} />}
                        className="text-red-600 hover:bg-red-50"
                      >
                        Disqualify Candidate
                      </DropdownItem>
                    ) : null}
                    <DropdownItem
                      key="download"
                      onPress={() => downloadResume(row._id)}
                      startContent={<Download size={16} />}
                      className="text-blue-600 hover:bg-blue-50"
                    >
                      Download Resume
                    </DropdownItem>
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

export default DataTableNew;
