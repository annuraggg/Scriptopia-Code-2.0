import { RootContext } from "@/types/RootContext";
import { Link, useOutletContext } from "react-router-dom";
import { Button } from "@nextui-org/react";
import {
  Bell,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  ShieldCheck,
  Users,
} from "lucide-react";
import { PageShell } from "@/components/campus/PageShell";
import { MetricCard } from "@/components/campus/MetricCard";
import { StatusPill } from "@/components/campus/StatusPill";
import { EmptyState } from "@/components/campus/EmptyState";

const Dashboard = () => {
  const { notifications, user, institute } = useOutletContext<RootContext>();

  const unreadNotifications =
    notifications?.filter((notif) => !notif.readBy?.includes(user?.user!)) || [];
  const recentNotifications = [...(notifications || [])]
    .sort(
      (a, b) =>
        new Date(b.createdAt || 0).getTime() -
        new Date(a.createdAt || 0).getTime()
    )
    .slice(0, 5);

  const activeDrives =
    institute?.drives?.filter(
      (drive) => new Date(drive.applicationRange?.end) > new Date()
    )?.length || 0;

  const permissions = user?.permissions || [];

  return (
    <PageShell
      eyebrow="Campus command center"
      title={`Welcome back${user?.role ? `, ${user.role}` : ""}`}
      description="Monitor placement operations, candidate access, company activity, and important institute updates from a single workspace."
      actions={
        <>
          <Button as={Link} to="/analytics" variant="flat">
            View analytics
          </Button>
          <Button as={Link} to="/drives/create" color="primary">
            Create drive
          </Button>
        </>
      }
    >
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Active drives"
          value={activeDrives}
          detail="Currently accepting applications"
          icon={<BriefcaseBusiness className="h-4 w-4" />}
          tone="blue"
        />
        <MetricCard
          label="Candidates"
          value={institute?.candidates?.length || 0}
          detail="Verified institute profiles"
          icon={<Users className="h-4 w-4" />}
          tone="green"
        />
        <MetricCard
          label="Unread updates"
          value={unreadNotifications.length}
          detail={`${notifications?.length || 0} total notifications`}
          icon={<Bell className="h-4 w-4" />}
          tone="amber"
        />
        <MetricCard
          label="Permissions"
          value={permissions.length}
          detail="Granted in this institute"
          icon={<ShieldCheck className="h-4 w-4" />}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="campus-panel">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div>
              <h2 className="text-base font-semibold text-slate-950">
                Recent activity
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Latest institute notifications and operational updates.
              </p>
            </div>
            <Button as={Link} to="/notifications" size="sm" variant="light">
              Open inbox
            </Button>
          </div>

          {recentNotifications.length ? (
            <div className="divide-y divide-slate-100">
              {recentNotifications.map((notification) => {
                const isUnread = !notification.readBy?.includes(user?.user!);
                return (
                  <article
                    key={notification._id}
                    className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-semibold text-slate-950">
                          {notification.title}
                        </h3>
                        <StatusPill tone={isUnread ? "warning" : "neutral"}>
                          {isUnread ? "Unread" : "Read"}
                        </StatusPill>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">
                        {notification.message}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2 text-xs text-slate-500">
                      <Clock3 className="h-3.5 w-3.5" />
                      {new Date(notification.createdAt!).toLocaleDateString(
                        "en-US",
                        { month: "short", day: "numeric", year: "numeric" }
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon={<Bell className="h-5 w-5" />}
              title="No notifications yet"
              description="New drive activity, candidate updates, and institute events will appear here."
            />
          )}
        </div>

        <aside className="campus-panel p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-950 text-white">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-950">
                Access profile
              </h2>
              <p className="text-sm text-slate-500">{user?.email}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                Role
              </p>
              <p className="mt-1 text-sm font-semibold capitalize text-slate-950">
                {user?.role || "Member"}
              </p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                Status
              </p>
              <p className="mt-1 text-sm font-semibold capitalize text-slate-950">
                {user?.status || "Active"}
              </p>
            </div>
          </div>

          <div className="mt-5">
            <p className="mb-3 text-sm font-semibold text-slate-950">
              Enabled capabilities
            </p>
            <div className="flex max-h-[220px] flex-wrap gap-2 overflow-y-auto">
              {permissions.map((permission) => (
                <StatusPill key={permission} tone="info">
                  {permission.replace(/_/g, " ")}
                </StatusPill>
              ))}
              {!permissions.length && (
                <p className="text-sm text-slate-500">
                  No granular permissions assigned.
                </p>
              )}
            </div>
          </div>
        </aside>
      </section>
    </PageShell>
  );
};

export default Dashboard;
