import { useEffect, useState } from "react";
import { DataTable } from "./DataTable";
import { useAuth } from "@/auth";
import ax from "@/config/axios";
import { Button, Spinner } from "@nextui-org/react";
import { useOutletContext } from "react-router-dom";
import { RootContext } from "@/types/RootContext";
import { toast } from "sonner";
import { Candidate } from "@shared-types/Candidate";
import { PageShell } from "@/components/campus/PageShell";
import { MetricCard } from "@/components/campus/MetricCard";
import { EmptyState } from "@/components/campus/EmptyState";
import { ClipboardCopy, Clock3, RefreshCw, UserPlus, Users } from "lucide-react";

const PendingCandidates = () => {
  const { institute } = useOutletContext<RootContext>();
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { getToken } = useAuth();

  const fetchCandidates = async () => {
    setLoading(true);
    setError(null);
    const axios = ax(getToken);
    axios
      .get("/institutes/candidates/pending")
      .then((response) => setCandidates(response.data.data || []))
      .catch((err) => {
        console.error(err);
        setError("Failed to fetch candidates");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  const copyInvite = () => {
    navigator.clipboard.writeText(
      `${import.meta.env.VITE_CANDIDATE_URL}/campus?code=${institute?.code}`
    );
    toast.success("Invite link copied to clipboard");
  };

  return (
    <PageShell
      eyebrow="Candidate verification"
      title="Pending candidates"
      description="Approve or reject student access requests before they can apply to institute drives."
      actions={
        <>
          <Button
            variant="flat"
            startContent={<RefreshCw size={16} />}
            onPress={fetchCandidates}
            isLoading={loading}
          >
            Refresh
          </Button>
          <Button
            color="primary"
            startContent={<ClipboardCopy size={16} />}
            onPress={copyInvite}
          >
            Copy invite link
          </Button>
        </>
      }
    >
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Pending review"
          value={candidates.length}
          detail="Awaiting campus approval"
          icon={<Clock3 className="h-4 w-4" />}
          tone="amber"
        />
        <MetricCard
          label="Invite code"
          value={institute?.code || "Unavailable"}
          detail="Shared with students"
          icon={<UserPlus className="h-4 w-4" />}
          tone="blue"
        />
        <MetricCard
          label="Access outcome"
          value="Manual"
          detail="Admins approve every join request"
          icon={<Users className="h-4 w-4" />}
        />
      </section>

      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-lg border border-slate-200 bg-white">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title="Unable to load pending candidates"
          description={error}
          action={
            <Button color="primary" onPress={fetchCandidates}>
              Retry
            </Button>
          }
        />
      ) : (
        <DataTable
          data={candidates}
          type="pending"
          setData={setCandidates}
          onDataChange={fetchCandidates}
        />
      )}
    </PageShell>
  );
};

export default PendingCandidates;
