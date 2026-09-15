export const dynamic = "force-dynamic";

import Link from "next/link";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { AppRole } from "@/modules/auth/roles";
import { loadApprovalDetailAction } from "../actions";
import { ApprovalReviewClient } from "./approval-review-client";

const REVIEW_ROLES: readonly AppRole[] = ["OWNER", "ADMIN", "EDITOR", "REVIEWER"];

function messagePanel(message: string) {
  return (
    <section className="max-w-4xl">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">PAK Workspace</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Approval review</h1>
      <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/60 p-6 text-sm leading-6 text-slate-300">
        <p>{message}</p>
        <Link href="/approval-center" className="mt-4 inline-block font-semibold text-sky-300 underline underline-offset-4">
          Back to Approval Center
        </Link>
      </div>
    </section>
  );
}

export default async function ApprovalReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ requestId: string }>;
  searchParams: Promise<{ organization?: string | string[] }>;
}) {
  const route = await params;
  const query = await searchParams;
  const organizationId = typeof query.organization === "string" ? query.organization : null;

  if (!organizationId || !route.requestId) {
    return messagePanel("The approval request context is incomplete.");
  }

  const supabase = await createServerSupabaseClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return messagePanel("You must be signed in to review approval requests.");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", authData.user.id)
    .maybeSingle();

  const role = membership?.role as AppRole | undefined;
  if (membershipError || !role || !REVIEW_ROLES.includes(role)) {
    return messagePanel("You do not have access to this organization's approval request.");
  }

  const result = await loadApprovalDetailAction({
    organizationId,
    requestId: route.requestId,
  });
  if (!result.ok) {
    return messagePanel(result.error);
  }
  if (!result.detail) {
    return messagePanel("The approval request was not found or is no longer available.");
  }

  return (
    <section className="max-w-7xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">PAK Workspace</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Approval review</h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-slate-400">
            Review the immutable target snapshot and audit history before recording an authoritative decision.
          </p>
        </div>
        <Link href="/approval-center" className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-900">
          Back to queue
        </Link>
      </div>

      <ApprovalReviewClient organizationId={organizationId} role={role} initialDetail={result.detail} />
    </section>
  );
}
