import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAuthenticatedPublishingRepository } from "@/modules/publishing-production/server-repository";

export const dynamic = "force-dynamic";

export default async function PublishingLibraryPage() {
  const supabase = await createServerSupabaseClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect("/login");

  const { data: memberships, error } = await supabase
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", authData.user.id)
    .limit(1);
  if (error || !memberships?.[0]) {
    return <div className="rounded-xl border border-slate-200 bg-white p-6">No organization access.</div>;
  }

  const organizationId = String(memberships[0].organization_id);
  const publications = await (await createAuthenticatedPublishingRepository()).listPublications(organizationId);
  const rows = await Promise.all(publications.map(async (publication) => {
    const { data } = await supabase.storage.from("publishing-books").createSignedUrl(publication.pdfArtifactPath, 3600);
    return { publication, url: data?.signedUrl ?? null };
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">PAK Book Library</h1>
          <p className="mt-2 text-sm text-slate-600">Only released books that passed the publishing QA gate appear here.</p>
        </div>
        <Link href="/publishing/production" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800">Production Runner</Link>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">No released textbooks yet.</p>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-500"><tr><th className="py-2">Programme</th><th>Subject</th><th>Edition</th><th>Revision</th><th>Released</th><th>PDF</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(({ publication, url }) => (
                <tr key={publication.id}>
                  <td className="py-3 font-medium text-slate-900">{publication.programmeCode}</td>
                  <td>{publication.subjectCode}</td>
                  <td>{publication.edition}</td>
                  <td>{publication.revision}</td>
                  <td>{new Date(publication.releasedAt).toLocaleString()}</td>
                  <td>{url ? <a href={url} target="_blank" rel="noreferrer" className="underline">Open PDF</a> : "Unavailable"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
