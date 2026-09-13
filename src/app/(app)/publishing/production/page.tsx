import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { loadAcademicRegistryFromDisk } from "@/modules/publishing-production/server-curriculum";
import { createAuthenticatedPublishingRepository } from "@/modules/publishing-production/server-repository";
import { PublishingProductionClient } from "./production-client";

export const dynamic = "force-dynamic";

export default async function PublishingProductionPage() {
  const supabase = await createServerSupabaseClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) redirect("/login");

  const { data: memberships, error } = await supabase
    .from("organization_memberships")
    .select("organization_id,role")
    .eq("user_id", authData.user.id)
    .in("role", ["OWNER", "ADMIN", "EDITOR"])
    .limit(1);
  if (error || !memberships?.[0]) {
    return <div className="rounded-xl border border-slate-200 bg-white p-6">You do not have publishing production access.</div>;
  }

  const organizationId = String(memberships[0].organization_id);
  const [registry, runs] = await Promise.all([
    loadAcademicRegistryFromDisk(),
    (await createAuthenticatedPublishingRepository()).listRuns(organizationId),
  ]);
  const programmes = registry
    .filter((programme) => programme.curriculumStatus.toLowerCase().includes("architecture complete"))
    .map((programme) => ({ code: programme.code, title: programme.programmeTitle }));

  return (
    <PublishingProductionClient
      organizationId={organizationId}
      programmes={programmes}
      initialRuns={runs}
    />
  );
}
