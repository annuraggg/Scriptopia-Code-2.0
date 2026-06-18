import { useEffect, useState } from "react";
import { DataTable } from "./DataTable";
import { useAuth } from "@/auth";
import ax from "@/config/axios";
import { Button, Spinner } from "@nextui-org/react";
import { Candidate } from "@shared-types/Candidate";
import { PageShell } from "@/components/campus/PageShell";
import { MetricCard } from "@/components/campus/MetricCard";
import { EmptyState } from "@/components/campus/EmptyState";
import { CheckCircle2, RefreshCw, UserRoundCheck, Users } from "lucide-react";

const Candidates = () => {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { getToken } = useAuth();

  const fetchCandidates = async () => {
    setLoading(true);
    setError(null);
    try {
      const axios = ax(getToken);
      const response = await axios.get("/institutes/candidates");
      setCandidates(response.data.data || []);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch candidates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  return (
    <PageShell
      eyebrow="Candidate operations"
      title="Active candidates"
      description="Review verified student profiles, open candidate records, and remove campus access when needed."
      actions={
        <Button
          variant="flat"
          startContent={<RefreshCw size={16} />}
          onPress={fetchCandidates}
          isLoading={loading}
        >
          Refresh
        </Button>
      }
    >
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Active candidates"
          value={candidates.length}
          detail="Verified for this institute"
          icon={<Users className="h-4 w-4" />}
          tone="green"
        />
        <MetricCard
          label="Profiles"
          value={candidates.filter((candidate) => candidate.createdAt).length}
          detail="With profile metadata"
          icon={<UserRoundCheck className="h-4 w-4" />}
          tone="blue"
        />
        <MetricCard
          label="Access state"
          value="Verified"
          detail="Candidates can apply to campus drives"
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
      </section>

      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-lg border border-slate-200 bg-white">
          <Spinner size="lg" />
        </div>
      ) : error ? (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title="Unable to load candidates"
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
          type="active"
          setData={setCandidates}
          onDataChange={fetchCandidates}
        />
      )}
    </PageShell>
  );
};

export default Candidates;
