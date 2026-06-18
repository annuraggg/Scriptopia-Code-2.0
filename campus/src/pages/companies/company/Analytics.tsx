import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card,
  CardHeader,
  CardBody,
  Chip,
  Divider,
  Spinner,
  Tab,
  Tabs,
  Progress,
  Avatar,
  Button,
  Select,
  SelectItem,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Pagination,
} from "@nextui-org/react";
import { useAuth } from "@/auth";
import { motion } from "framer-motion";
import ax from "@/config/axios";
import { toast } from "react-toastify";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  Legend,
  PieChart,
  Pie,
  LineChart,
  Line,
  ComposedChart,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ScatterChart,
  Scatter,
  ZAxis,
  Treemap,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Users,
  Briefcase,
  BarChart2,
  Database,
  School,
  Code2,
  CheckCircle,
  XCircle,
  DollarSign,
  Building,
  Filter,
  Download,
  RefreshCw,
  Search,
} from "lucide-react";

interface YearwiseHiringStats {
  year: string;
  hired: number;
  totalApplicants: number;
  applicationRate: number;
  offerAcceptanceRate: number;
  averageSalary: number;
  highestSalary: number;
}

interface CandidateEducationStats {
  degreeDistribution: Record<string, number>;
  schoolDistribution: Record<string, number>;
  branchDistribution: Record<string, number>;
  averagePercentage: number;
}

interface CandidateSkillStats {
  topSkills: Array<{ skill: string; count: number }>;
  skillDistribution: Record<string, number>;
  averageProficiency: Record<string, number>;
}

interface CandidateWorkStats {
  previousCompanies: Array<{ company: string; count: number }>;
  averageWorkExperience: number;
  workTypeDistribution: Record<string, number>;
}

interface DriveStats {
  totalDrives: number;
  activeCount: number;
  completedCount: number;
  averageApplicationsPerDrive: number;
  averageHiresPerDrive: number;
  driveTypesDistribution: Record<string, number>;
  averageDriveDuration: number;
  mostCommonSkillsRequired: Array<{ skill: string; count: number }>;
}

interface InstituteRelationStats {
  topInstitutes: Array<{
    institute: string;
    hiredCount: number;
    instituteId: string;
  }>;
  institutePlacementRate: Record<string, number>;
}

interface ApplicationFunnelStats {
  total: number;
  byStage: Record<string, number>;
  stageConversionRates: Record<string, number>;
  averageTimeInStage: Record<string, number>;
}

interface SalaryStats {
  overallAverage: number;
  overallMedian: number;
  byYear: Record<string, { average: number; highest: number; lowest: number }>;
  byRole: Record<string, { average: number; highest: number; lowest: number }>;
}

interface CompanyAnalytics {
  overview: {
    totalHired: number;
    totalApplicants: number;
    overallAcceptanceRate: number;
    totalDrives: number;
    averageSalary: number;
    highestSalary: number;
  };
  yearwiseStats: YearwiseHiringStats[];
  candidateEducationStats: CandidateEducationStats;
  candidateSkillStats: CandidateSkillStats;
  candidateWorkStats: CandidateWorkStats;
  driveStats: DriveStats;
  instituteRelationStats: InstituteRelationStats;
  applicationFunnelStats: ApplicationFunnelStats;
  salaryStats: SalaryStats;
  topScoringCandidates: Array<{
    id: string;
    name: string;
    email: string;
    score: number;
    hired: boolean;
    institute: string;
  }>;
}

interface HiringTrends {
  monthly: Array<{
    year: string;
    month: number;
    applications: number;
    hired: number;
    rejected: number;
    inProgress: number;
  }>;
  yearly: Array<{
    year: string;
    applications: number;
    hired: number;
    rejected: number;
    inProgress: number;
    averageSalary: number;
  }>;
}

interface SkillDemand {
  topSkills: Array<{ skill: string; count: number; percentage: number }>;
  skillGaps: Array<{
    skill: string;
    demandPercentage: number;
    availabilityPercentage: number;
    gap: number;
  }>;
  categorizedSkills: Record<
    string,
    Array<{ skill: string; count: number; percentage: number }>
  >;
  skillTrends: Record<string, Array<{ year: number; percentage: number }>>;
}

interface CandidateSources {
  instituteSources: Array<{
    name: string;
    id: string;
    totalCandidates: number;
    hiredCandidates: number;
    hireRate: number;
  }>;
  hiringCycleTimes: Array<{
    timeRange: string;
    count: number;
    averageDays: number;
  }>;
  topSources: Array<{
    name: string;
    id: string;
    totalCandidates: number;
    hiredCandidates: number;
    hireRate: number;
  }>;
  totalCandidates: number;
  totalHired: number;
  overallHireRate: number;
}

const COLORS = [
  "#3b82f6", // blue-500
  "#22c55e", // green-500
  "#ef4444", // red-500
  "#8b5cf6", // violet-500
  "#f59e0b", // amber-500
  "#06b6d4", // cyan-500
  "#ec4899", // pink-500
  "#6366f1", // indigo-500
  "#14b8a6", // teal-500
  "#f43f5e", // rose-500
  "#8b5cf6", // violet-500
  "#0ea5e9", // sky-500
];

const staggerAnimation = {
  container: {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  },
  item: {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  },
};

const renderCustomizedTreemapContent = (props: any) => {
  const { depth, x, y, width, height, name, size } = props;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill: props.fill,
          stroke: "#fff",
          strokeWidth: 2 / (depth + 1e-10),
          strokeOpacity: 1 / (depth + 1e-10),
        }}
      />
      {width > 30 && height > 30 && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 7}
          textAnchor="middle"
          fill="#fff"
          fontSize={14}
        >
          {name}
        </text>
      )}
      {width > 30 && height > 30 && (
        <text
          x={x + width / 2}
          y={y + height / 2 - 7}
          textAnchor="middle"
          fill="#fff"
          fontSize={16}
          fontWeight="bold"
        >
          {size}
        </text>
      )}
    </g>
  );
};

