import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Tabs,
  Tab,
  Chip,
  Divider,
  Progress,
} from "@nextui-org/react";
import {
  Users,
  UserCheck,
  Clock,
  Award,
  AlertCircle,
  TrendingUp,
  School,
  BarChart2,
  DollarSign,
  Clipboard,
  Download,
} from "lucide-react";
import { motion } from "framer-motion";
import Loader from "@/components/Loader";
import { useAuth } from "@/auth";
import ax from "@/config/axios";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { DriveAnalytics } from "@shared-types/DriveAnalytics";
import { ExtendedAppliedDrive } from "@shared-types/ExtendedAppliedDrive";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface Drive {
  _id: string;
  title: string;
  company: {
    name: string;
    logo?: string;
  };
  status: string;
  jobRole?: string;
  jobDescription?: string;
  applicationRange?: {
    start: string;
    end: string;
  };
  workflow?: {
    steps: Array<{
      _id?: string;
      name: string;
      description?: string;
      status?: string;
    }>;
  };
}

interface DriveAnalyticsResponse {
  analytics: DriveAnalytics;
  drive: Drive;
}

interface StageAnalytics {
  stageName: string;
  totalCandidates: number;
  passedCandidates: number;
  failedCandidates: number;
  passRate: number;
  dropOffRate: number;
  isBottleneck: boolean;
  _id?: string;
}

const COLORS = [
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#8884d8",
  "#82ca9d",
];

