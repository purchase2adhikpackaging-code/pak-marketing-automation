import "server-only";

import { AppError } from "@/lib/errors/app-error";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  normalizeMediaListQuery,
  toSafeMediaAsset,
  type MediaAssetRow,
  type MediaListPage,
  type MediaListQuery,
  type SafeMediaAsset,
} from "./read-model";

const MEDIA_SELECT = "id,organization_id,asset_type,storage_bucket,storage_path,source,mime_type,width,height,duration_seconds,checksum,generating_job_id,status,display_name,size_bytes,metadata,created_by,archived_at,archived_by,created_at,updated_at";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function internal(message: string): AppError {
  return new AppError("INTERNAL_ERROR", message);
}

function escapedLikeSearch(value: string): string {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

function validCursor(createdAt: string, id: string): boolean {
  return Number.isFinite(Date.parse(createdAt)) && UUID_RE.test(id);
}

export class SupabaseMediaRepository {
  async list(input: MediaListQuery): Promise<MediaListPage> {
    const normalized = normalizeMediaListQuery(input);
    const supabase = await createServerSupabaseClient();
    const pageLimit = Math.min(normalized.limit, 50);

    let query = supabase
      .from("media_assets")
      .select(MEDIA_SELECT)
      .eq("organization_id", normalized.organizationId)
      .eq("status", normalized.status)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(pageLimit + 1);

    if (normalized.assetType) query = query.eq("asset_type", normalized.assetType);
    if (normalized.source) query = query.eq("source", normalized.source);
    if (normalized.search) query = query.ilike("display_name", `%${escapedLikeSearch(normalized.search)}%`);
    if (normalized.cursor && validCursor(normalized.cursor.createdAt, normalized.cursor.id)) {
      const timestamp = new Date(normalized.cursor.createdAt).toISOString();
      query = query.or(
        `created_at.lt.${timestamp},and(created_at.eq.${timestamp},id.lt.${normalized.cursor.id})`,
      );
    }

    const { data, error } = await query;
    if (error) throw internal("Unable to load media assets.");

    const rows = (data ?? []) as MediaAssetRow[];
    const hasMore = rows.length > pageLimit;
    const visible = rows.slice(0, pageLimit);
    const last = visible.at(-1);

    return {
      items: visible.map(toSafeMediaAsset),
      ...(hasMore && last
        ? { nextCursor: { createdAt: last.created_at, id: last.id } }
        : {}),
    };
  }

  async getById(organizationId: string, mediaAssetId: string): Promise<SafeMediaAsset | null> {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("media_assets")
      .select(MEDIA_SELECT)
      .eq("organization_id", organizationId)
      .eq("id", mediaAssetId)
      .maybeSingle();
    if (error) throw internal("Unable to load the media asset.");
    return data ? toSafeMediaAsset(data as MediaAssetRow) : null;
  }

  async archive(organizationId: string, mediaAssetId: string, actorId: string): Promise<void> {
    const supabase = await createServerSupabaseClient();
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("media_assets")
      .update({
        status: "ARCHIVED",
        archived_at: now,
        archived_by: actorId,
        updated_at: now,
      })
      .eq("organization_id", organizationId)
      .eq("id", mediaAssetId)
      .eq("status", "ACTIVE");
    if (error) throw internal("Unable to archive the media asset.");
  }
}
