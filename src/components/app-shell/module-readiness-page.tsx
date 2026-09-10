import Link from "next/link";

import type { ModuleReadinessConfig } from "./module-readiness";

export function ModuleReadinessPage({ config }: { config: ModuleReadinessConfig }) {
  const availabilityId = `${config.route.slice(1).replaceAll("/", "-")}-availability`;

  return (
    <section className="max-w-5xl">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">PAK Workspace</p>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-3xl font-semibold tracking-tight text-white">{config.title}</h2>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-400">{config.description}</p>
        </div>
        <span
          aria-label={`Readiness: ${config.status}`}
          className="rounded-full border border-slate-700 bg-slate-950/60 px-3 py-1.5 text-xs font-semibold text-slate-200"
        >
          {config.status}
        </span>
      </div>

      <section
        aria-labelledby={availabilityId}
        className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/60 p-5 sm:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 id={availabilityId} className="text-lg font-semibold text-white">
            Current availability
          </h3>
          <span className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{config.roadmapPhase}</span>
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-300">{config.explanation}</p>
        <p className="mt-3 text-sm leading-6 text-slate-400">
          <strong className="font-semibold text-slate-200">Dependency:</strong> {config.dependency}
        </p>
        <p className="sr-only">{config.roadmapPhase}</p>
      </section>

      <nav aria-label={`${config.title} related workflows`} className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
        <h3 className="text-lg font-semibold text-white">Available now</h3>
        <p className="mt-2 text-sm leading-6 text-slate-400">Continue with a workflow that is implemented in the current release.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          {config.relatedLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex min-h-11 items-center rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </section>
  );
}
