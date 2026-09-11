export const dynamic = "force-dynamic";

import Link from "next/link";
import { z } from "zod";
import { ScenePlanningWorkspace } from "./scene-planning-workspace";
import { loadScenePlanningWorkspaceData } from "./workspace-data";

function RouteMessage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/50 p-6">
      <p className="text-sm font-semibold text-white">{title}</p>
      <div className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{children}</div>
    </div>
  );
}

export default async function ScenePlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string | string[] }>;
}) {
  const params = await searchParams;
  const projectParam = typeof params.project === "string" ? params.project : null;
  const parsedProjectId = projectParam ? z.string().uuid().safeParse(projectParam) : null;
  const workspace = parsedProjectId?.success
    ? await loadScenePlanningWorkspaceData(parsedProjectId.data)
    : null;

  return (
    <section className="max-w-7xl">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">PAK Workspace</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">Scene Planning</h2>
      <p className="mt-4 max-w-3xl text-base leading-7 text-slate-400">
        Convert approved Content Studio artifacts into provider-neutral, versioned scene and shot plans. Canonical narration, visual continuity, deterministic quality checks, source freshness, and approval remain authoritative; only approved current shots can proceed to Phase 7 video generation.
      </p>

      {!projectParam ? (
        <RouteMessage title="Start from a persisted script artifact">
          Choose a current GENERATED language artifact in Content Studio and use <strong className="text-slate-200">Create Scene Plan</strong>. The script body is resolved server-side; Scene Planning never trusts browser copy/paste as the canonical source.
          <div className="mt-4">
            <Link href="/content-studio" className="inline-flex rounded-xl border border-slate-700 px-4 py-2 font-semibold text-white hover:bg-slate-900">
              Open Content Studio
            </Link>
          </div>
        </RouteMessage>
      ) : !parsedProjectId?.success ? (
        <RouteMessage title="Invalid Scene Planning project">
          The requested project identifier is invalid. Return to Content Studio and open Scene Planning from a persisted artifact.
        </RouteMessage>
      ) : !workspace ? (
        <RouteMessage title="Scene Planning project unavailable">
          This project does not exist in your current organization scope, or your membership does not permit access. No cross-organization project data is exposed.
        </RouteMessage>
      ) : (
        <ScenePlanningWorkspace {...workspace} />
      )}
    </section>
  );
}
