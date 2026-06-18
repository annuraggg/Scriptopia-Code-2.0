import { useNavigate, useOutletContext } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Pagination,
  Select,
  SelectItem,
  Spinner,
  useDisclosure,
} from "@nextui-org/react";
import {
  Archive,
  Copy,
  GraduationCap,
  MoreVertical,
  Plus,
  Search,
  Trash,
  Users,
} from "lucide-react";
import { useAuth } from "@/auth";
import ax from "@/config/axios";
import { PlacementGroup } from "@shared-types/PlacementGroup";
import { Department } from "@shared-types/Institute";
import EditGroupModal from "./EditGroupModal";
import { RootContext } from "@/types/RootContext";
import { toast } from "sonner";
import { PageShell } from "@/components/campus/PageShell";
import { MetricCard } from "@/components/campus/MetricCard";
import { StatusPill } from "@/components/campus/StatusPill";
import { EmptyState } from "@/components/campus/EmptyState";

const PlacementGroups = () => {
  const { institute } = useOutletContext<RootContext>();
  const [groups, setGroups] = useState<PlacementGroup[]>([]);
  const [instituteDepartments, setInstituteDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [sort, setSort] = useState("newest");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeFilters, setActiveFilters] = useState<{
    year: string;
    departments: string[];
  }>({
    year: "",
    departments: [],
  });
  const [editGroup, setEditGroup] = useState<PlacementGroup | null>(null);
  const [deleteGroup, setDeleteGroup] = useState<PlacementGroup | null>(null);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    pages: 1,
    limit: 10,
  });

  const {
    isOpen: isDeleteModalOpen,
    onOpen: openDeleteModal,
    onClose: closeDeleteModal,
  } = useDisclosure();
  const [isDeleting, setIsDeleting] = useState(false);

  const { getToken } = useAuth();
  const axios = ax(getToken);

  const fetchGroups = async (page = 1) => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await axios.get(
        `/placement-groups?page=${page}&limit=${pagination.limit}`
      );

      if (response.data?.success) {
        if (Array.isArray(response.data.data?.groups)) {
          setGroups(response.data.data.groups);
          if (response.data.data.pagination) {
            setPagination(response.data.data.pagination);
          }
        } else {
          setError("Unexpected data format from API");
        }

        if (Array.isArray(response.data.data?.departments)) {
          setInstituteDepartments(response.data.data.departments);
        }
      } else {
        setError("Failed to fetch placement groups");
      }
    } catch (err) {
      console.error("Error fetching groups:", err);
      setError("Error connecting to server");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    groups.forEach((group) => {
      if (group.academicYear?.start && group.academicYear?.end) {
        years.add(`${group.academicYear.start}-${group.academicYear.end}`);
      }
    });
    return Array.from(years).sort().reverse();
  }, [groups]);

  const filteredGroups = useMemo(() => {
    return (groups || [])
      .filter((group) => {
        const groupName = group.name || "";
        const matchesSearch =
          !searchTerm ||
          groupName.toLowerCase().includes(searchTerm.toLowerCase());
        const isArchived = !!group.archived;
        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "active" && !isArchived) ||
          (statusFilter === "archived" && isArchived);
        const yearString = `${group.academicYear?.start || ""}-${
          group.academicYear?.end || ""
        }`;
        const matchesYear =
          !activeFilters.year || yearString === activeFilters.year;
        const groupDepartments = Array.isArray(group.departments)
          ? group.departments
          : [];
        const matchesDepartment =
          activeFilters.departments.length === 0 ||
          activeFilters.departments.some((deptId) =>
            groupDepartments.includes(deptId)
          );

        return matchesSearch && matchesStatus && matchesYear && matchesDepartment;
      })
      .sort((a, b) =>
        sort === "newest"
          ? new Date(b?.createdAt || Date.now()).getTime() -
            new Date(a?.createdAt || Date.now()).getTime()
          : new Date(a?.createdAt || Date.now()).getTime() -
            new Date(b?.createdAt || Date.now()).getTime()
      );
  }, [activeFilters, groups, searchTerm, sort, statusFilter]);

  const activeGroups = groups.filter((group) => !group.archived);
  const hasFilters =
    searchTerm ||
    statusFilter !== "all" ||
    activeFilters.year ||
    activeFilters.departments.length;

  const handleCopyLink = (id: string) => {
    navigator.clipboard.writeText(`https://scriptopiacampus.com/group/${id}`);
    toast.success("Placement group link copied");
  };

  const handleArchive = async (id: string) => {
    try {
      await axios.post("/placementgroups/archive", { id });
      setGroups((prevGroups) =>
        prevGroups.map((group) =>
          group._id === id ? { ...group, archived: !group.archived } : group
        )
      );
      toast.success("Placement group updated");
    } catch (err) {
      console.error("Error archiving group:", err);
      toast.error("Failed to update placement group");
    }
  };

  const handleDeleteConfirm = () => {
    if (!deleteGroup?._id) return;
    setIsDeleting(true);

    axios
      .delete(`/placement-groups/${deleteGroup._id}`)
      .then(() => {
        closeDeleteModal();
        setDeleteGroup(null);
        toast.success("Placement group deleted successfully");
        setGroups((prevGroups) =>
          prevGroups.filter((group) => group._id !== deleteGroup._id)
        );
        setTimeout(() => fetchGroups(pagination.page), 300);
      })
      .catch((error) => {
        const errorMessage =
          error.response?.data?.message ||
          "Failed to delete placement group. Please try again.";

        if (error.response?.status === 404) {
          toast.success("Placement group no longer exists");
          setGroups((prevGroups) =>
            prevGroups.filter((group) => group._id !== deleteGroup?._id)
          );
          closeDeleteModal();
          setDeleteGroup(null);
          setTimeout(() => fetchGroups(pagination.page), 300);
        } else {
          toast.error(errorMessage);
        }
      })
      .finally(() => setIsDeleting(false));
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSort("newest");
    setStatusFilter("all");
    setActiveFilters({ year: "", departments: [] });
  };

  return (
    <PageShell
      eyebrow="Student segmentation"
      title="Placement groups"
      description="Build eligible student cohorts by academic year and department, then reuse them across drives and invitation flows."
      actions={
        <Button
          color="primary"
          startContent={<Plus size={16} />}
          onPress={() => navigate("create")}
        >
          Create group
        </Button>
      }
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Groups"
          value={pagination.total || groups.length}
          detail="Total cohorts"
          icon={<Users className="h-4 w-4" />}
        />
        <MetricCard
          label="Active"
          value={activeGroups.length}
          detail="Available for drives"
          icon={<GraduationCap className="h-4 w-4" />}
          tone="green"
        />
        <MetricCard
          label="Archived"
          value={groups.length - activeGroups.length}
          detail="Hidden from default planning"
          icon={<Archive className="h-4 w-4" />}
          tone="amber"
        />
        <MetricCard
          label="Departments"
          value={instituteDepartments.length}
          detail="Usable as segmentation criteria"
          icon={<GraduationCap className="h-4 w-4" />}
          tone="blue"
        />
      </section>

      <section className="campus-toolbar">
        <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
          <Input
            aria-label="Search placement groups"
            className="lg:max-w-sm"
            placeholder="Search groups"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            startContent={<Search size={18} className="text-slate-400" />}
          />
          <Select
            aria-label="Status"
            className="lg:max-w-[150px]"
            selectedKeys={[statusFilter]}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <SelectItem key="all">All status</SelectItem>
            <SelectItem key="active">Active</SelectItem>
            <SelectItem key="archived">Archived</SelectItem>
          </Select>
          <Select
            aria-label="Academic year"
            className="lg:max-w-[180px]"
            placeholder="Academic year"
            selectedKeys={activeFilters.year ? [activeFilters.year] : []}
            onChange={(event) =>
              setActiveFilters((current) => ({
                ...current,
                year: event.target.value,
              }))
            }
          >
            {availableYears.map((year) => (
              <SelectItem key={year}>{year}</SelectItem>
            ))}
          </Select>
          <Select
            aria-label="Department"
            className="lg:max-w-[220px]"
            placeholder="Department"
            selectedKeys={activeFilters.departments}
            onChange={(event) =>
              setActiveFilters((current) => ({
                ...current,
                departments: event.target.value ? [event.target.value] : [],
              }))
            }
          >
            {instituteDepartments.map((department) => (
              <SelectItem key={department._id!}>{department.name}</SelectItem>
            ))}
          </Select>
          <Select
            aria-label="Sort groups"
            className="lg:max-w-[150px]"
            selectedKeys={[sort]}
            onChange={(event) => setSort(event.target.value)}
          >
            <SelectItem key="newest">Newest</SelectItem>
            <SelectItem key="oldest">Oldest</SelectItem>
          </Select>
        </div>
        {hasFilters && (
          <Button variant="light" onPress={clearFilters}>
            Clear filters
          </Button>
        )}
      </section>

      <section className="campus-table">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title="Unable to load placement groups"
            description={error}
            action={<Button color="primary" onPress={() => fetchGroups()}>Retry</Button>}
          />
        ) : filteredGroups.length === 0 ? (
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title={hasFilters ? "No groups match this view" : "No placement groups yet"}
            description={
              hasFilters
                ? "Clear or adjust filters to see more cohorts."
                : "Create a placement group to define eligibility for drives and invitations."
            }
            action={
              !hasFilters && (
                <Button color="primary" startContent={<Plus size={16} />} onPress={() => navigate("create")}>
                  Create group
                </Button>
              )
            }
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredGroups.map((group) => {
              const departments = Array.isArray(group.departments)
                ? group.departments
                    .map(
                      (deptId) =>
                        instituteDepartments.find((dept) => dept._id === deptId)
                          ?.name || deptId
                    )
                    .slice(0, 3)
                : [];
              return (
                <article
                  key={group._id}
                  className="grid cursor-pointer gap-4 px-5 py-4 transition hover:bg-slate-50 xl:grid-cols-[1fr_180px_1fr_auto]"
                  onClick={() => navigate(`/placement-groups/${group._id}`)}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-sm font-semibold text-slate-950">
                        {group.name}
                      </h2>
                      <StatusPill tone={group.archived ? "neutral" : "success"}>
                        {group.archived ? "Archived" : "Active"}
                      </StatusPill>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      Created {new Date(group?.createdAt!).toLocaleDateString()}
                    </p>
                  </div>

                  <div>
                    <p className="campus-muted-label">Academic year</p>
                    <p className="mt-1 text-sm text-slate-700">
                      {group.academicYear?.start} - {group.academicYear?.end}
                    </p>
                  </div>

                  <div>
                    <p className="campus-muted-label">Departments</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {departments.length ? (
                        departments.map((department) => (
                          <StatusPill key={department}>{department}</StatusPill>
                        ))
                      ) : (
                        <span className="text-sm text-slate-500">All departments</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2" onClick={(event) => event.stopPropagation()}>
                    <Button
                      isIconOnly
                      variant="flat"
                      aria-label="Copy group link"
                      onPress={() => handleCopyLink(group._id!)}
                    >
                      <Copy size={16} />
                    </Button>
                    <Dropdown>
                      <DropdownTrigger>
                        <Button isIconOnly variant="flat" aria-label="Group actions">
                          <MoreVertical size={18} />
                        </Button>
                      </DropdownTrigger>
                      <DropdownMenu
                        onAction={(key) => {
                          if (key === "edit") setEditGroup(group);
                          if (key === "archive") handleArchive(group._id!);
                          if (key === "delete") {
                            setDeleteGroup(group);
                            openDeleteModal();
                          }
                        }}
                      >
                        <DropdownItem key="edit">Edit</DropdownItem>
                        <DropdownItem key="archive">
                          {group.archived ? "Unarchive" : "Archive"}
                        </DropdownItem>
                        <DropdownItem
                          key="delete"
                          className="text-danger"
                          color="danger"
                          startContent={<Trash size={16} />}
                        >
                          Delete
                        </DropdownItem>
                      </DropdownMenu>
                    </Dropdown>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {pagination.pages > 1 && (
        <div className="flex justify-center">
          <Pagination
            total={pagination.pages}
            page={pagination.page}
            onChange={fetchGroups}
            showControls
          />
        </div>
      )}

      {editGroup && (
        <EditGroupModal
          group={editGroup}
          instituteDepartments={instituteDepartments}
          instituteCandidates={institute.candidates}
          onClose={() => setEditGroup(null)}
          onSave={(updatedGroup) => {
            setGroups(
              groups.map((group) =>
                group._id === updatedGroup._id ? updatedGroup : group
              )
            );
            setEditGroup(null);
          }}
        />
      )}

      <Modal isOpen={isDeleteModalOpen} onClose={closeDeleteModal}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                Delete placement group
              </ModalHeader>
              <ModalBody>
                <p className="text-sm leading-6 text-slate-600">
                  Delete <span className="font-semibold">{deleteGroup?.name}</span>?
                  This action cannot be undone.
                </p>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose} isDisabled={isDeleting}>
                  Cancel
                </Button>
                <Button
                  color="danger"
                  onPress={handleDeleteConfirm}
                  startContent={<Trash size={16} />}
                  isLoading={isDeleting}
                >
                  Delete
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </PageShell>
  );
};

export default PlacementGroups;
