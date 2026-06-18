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
  Select,
  SelectItem,
  useDisclosure,
} from "@nextui-org/react";
import { useNavigate, useOutletContext } from "react-router-dom";
import {
  BriefcaseBusiness,
  CalendarClock,
  Copy,
  EllipsisVertical,
  PlusIcon,
  Search,
  Trash2Icon,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/auth";
import ax from "@/config/axios";
import { toast } from "sonner";
import { Drive } from "@shared-types/Drive";
import { Company } from "@shared-types/Company";
import { RootContext } from "@/types/RootContext";
import { PageShell } from "@/components/campus/PageShell";
import { MetricCard } from "@/components/campus/MetricCard";
import { StatusPill } from "@/components/campus/StatusPill";
import { EmptyState } from "@/components/campus/EmptyState";

const workTypes = [
  { key: "full_time", label: "Full time" },
  { key: "part_time", label: "Part time" },
  { key: "internship", label: "Internship" },
];

const Drives: React.FC = () => {
  const navigate = useNavigate();
  const { institute, setInstitute, rerender } =
    useOutletContext() as RootContext;

  const [drives, setDrives] = useState<Drive[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [sort, setSort] = useState("newest");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [workScheduleFilter, setWorkScheduleFilter] = useState<string[]>([]);
  const [companyFilter, setCompanyFilter] = useState("");
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [deleteId, setDeleteId] = useState<string>();

  const { getToken } = useAuth();
  const axios = ax(getToken);

  useEffect(() => {
    setDrives((institute?.drives || []) as Drive[]);
    setCompanies(institute?.companies || []);
  }, [institute, rerender]);

  const getDriveStatus = (drive: Drive) =>
    new Date(drive.applicationRange?.end) < new Date() ? "closed" : "active";

  const filteredDrives = useMemo(() => {
    return [...(drives || [])]
      .filter((drive) => {
        const company = companies.find((item) => item._id === drive.company);
        const matchesSearch =
          !searchTerm ||
          drive.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          company?.name?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus =
          selectedFilter === "all" || getDriveStatus(drive) === selectedFilter;
        const matchesCompany =
          !companyFilter || company?.name === companyFilter;
        const matchesWorkType =
          workScheduleFilter.length === 0 ||
          workScheduleFilter.includes(drive.type);

        return (
          matchesSearch && matchesStatus && matchesCompany && matchesWorkType
        );
      })
      .sort((a, b) => {
        if (sort === "oldest") {
          return (
            new Date(a.applicationRange.start).getTime() -
            new Date(b.applicationRange.start).getTime()
          );
        }
        if (sort === "salary") {
          return (b?.salary?.min || 0) - (a?.salary?.min || 0);
        }
        return (
          new Date(b.applicationRange.start).getTime() -
          new Date(a.applicationRange.start).getTime()
        );
      });
  }, [companies, companyFilter, drives, searchTerm, selectedFilter, sort, workScheduleFilter]);

  const activeDrives = drives.filter((drive) => getDriveStatus(drive) === "active");
  const publishedDrives = drives.filter((drive) => drive.published);
  const closedDrives = drives.length - activeDrives.length;

  const openCreateDriveModal = () => {
    if (!companies.length) {
      toast.error("Create a company profile before launching a drive.");
      return;
    }
    navigate("create");
  };

  const copyDriveLink = (drive: Drive) => {
    if (!drive?._id) return;
    navigator.clipboard.writeText(
      `${import.meta.env.VITE_CANDIDATE_URL}/campus/drives${drive?.url || `/${drive._id}`}`
    );
    toast.success("Drive link copied");
  };

  const handleDelete = () => {
    const newInstitute = { ...institute };
    const newDrives = newInstitute.drives?.filter(
      (drive) => drive._id !== deleteId
    );

    setInstitute({ ...newInstitute, drives: newDrives });
    onOpenChange();

    axios.delete(`/drives/${deleteId}`).catch((err) => {
      toast.error(err.response?.data?.message || "An error occurred");
    });
  };

  const toggleWorkType = (type: string) => {
    setWorkScheduleFilter((current) =>
      current.includes(type)
        ? current.filter((item) => item !== type)
        : [...current, type]
    );
  };

  const hasFilters =
    searchTerm || selectedFilter !== "all" || companyFilter || workScheduleFilter.length;

  return (
    <PageShell
      eyebrow="Placement operations"
      title="Drives"
      description="Create, publish, and monitor campus recruitment drives across companies, workflows, and candidate pools."
      actions={
        <Button color="primary" startContent={<PlusIcon size={16} />} onPress={openCreateDriveModal}>
          Create drive
        </Button>
      }
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total drives"
          value={drives.length}
          detail="Across all companies"
          icon={<BriefcaseBusiness className="h-4 w-4" />}
        />
        <MetricCard
          label="Active"
          value={activeDrives.length}
          detail="Accepting applications"
          icon={<CalendarClock className="h-4 w-4" />}
          tone="green"
        />
        <MetricCard
          label="Published"
          value={publishedDrives.length}
          detail="Visible to candidates"
          icon={<Users className="h-4 w-4" />}
          tone="blue"
        />
        <MetricCard
          label="Closed"
          value={closedDrives}
          detail="Application window ended"
          icon={<X className="h-4 w-4" />}
          tone="rose"
        />
      </section>

      <section className="campus-toolbar">
        <div className="flex min-w-0 flex-1 flex-col gap-3 md:flex-row md:items-center">
          <Input
            aria-label="Search drives"
            className="md:max-w-sm"
            placeholder="Search drives or companies"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            startContent={<Search size={18} className="text-slate-400" />}
          />
          <Select
            aria-label="Drive status"
            className="md:max-w-[150px]"
            selectedKeys={[selectedFilter]}
            onChange={(event) => setSelectedFilter(event.target.value)}
          >
            <SelectItem key="all">All status</SelectItem>
            <SelectItem key="active">Active</SelectItem>
            <SelectItem key="closed">Closed</SelectItem>
          </Select>
          <Select
            aria-label="Company"
            className="md:max-w-[220px]"
            selectedKeys={companyFilter ? [companyFilter] : []}
            placeholder="All companies"
            onChange={(event) => setCompanyFilter(event.target.value)}
          >
            {companies.map((company) => (
              <SelectItem key={company.name}>{company.name}</SelectItem>
            ))}
          </Select>
          <Select
            aria-label="Sort drives"
            className="md:max-w-[150px]"
            selectedKeys={[sort]}
            onChange={(event) => setSort(event.target.value)}
          >
            <SelectItem key="newest">Newest</SelectItem>
            <SelectItem key="oldest">Oldest</SelectItem>
            <SelectItem key="salary">Salary</SelectItem>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {workTypes.map((type) => (
            <Button
              key={type.key}
              size="sm"
              variant={workScheduleFilter.includes(type.key) ? "solid" : "flat"}
              color={workScheduleFilter.includes(type.key) ? "primary" : "default"}
              onPress={() => toggleWorkType(type.key)}
            >
              {type.label}
            </Button>
          ))}
          {hasFilters && (
            <Button
              size="sm"
              variant="light"
              onPress={() => {
                setSearchTerm("");
                setSelectedFilter("all");
                setCompanyFilter("");
                setWorkScheduleFilter([]);
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </section>

      <section className="campus-table">
        {filteredDrives.length ? (
          <div className="divide-y divide-slate-100">
            {filteredDrives.map((drive) => {
              const company = companies.find((item) => item._id === drive.company);
              const status = getDriveStatus(drive);
              return (
                <article
                  key={drive._id}
                  className="grid cursor-pointer gap-4 px-5 py-4 transition hover:bg-slate-50 lg:grid-cols-[1fr_220px_170px_auto]"
                  onClick={() => navigate(`${drive._id}/info`, { state: { drive } })}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-sm font-semibold text-slate-950">
                        {drive.title}
                      </h2>
                      <StatusPill tone={status === "active" ? "success" : "neutral"}>
                        {status === "active" ? "Active" : "Closed"}
                      </StatusPill>
                      {drive.published && <StatusPill tone="info">Published</StatusPill>}
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {company?.name || "Company not linked"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                      Application window
                    </p>
                    <p className="mt-1 text-sm text-slate-700">
                      Until {new Date(drive.applicationRange?.end).toLocaleDateString()}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                      Work type
                    </p>
                    <p className="mt-1 text-sm capitalize text-slate-700">
                      {drive.type?.replace(/_/g, " ") || "Not specified"}
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-2" onClick={(event) => event.stopPropagation()}>
                    {drive?.published && (
                      <Button isIconOnly variant="flat" aria-label="Copy drive link" onPress={() => copyDriveLink(drive)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    )}
                    <Dropdown>
                      <DropdownTrigger>
                        <Button isIconOnly variant="flat" aria-label="Drive actions">
                          <EllipsisVertical className="h-4 w-4" />
                        </Button>
                      </DropdownTrigger>
                      <DropdownMenu>
                        <DropdownItem
                          key="delete"
                          className="text-danger"
                          color="danger"
                          startContent={<Trash2Icon size={16} />}
                          onPress={() => {
                            setDeleteId(drive._id);
                            onOpen();
                          }}
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
        ) : (
          <EmptyState
            icon={<BriefcaseBusiness className="h-5 w-5" />}
            title={hasFilters ? "No drives match this view" : "No drives yet"}
            description={
              hasFilters
                ? "Adjust your filters or clear the current search to see more drives."
                : "Create your first drive after adding a company profile."
            }
            action={
              !hasFilters && (
                <Button color="primary" startContent={<PlusIcon size={16} />} onPress={openCreateDriveModal}>
                  Create drive
                </Button>
              )
            }
          />
        )}
      </section>

      <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">Delete drive</ModalHeader>
              <ModalBody>
                <p className="text-sm leading-6 text-slate-600">
                  This will permanently remove the drive and its configuration
                  from the institute workspace.
                </p>
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>
                  Cancel
                </Button>
                <Button color="danger" onPress={handleDelete}>
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

export default Drives;
