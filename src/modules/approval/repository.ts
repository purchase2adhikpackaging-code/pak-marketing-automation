import "server-only";

import { AppError } from "@/lib/errors/app-error";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  normalizeApprovalListQuery,
  toApprovalEvent,
  toApprovalQueueItem,
  type ApprovalDetail,
  type ApprovalEvent,
  type ApprovalEventRow,
  type ApprovalKnowledgeSource,
  type ApprovalListPage,
  type ApprovalListQuery,
  type ApprovalRequestRow,
} from "./read-model";

function internal(message: string): AppError {
  return new AppError("INTERNAL_ERROR", message);
}

const REQUEST_COLUMNS = "id,organization_id,target_type,target_id,target_revision,target_checksum,target_fingerprint,target_snapshot,publication_intent,status,requested_by,requested_at,decided_by,decided_at,superseded_at,superseded_reason,created_at,updated_at";

export interface ApprovalRepository {
  list(input: ApprovalListQuery): Promise<ApprovalListPage>;
  getDetail(organizationId: string, requestId: string): Promise<ApprovalDetail | null>;
  getEvents(organizationId: string, requestId: string): Promise<readonly ApprovalEvent[]>;
  getContentProvenance(organizationId: string, contentItemId: string): Promise<readonly ApprovalKnowledgeSource[]>;
  countScenePlanReviewRequired(organizationId: string): Promise<number>;
}

export class SupabaseApprovalRepository implements ApprovalRepository {
  async list(input: ApprovalListQuery): Promise<ApprovalListPage> {
    const normalized = normalizeApprovalListQuery(input);
    const supabase = await createServerSupabaseClient();
    let query = supabase
      .from("approval_requests")
      .select(REQUEST_COLUMNS)
      .eq("organization_id", normalized.organizationId)
      .eq("status", normalized.status)
      .order("requested_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(Math.min(normalized.limit, 50));

    if (normalized.targetType) query = query.eq("target_type", normalized.targetType);
    const { data, error } = await query;
    if (error) throw internal("Unable to load the Approval Center queue.");
    return { items: ((data ?? []) as ApprovalRequestRow[]).map(toApprovalQueueItem) };
  }

  async getEvents(organizationId: string, requestId: string): Promise<readonly ApprovalEvent[]> {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("approval_events")
      .select("id,organization_id,approval_request_id,actor_kind,actor_user_id,event_type,comment,target_revision,target_checksum,created_at")
      .eq("organization_id", organizationId)
      .eq("approval_request_id", requestId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    if (error) throw internal("Unable to load approval history.");
    return ((data ?? []) as ApprovalEventRow[]).map(toApprovalEvent);
  }

  async getContentProvenance(organizationId: string, contentItemId: string): Promise<readonly ApprovalKnowledgeSource[]> {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("content_item_knowledge_sources")
      .select("id,knowledge_record_id,knowledge_revision,title_snapshot,content_snapshot,source_type_snapshot,source_label_snapshot,source_reference_snapshot,created_at")
      .eq("organization_id", organizationId)
      .eq("content_item_id", contentItemId)
      .order("created_at", { ascending: true });
    if (error) throw internal("Unable to load approval knowledge provenance.");
    return (data ?? []).map((row) => ({
      id: row.id,
      ...(row.knowledge_record_id ? { knowledgeRecordId: row.knowledge_record_id } : {}),
      knowledgeRevision: row.knowledge_revision,
      title: row.title_snapshot,
      content: row.content_snapshot,
      sourceType: row.source_type_snapshot,
      ...(row.source_label_snapshot ? { sourceLabel: row.source_label_snapshot } : {}),
      ...(row.source_reference_snapshot ? { sourceReference: row.source_reference_snapshot } : {}),
      createdAt: row.created_at,
    }));
  }

  async getDetail(organizationId: string, requestId: string): Promise<ApprovalDetail | null> {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("approval_requests")
      .select(REQUEST_COLUMNS)
      .eq("organization_id", organizationId)
      .eq("id", requestId)
      .maybeSingle();
    if (error) throw internal("Unable to load the approval request.");
    if (!data) return null;
    const request = toApprovalQueueItem(data as ApprovalRequestRow);
    const events = [...await this.getEvents(organizationId, requestId)];
    const knowledgeSources = request.target.type === "CONTENT_ARTIFACT" && request.target.contentItemId
      ? [...await this.getContentProvenance(organizationId, request.target.contentItemId)]
      : [];
    return { ...request, events, knowledgeSources };
  }

  async countScenePlanReviewRequired(organizationId: string): Promise<number> {
    const supabase = await createServerSupabaseClient();
    const { count, error } = await supabase
      .from("scene_plan_versions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("status", "REVIEW_REQUIRED");
    if (error) throw internal("Unable to load Scene Planning review workload.");
    return count ?? 0;
  }
}
