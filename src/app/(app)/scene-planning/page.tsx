export default function ScenePlanningPage() {
  return (
    <section className="max-w-7xl">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">PAK Workspace</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">Scene Planning</h2>
      <p className="mt-4 max-w-3xl text-base leading-7 text-slate-400">
        Convert approved Content Studio artifacts into provider-neutral, versioned scene and shot plans. Phase 6 preserves canonical narration, visual continuity, deterministic quality checks, and approval state before any future video provider is allowed to run.
      </p>

      <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/50 p-6">
        <p className="text-sm font-semibold text-white">Scene Planning foundation</p>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
          Project briefs, Visual Bible controls, scene timelines, quality findings, and approval actions are being wired on this route. No video-generation provider is called from Phase 6.
        </p>
      </div>
    </section>
  );
}
