export function ModulePage({ title, description }: { title: string; description: string }) {
  return (
    <section className="max-w-5xl">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">PAK Workspace</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-white">{title}</h2>
      <p className="mt-4 max-w-3xl text-base leading-7 text-slate-400">{description}</p>
    </section>
  );
}
