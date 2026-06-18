import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Input,
  Select,
  SelectItem,
  Spinner,
} from "@nextui-org/react";
import {
  Archive,
  Building2,
  Calendar,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react";
import { useAuth } from "@/auth";
import ax from "@/config/axios";
import { toast } from "sonner";
import CreateCompanyForm from "./CreateCompanyForm";
import EditCompanyModal from "./EditCompanyModal";
import { Company } from "@shared-types/Company";
import { PageShell } from "@/components/campus/PageShell";
import { MetricCard } from "@/components/campus/MetricCard";
import { StatusPill } from "@/components/campus/StatusPill";
import { EmptyState } from "@/components/campus/EmptyState";

interface Filters {
  year: string;
  studentsRange: string;
  averagePackage: string;
  highestPackage: string;
}

const parseRange = (range: string): [number, number] => {
  if (range.endsWith("+")) {
    const start = parseInt(range.slice(0, -1));
    return [start, Infinity];
  }
  const [start, end] = range.split("-").map((num) => parseInt(num));
  return [start, end];
};

const formatPackageRange = (range: string): [number, number] => {
  if (!range) return [0, Infinity];
  const [start, end] = range.split("-");
  if (end === "+") {
    return [parseInt(start) * 100000, Infinity];
  }
  return [parseInt(start) * 100000, parseInt(end) * 100000];
};

const CompanyProfiles = () => {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState("newest");
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "archived">("all");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [companyToDelete, setCompanyToDelete] = useState<string | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [companyToEdit, setCompanyToEdit] = useState<Company | null>(null);
  const [refetchCompanies, setRefetchCompanies] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [archivingCompanyId, setArchivingCompanyId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    year: "",
    studentsRange: "",
    averagePackage: "",
    highestPackage: "",
  });
  const [isFiltersApplied, setIsFiltersApplied] = useState(false);

  const { getToken } = useAuth();
  const axios = ax(getToken);

  const getYearStats = (company: Company) => company.generalInfo?.yearStats || [];

  const getTotalStudentsHired = (company: Company): number =>
    getYearStats(company).reduce((total, stat) => total + stat.hired, 0);

  const getAveragePackage = (company: Company): number => {
    const stats = getYearStats(company);
    const totalStudents = stats.reduce((sum, stat) => sum + stat.hired, 0);
    if (!totalStudents) return 0;
    return (
      stats.reduce((sum, stat) => sum + stat.average * stat.hired, 0) /
      totalStudents
    );
  };

  const getHighestPackage = (company: Company): number => {
    const stats = getYearStats(company);
    return stats.length ? Math.max(...stats.map((stat) => stat.highest)) : 0;
  };

  const getYearsOfVisit = (company: Company): string[] =>
    getYearStats(company).map((stat) => stat.year);

  const getMostRecentYear = (company: Company): string => {
    const years = getYearsOfVisit(company);
    return years.length > 0 ? years.sort().reverse()[0] : "No visits";
  };

  const showError = (err: unknown, defaultMessage: string) => {
    const message =
      (err as { response?: { data?: { message?: string } } })?.response?.data
        ?.message || defaultMessage;
    toast.error(message);
  };

  const fetchCompanies = async () => {
    setIsLoading(true);
    axios
      .get("/companies")
      .then((response) => {
        if (response.data?.data?.companies) {
          setCompanies(response.data.data.companies);
          setError(null);
        } else {
          setError("Invalid data format received from server");
          toast.error("Invalid data format received from server");
        }
      })
      .catch((err) => {
        const errorMessage =
          err?.response?.data?.message || "Failed to load companies";
        setError(errorMessage);
        toast.error(errorMessage);
      })
      .finally(() => {
        setIsLoading(false);
        setIsRefreshing(false);
      });
  };

  useEffect(() => {
    fetchCompanies();
  }, [refetchCompanies]);

  const refreshCompanies = async () => {
    setIsRefreshing(true);
    await fetchCompanies();
  };

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    companies.forEach((company) => {
      getYearStats(company).forEach((stat) => years.add(stat.year));
    });
    return Array.from(years).sort().reverse();
  }, [companies]);

  const filteredCompanies = useMemo(() => {
    return companies
      .filter((company) => {
        const companyName = company.name || "";
        if (
          searchTerm &&
          !companyName.toLowerCase().includes(searchTerm.toLowerCase())
        ) {
          return false;
        }

        const isArchived = !!company.isArchived;
        if (filter === "active" && isArchived) return false;
        if (filter === "archived" && !isArchived) return false;

        if (isFiltersApplied) {
          if (filters.year && !getYearsOfVisit(company).includes(filters.year)) {
            return false;
          }

          if (filters.studentsRange) {
            const [min, max] = parseRange(filters.studentsRange);
            const totalHired = getTotalStudentsHired(company);
            if (totalHired < min || totalHired > max) return false;
          }

          if (filters.averagePackage) {
            const [min, max] = formatPackageRange(filters.averagePackage);
            const avgPackage = getAveragePackage(company);
            if (avgPackage < min || avgPackage > max) return false;
          }

          if (filters.highestPackage) {
            const [min, max] = formatPackageRange(filters.highestPackage);
            const highestPackage = getHighestPackage(company);
            if (highestPackage < min || highestPackage > max) return false;
          }
        }

        return true;
      })
      .sort((a, b) =>
        sort === "newest"
          ? new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
          : new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime()
      );
  }, [companies, filters, filter, isFiltersApplied, searchTerm, sort]);

  const activeCompanies = companies.filter((company) => !company.isArchived);
  const totalStudentsHired = companies.reduce(
    (total, company) => total + getTotalStudentsHired(company),
    0
  );
  const topPackage = companies.length
    ? Math.max(...companies.map((company) => getHighestPackage(company)))
    : 0;

  const handleArchive = async (id: string) => {
    try {
      setArchivingCompanyId(id);
      const company = companies.find((item) => item._id === id);
      const isCurrentlyArchived = !!company?.isArchived;

      await axios.post("/companies/archive", { id });
      setCompanies((prev) =>
        prev.map((item) =>
          item._id === id ? { ...item, isArchived: !item.isArchived } : item
        )
      );
      toast.success(
        `Company ${isCurrentlyArchived ? "unarchived" : "archived"} successfully`
      );
    } catch (err) {
      showError(err, "Failed to archive company");
      refreshCompanies();
    } finally {
      setArchivingCompanyId(null);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      setIsDeleting(true);
      await axios.delete(`/companies/${id}`);
      setCompanies((prev) => prev.filter((company) => company._id !== id));
      setShowDeleteModal(false);
      setCompanyToDelete(null);
      toast.success("Company deleted successfully");
    } catch (err) {
      showError(err, "Failed to delete company");
      refreshCompanies();
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditSuccess = () => {
    setRefetchCompanies((current) => !current);
    setShowEditModal(false);
    setCompanyToEdit(null);
    toast.success("Company updated successfully");
  };

  const formatCurrency = (amount: number) =>
    amount ? `INR ${(amount / 100000).toFixed(1)}L` : "Not tracked";

  const clearFilters = () => {
    setFilters({
      year: "",
      studentsRange: "",
      averagePackage: "",
      highestPackage: "",
    });
    setIsFiltersApplied(false);
    toast.success("Filters cleared");
  };

  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  if (showCreateForm) {
    return (
      <PageShell
        eyebrow="Company CRM"
        title="Create company profile"
        description="Add the hiring relationship, HR contacts, and compensation history used by campus drives."
        actions={
          <Button variant="flat" onPress={() => setShowCreateForm(false)}>
            Back to companies
          </Button>
        }
      >
        <CreateCompanyForm onClose={() => setShowCreateForm(false)} />
      </PageShell>
    );
  }

  return (
    <PageShell
      eyebrow="Company CRM"
      title="Company profiles"
      description="Manage recruiter relationships, hiring history, compensation benchmarks, and company readiness for campus drives."
      actions={
        <>
          <Button
            variant="flat"
            startContent={<RefreshCw size={16} />}
            onPress={refreshCompanies}
            isLoading={isRefreshing}
            isDisabled={isLoading}
          >
            Refresh
          </Button>
          <Button
            color="primary"
            startContent={<Plus size={16} />}
            onPress={() => setShowCreateForm(true)}
          >
            New profile
          </Button>
        </>
      }
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Companies"
          value={companies.length}
          detail={`${activeCompanies.length} active profiles`}
          icon={<Building2 className="h-4 w-4" />}
        />
        <MetricCard
          label="Students hired"
          value={totalStudentsHired}
          detail="Across recorded visits"
          icon={<Users className="h-4 w-4" />}
          tone="green"
        />
        <MetricCard
          label="Highest package"
          value={formatCurrency(topPackage)}
          detail="Best recorded offer"
          icon={<TrendingUp className="h-4 w-4" />}
          tone="blue"
        />
        <MetricCard
          label="Archived"
          value={companies.length - activeCompanies.length}
          detail="Hidden from active planning"
          icon={<Archive className="h-4 w-4" />}
          tone="amber"
        />
      </section>

      <section className="campus-toolbar">
        <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
          <Input
            aria-label="Search companies"
            className="lg:max-w-sm"
            placeholder="Search companies"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            startContent={<Search size={18} className="text-slate-400" />}
          />
          <Select
            aria-label="Status"
            className="lg:max-w-[150px]"
            selectedKeys={[filter]}
            onChange={(event) => setFilter(event.target.value as typeof filter)}
          >
            <SelectItem key="all">All</SelectItem>
            <SelectItem key="active">Active</SelectItem>
            <SelectItem key="archived">Archived</SelectItem>
          </Select>
          <Select
            aria-label="Sort companies"
            className="lg:max-w-[150px]"
            selectedKeys={[sort]}
            onChange={(event) => setSort(event.target.value)}
          >
            <SelectItem key="newest">Newest</SelectItem>
            <SelectItem key="oldest">Oldest</SelectItem>
          </Select>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <Select
            aria-label="Visit year"
            placeholder="Visit year"
            selectedKeys={filters.year ? [filters.year] : []}
            onChange={(event) => handleFilterChange("year", event.target.value)}
          >
            {availableYears.map((year) => (
              <SelectItem key={year}>{year}</SelectItem>
            ))}
          </Select>
          <Select
            aria-label="Students hired"
            placeholder="Students"
            selectedKeys={filters.studentsRange ? [filters.studentsRange] : []}
            onChange={(event) =>
              handleFilterChange("studentsRange", event.target.value)
            }
          >
            <SelectItem key="0-50">0-50</SelectItem>
            <SelectItem key="51-100">51-100</SelectItem>
            <SelectItem key="100+">100+</SelectItem>
          </Select>
          <Select
            aria-label="Average package"
            placeholder="Avg package"
            selectedKeys={filters.averagePackage ? [filters.averagePackage] : []}
            onChange={(event) =>
              handleFilterChange("averagePackage", event.target.value)
            }
          >
            <SelectItem key="0-10">0-10L</SelectItem>
            <SelectItem key="10-20">10-20L</SelectItem>
            <SelectItem key="20+">20L+</SelectItem>
          </Select>
          <div className="flex gap-2">
            <Button
              className="flex-1"
              color="primary"
              variant={isFiltersApplied ? "solid" : "flat"}
              onPress={() => setIsFiltersApplied(true)}
            >
              Apply
            </Button>
            {(isFiltersApplied || searchTerm || filter !== "all") && (
              <Button variant="light" onPress={clearFilters}>
                Clear
              </Button>
            )}
          </div>
        </div>
      </section>

      <section className="campus-table">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <EmptyState
            icon={<Building2 className="h-5 w-5" />}
            title="Unable to load companies"
            description={error}
            action={
              <Button color="primary" onPress={refreshCompanies}>
                Retry
              </Button>
            }
          />
        ) : filteredCompanies.length === 0 ? (
          <EmptyState
            icon={<Building2 className="h-5 w-5" />}
            title="No companies found"
            description={
              searchTerm || isFiltersApplied
                ? "Adjust your search or filters to broaden the result set."
                : "Create your first company profile to start planning drives."
            }
            action={
              <Button
                color="primary"
                startContent={<Plus size={16} />}
                onPress={() => setShowCreateForm(true)}
              >
                New profile
              </Button>
            }
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredCompanies.map((company) => (
              <article
                key={company._id}
                className="grid cursor-pointer gap-4 px-5 py-4 transition hover:bg-slate-50 xl:grid-cols-[1fr_180px_180px_170px_auto]"
                onClick={() => navigate(`/companies/${company._id}`)}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-sm font-semibold text-slate-950">
                      {company.name}
                    </h2>
                    <StatusPill tone={company.isArchived ? "neutral" : "success"}>
                      {company.isArchived ? "Archived" : "Active"}
                    </StatusPill>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    Average package {formatCurrency(getAveragePackage(company))}
                  </p>
                </div>
                <div>
                  <p className="campus-muted-label">Last visit</p>
                  <p className="mt-1 flex items-center gap-2 text-sm text-slate-700">
                    <Calendar className="h-4 w-4 text-slate-400" />
                    {getMostRecentYear(company)}
                  </p>
                </div>
                <div>
                  <p className="campus-muted-label">Students hired</p>
                  <p className="mt-1 text-sm text-slate-700">
                    {getTotalStudentsHired(company)}
                  </p>
                </div>
                <div>
                  <p className="campus-muted-label">Highest package</p>
                  <p className="mt-1 text-sm text-slate-700">
                    {formatCurrency(getHighestPackage(company))}
                  </p>
                </div>
                <div
                  className="flex items-center justify-end"
                  onClick={(event) => event.stopPropagation()}
                >
                  <Dropdown>
                    <DropdownTrigger>
                      <Button
                        isIconOnly
                        variant="flat"
                        aria-label="Company actions"
                        isDisabled={archivingCompanyId === company._id}
                      >
                        {archivingCompanyId === company._id ? (
                          <Spinner size="sm" />
                        ) : (
                          <MoreVertical size={18} />
                        )}
                      </Button>
                    </DropdownTrigger>
                    <DropdownMenu
                      onAction={(key) => {
                        if (key === "edit") {
                          setCompanyToEdit(company);
                          setShowEditModal(true);
                        }
                        if (key === "archive") handleArchive(company._id!);
                        if (key === "delete") {
                          setCompanyToDelete(company._id!);
                          setShowDeleteModal(true);
                        }
                      }}
                      disabledKeys={company.isArchived ? ["edit"] : []}
                    >
                      {!company.isArchived ? (
                        <DropdownItem key="edit">Edit profile</DropdownItem>
                      ) : null}
                      <DropdownItem key="archive">
                        {company.isArchived ? "Unarchive" : "Archive"}
                      </DropdownItem>
                      <DropdownItem
                        key="delete"
                        className="text-danger"
                        color="danger"
                        startContent={<Trash2 size={16} />}
                      >
                        Delete
                      </DropdownItem>
                    </DropdownMenu>
                  </Dropdown>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-950">
              Delete company
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              This action cannot be undone. Existing references may no longer
              resolve in drive history.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                variant="flat"
                onPress={() => setShowDeleteModal(false)}
                isDisabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                color="danger"
                isLoading={isDeleting}
                onPress={() => {
                  if (companyToDelete) handleDelete(companyToDelete);
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && companyToEdit && !companyToEdit.isArchived && (
        <EditCompanyModal
          company={companyToEdit}
          onClose={() => {
            setShowEditModal(false);
            setCompanyToEdit(null);
          }}
          onSave={handleEditSuccess}
        />
      )}
    </PageShell>
  );
};

export default CompanyProfiles;
