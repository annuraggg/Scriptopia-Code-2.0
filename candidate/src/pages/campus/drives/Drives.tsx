import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth";
import {
  Button,
  Card,
  CardBody,
  Chip,
  Divider,
  Input,
  Tooltip,
  Pagination,
} from "@heroui/react";
import {
  Search,
  Briefcase,
  MapPin,
  Users,
  Building2,
  DollarSign,
  ChevronRight,
  Clock,
} from "lucide-react";
import { Delta } from "quill";
import Loader from "@/components/Loader";
import ax from "@/config/axios";

// Type definitions
type JobType =
  | "full_time"
  | "part_time"
  | "contract"
  | "internship"
  | "temporary";
type JobStatus =
  | "applied"
  | "inprogress"
  | "hired"
  | "rejected"
  | "disqualified";

// New types for API response
interface DriveResponse {
  drive: {
    _id: string;
    title: string;
    company: {
      name: string;
      logo?: string;
    };
    applicationRange?: {
      start: string;
      end: string;
    };
    url?: string;
    published: boolean;
    publishedOn: string;
    hasEnded: boolean;
    description?: any;
    salary?: {
      min?: number;
      max?: number;
      currency?: string;
    };
    openings?: number;
    location?: string;
    type?: string;
  };
  status: JobStatus;
  totalCandidates: number;
}

interface ApiResponse {
  drives: DriveResponse[];
  departments: { _id: string; name: string }[];
  pagination: {
    total: number;
    page: number;
    pages: number;
    limit: number;
  };
}

const JOB_TYPE_COLORS: Record<JobType, string> = {
  full_time: "success",
  part_time: "primary",
  contract: "secondary",
  internship: "warning",
  temporary: "danger",
};

const JOB_STATUS_COLORS = {
  applied: "primary",
  inprogress: "warning",
  hired: "success",
  rejected: "danger",
  disqualified: "danger",
  not_applied: "default",
};

/**
 * Home Component - Job listings with search and filters
 */
