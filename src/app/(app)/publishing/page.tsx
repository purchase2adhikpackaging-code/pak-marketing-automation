import Link from "next/link";

const destinations = [
  {
    href: "/publishing/production",
    title: "Production",
    description:
      "Launch governed subject, programme or pilot textbook runs, monitor the durable queue, and pause, resume or cancel production.",
  },
  {
    href: "/publishing/library",
    title: "Book Library",
    description:
      "Open released, QA-passed textbooks and their publication records. Draft or blocked jobs are never presented as academic-ready books.",
  },
] as const;

export default function PublishingPage() {
  return (
    <main className="space-y-8">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-400">PAK Academic Publishing</p>
        <h1 className="text-3xl font-semibold text-white">Publishing</h1>
        <p className="max-w-3xl text-sm leading-6 text-slate-300">
          Run the governed textbook factory and retrieve only publications that have passed the configured academic and technical QA gates.
        </p>
      </header>

      <section className="grid gap-4 md:grid-cols-2" aria-label="Publishing destinations">
        {destinations.map((destination) => (
          <Link
            key={destination.href}
            href={destination.href}
            className="rounded-xl border border-slate-800 bg-slate-900/70 p-6 transition hover:border-slate-600 hover:bg-slate-900"
          >
            <h2 className="text-lg font-semibold text-white">{destination.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">{destination.description}</p>
            <span className="mt-5 inline-block text-sm font-medium text-slate-100">Open {destination.title} →</span>
          </Link>
        ))}
      </section>
    </main>
  );
}