const CompanyAnalytics: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getToken } = useAuth();
  const axios = ax(getToken);

  const [analytics, setAnalytics] = useState<CompanyAnalytics | null>(null);
  const [hiringTrends, setHiringTrends] = useState<HiringTrends | null>(null);
  const [skillDemand, setSkillDemand] = useState<SkillDemand | null>(null);
  const [candidateSources, setCandidateSources] =
    useState<CandidateSources | null>(null);
  const [company, setCompany] = useState<{
    name: string;
    logo?: string;
  } | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [timeRange, setTimeRange] = useState<string>("yearly");
  const [chartType, setChartType] = useState<string>("bar");
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (id) {
      fetchAll();
    } else {
      setError("No company ID provided");
      setLoading(false);
    }
  }, [id]);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);

    try {
      await fetchCompany();

      await Promise.all([
        fetchAnalytics(),
        fetchHiringTrends(),
        fetchSkillDemand(),
        fetchCandidateSources(),
      ]);
    } catch (err) {
      console.error("Error fetching analytics data:", err);
      setError("Failed to load analytics data. Please try again.");
      toast.error("Failed to load analytics data");
    } finally {
      setLoading(false);
    }
  };

  const fetchCompany = async () => {
    try {
      const response = await axios.get(`/companies/${id}`);
      if (response.data?.data?.company) {
        setCompany(response.data.data.company);
      }
    } catch (err) {
      console.error("Error fetching company details:", err);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await axios.get(`/companies/analytics/${id}`);
      if (response.data?.data) {
        setAnalytics(response.data.data);
      } else {
        throw new Error("Invalid data format received");
      }
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.message || "Failed to load analytics";
      console.error("Error fetching analytics:", err);
      throw new Error(errorMessage);
    }
  };

  const fetchHiringTrends = async () => {
    try {
      const response = await axios.get(
        `/companies/analytics/hiring-trends/${id}`
      );
      if (response.data?.data) {
        setHiringTrends(response.data.data);
      } else {
        throw new Error("Invalid hiring trends data format received");
      }
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.message || "Failed to load hiring trends";
      console.error("Error fetching hiring trends:", err);
      throw new Error(errorMessage);
    }
  };

  const fetchSkillDemand = async () => {
    try {
      const response = await axios.get(
        `/companies/analytics/skill-demand/${id}`
      );
      if (response.data?.data) {
        setSkillDemand(response.data.data);
      } else {
        throw new Error("Invalid skill demand data format received");
      }
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.message || "Failed to load skill demand data";
      console.error("Error fetching skill demand:", err);
      throw new Error(errorMessage);
    }
  };

  const fetchCandidateSources = async () => {
    try {
      const response = await axios.get(
        `/companies/analytics/candidate-sources/${id}`
      );
      if (response.data?.data) {
        setCandidateSources(response.data.data);
      } else {
        throw new Error("Invalid candidate sources data format received");
      }
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.message || "Failed to load candidate sources data";
      console.error("Error fetching candidate sources:", err);
      throw new Error(errorMessage);
    }
  };

  const handleRefresh = () => {
    fetchAll();
    toast.success("Refreshing analytics data...");
  };

  const handleExport = () => {
    setIsExporting(true);

    setTimeout(() => {
      const dataStr = JSON.stringify({
        analytics,
        hiringTrends,
        skillDemand,
        candidateSources,
      });

      const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(
        dataStr
      )}`;

      const exportFileDefaultName = `company_analytics_${id}_${new Date()
        .toISOString()
        .slice(0, 10)}.json`;

      const linkElement = document.createElement("a");
      linkElement.setAttribute("href", dataUri);
      linkElement.setAttribute("download", exportFileDefaultName);
      linkElement.click();

      setIsExporting(false);
      toast.success("Analytics data exported successfully!");
    }, 500);
  };

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number): string => {
    return `${value.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <Spinner size="lg" color="primary" />
        <p className="mt-4 text-gray-600">Loading analytics data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="p-6 bg-white rounded-lg shadow-md text-center">
          <XCircle className="mx-auto text-red-500 w-12 h-12 mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Error Loading Analytics
          </h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <Button color="primary" onClick={() => navigate(-1)}>
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  if (!analytics || !hiringTrends || !skillDemand || !candidateSources) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <div className="p-6 bg-white rounded-lg shadow-md text-center">
          <Database className="mx-auto text-gray-400 w-12 h-12 mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            No Data Available
          </h2>
          <p className="text-gray-600 mb-6">
            There is no analytics data available for this company.
          </p>
          <div className="flex gap-4 justify-center">
            <Button color="primary" onClick={handleRefresh}>
              Refresh Data
            </Button>
            <Button variant="bordered" onClick={() => navigate(-1)}>
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-gray-50 pb-12"
    >
      <motion.div
        className="bg-white shadow-sm"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {company?.logo ? (
                <Avatar src={company.logo} className="h-12 w-12" />
              ) : (
                <Avatar
                  name={company?.name || "Company"}
                  className="h-12 w-12"
                />
              )}
              <div>
                <h1 className="text-2xl font-bold text-gray-800">
                  {company?.name || "Company"} Analytics
                </h1>
                <p className="text-gray-500">
                  Comprehensive performance insights and metrics
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="flat"
                color="primary"
                startContent={<RefreshCw size={16} />}
                onClick={handleRefresh}
              >
                Refresh
              </Button>
              <Button
                size="sm"
                variant="flat"
                startContent={<Download size={16} />}
                onClick={handleExport}
                isLoading={isExporting}
              >
                Export Data
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="container mx-auto px-4 mt-8">
        <Tabs
          aria-label="Analytics Tabs"
          selectedKey={activeTab}
          onSelectionChange={(key) => setActiveTab(key as string)}
          color="primary"
          variant="underlined"
          classNames={{
            tabList: "bg-white shadow-sm rounded-xl p-1",
            cursor: "bg-primary/20",
            tab: "h-10 data-[hover=true]:text-primary",
          }}
        >
          <Tab
            key="overview"
            title={
              <div className="flex items-center gap-2">
                <BarChart2 size={16} />
                <span>Overview</span>
              </div>
            }
          />
          <Tab
            key="hiring"
            title={
              <div className="flex items-center gap-2">
                <TrendingUp size={16} />
                <span>Hiring Trends</span>
              </div>
            }
          />
          <Tab
            key="skills"
            title={
              <div className="flex items-center gap-2">
                <Code2 size={16} />
                <span>Skills Analysis</span>
              </div>
            }
          />
          <Tab
            key="candidates"
            title={
              <div className="flex items-center gap-2">
                <Users size={16} />
                <span>Candidate Sources</span>
              </div>
            }
          />
          <Tab
            key="education"
            title={
              <div className="flex items-center gap-2">
                <School size={16} />
                <span>Education Insights</span>
              </div>
            }
          />
          <Tab
            key="salary"
            title={
              <div className="flex items-center gap-2">
                <DollarSign size={16} />
                <span>Salary Analysis</span>
              </div>
            }
          />
        </Tabs>
      </div>

      <div className="container mx-auto px-4 mt-6">
        {activeTab === "overview" && (
          <motion.div
            initial="hidden"
            animate="show"
            variants={staggerAnimation.container}
          >
            <motion.div
              variants={staggerAnimation.item}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
            >
              <Card shadow="sm" className="border border-gray-200">
                <CardBody className="gap-1">
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-medium text-gray-500">
                      Total Hired
                    </p>
                    <Users className="text-primary w-5 h-5" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800">
                    {analytics.overview.totalHired.toLocaleString()}
                  </h3>
                  <p className="text-xs text-gray-400">
                    From {analytics.overview.totalApplicants.toLocaleString()}{" "}
                    applicants
                  </p>
                </CardBody>
              </Card>

              <Card shadow="sm" className="border border-gray-200">
                <CardBody className="gap-1">
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-medium text-gray-500">
                      Acceptance Rate
                    </p>
                    <CheckCircle className="text-green-500 w-5 h-5" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800">
                    {formatPercent(analytics.overview.overallAcceptanceRate)}
                  </h3>
                  <p className="text-xs text-gray-400">
                    Overall offer acceptance rate
                  </p>
                </CardBody>
              </Card>

              <Card shadow="sm" className="border border-gray-200">
                <CardBody className="gap-1">
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-medium text-gray-500">
                      Average Salary
                    </p>
                    <DollarSign className="text-amber-500 w-5 h-5" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800">
                    {formatCurrency(analytics.overview.averageSalary)}
                  </h3>
                  <p className="text-xs text-gray-400">
                    Highest: {formatCurrency(analytics.overview.highestSalary)}
                  </p>
                </CardBody>
              </Card>

              <Card shadow="sm" className="border border-gray-200">
                <CardBody className="gap-1">
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-medium text-gray-500">
                      Total Drives
                    </p>
                    <Briefcase className="text-violet-500 w-5 h-5" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800">
                    {analytics.overview.totalDrives.toLocaleString()}
                  </h3>
                  <div className="flex items-center gap-2">
                    <Chip size="sm" variant="flat" color="success">
                      {analytics.driveStats.activeCount} Active
                    </Chip>
                    <Chip size="sm" variant="flat" color="default">
                      {analytics.driveStats.completedCount} Completed
                    </Chip>
                  </div>
                </CardBody>
              </Card>
            </motion.div>

            <motion.div variants={staggerAnimation.item} className="mb-8">
              <Card shadow="sm" className="border border-gray-200">
                <CardHeader className="flex justify-between">
                  <h3 className="text-xl font-semibold text-gray-800">
                    Hiring Trends
                  </h3>
                  <Select
                    size="sm"
                    label="Time Period"
                    className="w-40"
                    defaultSelectedKeys={["yearly"]}
                    onChange={(e) => setTimeRange(e.target.value)}
                  >
                    <SelectItem key="yearly" value="yearly">
                      Yearly
                    </SelectItem>
                    <SelectItem key="monthly" value="monthly">
                      Monthly
                    </SelectItem>
                  </Select>
                </CardHeader>
                <CardBody>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={
                          timeRange === "yearly"
                            ? hiringTrends.yearly
                            : hiringTrends.monthly
                        }
                        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient
                            id="colorHired"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#3b82f6"
                              stopOpacity={0.8}
                            />
                            <stop
                              offset="95%"
                              stopColor="#3b82f6"
                              stopOpacity={0}
                            />
                          </linearGradient>
                          <linearGradient
                            id="colorApplications"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="#8b5cf6"
                              stopOpacity={0.8}
                            />
                            <stop
                              offset="95%"
                              stopColor="#8b5cf6"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <XAxis
                          dataKey={
                            timeRange === "yearly"
                              ? "year"
                              : (item) => `${item.year}-${item.month}`
                          }
                          tick={{ fontSize: 12 }}
                        />
                        <YAxis tick={{ fontSize: 12 }} />
                        <CartesianGrid strokeDasharray="3 3" />
                        <RechartsTooltip
                          contentStyle={{
                            backgroundColor: "#fff",
                            borderRadius: "8px",
                            boxShadow: "0 2px 10px rgba(0, 0, 0, 0.1)",
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="applications"
                          stroke="#8b5cf6"
                          fillOpacity={1}
                          fill="url(#colorApplications)"
                          name="Applications"
                        />
                        <Area
                          type="monotone"
                          dataKey="hired"
                          stroke="#3b82f6"
                          fillOpacity={1}
                          fill="url(#colorHired)"
                          name="Hired"
                        />
                        <Legend />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardBody>
              </Card>
            </motion.div>

            <motion.div
              variants={staggerAnimation.item}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"
            >
              <Card shadow="sm" className="border border-gray-200">
                <CardHeader>
                  <h3 className="text-xl font-semibold text-gray-800">
                    Top Required Skills
                  </h3>
                </CardHeader>
                <CardBody>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        layout="vertical"
                        data={skillDemand.topSkills.slice(0, 8)}
                        margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                      >
                        <XAxis type="number" tick={{ fontSize: 12 }} />
                        <YAxis
                          dataKey="skill"
                          type="category"
                          width={100}
                          tick={{ fontSize: 12 }}
                        />
                        <RechartsTooltip
                          contentStyle={{
                            backgroundColor: "#fff",
                            borderRadius: "8px",
                            boxShadow: "0 2px 10px rgba(0, 0, 0, 0.1)",
                          }}
                        />
                        <CartesianGrid strokeDasharray="3 3" />
                        <Bar
                          dataKey="count"
                          fill="#3b82f6"
                          radius={[0, 4, 4, 0]}
                        >
                          {skillDemand.topSkills.slice(0, 8).map((_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardBody>
              </Card>

              <Card shadow="sm" className="border border-gray-200">
                <CardHeader>
                  <h3 className="text-xl font-semibold text-gray-800">
                    Application Funnel
                  </h3>
                </CardHeader>
                <CardBody>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={Object.entries(
                            analytics.applicationFunnelStats.byStage
                          ).map(([name, value]) => ({ name, value }))}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          innerRadius={40}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percent }) =>
                            `${name}: ${(percent * 100).toFixed(1)}%`
                          }
                        >
                          {Object.entries(
                            analytics.applicationFunnelStats.byStage
                          ).map((_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <RechartsTooltip
                          formatter={(value) => [`${value} applicants`, ""]}
                        />
                        <Legend
                          layout="vertical"
                          verticalAlign="middle"
                          align="right"
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardBody>
              </Card>
            </motion.div>

            <motion.div variants={staggerAnimation.item} className="mb-8">
              <Card shadow="sm" className="border border-gray-200">
                <CardHeader>
                  <h3 className="text-xl font-semibold text-gray-800">
                    Top Scoring Candidates
                  </h3>
                </CardHeader>
                <CardBody>
                  <Table
                    aria-label="Top scoring candidates table"
                    classNames={{
                      wrapper: "min-h-[400px]",
                    }}
                    bottomContent={
                      <div className="flex w-full justify-center">
                        <Pagination
                          isCompact
                          showControls
                          showShadow
                          color="primary"
                          page={page}
                          total={Math.ceil(
                            analytics.topScoringCandidates.length / 5
                          )}
                          onChange={(p) => setPage(p)}
                        />
                      </div>
                    }
                  >
                    <TableHeader>
                      <TableColumn>NAME</TableColumn>
                      <TableColumn>EMAIL</TableColumn>
                      <TableColumn>SCORE</TableColumn>
                      <TableColumn>INSTITUTE</TableColumn>
                      <TableColumn>STATUS</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {analytics.topScoringCandidates
                        .slice((page - 1) * 5, page * 5)
                        .map((candidate, _) => (
                          <TableRow key={candidate.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Avatar
                                  name={candidate.name}
                                  size="sm"
                                  className="hidden sm:flex"
                                />
                                <span>{candidate.name}</span>
                              </div>
                            </TableCell>
                            <TableCell>{candidate.email}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span>{candidate.score.toFixed(1)}</span>
                                <Progress
                                  aria-label="Score"
                                  size="sm"
                                  value={candidate.score}
                                  maxValue={100}
                                  color="primary"
                                  className="max-w-md"
                                />
                              </div>
                            </TableCell>
                            <TableCell>{candidate.institute}</TableCell>
                            <TableCell>
                              <Chip
                                color={candidate.hired ? "success" : "default"}
                                variant="flat"
                                size="sm"
                              >
                                {candidate.hired ? "Hired" : "Not Hired"}
                              </Chip>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </CardBody>
              </Card>
            </motion.div>

            <motion.div
              variants={staggerAnimation.item}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            >
              <Card shadow="sm" className="border border-gray-200">
                <CardHeader>
                  <h3 className="text-xl font-semibold text-gray-800">
                    Top Institutes
                  </h3>
                </CardHeader>
                <CardBody>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={analytics.instituteRelationStats.topInstitutes.slice(
                          0,
                          5
                        )}
                        margin={{
                          top: 5,
                          right: 30,
                          left: 20,
                          bottom: 5,
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="institute" tick={{ fontSize: 10 }} />
                        <YAxis />
                        <RechartsTooltip />
                        <Bar
                          dataKey="hiredCount"
                          name="Hired Candidates"
                          fill="#8b5cf6"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardBody>
              </Card>

              <Card shadow="sm" className="border border-gray-200">
                <CardHeader>
                  <h3 className="text-xl font-semibold text-gray-800">
                    Yearly Hiring Stats
                  </h3>
                </CardHeader>
                <CardBody>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={analytics.yearwiseStats}
                        margin={{
                          top: 5,
                          right: 30,
                          left: 20,
                          bottom: 5,
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="year" />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <RechartsTooltip />
                        <Legend />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="hired"
                          name="Hired"
                          stroke="#3b82f6"
                          activeDot={{ r: 8 }}
                        />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="totalApplicants"
                          name="Applicants"
                          stroke="#8b5cf6"
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="applicationRate"
                          name="Success Rate (%)"
                          stroke="#22c55e"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          </motion.div>
        )}

        {activeTab === "hiring" && (
          <motion.div
            initial="hidden"
            animate="show"
            variants={staggerAnimation.container}
          >
            <motion.div
              variants={staggerAnimation.item}
              className="flex justify-between mb-6"
            >
              <h2 className="text-2xl font-bold text-gray-800">
                Hiring Trends Analysis
              </h2>
              <div className="flex gap-2">
                <Select
                  size="sm"
                  label="Time Period"
                  className="w-40"
                  defaultSelectedKeys={["yearly"]}
                  onChange={(e) => setTimeRange(e.target.value)}
                >
                  <SelectItem key="yearly" value="yearly">
                    Yearly
                  </SelectItem>
                  <SelectItem key="monthly" value="monthly">
                    Monthly
                  </SelectItem>
                </Select>
                <Select
                  size="sm"
                  label="Chart Type"
                  className="w-40"
                  defaultSelectedKeys={["area"]}
                  onChange={(e) => setChartType(e.target.value)}
                >
                  <SelectItem key="area" value="area">
                    Area Chart
                  </SelectItem>
                  <SelectItem key="bar" value="bar">
                    Bar Chart
                  </SelectItem>
                  <SelectItem key="line" value="line">
                    Line Chart
                  </SelectItem>
                </Select>
              </div>
            </motion.div>

            <motion.div variants={staggerAnimation.item} className="mb-8">
              <Card shadow="sm" className="border border-gray-200">
                <CardHeader>
                  <h3 className="text-xl font-semibold text-gray-800">
                    {timeRange === "yearly" ? "Yearly" : "Monthly"} Hiring
                    Trends
                  </h3>
                </CardHeader>
                <CardBody>
                  <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      {(() => {
                        const chartData =
                          timeRange === "yearly"
                            ? hiringTrends.yearly
                            : hiringTrends.monthly;

                        interface YearlyChartData {
                          year: string;
                          applications: number;
                          hired: number;
                          rejected: number;
                          inProgress: number;
                          averageSalary: number;
                        }

                        interface MonthlyChartData {
                          year: string;
                          month: number;
                          applications: number;
                          hired: number;
                          rejected: number;
                          inProgress: number;
                        }

                        type ChartData = YearlyChartData | MonthlyChartData;

                        interface XAxisProps {
                          dataKey: string | ((item: ChartData) => string);
                        }

                        const xAxisProps: XAxisProps = {
                          dataKey:
                            timeRange === "yearly"
                              ? "year"
                              : (item: ChartData) =>
                                  `${item.year}-${
                                    (item as MonthlyChartData).month
                                  }`,
                        };

                        const tooltipStyle = {
                          backgroundColor: "#fff",
                          borderRadius: "8px",
                          boxShadow: "0 2px 10px rgba(0, 0, 0, 0.1)",
                        };

                        const chartMargin = {
                          top: 10,
                          right: 30,
                          left: 0,
                          bottom: 10,
                        };

                        if (chartType === "area") {
                          return (
                            <AreaChart data={chartData} margin={chartMargin}>
                              <defs>
                                <linearGradient
                                  id="colorHired"
                                  x1="0"
                                  y1="0"
                                  x2="0"
                                  y2="1"
                                >
                                  <stop
                                    offset="5%"
                                    stopColor="#3b82f6"
                                    stopOpacity={0.8}
                                  />
                                  <stop
                                    offset="95%"
                                    stopColor="#3b82f6"
                                    stopOpacity={0}
                                  />
                                </linearGradient>
                                <linearGradient
                                  id="colorApplications"
                                  x1="0"
                                  y1="0"
                                  x2="0"
                                  y2="1"
                                >
                                  <stop
                                    offset="5%"
                                    stopColor="#8b5cf6"
                                    stopOpacity={0.8}
                                  />
                                  <stop
                                    offset="95%"
                                    stopColor="#8b5cf6"
                                    stopOpacity={0}
                                  />
                                </linearGradient>
                                <linearGradient
                                  id="colorRejected"
                                  x1="0"
                                  y1="0"
                                  x2="0"
                                  y2="1"
                                >
                                  <stop
                                    offset="5%"
                                    stopColor="#ef4444"
                                    stopOpacity={0.8}
                                  />
                                  <stop
                                    offset="95%"
                                    stopColor="#ef4444"
                                    stopOpacity={0}
                                  />
                                </linearGradient>
                              </defs>
                              <XAxis {...xAxisProps} />
                              <YAxis />
                              <CartesianGrid strokeDasharray="3 3" />
                              <RechartsTooltip contentStyle={tooltipStyle} />
                              <Area
                                type="monotone"
                                dataKey="applications"
                                stroke="#8b5cf6"
                                fillOpacity={1}
                                fill="url(#colorApplications)"
                                name="Applications"
                              />
                              <Area
                                type="monotone"
                                dataKey="hired"
                                stroke="#3b82f6"
                                fillOpacity={1}
                                fill="url(#colorHired)"
                                name="Hired"
                              />
                              <Area
                                type="monotone"
                                dataKey="rejected"
                                stroke="#ef4444"
                                fillOpacity={1}
                                fill="url(#colorRejected)"
                                name="Rejected"
                              />
                              <Legend />
                            </AreaChart>
                          );
                        }

                        if (chartType === "bar") {
                          return (
                            <BarChart data={chartData} margin={chartMargin}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis {...xAxisProps} />
                              <YAxis />
                              <RechartsTooltip contentStyle={tooltipStyle} />
                              <Legend />
                              <Bar
                                dataKey="applications"
                                name="Applications"
                                fill="#8b5cf6"
                              />
                              <Bar
                                dataKey="hired"
                                name="Hired"
                                fill="#3b82f6"
                              />
                              <Bar
                                dataKey="rejected"
                                name="Rejected"
                                fill="#ef4444"
                              />
                            </BarChart>
                          );
                        }

                        // Default to line chart
                        return (
                          <LineChart data={chartData} margin={chartMargin}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis {...xAxisProps} />
                            <YAxis />
                            <RechartsTooltip contentStyle={tooltipStyle} />
                            <Legend />
                            <Line
                              type="monotone"
                              dataKey="applications"
                              name="Applications"
                              stroke="#8b5cf6"
                              activeDot={{ r: 8 }}
                            />
                            <Line
                              type="monotone"
                              dataKey="hired"
                              name="Hired"
                              stroke="#3b82f6"
                            />
                            <Line
                              type="monotone"
                              dataKey="rejected"
                              name="Rejected"
                              stroke="#ef4444"
                            />
                          </LineChart>
                        );
                      })()}
                    </ResponsiveContainer>
                  </div>
                </CardBody>
              </Card>
            </motion.div>

            <motion.div
              variants={staggerAnimation.item}
              className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8"
            >
              <Card shadow="sm" className="border border-gray-200">
                <CardBody>
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-full bg-primary/10">
                      <TrendingUp className="text-primary w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">
                        Average Hiring Rate
                      </p>
                      <h4 className="text-xl font-bold text-gray-800">
                        {formatPercent(
                          hiringTrends.yearly.reduce(
                            (sum, year) =>
                              sum +
                              (year.applications > 0
                                ? (year.hired / year.applications) * 100
                                : 0),
                            0
                          ) / hiringTrends.yearly.length
                        )}
                      </h4>
                    </div>
                  </div>
                </CardBody>
              </Card>

              <Card shadow="sm" className="border border-gray-200">
                <CardBody>
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-full bg-green-500/10">
                      <DollarSign className="text-green-500 w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">
                        Avg. Yearly Salary
                      </p>
                      <h4 className="text-xl font-bold text-gray-800">
                        {formatCurrency(
                          hiringTrends.yearly.reduce(
                            (sum, year) => sum + year.averageSalary,
                            0
                          ) / hiringTrends.yearly.length
                        )}
                      </h4>
                    </div>
                  </div>
                </CardBody>
              </Card>

              <Card shadow="sm" className="border border-gray-200">
                <CardBody>
                  <div className="flex items-center gap-4">
                    <div className="p-3 rounded-full bg-amber-500/10">
                      <Users className="text-amber-500 w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Total Hired</p>
                      <h4 className="text-xl font-bold text-gray-800">
                        {hiringTrends.yearly.reduce(
                          (sum, year) => sum + year.hired,
                          0
                        )}
                      </h4>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </motion.div>

            <motion.div variants={staggerAnimation.item} className="mb-8">
              <Card shadow="sm" className="border border-gray-200">
                <CardHeader>
                  <h3 className="text-xl font-semibold text-gray-800">
                    Yearly Metrics Comparison
                  </h3>
                </CardHeader>
                <CardBody>
                  <Table aria-label="Yearly metrics comparison table">
                    <TableHeader>
                      <TableColumn>YEAR</TableColumn>
                      <TableColumn>APPLICATIONS</TableColumn>
                      <TableColumn>HIRED</TableColumn>
                      <TableColumn>REJECTED</TableColumn>
                      <TableColumn>AVERAGE SALARY</TableColumn>
                      <TableColumn>SUCCESS RATE</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {hiringTrends.yearly.map((year) => (
                        <TableRow key={year.year}>
                          <TableCell>{year.year}</TableCell>
                          <TableCell>{year.applications}</TableCell>
                          <TableCell>{year.hired}</TableCell>
                          <TableCell>{year.rejected}</TableCell>
                          <TableCell>
                            {formatCurrency(year.averageSalary)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span>
                                {formatPercent(
                                  year.applications > 0
                                    ? (year.hired / year.applications) * 100
                                    : 0
                                )}
                              </span>
                              <Progress
                                aria-label="Success rate"
                                size="sm"
                                value={
                                  year.applications > 0
                                    ? (year.hired / year.applications) * 100
                                    : 0
                                }
                                maxValue={100}
                                color="success"
                                className="max-w-md"
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardBody>
              </Card>
            </motion.div>

            <motion.div
              variants={staggerAnimation.item}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            >
              <Card shadow="sm" className="border border-gray-200">
                <CardHeader>
                  <h3 className="text-xl font-semibold text-gray-800">
                    Year-over-Year Growth
                  </h3>
                </CardHeader>
                <CardBody>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={hiringTrends.yearly
                          .map((year, index, array) => {
                            if (index === 0) {
                              return {
                                year: year.year,
                                hiredGrowth: 0,
                                applicationsGrowth: 0,
                                salaryGrowth: 0,
                              };
                            }
                            const prevYear = array[index - 1];
                            return {
                              year: year.year,
                              hiredGrowth:
                                prevYear.hired > 0
                                  ? ((year.hired - prevYear.hired) /
                                      prevYear.hired) *
                                    100
                                  : 0,
                              applicationsGrowth:
                                prevYear.applications > 0
                                  ? ((year.applications -
                                      prevYear.applications) /
                                      prevYear.applications) *
                                    100
                                  : 0,
                              salaryGrowth:
                                prevYear.averageSalary > 0
                                  ? ((year.averageSalary -
                                      prevYear.averageSalary) /
                                      prevYear.averageSalary) *
                                    100
                                  : 0,
                            };
                          })
                          .filter((_, index) => index > 0)}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="year" />
                        <YAxis
                          label={{
                            value: "Growth %",
                            angle: -90,
                            position: "insideLeft",
                          }}
                        />
                        <RechartsTooltip
                          formatter={(value) => [
                            `${Number(value).toFixed(2)}%`,
                            "",
                          ]}
                        />
                        <Legend />
                        <Bar
                          dataKey="hiredGrowth"
                          name="Hired Growth %"
                          fill="#3b82f6"
                        />
                        <Bar
                          dataKey="applicationsGrowth"
                          name="Applications Growth %"
                          fill="#8b5cf6"
                        />
                        <Bar
                          dataKey="salaryGrowth"
                          name="Salary Growth %"
                          fill="#22c55e"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardBody>
              </Card>

              <Card shadow="sm" className="border border-gray-200">
                <CardHeader>
                  <h3 className="text-xl font-semibold text-gray-800">
                    Applications vs. Hiring Rate
                  </h3>
                </CardHeader>
                <CardBody>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={hiringTrends.yearly}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="year" />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <RechartsTooltip />
                        <Legend />
                        <Bar
                          yAxisId="left"
                          dataKey="applications"
                          name="Applications"
                          fill="#8b5cf6"
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="hired"
                          name="Hired"
                          stroke="#3b82f6"
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          </motion.div>
        )}

        {activeTab === "skills" && (
          <motion.div
            initial="hidden"
            animate="show"
            variants={staggerAnimation.container}
          >
            <motion.div
              variants={staggerAnimation.item}
              className="flex justify-between mb-6"
            >
              <h2 className="text-2xl font-bold text-gray-800">
                Skills Analysis
              </h2>
            </motion.div>

            <motion.div variants={staggerAnimation.item} className="mb-8">
              <Card shadow="sm" className="border border-gray-200">
                <CardHeader className="flex justify-between">
                  <h3 className="text-xl font-semibold text-gray-800">
                    Most In-Demand Skills
                  </h3>
                  <Select
                    size="sm"
                    label="Chart Type"
                    className="w-40"
                    defaultSelectedKeys={["bar"]}
                    onChange={(e) => setChartType(e.target.value)}
                  >
                    <SelectItem key="bar" value="bar">
                      Bar Chart
                    </SelectItem>
                    <SelectItem key="radar" value="radar">
                      Radar Chart
                    </SelectItem>
                    <SelectItem key="treemap" value="treemap">
                      Treemap
                    </SelectItem>
                  </Select>
                </CardHeader>
                <CardBody>
                  <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      <>
                        {chartType === "bar" && (
                          <BarChart
                            data={skillDemand.topSkills.slice(0, 10)}
                            margin={{ top: 5, right: 30, left: 20, bottom: 50 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                              dataKey="skill"
                              angle={-45}
                              textAnchor="end"
                              interval={0}
                              height={70}
                            />
                            <YAxis />
                            <RechartsTooltip />
                            <Legend />
                            <Bar
                              dataKey="count"
                              name="Demand Count"
                              fill="#3b82f6"
                            >
                              {skillDemand.topSkills
                                .slice(0, 10)
                                .map((_, index) => (
                                  <Cell
                                    key={`cell-${index}`}
                                    fill={COLORS[index % COLORS.length]}
                                  />
                                ))}
                            </Bar>
                          </BarChart>
                        )}

                        {chartType === "radar" && (
                          <RadarChart
                            outerRadius={150}
                            width={730}
                            height={350}
                            data={skillDemand.topSkills.slice(0, 8)}
                          >
                            <PolarGrid />
                            <PolarAngleAxis dataKey="skill" />
                            <PolarRadiusAxis angle={30} domain={[0, "auto"]} />
                            <Radar
                              name="Skill Demand"
                              dataKey="count"
                              stroke="#3b82f6"
                              fill="#3b82f6"
                              fillOpacity={0.6}
                            />
                            <Legend />
                          </RadarChart>
                        )}

                        {chartType === "treemap" && (
                          <Treemap
                            data={skillDemand.topSkills
                              .slice(0, 15)
                              .map((skill) => ({
                                name: skill.skill,
                                size: skill.count,
                                fill: COLORS[
                                  Math.floor(Math.random() * COLORS.length)
                                ],
                              }))}
                            dataKey="size"
                            stroke="#fff"
                            fill="#3b82f6"
                          >
                            {renderCustomizedTreemapContent}
                          </Treemap>
                        )}
                      </>
                    </ResponsiveContainer>
                  </div>
                </CardBody>
              </Card>
            </motion.div>

            <motion.div
              variants={staggerAnimation.item}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"
            >
              <Card shadow="sm" className="border border-gray-200">
                <CardHeader>
                  <h3 className="text-xl font-semibold text-gray-800">
                    Skill Gaps Analysis
                  </h3>
                </CardHeader>
                <CardBody>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        layout="vertical"
                        data={skillDemand.skillGaps.slice(0, 8)}
                        margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                      >
                        <XAxis type="number" tick={{ fontSize: 12 }} />
                        <YAxis
                          dataKey="skill"
                          type="category"
                          width={100}
                          tick={{ fontSize: 12 }}
                        />
                        <RechartsTooltip
                          contentStyle={{
                            backgroundColor: "#fff",
                            borderRadius: "8px",
                            boxShadow: "0 2px 10px rgba(0, 0, 0, 0.1)",
                          }}
                        />
                        <CartesianGrid strokeDasharray="3 3" />
                        <Legend />
                        <Bar
                          dataKey="demandPercentage"
                          name="Demand %"
                          fill="#3b82f6"
                        />
                        <Bar
                          dataKey="availabilityPercentage"
                          name="Availability %"
                          fill="#8b5cf6"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardBody>
              </Card>

              <Card shadow="sm" className="border border-gray-200">
                <CardHeader>
                  <h3 className="text-xl font-semibold text-gray-800">
                    Skill Trends (3 Year)
                  </h3>
                </CardHeader>
                <CardBody>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="year"
                          type="number"
                          domain={[
                            Math.min(
                              ...Object.values(skillDemand.skillTrends)[0].map(
                                (item) => item.year
                              )
                            ),
                            Math.max(
                              ...Object.values(skillDemand.skillTrends)[0].map(
                                (item) => item.year
                              )
                            ),
                          ]}
                          allowDecimals={false}
                        />
                        <YAxis />
                        <RechartsTooltip />
                        <Legend />
                        {Object.entries(skillDemand.skillTrends)
                          .slice(0, 5)
                          .map(([skill, data], index) => (
                            <Line
                              key={skill}
                              data={data}
                              type="monotone"
                              dataKey="percentage"
                              name={skill}
                              stroke={COLORS[index % COLORS.length]}
                              activeDot={{ r: 8 }}
                            />
                          ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardBody>
              </Card>
            </motion.div>

            <motion.div variants={staggerAnimation.item} className="mb-8">
              <Card shadow="sm" className="border border-gray-200">
                <CardHeader>
                  <h3 className="text-xl font-semibold text-gray-800">
                    Skills by Category
                  </h3>
                </CardHeader>
                <CardBody>
                  <Tabs aria-label="Skill Categories">
                    {Object.keys(skillDemand.categorizedSkills).map(
                      (category) => (
                        <Tab key={category} title={category}>
                          <div className="h-96 mt-4 px-2">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart
                                data={skillDemand.categorizedSkills[
                                  category
                                ].slice(0, 10)}
                                margin={{
                                  top: 5,
                                  right: 30,
                                  left: 20,
                                  bottom: 50,
                                }}
                              >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis
                                  dataKey="skill"
                                  angle={-45}
                                  textAnchor="end"
                                  interval={0}
                                  height={70}
                                />
                                <YAxis />
                                <RechartsTooltip />
                                <Legend />
                                <Bar
                                  dataKey="percentage"
                                  name="Demand %"
                                  fill="#3b82f6"
                                >
                                  {skillDemand.categorizedSkills[category]
                                    .slice(0, 10)
                                    .map((_, index) => (
                                      <Cell
                                        key={`cell-${index}`}
                                        fill={COLORS[index % COLORS.length]}
                                      />
                                    ))}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </Tab>
                      )
                    )}
                  </Tabs>
                </CardBody>
              </Card>
            </motion.div>

            <motion.div variants={staggerAnimation.item}>
              <Card shadow="sm" className="border border-gray-200">
                <CardHeader>
                  <h3 className="text-xl font-semibold text-gray-800">
                    Detailed Skill Requirements
                  </h3>
                </CardHeader>
                <CardBody>
                  <Table
                    aria-label="Skill requirements table"
                    bottomContent={
                      <div className="flex w-full justify-center">
                        <Pagination
                          isCompact
                          showControls
                          showShadow
                          color="primary"
                          page={page}
                          total={Math.ceil(skillDemand.topSkills.length / 10)}
                          onChange={(p) => setPage(p)}
                        />
                      </div>
                    }
                  >
                    <TableHeader>
                      <TableColumn>SKILL</TableColumn>
                      <TableColumn>DEMAND COUNT</TableColumn>
                      <TableColumn>PERCENTAGE</TableColumn>
                      <TableColumn>CATEGORY</TableColumn>
                      <TableColumn>TREND</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {skillDemand.topSkills
                        .slice((page - 1) * 10, page * 10)
                        .map((skill) => {
                          let skillCategory = "Other";
                          for (const [category, skills] of Object.entries(
                            skillDemand.categorizedSkills
                          )) {
                            if (skills.some((s) => s.skill === skill.skill)) {
                              skillCategory = category;
                              break;
                            }
                          }

                          return (
                            <TableRow key={skill.skill}>
                              <TableCell>
                                <div className="font-medium">{skill.skill}</div>
                              </TableCell>
                              <TableCell>{skill.count}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <span>{skill.percentage.toFixed(1)}%</span>
                                  <Progress
                                    aria-label="Demand percentage"
                                    size="sm"
                                    value={skill.percentage}
                                    maxValue={100}
                                    color="primary"
                                    className="max-w-md"
                                  />
                                </div>
                              </TableCell>
                              <TableCell>
                                <Chip size="sm" variant="flat" color="primary">
                                  {skillCategory}
                                </Chip>
                              </TableCell>
                              <TableCell>
                                {skillDemand.skillTrends[skill.skill] ? (
                                  <Chip
                                    size="sm"
                                    variant="flat"
                                    color={
                                      skillDemand.skillTrends[skill.skill][2]
                                        ?.percentage >
                                      skillDemand.skillTrends[skill.skill][0]
                                        ?.percentage
                                        ? "success"
                                        : "danger"
                                    }
                                    startContent={
                                      skillDemand.skillTrends[skill.skill][2]
                                        ?.percentage >
                                      skillDemand.skillTrends[skill.skill][0]
                                        ?.percentage ? (
                                        <TrendingUp size={14} />
                                      ) : (
                                        <TrendingDown size={14} />
                                      )
                                    }
                                  >
                                    {skillDemand.skillTrends[skill.skill][2]
                                      ?.percentage >
                                    skillDemand.skillTrends[skill.skill][0]
                                      ?.percentage
                                      ? "Growing"
                                      : "Declining"}
                                  </Chip>
                                ) : (
                                  "N/A"
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                    </TableBody>
                  </Table>
                </CardBody>
              </Card>
            </motion.div>
          </motion.div>
        )}

        {activeTab === "candidates" && (
          <motion.div
            initial="hidden"
            animate="show"
            variants={staggerAnimation.container}
          >
            <motion.div
              variants={staggerAnimation.item}
              className="flex justify-between mb-6"
            >
              <h2 className="text-2xl font-bold text-gray-800">
                Candidate Sourcing Analysis
              </h2>
            </motion.div>

            <motion.div
              variants={staggerAnimation.item}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
            >
              <Card shadow="sm" className="border border-gray-200">
                <CardBody className="gap-1">
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-medium text-gray-500">
                      Total Candidates
                    </p>
                    <Users className="text-blue-500 w-5 h-5" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800">
                    {candidateSources.totalCandidates.toLocaleString()}
                  </h3>
                  <p className="text-xs text-gray-400">Across all sources</p>
                </CardBody>
              </Card>

              <Card shadow="sm" className="border border-gray-200">
                <CardBody className="gap-1">
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-medium text-gray-500">
                      Total Hired
                    </p>
                    <CheckCircle className="text-green-500 w-5 h-5" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800">
                    {candidateSources.totalHired.toLocaleString()}
                  </h3>
                  <p className="text-xs text-gray-400">
                    Successfully hired candidates
                  </p>
                </CardBody>
              </Card>

              <Card shadow="sm" className="border border-gray-200">
                <CardBody className="gap-1">
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-medium text-gray-500">
                      Overall Hire Rate
                    </p>
                    <BarChart2 className="text-violet-500 w-5 h-5" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800">
                    {formatPercent(candidateSources.overallHireRate)}
                  </h3>
                  <p className="text-xs text-gray-400">
                    Conversion from application to hire
                  </p>
                </CardBody>
              </Card>

              <Card shadow="sm" className="border border-gray-200">
                <CardBody className="gap-1">
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-medium text-gray-500">
                      Top Source
                    </p>
                    <Building className="text-amber-500 w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 truncate">
                    {candidateSources.topSources[0]?.name || "N/A"}
                  </h3>
                  <p className="text-xs text-gray-400">
                    {candidateSources.topSources[0]?.hiredCandidates || 0}{" "}
                    candidates hired
                  </p>
                </CardBody>
              </Card>
            </motion.div>

            <motion.div variants={staggerAnimation.item} className="mb-8">
              <Card shadow="sm" className="border border-gray-200">
                <CardHeader>
                  <h3 className="text-xl font-semibold text-gray-800">
                    Top Institute Sources
                  </h3>
                </CardHeader>
                <CardBody>
                  <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={candidateSources.instituteSources.slice(0, 10)}
                        margin={{ top: 5, right: 30, left: 20, bottom: 50 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="name"
                          angle={-45}
                          textAnchor="end"
                          interval={0}
                          height={70}
                        />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <RechartsTooltip />
                        <Legend />
                        <Bar
                          yAxisId="left"
                          dataKey="totalCandidates"
                          name="Total Candidates"
                          fill="#8b5cf6"
                        />
                        <Bar
                          yAxisId="left"
                          dataKey="hiredCandidates"
                          name="Hired Candidates"
                          fill="#3b82f6"
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="hireRate"
                          name="Hire Rate (%)"
                          stroke="#22c55e"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardBody>
              </Card>
            </motion.div>

            <motion.div
              variants={staggerAnimation.item}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"
            >
              <Card shadow="sm" className="border border-gray-200">
                <CardHeader>
                  <h3 className="text-xl font-semibold text-gray-800">
                    Hiring Cycle Times
                  </h3>
                </CardHeader>
                <CardBody>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={candidateSources.hiringCycleTimes}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="timeRange" />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <RechartsTooltip />
                        <Legend />
                        <Bar
                          yAxisId="left"
                          dataKey="count"
                          name="Number of Hires"
                          fill="#3b82f6"
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="averageDays"
                          name="Avg Days"
                          stroke="#ef4444"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardBody>
              </Card>

              <Card shadow="sm" className="border border-gray-200">
                <CardHeader>
                  <h3 className="text-xl font-semibold text-gray-800">
                    Source Performance Comparison
                  </h3>
                </CardHeader>
                <CardBody>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart
                        margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
                      >
                        <CartesianGrid />
                        <XAxis
                          type="number"
                          dataKey="totalCandidates"
                          name="Total Candidates"
                          label={{
                            value: "Total Candidates",
                            position: "insideBottom",
                            offset: -5,
                          }}
                        />
                        <YAxis
                          type="number"
                          dataKey="hireRate"
                          name="Hire Rate (%)"
                          label={{
                            value: "Hire Rate (%)",
                            angle: -90,
                            position: "insideLeft",
                          }}
                        />
                        <ZAxis
                          type="number"
                          dataKey="hiredCandidates"
                          range={[50, 400]}
                          name="Hired Count"
                        />
                        <RechartsTooltip
                          cursor={{ strokeDasharray: "3 3" }}
                          content={(props) => {
                            if (!props.active || !props.payload?.length)
                              return null;
                            const data = props.payload[0].payload;
                            return (
                              <div className="p-2 bg-white border border-gray-200 rounded shadow-md">
                                <p className="text-sm font-bold">{data.name}</p>
                                <p className="text-xs text-gray-500">
                                  Total: {data.totalCandidates}
                                </p>
                                <p className="text-xs text-gray-500">
                                  Hired: {data.hiredCandidates}
                                </p>
                                <p className="text-xs text-gray-500">
                                  Hire Rate: {data.hireRate.toFixed(1)}%
                                </p>
                              </div>
                            );
                          }}
                        />
                        <Legend />
                        <Scatter
                          name="Institute Sources"
                          data={candidateSources.instituteSources}
                          fill="#8884d8"
                        >
                          {candidateSources.instituteSources.map((_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </CardBody>
              </Card>
            </motion.div>

            <motion.div variants={staggerAnimation.item}>
              <Card shadow="sm" className="border border-gray-200">
                <CardHeader className="flex justify-between">
                  <h3 className="text-xl font-semibold text-gray-800">
                    Institute Performance
                  </h3>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="flat"
                      color="primary"
                      startContent={<Filter size={16} />}
                    >
                      Filter
                    </Button>
                    <Button
                      size="sm"
                      variant="flat"
                      startContent={<Search size={16} />}
                    >
                      Search
                    </Button>
                  </div>
                </CardHeader>
                <CardBody>
                  <Table
                    aria-label="Institute performance table"
                    bottomContent={
                      <div className="flex w-full justify-center">
                        <Pagination
                          isCompact
                          showControls
                          showShadow
                          color="primary"
                          page={page}
                          total={Math.ceil(
                            candidateSources.instituteSources.length / 5
                          )}
                          onChange={(p) => setPage(p)}
                        />
                      </div>
                    }
                  >
                    <TableHeader>
                      <TableColumn>INSTITUTE</TableColumn>
                      <TableColumn>TOTAL CANDIDATES</TableColumn>
                      <TableColumn>HIRED CANDIDATES</TableColumn>
                      <TableColumn>HIRE RATE</TableColumn>
                      <TableColumn>PERFORMANCE</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {candidateSources.instituteSources
                        .slice((page - 1) * 5, page * 5)
                        .map((institute) => (
                          <TableRow key={institute.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Avatar
                                  name={institute.name}
                                  size="sm"
                                  className="hidden sm:flex"
                                />
                                <span className="font-medium">
                                  {institute.name}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>{institute.totalCandidates}</TableCell>
                            <TableCell>{institute.hiredCandidates}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span>{formatPercent(institute.hireRate)}</span>
                                <Progress
                                  aria-label="Hire rate"
                                  size="sm"
                                  value={institute.hireRate}
                                  maxValue={100}
                                  color="primary"
                                  className="max-w-md"
                                />
                              </div>
                            </TableCell>
                            <TableCell>
                              <Chip
                                size="sm"
                                variant="flat"
                                color={
                                  institute.hireRate > 70
                                    ? "success"
                                    : institute.hireRate > 40
                                    ? "warning"
                                    : "danger"
                                }
                              >
                                {institute.hireRate > 70
                                  ? "Excellent"
                                  : institute.hireRate > 40
                                  ? "Good"
                                  : "Needs Improvement"}
                              </Chip>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </CardBody>
              </Card>
            </motion.div>
          </motion.div>
        )}

        {activeTab === "education" && (
          <motion.div
            initial="hidden"
            animate="show"
            variants={staggerAnimation.container}
          >
            <motion.div
              variants={staggerAnimation.item}
              className="flex justify-between mb-6"
            >
              <h2 className="text-2xl font-bold text-gray-800">
                Education Insights
              </h2>
            </motion.div>

            <motion.div variants={staggerAnimation.item} className="mb-8">
              <Card shadow="sm" className="border border-gray-200">
                <CardBody className="py-8">
                  <div className="flex flex-col md:flex-row items-center justify-around gap-8">
                    <div className="flex flex-col items-center">
                      <p className="text-lg text-gray-500 mb-1">
                        Average Percentage
                      </p>
                      <h3 className="text-4xl font-bold text-gray-800">
                        {analytics.candidateEducationStats.averagePercentage.toFixed(
                          1
                        )}
                        %
                      </h3>
                      <p className="text-sm text-gray-400 mt-2">
                        Among hired candidates
                      </p>
                    </div>
                    <Divider orientation="vertical" className="h-20" />
                    <div className="text-center">
                      <h3 className="text-lg text-gray-500 mb-4">
                        Education Metrics
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-500">Degree Types</p>
                          <p className="text-2xl font-semibold text-gray-800">
                            {
                              Object.keys(
                                analytics.candidateEducationStats
                                  .degreeDistribution
                              ).length
                            }
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Schools</p>
                          <p className="text-2xl font-semibold text-gray-800">
                            {
                              Object.keys(
                                analytics.candidateEducationStats
                                  .schoolDistribution
                              ).length
                            }
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Branches</p>
                          <p className="text-2xl font-semibold text-gray-800">
                            {
                              Object.keys(
                                analytics.candidateEducationStats
                                  .branchDistribution
                              ).length
                            }
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Most Common</p>
                          <p className="text-xl font-semibold text-gray-800 truncate">
                            {Object.entries(
                              analytics.candidateEducationStats
                                .degreeDistribution
                            )
                              .sort((a, b) => b[1] - a[1])
                              .map((entry) => entry[0])[0] || "N/A"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </motion.div>

            <motion.div
              variants={staggerAnimation.item}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"
            >
              <Card shadow="sm" className="border border-gray-200">
                <CardHeader>
                  <h3 className="text-xl font-semibold text-gray-800">
                    Degree Distribution
                  </h3>
                </CardHeader>
                <CardBody>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={Object.entries(
                            analytics.candidateEducationStats.degreeDistribution
                          )
                            .map(([name, value]) => ({ name, value }))
                            .sort((a, b) => b.value - a.value)
                            .slice(0, 6)}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, percent }) =>
                            `${name}: ${(percent * 100).toFixed(1)}%`
                          }
                        >
                          {Object.entries(
                            analytics.candidateEducationStats.degreeDistribution
                          )
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 6)
                            .map((_, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={COLORS[index % COLORS.length]}
                              />
                            ))}
                        </Pie>
                        <RechartsTooltip
                          formatter={(value) => [`${value} candidates`, ""]}
                        />
                        <Legend
                          layout="vertical"
                          verticalAlign="middle"
                          align="right"
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardBody>
              </Card>

              <Card shadow="sm" className="border border-gray-200">
                <CardHeader>
                  <h3 className="text-xl font-semibold text-gray-800">
                    Branch Distribution
                  </h3>
                </CardHeader>
                <CardBody>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={Object.entries(
                          analytics.candidateEducationStats.branchDistribution
                        )
                          .map(([name, value]) => ({ name, value }))
                          .sort((a, b) => b.value - a.value)
                          .slice(0, 8)}
                        margin={{ top: 5, right: 30, left: 20, bottom: 50 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                          dataKey="name"
                          angle={-45}
                          textAnchor="end"
                          interval={0}
                          height={70}
                        />
                        <YAxis />
                        <RechartsTooltip />
                        <Legend />
                        <Bar dataKey="value" name="Candidates" fill="#3b82f6">
                          {Object.entries(
                            analytics.candidateEducationStats.branchDistribution
                          )
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 8)
                            .map((_, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={COLORS[index % COLORS.length]}
                              />
                            ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardBody>
              </Card>
            </motion.div>

            <motion.div variants={staggerAnimation.item} className="mb-8">
              <Card shadow="sm" className="border border-gray-200">
                <CardHeader>
                  <h3 className="text-xl font-semibold text-gray-800">
                    Top Schools
                  </h3>
                </CardHeader>
                <CardBody>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        layout="vertical"
                        data={Object.entries(
                          analytics.candidateEducationStats.schoolDistribution
                        )
                          .map(([name, value]) => ({ name, value }))
                          .sort((a, b) => b.value - a.value)
                          .slice(0, 10)}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={150} />
                        <RechartsTooltip />
                        <Bar
                          dataKey="value"
                          name="Candidates"
                          barSize={20}
                          fill="#3b82f6"
                        >
                          {Object.entries(
                            analytics.candidateEducationStats.schoolDistribution
                          )
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 10)
                            .map((_, index) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={COLORS[index % COLORS.length]}
                              />
                            ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardBody>
              </Card>
            </motion.div>

            <motion.div variants={staggerAnimation.item}>
              <Card shadow="sm" className="border border-gray-200">
                <CardHeader>
                  <h3 className="text-xl font-semibold text-gray-800">
                    Work Experience Insights
                  </h3>
                </CardHeader>
                <CardBody>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <h4 className="text-lg font-medium text-gray-700 mb-4">
                        Previous Companies
                      </h4>
                      <div className="space-y-3">
                        {analytics.candidateWorkStats.previousCompanies
                          .slice(0, 5)
                          .map((company) => (
                            <div
                              key={company.company}
                              className="flex items-center justify-between"
                            >
                              <span className="text-sm text-gray-600">
                                {company.company}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">
                                  {company.count}
                                </span>
                                <Progress
                                  size="sm"
                                  maxValue={
                                    analytics.candidateWorkStats
                                      .previousCompanies[0].count
                                  }
                                  value={company.count}
                                  color="primary"
                                  className="w-24"
                                />
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-lg font-medium text-gray-700 mb-4">
                        Work Type Distribution
                      </h4>
                      <div className="h-60">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={Object.entries(
                                analytics.candidateWorkStats
                                  .workTypeDistribution
                              )
                                .map(([name, value]) => ({ name, value }))
                                .sort((a, b) => b.value - a.value)}
                              cx="50%"
                              cy="50%"
                              innerRadius={40}
                              outerRadius={80}
                              fill="#8884d8"
                              dataKey="value"
                            >
                              {Object.entries(
                                analytics.candidateWorkStats
                                  .workTypeDistribution
                              ).map((_, index) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={COLORS[index % COLORS.length]}
                                />
                              ))}
                            </Pie>
                            <RechartsTooltip />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="flex flex-col justify-center items-center">
                      <h4 className="text-lg font-medium text-gray-700 mb-4">
                        Average Experience
                      </h4>
                      <div className="text-center">
                        <div className="text-4xl font-bold text-primary mb-2">
                          {analytics.candidateWorkStats.averageWorkExperience.toFixed(
                            1
                          )}
                        </div>
                        <p className="text-sm text-gray-500">
                          Years of work experience
                        </p>
                      </div>
                      <div className="w-full mt-8">
                        <h5 className="text-sm font-medium text-gray-600 mb-2">
                          Experience Level
                        </h5>
                        <div className="bg-gray-200 h-2 rounded-full w-full">
                          <div
                            className="bg-primary h-2 rounded-full"
                            style={{
                              width: `${Math.min(
                                (analytics.candidateWorkStats
                                  .averageWorkExperience /
                                  10) *
                                  100,
                                100
                              )}%`,
                            }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>Entry</span>
                          <span>Mid</span>
                          <span>Senior</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          </motion.div>
        )}

        {activeTab === "salary" && (
          <motion.div
            initial="hidden"
            animate="show"
            variants={staggerAnimation.container}
          >
            <motion.div
              variants={staggerAnimation.item}
              className="flex justify-between mb-6"
            >
              <h2 className="text-2xl font-bold text-gray-800">
                Salary Analysis
              </h2>
            </motion.div>

            <motion.div variants={staggerAnimation.item} className="mb-8">
              <Card shadow="sm" className="border border-gray-200">
                <CardBody className="py-8">
                  <div className="flex flex-col md:flex-row items-center justify-around gap-8">
                    <div className="flex flex-col items-center">
                      <p className="text-lg text-gray-500 mb-1">
                        Overall Average
                      </p>
                      <h3 className="text-4xl font-bold text-primary">
                        {formatCurrency(analytics.salaryStats.overallAverage)}
                      </h3>
                    </div>
                    <Divider orientation="vertical" className="h-20" />
                    <div className="flex flex-col items-center">
                      <p className="text-lg text-gray-500 mb-1">
                        Overall Median
                      </p>
                      <h3 className="text-4xl font-bold text-primary">
                        {formatCurrency(analytics.salaryStats.overallMedian)}
                      </h3>
                    </div>
                    <Divider orientation="vertical" className="h-20" />
                    <div className="flex flex-col items-center">
                      <p className="text-lg text-gray-500 mb-1">
                        Highest Offered
                      </p>
                      <h3 className="text-4xl font-bold text-primary">
                        {formatCurrency(analytics.overview.highestSalary)}
                      </h3>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </motion.div>

            <motion.div
              variants={staggerAnimation.item}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8"
            >
              <Card shadow="sm" className="border border-gray-200">
                <CardHeader>
                  <h3 className="text-xl font-semibold text-gray-800">
                    Salary by Year
                  </h3>
                </CardHeader>
                <CardBody>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart
                        data={Object.entries(analytics.salaryStats.byYear).map(
                          ([year, data]) => ({
                            year,
                            average: data.average,
                            highest: data.highest,
                            lowest: data.lowest,
                            range: data.highest - data.lowest,
                          })
                        )}
                        margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="year" />
                        <YAxis />
                        <RechartsTooltip
                          formatter={(value) => [
                            formatCurrency(Number(value)),
                            "",
                          ]}
                        />
                        <Legend />
                        <Bar
                          dataKey="range"
                          name="Salary Range"
                          barSize={20}
                          fill="#8884d8"
                          fillOpacity={0.3}
                        />
                        <Line
                          type="monotone"
                          dataKey="average"
                          name="Average"
                          stroke="#3b82f6"
                        />
                        <Line
                          type="monotone"
                          dataKey="highest"
                          name="Highest"
                          stroke="#22c55e"
                          strokeDasharray="5 5"
                        />
                        <Line
                          type="monotone"
                          dataKey="lowest"
                          name="Lowest"
                          stroke="#ef4444"
                          strokeDasharray="3 3"
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </CardBody>
              </Card>

              <Card shadow="sm" className="border border-gray-200">
                <CardHeader>
                  <h3 className="text-xl font-semibold text-gray-800">
                    Salary by Role
                  </h3>
                </CardHeader>
                <CardBody>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        layout="vertical"
                        data={Object.entries(analytics.salaryStats.byRole)
                          .map(([role, data]) => ({
                            role,
                            average: data.average,
                            highest: data.highest,
                            lowest: data.lowest,
                          }))
                          .sort((a, b) => b.average - a.average)
                          .slice(0, 8)}
                        margin={{ top: 20, right: 20, left: 100, bottom: 20 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="role" type="category" />
                        <RechartsTooltip
                          formatter={(value) => [
                            formatCurrency(Number(value)),
                            "",
                          ]}
                        />
                        <Legend />
                        <Bar
                          dataKey="average"
                          name="Average Salary"
                          fill="#3b82f6"
                        />
                        <Bar
                          dataKey="highest"
                          name="Highest Salary"
                          fill="#22c55e"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardBody>
              </Card>
            </motion.div>

            <motion.div variants={staggerAnimation.item} className="mb-8">
              <Card shadow="sm" className="border border-gray-200">
                <CardHeader>
                  <h3 className="text-xl font-semibold text-gray-800">
                    Salary Ranges by Role
                  </h3>
                </CardHeader>
                <CardBody>
                  <Table aria-label="Salary ranges by role table">
                    <TableHeader>
                      <TableColumn>ROLE</TableColumn>
                      <TableColumn>AVERAGE</TableColumn>
                      <TableColumn>LOWEST</TableColumn>
                      <TableColumn>HIGHEST</TableColumn>
                      <TableColumn>RANGE</TableColumn>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(analytics.salaryStats.byRole)
                        .sort((a, b) => b[1].average - a[1].average)
                        .map(([role, data]) => (
                          <TableRow key={role}>
                            <TableCell className="font-medium">
                              {role}
                            </TableCell>
                            <TableCell>
                              {formatCurrency(data.average)}
                            </TableCell>
                            <TableCell>{formatCurrency(data.lowest)}</TableCell>
                            <TableCell>
                              {formatCurrency(data.highest)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span>{formatCurrency(data.lowest)}</span>
                                <div className="relative w-24 h-3 bg-gray-200 rounded-full">
                                  <div
                                    className="absolute top-0 left-0 h-3 bg-primary rounded-full"
                                    style={{
                                      width: "100%",
                                      backgroundImage:
                                        "linear-gradient(to right, #3b82f6, #22c55e)",
                                    }}
                                  ></div>
                                </div>
                                <span>{formatCurrency(data.highest)}</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </CardBody>
              </Card>
            </motion.div>

            <motion.div variants={staggerAnimation.item}>
              <Card shadow="sm" className="border border-gray-200">
                <CardHeader>
                  <h3 className="text-xl font-semibold text-gray-800">
                    Year-over-Year Salary Growth
                  </h3>
                </CardHeader>
                <CardBody>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={Object.entries(analytics.salaryStats.byYear).map(
                          ([year, data], index, array) => {
                            if (index === 0) {
                              return {
                                year,
                                average: data.average,
                                growth: 0,
                              };
                            }
                            const prevYear = array[index - 1][1];
                            return {
                              year,
                              average: data.average,
                              growth:
                                prevYear.average > 0
                                  ? ((data.average - prevYear.average) /
                                      prevYear.average) *
                                    100
                                  : 0,
                            };
                          }
                        )}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="year" />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <RechartsTooltip />
                        <Legend />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="average"
                          name="Average Salary"
                          stroke="#3b82f6"
                          activeDot={{ r: 8 }}
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="growth"
                          name="YoY Growth %"
                          stroke="#22c55e"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

export default CompanyAnalytics;
