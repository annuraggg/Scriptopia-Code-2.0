import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  CheckboxGroup,
  Chip,
  Divider,
  Input,
  Slider,
  Pagination,
  Tooltip,
} from "@heroui/react";
import {
  Search,
  Clock,
  DotIcon,
  Building,
  MapPin,
  Users,
  Briefcase,
  X,
  ChevronRight,
} from "lucide-react";
import { Delta } from "quill";

import Loader from "@/components/Loader";
import ax from "@/config/axios";
import { ExtendedPosting } from "@shared-types/ExtendedPosting";

// Type definitions for better type safety
type JobType =
  | "full_time"
  | "part_time"
  | "contract"
  | "internship"
  | "temporary";
type SalaryRange = [number, number];

interface JobTypeOption {
  value: JobType;
  label: string;
}

// API pagination interface
interface PaginationData {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

// Constants
const JOB_TYPES: JobTypeOption[] = [
  { value: "full_time", label: "Full Time" },
  { value: "part_time", label: "Part Time" },
  { value: "contract", label: "Contract" },
  { value: "internship", label: "Internship" },
  { value: "temporary", label: "Temporary" },
];

const JOB_TYPE_COLORS: Record<
  JobType,
  "success" | "primary" | "secondary" | "warning" | "danger"
> = {
  full_time: "success",
  part_time: "primary",
  contract: "secondary",
  internship: "warning",
  temporary: "danger",
};

/**
 * Home Component - Job listings page with filtering and search capabilities
 */
const Home = () => {
  // State management
  const [postings, setPostings] = useState<ExtendedPosting[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedJobTypes, setSelectedJobTypes] = useState<JobType[]>([]);
  const [salaryRange, setSalaryRange] = useState<SalaryRange>([0, 1000000]);
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [paginationData, setPaginationData] = useState<PaginationData>({
    page: 1,
    limit: 10,
    totalItems: 0,
    totalPages: 0,
  });

  // Constants
  const DEFAULT_SALARY_MAX = 1000000;
  const DEFAULT_LIMIT = 10;

  // Hooks
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const axios = ax(getToken);

  // Fetch job postings when page or filters change
  useEffect(() => {
    fetchPostings();
  }, [currentPage]);

  // Fetch job postings with debounce for filters
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1); // Reset to first page when filters change
      fetchPostings();
    }, 500);

    return () => clearTimeout(timer);
  }, [selectedJobTypes, salaryRange, searchQuery]);

  /**
   * Fetch job postings from API with pagination
   */
  const fetchPostings = async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      // Build query parameters for pagination
      const params = new URLSearchParams();
      params.append("page", currentPage.toString());
      params.append("limit", DEFAULT_LIMIT.toString());

      // Add filters if any
      if (selectedJobTypes.length > 0) {
        // Convert job types to query parameter
        params.append("type", selectedJobTypes.join(","));
      }

      if (salaryRange[0] > 0) {
        params.append("minSalary", salaryRange[0].toString());
      }

      if (salaryRange[1] < DEFAULT_SALARY_MAX) {
        params.append("maxSalary", salaryRange[1].toString());
      }

      if (searchQuery.trim()) {
        params.append("search", searchQuery.trim());
      }

      const response = await axios.get(
        `/postings/candidate/postings?${params.toString()}`
      );

      if (response.data?.data !== undefined) {
        console.log("Fetched postings:", response.data.data.data);
        console.log("Pagination:", response.data.pagination);
        setPostings(response.data.data.data);
        setPaginationData(response.data.data.pagination);
      } else {
        setError("No job postings available");
        setPostings([]);
        setPaginationData({
          page: 1,
          limit: DEFAULT_LIMIT,
          totalItems: 0,
          totalPages: 0,
        });
      }
    } catch (err) {
      console.error("Failed to fetch job postings:", err);
      setError("Failed to fetch job postings. Please try again later.");
      setPostings([]);
      setPaginationData({
        page: 1,
        limit: DEFAULT_LIMIT,
        totalItems: 0,
        totalPages: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * Format job type for display
   */
  const normalizeText = (text?: string): string => {
    if (!text) return "N/A";
    const titleCase =
      text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    return titleCase.replace(/_/g, " ");
  };

  /**
   * Calculate days since posting
   */
  const getAgoDays = (date?: Date | string): string => {
    if (!date) return "Recently";

    try {
      const today = new Date();
      const createdAt = new Date(date);
      const diffTime = Math.abs(today.getTime() - createdAt.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return "Today";
      if (diffDays === 1) return "Yesterday";
      return `${diffDays} days ago`;
    } catch (e) {
      return "Recently";
    }
  };

  /**
   * Format posting description from Delta format
   */
  const formatDescription = (description?: Delta): string => {
    if (!description?.ops) return "";
    try {
      return description.ops
        .map((op) => op?.insert?.toString() || "")
        .join("")
        .trim();
    } catch (e) {
      return "";
    }
  };

  /**
   * Format salary for display
   */
  const formatSalary = (salary?: {
    min?: number;
    max?: number;
    currency?: string;
  }): string => {
    if (!salary || (!salary.min && !salary.max)) return "Salary not specified";

    const currency = salary.currency?.toUpperCase() || "USD";
    const formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    });

    if (salary.min && salary.max) {
      return `${formatter.format(salary.min)} - ${formatter.format(
        salary.max
      )}`;
    } else if (salary.min) {
      return `From ${formatter.format(salary.min)}`;
    } else if (salary.max) {
      return `Up to ${formatter.format(salary.max)}`;
    }

    return "Salary not specified";
  };

  /**
   * Handle job type selection change
   */
  const handleJobTypeChange = (values: string[]): void => {
    setSelectedJobTypes(values as JobType[]);
  };

  /**
   * Handle salary range change
   */
  const handleSalaryChange = (value: number | number[]): void => {
    if (Array.isArray(value)) {
      setSalaryRange(value as SalaryRange);
    }
  };

  /**
   * Reset all filters to default values
   */
  const clearFilters = (): void => {
    setSelectedJobTypes([]);
    setSalaryRange([0, DEFAULT_SALARY_MAX]);
    setSearchQuery("");
  };

  if (loading && postings.length === 0) return <Loader />;

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="mx-auto p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Job Listings</h1>
            <p className="text-gray-500 mt-1">
              {paginationData.totalItems}{" "}
              {paginationData.totalItems === 1
                ? "opportunity"
                : "opportunities"}{" "}
              found
            </p>
          </div>
        </div>

        {/* Main content */}
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Filters sidebar */}
          <div className="lg:w-1/4 w-full space-y-5">
            <Card className="shadow-sm">
              <CardBody className="p-4">
                <Input
                  placeholder="Search job titles, companies, locations..."
                  startContent={<Search size={16} className="text-gray-400" />}
                  endContent={
                    searchQuery ? (
                      <Button
                        isIconOnly
                        variant="light"
                        size="sm"
                        onClick={() => setSearchQuery("")}
                      >
                        <X size={16} />
                      </Button>
                    ) : null
                  }
                  className="w-full"
                  variant="bordered"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </CardBody>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="flex justify-between">
                <h3 className="text-md font-semibold text-gray-700">
                  Job Type
                </h3>
                <Button
                  variant="light"
                  color="danger"
                  size="sm"
                  onClick={clearFilters}
                  className="text-sm"
                >
                  Clear filters
                </Button>
              </CardHeader>
              <CardBody>
                <CheckboxGroup
                  value={selectedJobTypes}
                  onChange={handleJobTypeChange}
                  className="gap-2"
                >
                  {JOB_TYPES.map((jobType) => (
                    <Checkbox key={jobType.value} value={jobType.value}>
                      <span className="text-sm">{jobType.label}</span>
                    </Checkbox>
                  ))}
                </CheckboxGroup>
              </CardBody>
            </Card>

            <Card className="shadow-sm">
              <CardHeader>
                <h3 className="text-md font-semibold text-gray-700">
                  Salary Range
                </h3>
              </CardHeader>
              <CardBody>
                <Slider
                  value={salaryRange}
                  onChange={handleSalaryChange}
                  formatOptions={{ style: "currency", currency: "USD" }}
                  label="Annual salary"
                  maxValue={DEFAULT_SALARY_MAX}
                  minValue={0}
                  step={5000}
                  className="max-w-md"
                />
                <div className="flex justify-between mt-2 text-xs text-gray-500">
                  <span>
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                      maximumFractionDigits: 0,
                    }).format(salaryRange[0])}
                  </span>
                  <span>
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                      maximumFractionDigits: 0,
                    }).format(salaryRange[1])}
                  </span>
                </div>
              </CardBody>
            </Card>
          </div>

          {/* Job listings */}
          <div className="lg:w-3/4 w-full">
            {error ? (
              <Card className="shadow-sm p-8 text-center">
                <div className="flex flex-col items-center justify-center py-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {error}
                  </h3>
                  <p className="text-gray-500 mb-4">
                    Unable to load job listings at this time.
                  </p>
                  <Button color="primary" onClick={fetchPostings}>
                    Retry
                  </Button>
                </div>
              </Card>
            ) : postings.length === 0 && !loading ? (
              <Card className="shadow-sm p-8 text-center">
                <div className="flex flex-col items-center justify-center py-6">
                  <div className="bg-gray-100 p-3 rounded-full mb-4">
                    <Briefcase size={24} className="text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No job listings found
                  </h3>
                  <p className="text-gray-500 mb-4">
                    Try adjusting your filters or search criteria.
                  </p>
                  <Button color="primary" onClick={clearFilters}>
                    Reset Filters
                  </Button>
                </div>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
                  {postings.map((posting) => (
                    <Card
                      key={posting._id}
                      className="shadow-sm hover:shadow-md transition-shadow"
                      isPressable
                      onPress={() => navigate(`/postings/${posting.url}`)}
                    >
                      <CardBody className="p-5">
                        <div className="flex gap-4 mb-3">
                          <div
                            className="w-14 h-14 rounded-xl bg-gray-100 flex-shrink-0 flex items-center justify-center"
                            style={
                              posting?.organizationId?.logo
                                ? {
                                    backgroundImage: `url(${posting.organizationId.logo})`,
                                    backgroundSize: "cover",
                                    backgroundPosition: "center",
                                  }
                                : undefined
                            }
                          >
                            {!posting?.organizationId?.logo && (
                              <Building size={24} className="text-gray-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-gray-900 line-clamp-1">
                              {posting?.title || "Untitled Position"}
                            </h3>
                            <div className="flex items-center text-sm text-gray-600 mt-1">
                              <p className="truncate">
                                {posting?.organizationId?.name ||
                                  "Unknown Organization"}
                              </p>
                              <DotIcon className="mx-1" size={16} />
                              <div className="flex items-center">
                                <Users size={14} className="mr-1" />
                                <span>
                                  {posting?.candidates?.length || 0} applicants
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 my-3">
                          {posting?.type && (
                            <Tooltip content={normalizeText(posting.type)}>
                              <Chip
                                color={
                                  JOB_TYPE_COLORS[
                                    posting.type.toLowerCase() as JobType
                                  ] || "default"
                                }
                                variant="flat"
                                size="sm"
                                startContent={<Briefcase size={12} />}
                              >
                                {normalizeText(posting.type)}
                              </Chip>
                            </Tooltip>
                          )}

                          {posting?.location && (
                            <Tooltip content={posting.location}>
                              <Chip
                                color="warning"
                                variant="flat"
                                size="sm"
                                startContent={<MapPin size={12} />}
                              >
                                {posting.location}
                              </Chip>
                            </Tooltip>
                          )}

                          {posting?.openings && (
                            <Tooltip
                              content={`${posting.openings} positions available`}
                            >
                              <Chip color="danger" variant="flat" size="sm">
                                {posting.openings}{" "}
                                {posting.openings === 1
                                  ? "Opening"
                                  : "Openings"}
                              </Chip>
                            </Tooltip>
                          )}
                        </div>

                        <p className="text-sm text-gray-600 line-clamp-2 h-10">
                          {formatDescription(
                            posting?.description as unknown as Delta
                          )}
                        </p>

                        <Divider className="my-3" />

                        <div className="flex justify-between items-center text-xs text-gray-500">
                          <div>
                            {posting?.salary && formatSalary(posting.salary)}
                          </div>

                          <div className="flex items-center gap-1">
                            <Clock size={14} />
                            <span>
                              Posted{" "}
                              {getAgoDays(
                                posting?.publishedOn || posting?.createdAt
                              )}
                            </span>
                          </div>
                        </div>

                        <Button
                          color="primary"
                          variant="flat"
                          size="sm"
                          className="w-full mt-3"
                          endContent={<ChevronRight size={16} />}
                        >
                          View Details
                        </Button>
                      </CardBody>
                    </Card>
                  ))}
                </div>

                {/* Server-side pagination */}
                {paginationData.totalPages > 1 && (
                  <div className="flex justify-center mt-6">
                    <Pagination
                      total={paginationData.totalPages}
                      page={currentPage}
                      onChange={(page) => setCurrentPage(page)}
                      showControls
                    />
                  </div>
                )}

                {/* Loading indicator when changing pages */}
                {loading && postings.length > 0 && (
                  <div className="flex justify-center mt-4">
                    <Loader />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
