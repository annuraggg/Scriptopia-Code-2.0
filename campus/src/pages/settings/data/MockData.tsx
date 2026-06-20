import ax from "@/config/axios";
import { useAuth } from "@/auth";
import { Database, RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

type MockStatus = {
  status: "none" | "generating" | "ready" | "removing" | "failed";
  generatedAt?: string;
  recordCounts?: Record<string, number>;
  lastError?: string;
};

const MockData = () => {
  const { getToken } = useAuth();
  const api = ax(getToken);
  const [data, setData] = useState<MockStatus>({ status: "none" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await api.get("/institutes/settings/mock-data");
    setData(response.data.data);
  }, []);

  useEffect(() => {
    load().catch(() => toast.error("Could not load mock data status"));
  }, [load]);

  const run = async (action: "generate" | "remove") => {
    if (action === "remove" && !window.confirm("Remove all generated records? Real records and configuration will be preserved.")) return;
    setBusy(true);
    try {
      if (action === "generate") await api.post("/institutes/settings/mock-data");
      else await api.delete("/institutes/settings/mock-data");
      toast.success(action === "generate" ? "Mock data generated" : "Mock data removed");
      await load();
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Mock data operation failed");
    } finally {
      setBusy(false);
    }
  };

  const counts = Object.entries(data.recordCounts || {}).filter(([, value]) => value > 0);

  return (
    <main className="mx-auto w-full max-w-5xl p-6 lg:p-10">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">Workspace data</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">Mock data</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">Manage the connected demonstration dataset used across dashboards, drives, applications, and placement analytics.</p>
        </div>
        <span className="w-fit rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">{data.status}</span>
      </div>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-indigo-50 p-3 text-indigo-700"><Database className="h-5 w-5" /></div>
          <div className="flex-1">
            <h2 className="font-semibold text-slate-950">{data.status === "ready" ? "Demonstration dataset active" : "No demonstration dataset"}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {data.generatedAt ? `Generated ${new Date(data.generatedAt).toLocaleString()}.` : "Generate realistic linked institutional records without affecting live data."}
            </p>
            {data.lastError && <p className="mt-3 rounded-md bg-rose-50 p-3 text-sm text-rose-700">{data.lastError}</p>}
          </div>
        </div>

        {counts.length > 0 && (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {counts.map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-2xl font-semibold text-slate-950">{value.toLocaleString()}</p>
                <p className="mt-1 text-xs font-medium capitalize text-slate-500">{label.replace(/([A-Z])/g, " $1")}</p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          {data.status !== "ready" ? (
            <button disabled={busy} onClick={() => run("generate")} className="inline-flex h-10 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} /> Generate mock data
            </button>
          ) : (
            <button disabled={busy} onClick={() => run("remove")} className="inline-flex h-10 items-center gap-2 rounded-md border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">
              <Trash2 className="h-4 w-4" /> Remove mock data
            </button>
          )}
        </div>
      </section>
    </main>
  );
};

export default MockData;