const Home = () => {
  const [drives, setDrives] = useState<DriveResponse[]>([]);
  const [filteredDrives, setFilteredDrives] = useState<DriveResponse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false);
  const itemsPerPage = 9; // For 3x3 grid

  const { getToken } = useAuth();
  const navigate = useNavigate();
  const axios = ax(getToken);

  // Fetch job drives on component mount and when page changes
  useEffect(() => {
    fetchDrives();
  }, [currentPage]);

  // Apply filters when filter values or drives change
  useEffect(() => {
    applyFilters();
  }, [drives, searchQuery]);

  /**
   * Fetch job drives from API
   */
  const fetchDrives = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(
        `/candidates/drives?page=${currentPage}&limit=${itemsPerPage}`
      );

      if (response.data?.data) {
        const apiResponse = response.data.data as ApiResponse;
        console.log("Fetched drives:", apiResponse);

        setDrives(apiResponse.drives || []);
        setFilteredDrives(apiResponse.drives || []);
        setTotalPages(apiResponse.pagination.pages);
      } else {
        setError("No drive listings available");
      }
    } catch (err) {
      console.error("Failed to fetch drive drives:", err);
      setError("Failed to load drive listings. Please try again later.");
      setDrives([]);
      setFilteredDrives([]);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Apply filters to job drives
   */
  const applyFilters = () => {
    let filtered = [...drives];

    // Apply search query filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (driveItem) =>
          driveItem.drive.title.toLowerCase().includes(query) ||
          driveItem.drive.company?.name?.toLowerCase().includes(query) ||
          driveItem.drive.location?.toLowerCase().includes(query)
      );
    }

    setFilteredDrives(filtered);
  };

  /**
   * Reset all filters
   */
  const clearFilters = () => {
    setSearchQuery("");
  };

  /**
   * Format job type display text
   */
  const normalizeText = (text: string): string => {
    if (!text) return "N/A";
    const titleCase =
      text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    return titleCase.replace(/_/g, " ");
  };

  /**
   * Format application deadline
   */
  const getApplicationDeadline = (driveItem: DriveResponse): string => {
    if (driveItem.drive.hasEnded) return "Closed";
    if (!driveItem.drive.applicationRange?.end) return "Open";

    const endDate = new Date(driveItem.drive.applicationRange.end);
    const now = new Date();
    const diffTime = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return "Expired";
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "1 day left";
    return `${diffDays} days left`;
  };

  /**
   * Format salary range for display
   */
  const formatSalary = (salary?: {
    min?: number;
    max?: number;
    currency?: string;
  }): string => {
    if (!salary?.min && !salary?.max) return "Salary not specified";

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
   * Format description text from Delta format
   */
  const formatDescription = (description?: Delta): string => {
    if (!description?.ops) return "No description provided";

    try {
      return description.ops
        .map((op) => op.insert?.toString() || "")
        .join("")
        .trim()
        .replace(/\n+/g, " ");
    } catch (e) {
      return "No description provided";
    }
  };

  if (loading && drives.length === 0) return <Loader />;

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Header with very subtle gradient background */}
      <div
        className="relative"
        style={{
          background: "url('/wave-top.svg')",
          backgroundSize: "cover",
          backgroundPosition: "top",
          backgroundRepeat: "no-repeat",
          height: "450px",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">
                Explore Opportunities
              </h1>
              <p className="text-gray-300 mt-2 opacity-90">
                Discover and apply to the latest openings tailored for you
              </p>
            </div>

            {/* User info and date in header - positioned at right */}
            <div className="flex flex-col md:flex-row justify-between mb-8">
              <div className="flex items-center gap-8 text-sm">
                <div className="flex items-center">
                  <div className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center mr-3">
                    <Briefcase size={16} className="text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-300 opacity-80">
                      Total Drives
                    </p>
                    <p className="font-semibold text-white">{drives.length}</p>
                  </div>
                </div>

                <div className="flex items-center">
                  <div className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center mr-3">
                    <Users size={16} className="text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-300 opacity-80">Applied</p>
                    <p className="font-semibold text-white">
                      {drives.filter((d) => d.status === "applied").length}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced search bar with fixed icon positioning */}
          <div
            className={`w-full md:max-w-2xl mx-auto transition-all duration-300 ${
              isSearchFocused ? "scale-105" : ""
            }`}
          >
            <div className="relative flex items-center mt-14">
              <Search
                size={20}
                className="absolute left-4 text-gray-400 z-10"
              />
              <Input
                classNames={{
                  base: "h-14",
                  mainWrapper: "h-14",
                  input: "text-base pl-14",
                  inputWrapper:
                    "h-14 bg-white shadow-md border-0 hover:bg-white/90",
                }}
                placeholder="Search drives by title, company, or location..."
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClear={() => setSearchQuery("")}
                isClearable
                radius="lg"
              />
            </div>
          </div>
        </div>

        {/* Improved wave at bottom with no line */}
        <div
          className="absolute bottom-0 left-0 right-0 overflow-hidden"
          style={{ height: "40px" }}
        >
          <div
            className="absolute bottom-0 left-0 right-0 h-40 bg-gray-50"
            style={{
              borderTopLeftRadius: "50% 100%",
              borderTopRightRadius: "50% 100%",
              transform: "scaleX(1.5)",
            }}
          ></div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ">
        {/* Job listings */}
        <div>
          {error ? (
            <Card className="w-full shadow-sm mb-6">
              <CardBody className="flex flex-col items-center justify-center py-12">
                <p className="text-gray-500 mb-3">{error}</p>
                <Button color="primary" onClick={fetchDrives}>
                  Try Again
                </Button>
              </CardBody>
            </Card>
          ) : filteredDrives.length === 0 ? (
            <Card className="w-full shadow-sm mb-6">
              <CardBody className="flex flex-col items-center justify-center py-12">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                  <Briefcase size={24} className="text-gray-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  No drives found
                </h3>
                <p className="text-gray-500 mb-4 text-center">
                  We couldn't find any drives matching your criteria.
                </p>
                <Button color="primary" onClick={clearFilters}>
                  Clear Search
                </Button>
              </CardBody>
            </Card>
          ) : (
            <>
              {/* 3x3 Grid layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
                {filteredDrives.map((driveItem) => {
                  const drive = driveItem.drive;
                  const status = driveItem.status || "not_applied";
                  const deadline = getApplicationDeadline(driveItem);
                  const isDeadlineSoon =
                    deadline.includes("day") && parseInt(deadline) <= 3;

                  return (
                    <Card
                      key={drive._id}
                      className="shadow-sm hover:shadow-xl transition-all duration-300 border-none overflow-hidden"
                      isPressable
                      onPress={() => navigate(`${drive._id}`)}
                    >
                      <CardBody className="p-0">
                        {/* Card header with very subtle gradient */}
                        <div className="relative">
                          <div
                            className="h-28 p-4 flex items-center bg-opacity-10"
                            style={{
                              background:
                                "linear-gradient(to right, #262a37, #2d323f, #32384f)",
                            }}
                          >
                            <div className="absolute bottom-0 right-4 transform translate-y-1/2">
                              <div
                                className="w-16 h-16 rounded-xl bg-white shadow-lg flex items-center justify-center p-2"
                                style={{
                                  backgroundSize: "cover",
                                  backgroundPosition: "center",
                                  backgroundImage: drive.company?.logo
                                    ? `url(${drive.company.logo})`
                                    : "none",
                                }}
                              >
                                {!drive.company?.logo && (
                                  <Building2 className="w-full h-full text-gray-400" />
                                )}
                              </div>
                            </div>

                            {/* Application status badge */}
                            <Chip
                              size="sm"
                              color={JOB_STATUS_COLORS[status] as any}
                              className="absolute top-3 right-3"
                            >
                              {normalizeText(status)}
                            </Chip>
                          </div>
                        </div>

                        {/* Card content */}
                        <div className="px-5 pt-8 pb-5">
                          <div className="mb-1 flex items-center justify-between">
                            <span className="text-xs text-gray-500">
                              {drive.company?.name || "Unknown Organization"}
                            </span>
                            <Tooltip
                              content={`${
                                driveItem.totalCandidates || 0
                              } applicants`}
                            >
                              <div className="flex items-center text-xs text-gray-500 mt-5">
                                <Users size={12} className="mr-1" />
                                <span>{driveItem.totalCandidates || 0}</span>
                              </div>
                            </Tooltip>
                          </div>

                          <h3 className="font-bold text-gray-800 text-lg mt-1 mb-3 truncate overflow-hidden">
                            {drive?.title || "Untitled Position"}
                          </h3>

                          <div className="flex flex-wrap gap-2 mb-4">
                            {drive?.type && (
                              <Tooltip
                                content={`Drive Type: ${normalizeText(
                                  drive.type
                                )}`}
                              >
                                <Chip
                                  color={
                                    (JOB_TYPE_COLORS[
                                      drive.type.toLowerCase() as JobType
                                    ] as any) || "default"
                                  }
                                  variant="flat"
                                  size="sm"
                                  startContent={<Briefcase size={12} />}
                                  className="h-6"
                                >
                                  {normalizeText(drive.type)}
                                </Chip>
                              </Tooltip>
                            )}

                            {drive?.location && (
                              <Tooltip content={`Location: ${drive.location}`}>
                                <Chip
                                  color="default"
                                  variant="flat"
                                  size="sm"
                                  startContent={<MapPin size={12} />}
                                  className="h-6"
                                >
                                  {drive.location}
                                </Chip>
                              </Tooltip>
                            )}

                            {drive?.openings && (
                              <Tooltip
                                content={`${drive.openings} positions available`}
                              >
                                <Chip
                                  color="secondary"
                                  variant="flat"
                                  size="sm"
                                  className="h-6"
                                >
                                  {drive.openings}{" "}
                                  {drive.openings === 1
                                    ? "Opening"
                                    : "Openings"}
                                </Chip>
                              </Tooltip>
                            )}
                          </div>

                          <p className="text-sm text-gray-600 line-clamp-2 min-h-[2.5rem] mb-4">
                            {formatDescription(
                              drive?.description as unknown as Delta
                            )}
                          </p>

                          <Divider className="my-4" />

                          <div className="flex items-center justify-between">
                            {/* Salary */}
                            <Tooltip content={formatSalary(drive?.salary)}>
                              <div className="flex items-center text-xs text-gray-500">
                                <DollarSign size={14} className="mr-1" />
                                <span className="line-clamp-1 max-w-[120px]">
                                  {formatSalary(drive?.salary)}
                                </span>
                              </div>
                            </Tooltip>

                            {/* Deadline */}
                            <Tooltip
                              content={`Application deadline: ${deadline}`}
                            >
                              <div className="flex items-center text-xs">
                                <Clock
                                  size={14}
                                  className={`mr-1 ${
                                    isDeadlineSoon
                                      ? "text-danger"
                                      : "text-gray-500"
                                  }`}
                                />
                                <span
                                  className={
                                    isDeadlineSoon
                                      ? "text-danger font-medium"
                                      : "text-gray-500"
                                  }
                                >
                                  {deadline}
                                </span>
                              </div>
                            </Tooltip>
                          </div>

                          <Button
                            color="primary"
                            variant="flat"
                            size="md"
                            className="mt-5 w-full font-medium"
                            endContent={<ChevronRight size={16} />}
                            radius="lg"
                          >
                            View Details
                          </Button>
                        </div>
                      </CardBody>
                    </Card>
                  );
                })}
              </div>
            </>
          )}

          {/* Enhanced pagination with more space */}
          {/* Results count */}
          <div className="flex justify-between items-center mb-5">
            <p className="text-sm text-gray-500">
              Showing{" "}
              <span className="font-medium">{filteredDrives.length}</span>{" "}
              results
            </p>
          </div>
          {totalPages > 1 && (
            <div className="flex justify-center my-10">
              <Pagination
                total={totalPages}
                initialPage={1}
                page={currentPage}
                onChange={setCurrentPage}
                showControls
                size="lg"
                classNames={{
                  wrapper: "gap-0.5",
                  item: "bg-white border-gray-200 shadow-sm",
                  cursor: "bg-gray-800 text-white font-medium",
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Home;