const GENDER_COLORS = {
  male: "#3b82f6",
  female: "#ec4899",
  other: "#8b5cf6",
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const DriveAnalyticsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { getToken } = useAuth();
  const axios = ax(getToken);
  const [data, setData] = useState<DriveAnalyticsResponse | null>(null);
  const [pipelineData, setPipelineData] = useState<ExtendedAppliedDrive[]>([]);
  const [selected, setSelected] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;

    const fetchDriveAnalytics = async () => {
      try {
        const [analyticsResponse, pipelineResponse] = await Promise.all([
          axios.get(`/drives/${id}/analytics`),
          axios.get(`/drives/${id}/applied`),
        ]);

        setData(analyticsResponse.data.data);
        setPipelineData(pipelineResponse.data.data.applications);
      } catch (error) {
        console.error("Error fetching drive data:", error);
        toast.error("Failed to load drive analytics");
      } finally {
        setLoading(false);
      }
    };

    fetchDriveAnalytics();
  }, [id, axios]);

  const calculateStageAnalytics = (): StageAnalytics[] => {
    if (!data?.drive.workflow?.steps || !pipelineData.length) {
      return [];
    }

    return data.drive.workflow.steps.map((step, stepIndex) => {
      const totalCandidates = pipelineData.length;

      // const candidatesInStage = pipelineData.filter((candidate) => {
      //   if (step.status === "in-progress") {
      //     return (
      //       candidate.status === "inprogress" ||
      //       (stepIndex === 0 && candidate.status === "applied")
      //     );
      //   } else if (
      //     step.status === "completed" &&
      //     stepIndex === data.drive.workflow!.steps!.length - 1
      //   ) {
      //     return candidate.status === "hired";
      //   } else if (candidate.status === "rejected") {
      //     return (
      //       candidate.disqualifiedStage?.toString() === step._id?.toString()
      //     );
      //   }
      //   return false;
      // });

      const passedCandidates = pipelineData.filter((candidate) => {
        if (candidate.status === "hired") return true;

        if (candidate.status === "inprogress") {
          const activeStepIndex = data.drive.workflow!.steps!.findIndex(
            (s) => s.status === "in-progress"
          );
          return activeStepIndex > stepIndex;
        }

        if (candidate.status === "rejected") {
          const rejectedStepIndex = data.drive.workflow!.steps!.findIndex(
            (s) => s._id?.toString() === candidate.disqualifiedStage?.toString()
          );
          return rejectedStepIndex > stepIndex;
        }

        return false;
      });

      const failedCandidates = pipelineData.filter(
        (candidate) =>
          candidate.status === "rejected" &&
          candidate.disqualifiedStage?.toString() === step._id?.toString()
      ).length;

      const passRate =
        totalCandidates > 0
          ? (passedCandidates.length / totalCandidates) * 100
          : 0;
      const dropOffRate =
        totalCandidates > 0 ? (failedCandidates / totalCandidates) * 100 : 0;

      return {
        stageName: step.name,
        totalCandidates,
        passedCandidates: passedCandidates.length,
        failedCandidates,
        passRate,
        dropOffRate,
        isBottleneck: false,
        _id: step._id,
      };
    });
  };

  const exportToPDF = async () => {
    if (!contentRef.current || !data) return;

    try {
      setExporting(true);
      toast.info("Preparing export...");

      const tempDiv = document.createElement("div");
      tempDiv.style.width = "1000px";
      tempDiv.style.padding = "20px";
      tempDiv.style.backgroundColor = "white";
      document.body.appendChild(tempDiv);

      const currentTab = selected;

      setSelected("overview");
      await new Promise((resolve) => setTimeout(resolve, 100));
      const overviewClone = contentRef.current.cloneNode(true) as HTMLElement;
      tempDiv.appendChild(overviewClone);

      setSelected("stages");
      await new Promise((resolve) => setTimeout(resolve, 100));
      const stagesClone = contentRef.current.cloneNode(true) as HTMLElement;
      tempDiv.appendChild(stagesClone);

      setSelected("demographics");
      await new Promise((resolve) => setTimeout(resolve, 100));
      const demographicsClone = contentRef.current.cloneNode(
        true
      ) as HTMLElement;
      tempDiv.appendChild(demographicsClone);

      setSelected(currentTab);

      const pdf = new jsPDF("p", "mm", "a4");

      pdf.setFontSize(24);
      pdf.text(`${data.drive.title} Analytics Report`, 20, 30);
      pdf.setFontSize(16);
      pdf.text(`${data.drive.company?.name}`, 20, 45);
      pdf.text(`${data.drive.jobRole || "Various Roles"}`, 20, 55);
      pdf.setFontSize(12);
      const today = new Date().toLocaleDateString();
      pdf.text(`Generated on: ${today}`, 20, 65);

      let verticalOffset = 30;
      let pageCount = 1;

      const sections = tempDiv.children;
      for (let i = 0; i < sections.length; i++) {
        const section = sections[i] as HTMLElement;

        if (i > 0) {
          pdf.addPage();
          pageCount++;
          verticalOffset = 20;
        }

        let sectionTitle = "";
        if (i === 0) sectionTitle = "Overview";
        if (i === 1) sectionTitle = "Stage Analysis";
        if (i === 2) sectionTitle = "Demographics";

        pdf.setFontSize(18);
        pdf.text(sectionTitle, 20, verticalOffset);
        verticalOffset += 10;

        const canvas = await html2canvas(section, {
          scale: 0.7,
          logging: false,
          useCORS: true,
          allowTaint: true,
        });

        const imgData = canvas.toDataURL("image/png");
        const imgWidth = 170;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        if (verticalOffset + imgHeight > 270) {
          pdf.addPage();
          pageCount++;
          verticalOffset = 20;
        }

        pdf.addImage(imgData, "PNG", 20, verticalOffset, imgWidth, imgHeight);
        verticalOffset += imgHeight + 20;
      }

      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(10);
        pdf.text(
          `Page ${i} of ${pageCount}`,
          pdf.internal.pageSize.getWidth() - 40,
          pdf.internal.pageSize.getHeight() - 10
        );
      }

      document.body.removeChild(tempDiv);

      pdf.save(`${data.drive.title}-Analytics-Report.pdf`);
      toast.success("Analytics report downloaded successfully!");
    } catch (error) {
      console.error("Error exporting to PDF:", error);
      toast.error("Failed to export analytics report");
    } finally {
      setExporting(false);
    }
  };

  const stageAnalytics = calculateStageAnalytics();

  const bottleneckStage =
    stageAnalytics.length > 0
      ? stageAnalytics.reduce(
          (prev, current) =>
            current.dropOffRate > prev.dropOffRate ? current : prev,
          stageAnalytics[0]
        )
      : null;

  if (bottleneckStage) {
    stageAnalytics.forEach((stage) => {
      if (stage.stageName === bottleneckStage.stageName) {
        stage.isBottleneck = true;
      }
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-screen text-center">
        <AlertCircle size={48} className="text-danger mb-4" />
        <h2 className="text-2xl font-bold mb-2">Analytics Not Available</h2>
        <p className="text-gray-500">
          Unable to load drive analytics. Please try again later.
        </p>
        <Button
          color="primary"
          className="mt-4"
          onClick={() => window.history.back()}
        >
          Go Back
        </Button>
      </div>
    );
  }

  const { analytics, drive } = data;

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercentage = (value: number): string => {
    return value.toFixed(1) + "%";
  };

  const stageData = stageAnalytics.map((stage) => ({
    name: stage.stageName,
    dropOff: stage.dropOffRate,
    pass: stage.passRate,
  }));

  const hiredCandidates = pipelineData.filter(
    (c) => c.status === "hired"
  ).length;
  const rejectedCandidates = pipelineData.filter(
    (c) => c.status === "rejected"
  ).length;
  const inProgressCandidates = pipelineData.filter(
    (c) => c.status === "inprogress" || c.status === "applied"
  ).length;

  const candidateStatusData = [
    { name: "Hired", value: hiredCandidates },
    { name: "Rejected", value: rejectedCandidates },
    { name: "In Progress", value: inProgressCandidates },
  ];

  const genderDistribution = pipelineData.reduce(
    (acc: { male: number; female: number; other: number }, candidate) => {
      const gender = candidate.user.gender?.toLowerCase() || "other";
      if (gender === "male") acc.male++;
      else if (gender === "female") acc.female++;
      else acc.other++;
      return acc;
    },
    { male: 0, female: 0, other: 0 }
  );

  const genderData = [
    { name: "Male", value: genderDistribution.male },
    { name: "Female", value: genderDistribution.female },
    { name: "Other", value: genderDistribution.other },
  ].filter((item) => item.value > 0);

  const degreeData = analytics.educationDistribution
    ? Object.entries(analytics.educationDistribution.degreeTypes).map(
        ([degree, count]) => ({
          name: degree,
          value: count,
        })
      )
    : [];

  const renderStatsCard = (
    title: string,
    value: string | number,
    icon: React.ReactNode,
    color: string
  ) => (
    <motion.div
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      transition={{ duration: 0.3 }}
      className="w-full md:w-1/2 lg:w-1/4 p-2"
    >
      <Card className="h-full shadow-md hover:shadow-lg transition-shadow duration-300">
        <CardBody className="flex flex-row items-center">
          <div className={`p-3 rounded-lg bg-${color}-100`}>{icon}</div>
          <div className="ml-4">
            <p className="text-sm text-default-500">{title}</p>
            <h3 className="text-xl font-bold">{value}</h3>
          </div>
        </CardBody>
      </Card>
    </motion.div>
  );

  const renderSalaryMetrics = () => (
    <Card className="mb-6 shadow-md">
      <CardHeader className="border-b border-default-200 bg-default-50">
        <h3 className="text-lg font-semibold flex items-center">
          <DollarSign size={20} className="mr-2 text-primary" />
          Salary Analysis
        </h3>
      </CardHeader>
      <CardBody>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center p-4 border border-default-200 rounded-lg hover:bg-default-50 transition-colors">
            <p className="text-sm text-default-500 mb-1">Average CTC</p>
            <h4 className="text-xl font-bold text-primary">
              {formatCurrency(analytics.salary.averageCTC)}
            </h4>
          </div>
          <div className="text-center p-4 border border-default-200 rounded-lg hover:bg-default-50 transition-colors">
            <p className="text-sm text-default-500 mb-1">Highest Package</p>
            <h4 className="text-xl font-bold text-success">
              {formatCurrency(analytics.salary.highestCTC)}
            </h4>
          </div>
          <div className="text-center p-4 border border-default-200 rounded-lg hover:bg-default-50 transition-colors">
            <p className="text-sm text-default-500 mb-1">Lowest Package</p>
            <h4 className="text-xl font-bold text-warning">
              {formatCurrency(analytics.salary.lowestCTC)}
            </h4>
          </div>
          <div className="text-center p-4 border border-default-200 rounded-lg hover:bg-default-50 transition-colors">
            <p className="text-sm text-default-500 mb-1">Median Package</p>
            <h4 className="text-xl font-bold text-secondary">
              {formatCurrency(analytics.salary.medianCTC)}
            </h4>
          </div>
        </div>
      </CardBody>
    </Card>
  );

  const renderStageAnalysis = () => (
    <Card className="mb-6 shadow-md">
      <CardHeader className="border-b border-default-200 bg-default-50">
        <h3 className="text-lg font-semibold flex items-center">
          <Clipboard size={20} className="mr-2 text-primary" />
          Stage Analysis
        </h3>
      </CardHeader>
      <CardBody>
        {bottleneckStage && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg shadow-sm">
            <h4 className="font-medium text-amber-800 flex items-center">
              <AlertCircle size={16} className="mr-2" />
              Bottleneck Identified
            </h4>
            <p className="text-sm text-amber-700 mt-1">
              <span className="font-medium">{bottleneckStage.stageName}</span>{" "}
              has the highest drop-off rate (
              {formatPercentage(bottleneckStage.dropOffRate)}). Consider
              reviewing this stage to improve conversion.
            </p>
          </div>
        )}

        <div className="mt-6 bg-default-50 p-4 rounded-lg">
          <h4 className="font-medium mb-4 text-center text-primary">
            Stage Performance Analysis
          </h4>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={stageData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="name" tick={{ fill: "#666" }} />
              <YAxis tick={{ fill: "#666" }} />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  borderRadius: "8px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                }}
              />
              <Legend wrapperStyle={{ paddingTop: "10px" }} />
              <Bar
                dataKey="pass"
                name="Pass Rate (%)"
                fill="#4ade80"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="dropOff"
                name="Drop-off Rate (%)"
                fill="#f87171"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-8">
          <h4 className="font-medium mb-4 text-primary">Stage Details</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {stageAnalytics.map((stage, index) => (
              <div
                key={index}
                className={`border ${
                  stage.isBottleneck
                    ? "border-amber-300 bg-amber-50"
                    : "border-default-200"
                } rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow`}
              >
                <div className="flex justify-between mb-2">
                  <h5 className="font-medium">{stage.stageName}</h5>
                  {stage.isBottleneck && (
                    <Chip color="warning" size="sm" variant="flat">
                      Bottleneck
                    </Chip>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                  <div className="bg-default-50 p-2 rounded">
                    Total Candidates:{" "}
                    <span className="font-medium">{stage.totalCandidates}</span>
                  </div>
                  <div className="bg-default-50 p-2 rounded">
                    Passed:{" "}
                    <span className="font-medium text-success">
                      {stage.passedCandidates}
                    </span>
                  </div>
                  <div className="bg-default-50 p-2 rounded">
                    Failed:{" "}
                    <span className="font-medium text-danger">
                      {stage.failedCandidates}
                    </span>
                  </div>
                  <div className="bg-default-50 p-2 rounded">
                    Pass Rate:{" "}
                    <span className="font-medium">
                      {formatPercentage(stage.passRate)}
                    </span>
                  </div>
                </div>
                <div className="mt-2">
                  <div className="flex justify-between mb-1 text-xs">
                    <span>Pass Rate</span>
                    <span>{formatPercentage(stage.passRate)}</span>
                  </div>
                  <Progress
                    value={stage.passRate}
                    color={
                      stage.passRate > 70
                        ? "success"
                        : stage.passRate > 40
                        ? "warning"
                        : "danger"
                    }
                    size="md"
                    radius="sm"
                    className="h-2"
                    showValueLabel={false}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardBody>
    </Card>
  );

  const renderDemographics = () => (
    <Card className="mb-6 shadow-md">
      <CardHeader className="border-b border-default-200 bg-default-50">
        <h3 className="text-lg font-semibold flex items-center">
          <Users size={20} className="mr-2 text-primary" />
          Candidate Demographics
        </h3>
      </CardHeader>
      <CardBody>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {genderData.length > 0 && (
            <div className="bg-default-50 p-4 rounded-lg">
              <h4 className="font-medium mb-4 text-center text-primary">
                Gender Distribution
              </h4>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={genderData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={90}
                    innerRadius={50}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name}: ${(percent * 100).toFixed(0)}%`
                    }
                    paddingAngle={2}
                  >
                    {genderData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          entry.name.toLowerCase() === "male"
                            ? GENDER_COLORS.male
                            : entry.name.toLowerCase() === "female"
                            ? GENDER_COLORS.female
                            : GENDER_COLORS.other
                        }
                      />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      borderRadius: "8px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    }}
                  />
                  <Legend wrapperStyle={{ paddingTop: "10px" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {analytics.educationDistribution && degreeData.length > 0 && (
            <div className="bg-default-50 p-4 rounded-lg">
              <h4 className="font-medium mb-4 text-center text-primary">
                Education Distribution
              </h4>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={degreeData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={90}
                    innerRadius={50}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${name}: ${(percent * 100).toFixed(0)}%`
                    }
                    paddingAngle={2}
                  >
                    {degreeData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      borderRadius: "8px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    }}
                  />
                  <Legend wrapperStyle={{ paddingTop: "10px" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {analytics.educationDistribution &&
          analytics.educationDistribution.topSchools.length > 0 && (
            <div className="mt-8">
              <h4 className="font-medium mb-4 text-primary">Top Schools</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {analytics.educationDistribution.topSchools.map(
                  (school, index) => (
                    <div
                      key={index}
                      className="flex items-center p-4 border border-default-200 rounded-lg shadow-sm hover:shadow-md transition-shadow bg-default-50"
                    >
                      <div className="bg-blue-100 p-3 rounded-full mr-4">
                        <School size={18} className="text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium truncate">{school.school}</p>
                        <p className="text-sm text-default-500">
                          {school.count} candidate
                          {school.count !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
      </CardBody>
    </Card>
  );

  const totalCandidates = pipelineData.length;
  const applicationRate =
    totalCandidates > 0
      ? (totalCandidates / (analytics.totalCandidates || 1)) * 100
      : 0;
  const conversionRate =
    totalCandidates > 0 ? (hiredCandidates / totalCandidates) * 100 : 0;

  return (
    <div className="container mx-auto px-4 py-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-6"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-primary">
              {drive.title} Analytics
            </h1>
            <p className="text-default-500 mt-1">
              {drive.company?.name} · {drive.jobRole || "Various Roles"}
            </p>
          </div>
          <Button
            color="primary"
            variant="shadow"
            className="mt-4 md:mt-0 flex items-center gap-2"
            onClick={exportToPDF}
            isLoading={exporting}
            startContent={!exporting && <Download size={18} />}
          >
            {exporting ? "Exporting..." : "Export"}
          </Button>
        </div>

        <Divider className="my-4" />

        <Tabs
          selectedKey={selected}
          onSelectionChange={(key) => setSelected(key as string)}
          className="mt-6"
          variant="underlined"
          color="primary"
          size="lg"
        >
          <Tab key="overview" title="Overview" />
          <Tab key="stages" title="Stage Analysis" />
          <Tab key="demographics" title="Demographics" />
        </Tabs>
      </motion.div>

      <div ref={contentRef}>
        {selected === "overview" && (
          <div className="space-y-6">
            <div className="flex flex-wrap -mx-2">
              {renderStatsCard(
                "Total Candidates",
                totalCandidates,
                <Users size={24} className="text-blue-500" />,
                "blue"
              )}
              {renderStatsCard(
                "Active Candidates",
                pipelineData.filter(
                  (c) => c.status === "applied" || c.status === "inprogress"
                ).length,
                <UserCheck size={24} className="text-green-500" />,
                "green"
              )}
              {renderStatsCard(
                "Hired Candidates",
                hiredCandidates,
                <Award size={24} className="text-purple-500" />,
                "purple"
              )}
              {renderStatsCard(
                "Application Rate",
                formatPercentage(applicationRate),
                <TrendingUp size={24} className="text-teal-500" />,
                "teal"
              )}
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
            >
              <Card className="mb-6 shadow-md">
                <CardHeader className="border-b border-default-200 bg-default-50">
                  <h3 className="text-lg font-semibold flex items-center">
                    <BarChart2 size={20} className="mr-2 text-primary" />
                    Key Performance Indicators
                  </h3>
                </CardHeader>
                <CardBody>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center p-4 border border-default-200 rounded-lg hover:shadow-sm transition-shadow">
                      <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-blue-100 mb-4">
                        <Users size={32} className="text-blue-600" />
                      </div>
                      <h4 className="text-2xl font-bold text-blue-600">
                        {formatPercentage(applicationRate)}
                      </h4>
                      <p className="text-sm text-default-500">
                        Application Rate
                      </p>
                    </div>

                    <div className="text-center p-4 border border-default-200 rounded-lg hover:shadow-sm transition-shadow">
                      <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-green-100 mb-4">
                        <UserCheck size={32} className="text-green-600" />
                      </div>
                      <h4 className="text-2xl font-bold text-green-600">
                        {formatPercentage(conversionRate)}
                      </h4>
                      <p className="text-sm text-default-500">
                        Conversion Rate
                      </p>
                    </div>

                    <div className="text-center p-4 border border-default-200 rounded-lg hover:shadow-sm transition-shadow">
                      <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-amber-100 mb-4">
                        <Clock size={32} className="text-amber-600" />
                      </div>
                      <h4 className="text-2xl font-bold text-amber-600">
                        {analytics.timeToHire
                          ? analytics.timeToHire.toFixed(1)
                          : "N/A"}
                      </h4>
                      <p className="text-sm text-default-500">
                        Avg. Days to Hire
                      </p>
                    </div>
                  </div>
                </CardBody>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <Card className="shadow-md">
                  <CardHeader className="border-b border-default-200 bg-default-50">
                    <h3 className="text-lg font-semibold flex items-center">
                      <BarChart2 size={20} className="mr-2 text-primary" />
                      Candidate Status
                    </h3>
                  </CardHeader>
                  <CardBody className="bg-default-50">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={candidateStatusData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={90}
                          innerRadius={50}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, value, percent }) =>
                            `${name}: ${value} (${(percent * 100).toFixed(0)}%)`
                          }
                          paddingAngle={2}
                        >
                          <Cell fill="#4ade80" />
                          <Cell fill="#f87171" />
                          <Cell fill="#fbbf24" />
                        </Pie>
                        <RechartsTooltip
                          contentStyle={{
                            backgroundColor: "#fff",
                            borderRadius: "8px",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                          }}
                        />
                        <Legend wrapperStyle={{ paddingTop: "10px" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardBody>
                </Card>

                {renderSalaryMetrics()}
              </div>
            </motion.div>
          </div>
        )}

        {selected === "stages" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            {renderStageAnalysis()}
          </motion.div>
        )}

        {selected === "demographics" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          >
            {renderDemographics()}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default DriveAnalyticsPage;
