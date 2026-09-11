"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { controlProductionRun, startProductionRun } from "./actions";
import type { ProductionRun } from "@/modules/publishing-production/domain";

type ProgrammeOption = { code: string; title: string };

export function PublishingProductionClient(props: {
  organizationId: string;
  programmes: ProgrammeOption[];
  initialRuns: ProductionRun[];
}) {
  const [scopeType, setScopeType] = useState<"SUBJECT" | "PROGRAMME" | "PILOT" | "PORTFOLIO">("PILOT");
  const [programmeCode, setProgrammeCode] = useState(props.programmes[0]?.code ?? "");
  const [subjectCode, setSubjectCode] = useState("D01-102");
  const [pilotLimit, setPilotLimit] = useState(3);
  const [concurrency, setConcurrency] = useState(4);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedProgramme = useMemo(
    () => props.programmes.find((programme) => programme.code === programmeCode),
    [props.programmes, programmeCode],
  );

  function startRun() {
    startTransition(async () => {
      setMessage(null);
      const scope = scopeType === "PORTFOLIO"
        ? { type: "PORTFOLIO" as const }
        : scopeType === "PROGRAMME"
          ? { type: "PROGRAMME" as const, programmeCode }
          : scopeType === "PILOT"
            ? { type: "PILOT" as const, programmeCode, limit: pilotLimit }
            : { type: "SUBJECT" as const, programmeCode, subjectCode };
      const result = await startProductionRun({
        organizationId: props.organizationId,
        scope,
        concurrency,
      });
      setMessage(result.ok
        ? `Production run started: ${result.plannedCount} governed book job(s) queued.`
        : result.error);
      if (result.ok) window.location.reload();
    });
  }

  function control(runId: string, state: "PAUSED" | "RUNNING" | "CANCELLED") {
    startTransition(async () => {
      const result = await controlProductionRun({ organizationId: props.organizationId, runId, state });
      setMessage(result.ok ? `Run ${state.toLowerCase()}.` : result.error);
      if (result.ok) window.location.reload();
    });
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">Publishing Production Runner</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Start durable textbook production. Work continues from persisted checkpoints even when this browser is closed.
            </p>
          </div>
          <Link href="/publishing/library" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800">
            Open Book Library
          </Link>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <label className="text-sm font-medium text-slate-700">
            Scope
            <select aria-label="Production scope" value={scopeType} onChange={(event) => setScopeType(event.target.value as typeof scopeType)} className="mt-1 w-full rounded-lg border border-slate-300 p-2">
              <option value="PILOT">Pilot</option>
              <option value="SUBJECT">Single subject</option>
              <option value="PROGRAMME">Programme</option>
              <option value="PORTFOLIO">Eligible portfolio</option>
            </select>
          </label>

          {scopeType !== "PORTFOLIO" && (
            <label className="text-sm font-medium text-slate-700">
              Programme
              <select aria-label="Programme" value={programmeCode} onChange={(event) => setProgrammeCode(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2">
                {props.programmes.map((programme) => <option key={programme.code} value={programme.code}>{programme.code} — {programme.title}</option>)}
              </select>
            </label>
          )}

          {scopeType === "SUBJECT" && (
            <label className="text-sm font-medium text-slate-700">
              Subject code
              <input aria-label="Subject code" value={subjectCode} onChange={(event) => setSubjectCode(event.target.value.toUpperCase())} className="mt-1 w-full rounded-lg border border-slate-300 p-2" />
            </label>
          )}

          {scopeType === "PILOT" && (
            <label className="text-sm font-medium text-slate-700">
              Pilot books
              <input aria-label="Pilot books" type="number" min={1} max={10} value={pilotLimit} onChange={(event) => setPilotLimit(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 p-2" />
            </label>
          )}

          <label className="text-sm font-medium text-slate-700">
            Concurrent workers
            <input aria-label="Concurrent workers" type="number" min={1} max={32} value={concurrency} onChange={(event) => setConcurrency(Number(event.target.value))} className="mt-1 w-full rounded-lg border border-slate-300 p-2" />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" onClick={startRun} disabled={isPending || (scopeType !== "PORTFOLIO" && !selectedProgramme)} className="rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {isPending ? "Saving…" : "Start Production"}
          </button>
          {message && <p role="status" className="text-sm text-slate-700">{message}</p>}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Production Runs</h2>
        {props.initialRuns.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No production runs yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-slate-500"><tr><th className="py-2">Status</th><th>Planned</th><th>Queued</th><th>Running</th><th>Released</th><th>Blocked</th><th>Controls</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {props.initialRuns.map((run) => (
                  <tr key={run.id}>
                    <td className="py-3 font-medium text-slate-900">{run.status}</td>
                    <td>{run.plannedCount}</td><td>{run.queuedCount}</td><td>{run.runningCount}</td><td>{run.releasedCount}</td><td>{run.blockedCount}</td>
                    <td className="space-x-2 whitespace-nowrap">
                      {run.status === "PAUSED" ? <button onClick={() => control(run.id, "RUNNING")} className="underline">Resume</button> : <button onClick={() => control(run.id, "PAUSED")} disabled={["COMPLETED","COMPLETED_WITH_BLOCKED","CANCELLED","FAILED"].includes(run.status)} className="underline disabled:opacity-30">Pause</button>}
                      <button onClick={() => control(run.id, "CANCELLED")} disabled={["COMPLETED","COMPLETED_WITH_BLOCKED","CANCELLED","FAILED"].includes(run.status)} className="underline disabled:opacity-30">Cancel</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
