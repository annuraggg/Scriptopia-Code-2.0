"use client";

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
  ArrowUpDown,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  Search,
  UserMinusIcon,
  X,
} from "lucide-react";
import {
  Button,
  Checkbox,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Tooltip,
  useDisclosure,
} from "@nextui-org/react";
import { useMemo, useState } from "react";
import ax from "@/config/axios";
import { toast } from "sonner";
import { useAuth } from "@/auth";
import { Candidate } from "@shared-types/Candidate";
import { StatusPill } from "@/components/campus/StatusPill";
import { EmptyState } from "@/components/campus/EmptyState";

interface DataTableProps<TData extends Candidate> {
  data: TData[];
  type: "pending" | "active";
  setData: React.Dispatch<React.SetStateAction<TData[]>>;
  onDataChange?: () => void;
}

export function DataTable<TData extends Candidate>({
  data = [],
  type,
  setData,
  onDataChange,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedCandidate, setSelectedCandidate] = useState<TData | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const {
    isOpen: isAcceptModalOpen,
    onOpen: onOpenAcceptModal,
    onClose: onCloseAcceptModal,
  } = useDisclosure();
  const {
    isOpen: isRejectModalOpen,
    onOpen: onOpenRejectModal,
    onClose: onCloseRejectModal,
  } = useDisclosure();
  const {
    isOpen: isRemoveModalOpen,
    onOpen: onOpenRemoveModal,
    onClose: onCloseRemoveModal,
  } = useDisclosure();

  const { getToken } = useAuth();
  const axios = ax(getToken);

  const handleAcceptCandidate = (id: string) => {
    setIsAccepting(true);
    axios
      .post(`/institutes/candidate/${id}/accept`)
      .then(() => {
        toast.success("Candidate accepted");
        setData((prev) => prev.filter((candidate) => candidate._id !== id));
        onDataChange?.();
        onCloseAcceptModal();
      })
      .catch((err) => {
        console.error(err);
        toast.error(err.response?.data?.message || "An error occurred");
      })
      .finally(() => setIsAccepting(false));
  };

  const handleRejectCandidate = (id: string) => {
    setIsRejecting(true);
    axios
      .post(`/institutes/candidate/${id}/reject`)
      .then(() => {
        toast.success("Candidate rejected");
        setData((prev) => prev.filter((candidate) => candidate._id !== id));
        onDataChange?.();
        onCloseRejectModal();
      })
      .catch((err) => {
        console.error(err);
        toast.error(err.response?.data?.message || "An error occurred");
      })
      .finally(() => setIsRejecting(false));
  };

  const handleRemoveCandidate = (id: string) => {
    setIsRemoving(true);
    axios
      .post(`/institutes/candidate/${id}/remove`)
      .then(() => {
        toast.success("Candidate removed");
        setData((prev) => prev.filter((candidate) => candidate._id !== id));
        onDataChange?.();
        onCloseRemoveModal();
      })
      .catch((err) => {
        console.error(err);
        toast.error(err.response?.data?.message || "An error occurred");
      })
      .finally(() => setIsRemoving(false));
  };

  const columns = useMemo<ColumnDef<TData>[]>(
    () => [
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
        accessorKey: "instituteUid",
        header: ({ column }) => (
          <Button
            size="sm"
            variant="light"
            onPress={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Unique ID
            <ArrowUpDown className="h-3.5 w-3.5" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-slate-600">
            {row.original.instituteUid || "Unassigned"}
          </span>
        ),
      },
      {
        accessorKey: "name",
        header: ({ column }) => (
          <Button
            size="sm"
            variant="light"
            onPress={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Candidate
            <ArrowUpDown className="h-3.5 w-3.5" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-950">
              {row.original.name || "Unnamed candidate"}
            </p>
            <p className="truncate text-xs text-slate-500">
              {row.original.email}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "email",
        header: ({ column }) => (
          <Button
            size="sm"
            variant="light"
            onPress={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Email
            <ArrowUpDown className="h-3.5 w-3.5" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="text-sm text-slate-600">{row.original.email}</span>
        ),
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <Button
            size="sm"
            variant="light"
            onPress={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Created
            <ArrowUpDown className="h-3.5 w-3.5" />
          </Button>
        ),
        cell: ({ row }) =>
          row.original.createdAt
            ? new Date(row.original.createdAt).toLocaleDateString()
            : "N/A",
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <StatusPill tone={type === "pending" ? "warning" : "success"}>
            {type === "pending"
              ? "Pending"
              : ((row.original as Candidate & { status?: string }).status ||
                  "Active")}
          </StatusPill>
        ),
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            {type === "pending" && (
              <Tooltip content="Accept candidate">
                <Button
                  isIconOnly
                  size="sm"
                  variant="flat"
                  color="success"
                  onPress={() => {
                    setSelectedCandidate(row.original);
                    onOpenAcceptModal();
                  }}
                  aria-label="Accept candidate"
                >
                  <Check className="h-4 w-4" />
                </Button>
              </Tooltip>
            )}

            <Tooltip content="View profile">
              <Button
                isIconOnly
                size="sm"
                variant="flat"
                onPress={() => window.open(`/c/${row.original._id}`)}
                aria-label="View profile"
              >
                <Eye className="h-4 w-4" />
              </Button>
            </Tooltip>

            {type === "pending" && (
              <Tooltip content="Reject candidate">
                <Button
                  isIconOnly
                  size="sm"
                  variant="flat"
                  color="danger"
                  onPress={() => {
                    setSelectedCandidate(row.original);
                    onOpenRejectModal();
                  }}
                  aria-label="Reject candidate"
                >
                  <X className="h-4 w-4" />
                </Button>
              </Tooltip>
            )}

            {type === "active" && (
              <Tooltip content="Remove from campus">
                <Button
                  isIconOnly
                  size="sm"
                  variant="flat"
                  color="danger"
                  onPress={() => {
                    setSelectedCandidate(row.original);
                    onOpenRemoveModal();
                  }}
                  aria-label="Remove from campus"
                >
                  <UserMinusIcon className="h-4 w-4" />
                </Button>
              </Tooltip>
            )}
          </div>
        ),
      },
    ],
    [onOpenAcceptModal, onOpenRejectModal, onOpenRemoveModal, type]
  );

  const table = useReactTable({
    data,
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
      pagination: { pageSize: 10, pageIndex },
    },
  });

  const selectedRows = table.getSelectedRowModel().rows.length;

  return (
    <>
      <div className="campus-table">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-3 md:flex-row md:items-center md:justify-between">
          <Input
            aria-label="Filter candidates by email"
            placeholder="Search by email"
            value={(table.getColumn("email")?.getFilterValue() as string) ?? ""}
            onChange={(event) =>
              table.getColumn("email")?.setFilterValue(event.target.value)
            }
            startContent={<Search size={18} className="text-slate-400" />}
            className="md:max-w-sm"
          />
          <div className="flex items-center justify-between gap-3 md:justify-end">
            {selectedRows > 0 && (
              <span className="text-sm text-slate-500">
                {selectedRows} selected
              </span>
            )}
            <div className="flex items-center gap-2">
              <Button
                onPress={() => setPageIndex(pageIndex - 1)}
                isDisabled={!table.getCanPreviousPage()}
                isIconOnly
                variant="flat"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-20 text-center text-sm text-slate-500">
                Page {pageIndex + 1}
              </span>
              <Button
                onPress={() => setPageIndex(pageIndex + 1)}
                isDisabled={!table.getCanNextPage()}
                isIconOnly
                variant="flat"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <Table>
          <TableHeader className="bg-slate-50">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="px-4 py-3 text-xs">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className="hover:bg-slate-50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="p-0">
                  <EmptyState
                    icon={<Search className="h-5 w-5" />}
                    title="No candidates found"
                    description="Try a different email search or refresh the candidate list."
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Modal isOpen={isAcceptModalOpen} onClose={onCloseAcceptModal}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                Accept candidate
              </ModalHeader>
              <ModalBody>
                <p className="text-sm leading-6 text-slate-600">
                  Accept <strong>{selectedCandidate?.name}</strong> into this
                  institute workspace?
                </p>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose} isDisabled={isAccepting}>
                  Cancel
                </Button>
                <Button
                  color="success"
                  isLoading={isAccepting}
                  onPress={() => handleAcceptCandidate(selectedCandidate?._id || "")}
                >
                  Accept
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      <Modal isOpen={isRejectModalOpen} onClose={onCloseRejectModal}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                Reject candidate
              </ModalHeader>
              <ModalBody>
                <p className="text-sm leading-6 text-slate-600">
                  Reject <strong>{selectedCandidate?.name}</strong>? They will
                  not gain access to this institute.
                </p>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose} isDisabled={isRejecting}>
                  Cancel
                </Button>
                <Button
                  color="danger"
                  isLoading={isRejecting}
                  onPress={() => handleRejectCandidate(selectedCandidate?._id || "")}
                >
                  Reject
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      <Modal isOpen={isRemoveModalOpen} onClose={onCloseRemoveModal}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                Remove candidate
              </ModalHeader>
              <ModalBody>
                <p className="text-sm leading-6 text-slate-600">
                  Remove <strong>{selectedCandidate?.name}</strong> from this
                  campus workspace?
                </p>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose} isDisabled={isRemoving}>
                  Cancel
                </Button>
                <Button
                  color="danger"
                  isLoading={isRemoving}
                  onPress={() => handleRemoveCandidate(selectedCandidate?._id || "")}
                >
                  Remove
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
