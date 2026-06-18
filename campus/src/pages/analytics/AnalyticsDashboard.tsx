import { useEffect, useState } from "react";
import { Button, Spinner, Tab, Tabs } from "@nextui-org/react";
import { RefreshCw } from "lucide-react";
import { useAnalyticsService } from "./analytics";
import {
  AnalyticsData,
  DashboardStats,
} from "@shared-types/InstituteAnalytics";
import OverviewStats from "./OverviewStats";
import RecentActivity from "./RecentActivity";
import DriveDistributionChart from "./DriveDistributionChart";
import OngoingApplications from "./OngoingApplications";
import UpcomingEvents from "./UpcomingEvents";
import DriveAnalytics from "./DriveAnalytics";
import CandidateAnalytics from "./CandidateAnalytics";
import DepartmentAnalytics from "./DepartmentAnalytics";
import { PageShell } from "@/components/campus/PageShell";
import { EmptyState } from "@/components/campus/EmptyState";
import { BarChart3 } from "lucide-react";

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const analyticsService = useAnalyticsService();

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [dashboardData, analyticsResults] = await Promise.all([
        analyticsService.fetchDashboardStats(),
        analyticsService.fetchAnalytics(),
      ]);

      setDashboardStats(dashboardData);
      setAnalyticsData(analyticsResults);
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError("Unable to load analytics data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <PageShell
      eyebrow="Institute intelligence"
      title="Analytics"
      description="Track placement performance across drives, candidates, departments, applications, and upcoming events."
      actions={
        <Button
          variant="flat"
          startContent={<RefreshCw size={16} />}
          onPress={loadData}
          isLoading={loading}
        >
          Refresh
        </Button>
      }
    >
      {loading ? (
        <div className="flex h-80 items-center justify-center rounded-lg border border-slate-200 bg-white">
          <div className="text-center">
            <Spinner size="lg" />
            <p className="mt-4 text-sm font-medium text-slate-600">
              Loading analytics
            </p>
          </div>
        </div>
      ) : error || !dashboardStats || !analyticsData ? (
        <EmptyState
          icon={<BarChart3 className="h-5 w-5" />}
          title="Analytics unavailable"
          description={error || "The analytics service did not return data."}
          action={<Button color="primary" onPress={loadData}>Retry</Button>}
        />
      ) : (
        <Tabs
          aria-label="Analytics sections"
          selectedKey={activeTab}
          onSelectionChange={(key) => setActiveTab(key as string)}
          classNames={{
            tabList:
              "rounded-lg border border-slate-200 bg-white p-1 shadow-sm",
            cursor: "bg-slate-950",
            tab: "h-10 px-4",
            tabContent:
              "text-slate-600 group-data-[selected=true]:text-white font-medium",
          }}
        >
          <Tab key="overview" title="Overview">
            <section className="mt-5 space-y-6">
              <div className="campus-panel p-5">
                <OverviewStats stats={dashboardStats} />
              </div>
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                <DriveDistributionChart
                  distribution={dashboardStats.driveTypeDistribution}
                />
                <UpcomingEvents events={dashboardStats.upcomingEvents} />
              </div>
              <div className="grid grid-cols-1 gap-6">
                <OngoingApplications
                  applications={dashboardStats.ongoingApplications}
                />
                <RecentActivity activities={dashboardStats.recentActivity} />
              </div>
            </section>
          </Tab>

          <Tab key="drives" title="Drives">
            <section className="campus-panel mt-5 p-5">
              <DriveAnalytics
                driveStats={analyticsData.driveStats}
                timelineData={{
                  driveCreationTimeline:
                    analyticsData.timelineStats.driveCreationTimeline,
                  drivePublishingTimeline:
                    analyticsData.timelineStats.drivePublishingTimeline,
                }}
              />
            </section>
          </Tab>

          <Tab key="candidates" title="Candidates">
            <section className="campus-panel mt-5 p-5">
              <CandidateAnalytics candidateStats={analyticsData.candidateStats} />
            </section>
          </Tab>

          <Tab key="departments" title="Departments">
            <section className="campus-panel mt-5 p-5">
              <DepartmentAnalytics />
            </section>
          </Tab>
        </Tabs>
      )}
    </PageShell>
  );
}
