import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card,
  CardBody,
  Chip,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Button,
  Tabs,
  Tab,
} from "@nextui-org/react";
import { MoreVertical } from "lucide-react";
import { motion } from "framer-motion";
import Filter from "./Filter";
import { useAuth } from "@/auth";
import ax from "@/config/axios";
import { CompanyTable } from "./CompanyTable";
import { Company as ICompany } from "@shared-types/Company";
import Analytics from "./Analytics";
import Loader from "@/components/Loader";
import { toast } from "sonner";

interface Student {
  _id: string;
  name: string;
  email: string;
  uid: string;
  department: string;
  placed: boolean;
}

const SORT_OPTIONS = {
  NEWEST: "newest",
  OLDEST: "oldest",
} as const;

const formatCurrency = (amount: number) => `₹${(amount / 100000).toFixed(1)}L`;

const Company = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const axios = ax(getToken);

  const [company, setCompany] = useState<ICompany | null>(null);
  const [loading, setloading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);

  // UI states
  const [selected, setSelected] = useState("details");
  const [searchTerm, _setSearchTerm] = useState("");
  const [filter] = useState<"all" | "placed" | "pending">("all");
  const [sort, _setSort] = useState<
    typeof SORT_OPTIONS.NEWEST | typeof SORT_OPTIONS.OLDEST
  >(SORT_OPTIONS.NEWEST);
  const [activeFilters, setActiveFilters] = useState({
    year: "",
    departments: [] as string[],
  });

  // Fetch company data
  useEffect(() => {
    const fetchCompany = async () => {
      setloading(true);
      axios
        .get("/companies/" + id)
        .then((res) => {
          setCompany(res.data.data.company);
          setStudents(res.data.data.candidates);
        })
        .catch((err) => {
          toast.error(
            err.response?.data?.message || "Failed to fetch company data"
          );
        })
        .finally(() => setloading(false));
    };

    fetchCompany();
  }, [id]);

  // Filter students
  const filteredStudents = useMemo(() => {
    return students
      .filter((student) => {
        const matchesSearch =
          !searchTerm ||
          student.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter =
          filter === "all" ||
          (filter === "placed" ? student.placed : !student.placed);
        const matchesYear = !activeFilters.year || true; // Skip year filtering as it's not in the schema
        const matchesDepartment =
          !activeFilters.departments.length ||
          activeFilters.departments.includes(student.department);

        return (
          matchesSearch && matchesFilter && matchesYear && matchesDepartment
        );
      })
      .sort((a, b) => {
        // Sort by name since there's no year/batch field
        return sort === SORT_OPTIONS.NEWEST
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      });
  }, [students, searchTerm, filter, activeFilters, sort]);

  const handleFilterChange = (newFilters: {
    year: string;
    departments: string[];
  }) => {
    setActiveFilters(newFilters);
  };

  const handleClearFilters = () => {
    setActiveFilters({ year: "", departments: [] });
  };

  const handleDeleteCompany = async () => {
    if (!company) return;
    if (window.confirm(`Are you sure you want to delete ${company.name}?`)) {
      try {
        const response = await axios.delete(`/companies/${company._id}`);
        if (response.data.success) {
          alert("Company deleted successfully");
          navigate("/companies");
        } else {
          alert(response.data.message || "Failed to delete company");
        }
      } catch (error) {
        console.error("Error deleting company:", error);
        alert("An error occurred while deleting the company");
      }
    }
  };

  const handleArchiveCompany = async () => {
    if (!company) return;
    try {
      const response = await axios.post("/companies/archive", {
        id: company._id,
      });
      if (response.data.success) {
        alert(
          `Company ${
            company.isArchived ? "unarchived" : "archived"
          } successfully`
        );
        window.location.reload();
      } else {
        alert(response.data.message || "Failed to update archive status");
      }
    } catch (error) {
      console.error("Error archiving/unarchiving company:", error);
      alert("An error occurred");
    }
  };

  // Calculate total students hired from yearStats
  const getTotalStudentsHired = () => {
    if (!company) return 0;
    return company.generalInfo.yearStats.reduce(
      (total, stat) => total + stat.hired,
      0
    );
  };

  // Calculate average package across all years
  const getAveragePackage = () => {
    if (!company) return 0;
    const stats = company.generalInfo.yearStats;
    if (stats.length === 0) return 0;
    const totalAverage = stats.reduce((sum, stat) => sum + stat.average, 0);
    return totalAverage / stats.length;
  };

  // Get highest package across all years
  const getHighestPackage = () => {
    if (!company) return 0;
    const stats = company.generalInfo.yearStats;
    if (stats.length === 0) return 0;
    return Math.max(...stats.map((stat) => stat.highest));
  };

  // Get all years as comma-separated string
  const getYearsOfVisit = () => {
    if (!company) return "";
    return company.generalInfo.yearStats.map((stat) => stat.year).join(", ");
  };

  if (loading) return <Loader />;

  if (!company) return <div>Company not found</div>;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6"
    >
      <div className="flex items-center justify-between p-2">
        <h1 className="text-3xl flex font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent items-center">
          <p> {company.name}</p>
          {company.isArchived && (
            <Chip className="ml-2" color="warning" size="sm">
              Archived
            </Chip>
          )}
        </h1>
        <Dropdown>
          <DropdownTrigger>
            <Button isIconOnly variant="light" className="text-neutral-400">
              <MoreVertical size={20} />
            </Button>
          </DropdownTrigger>
          <DropdownMenu>
            <DropdownItem key={"archive"} onClick={handleArchiveCompany}>
              {company.isArchived ? "Unarchive Company" : "Archive Company"}
            </DropdownItem>
            <DropdownItem
              key={"delete"}
              className="text-danger"
              onClick={handleDeleteCompany}
            >
              Delete Company
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </div>

      <Tabs
        selectedKey={selected}
        onSelectionChange={setSelected as any}
        variant="underlined"
        color="primary"
        className="mt-6"
      >
        <Tab key="details" title="Company Details">
          <div className="space-y-6 mt-5">
            <Card className="bg-default-50 p-2">
              <CardBody>
                <h3 className="text-xl font-semibold mb-4">About</h3>
                <p className="text-default-500 leading-relaxed mx-2">
                  {company.description || "No description available"}
                </p>
              </CardBody>
            </Card>

            <Card className="bg-default-50 p-2">
              <CardBody>
                <h3 className="text-xl font-semibold mb-4">
                  General Information
                </h3>
                <div className="space-y-6">
                  {/* Industry */}
                  <div className="mx-2">
                    <p className="text-sm text-default-500 mb-3">Industry</p>
                    <div className="flex flex-wrap gap-2">
                      {company.generalInfo.industry.map((industry) => (
                        <Chip
                          key={industry}
                          variant="dot"
                          color="success"
                          classNames={{
                            base: "text-green-default dark:text-default",
                          }}
                        >
                          {industry}
                        </Chip>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="mx-2">
                      <p className="text-sm text-default-500 mb-1">
                        Year(s) of Visit
                      </p>
                      <p className="text-lg font-semibold">
                        {getYearsOfVisit()}
                      </p>
                    </div>
                    <div className="mx-2">
                      <p className="text-sm text-default-500 mb-1">
                        Total Students Hired
                      </p>
                      <p className="text-lg font-semibold">
                        {getTotalStudentsHired()}
                      </p>
                    </div>
                    <div className="mx-2">
                      <p className="text-sm text-default-500 mb-1">
                        Average Package
                      </p>
                      <p className="text-lg font-semibold">
                        {formatCurrency(getAveragePackage())}
                      </p>
                    </div>
                    <div className="mx-2">
                      <p className="text-sm text-default-500 mb-1">
                        Highest Package
                      </p>
                      <p className="text-lg font-semibold">
                        {formatCurrency(getHighestPackage())}
                      </p>
                    </div>
                  </div>

                  <div className="mx-2">
                    <p className="text-sm text-default-500 mb-3">
                      Roles Offered
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {company.generalInfo.rolesOffered?.map((role) => (
                        <Chip
                          key={role}
                          variant="dot"
                          color="success"
                          classNames={{
                            base: "text-green-default dark:text-default",
                          }}
                        >
                          {role}
                        </Chip>
                      ))}
                    </div>
                  </div>

                  {/* Year-wise Statistics */}
                  <div className="mx-2">
                    <p className="text-xl font-semibold mb-3">
                      Year-wise Statistics
                    </p>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-default-200">
                        <thead>
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-default-500 uppercase tracking-wider">
                              Year
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-default-500 uppercase tracking-wider">
                              Hired
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-default-500 uppercase tracking-wider">
                              Average Package
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-default-500 uppercase tracking-wider">
                              Highest Package
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-default-50 divide-y divide-default-200">
                          {company.generalInfo.yearStats.map((stat) => (
                            <tr key={stat.year}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                {stat.year}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                {stat.hired}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                {formatCurrency(stat.average)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm">
                                {formatCurrency(stat.highest)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card className="bg-default-50 p-2">
              <CardBody>
                <h3 className="text-xl font-semibold mb-4">HR Contact</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="mx-2">
                    <p className="text-sm text-default-500 mb-1">Name</p>
                    <p className="text-lg font-semibold">
                      {company.hrContact?.name || "N/A"}
                    </p>
                  </div>
                  <div className="mx-2">
                    <p className="text-sm text-default-500 mb-1">Phone</p>
                    <p className="text-lg font-semibold">
                      {company.hrContact?.phone || "N/A"}
                    </p>
                  </div>
                  <div className="mx-2">
                    <p className="text-sm text-default-500 mb-1">Email</p>
                    <p className="text-lg font-semibold">
                      {company.hrContact?.email || "N/A"}
                    </p>
                  </div>
                  <div className="mx-2">
                    <p className="text-sm text-default-500 mb-1">Website</p>
                    {company.hrContact?.website ? (
                      <a
                        href={`${company.hrContact.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-lg font-semibold text-primary hover:underline"
                      >
                        {company.hrContact.website}
                      </a>
                    ) : (
                      <p className="text-lg font-semibold">N/A</p>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>
        </Tab>

        <Tab key="students" title="Candidate Details">
          <div className="flex gap-8 mt-5">
            <div className="w-1/4">
              <Filter
                onFilterChange={handleFilterChange}
                onClearFilters={handleClearFilters}
              />
            </div>
            <div className="w-3/4">
              <CompanyTable data={filteredStudents} />
            </div>
          </div>
        </Tab>

        <Tab key="placements" title="Placement Details">
          <Analytics />
        </Tab>
      </Tabs>
    </motion.div>
  );
};

export default Company;
