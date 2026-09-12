import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MANAGER_ROLES = new Set(["OWNER", "ADMIN", "EDITOR"]);
const PREVIEW_TTL_SECONDS = 300;
const UPLOAD_SESSION_TTL_MS = 15 * 60 * 1000;
const MEDIA_BUCKET = "media-library";

const MEDIA_UPLOAD_LIMITS = {
  IMAGE: 25 * 1024 * 1024,
  VIDEO: 512 * 1024 * 1024,
  AUDIO: 100 * 1024 * 1024,
  DOCUMENT: 50 * 1024 * 1024,
} as const;

type MediaAssetType = keyof typeof MEDIA_UPLOAD_LIMITS;

type IssueUploadBody = {
  operation: "issue-upload";
  organizationId: string;
  assetType: MediaAssetType;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  displayName?: string;
};

type FinalizeUploadBody = {
  operation: "finalize-upload";
  organizationId: string;
  sessionId: string;
};

type PreviewBody = {
  operation: "preview";
  organizationId: string;
  mediaAssetId: string;
};

type RequestBody = IssueUploadBody | FinalizeUploadBody | PreviewBody;

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function normalizeFilename(filename: string): string | null {
  if (!filename || filename.length > 180 || filename.includes("/") || filename.includes("\\")) return null;
  const trimmed = filename.trim();
  if (!trimmed || trimmed === "." || trimmed === "..") return null;

  const lastDot = trimmed.lastIndexOf(".");
  const hasExtension = lastDot > 0 && lastDot < trimmed.length - 1;
  const stem = hasExtension ? trimmed.slice(0, lastDot) : trimmed;
  const extension = hasExtension ? trimmed.slice(lastDot + 1).toLowerCase() : "";
  const safeStem = stem
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9._-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");

  if (!safeStem || (extension && !/^[A-Za-z0-9]{1,16}$/.test(extension))) return null;
  return extension ? `${safeStem}.${extension}` : safeStem;
}

const DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
]);

function isAllowedMime(assetType: MediaAssetType, mimeType: string): boolean {
  const mime = mimeType.trim().toLowerCase();
  if (!mime || mime.includes(";") || mime === "image/svg+xml") return false;
  if (assetType === "IMAGE") return mime.startsWith("image/");
  if (assetType === "VIDEO") return mime.startsWith("video/");
  if (assetType === "AUDIO") return mime.startsWith("audio/");
  return DOCUMENT_MIME_TYPES.has(mime);
}

function parseBody(value: unknown): RequestBody | null {
  const input = asRecord(value);
  if (!input || typeof input.operation !== "string" || typeof input.organizationId !== "string" || !UUID_RE.test(input.organizationId)) {
    return null;
  }

  if (input.operation === "issue-upload") {
    if (
      (input.assetType !== "IMAGE" && input.assetType !== "VIDEO" && input.assetType !== "AUDIO" && input.assetType !== "DOCUMENT")
      || typeof input.filename !== "string"
      || typeof input.mimeType !== "string"
      || typeof input.sizeBytes !== "number"
      || !Number.isSafeInteger(input.sizeBytes)
      || input.sizeBytes <= 0
      || input.sizeBytes > MEDIA_UPLOAD_LIMITS[input.assetType]
      || !isAllowedMime(input.assetType, input.mimeType)
      || normalizeFilename(input.filename) === null
      || (input.displayName !== undefined && (typeof input.displayName !== "string" || input.displayName.trim().length > 200))
    ) return null;

    return {
      operation: "issue-upload",
      organizationId: input.organizationId,
      assetType: input.assetType,
      filename: input.filename,
      mimeType: input.mimeType.trim().toLowerCase(),
      sizeBytes: input.sizeBytes,
      ...(typeof input.displayName === "string" && input.displayName.trim()
        ? { displayName: input.displayName.trim() }
        : {}),
    };
  }

  if (input.operation === "finalize-upload") {
    if (typeof input.sessionId !== "string" || !UUID_RE.test(input.sessionId)) return null;
    return { operation: "finalize-upload", organizationId: input.organizationId, sessionId: input.sessionId };
  }

  if (input.operation === "preview") {
    if (typeof input.mediaAssetId !== "string" || !UUID_RE.test(input.mediaAssetId)) return null;
    return { operation: "preview", organizationId: input.organizationId, mediaAssetId: input.mediaAssetId };
  }

  return null;
}

function splitStoragePath(path: string): { folder: string; filename: string } | null {
  const lastSlash = path.lastIndexOf("/");
  if (lastSlash < 1 || lastSlash === path.length - 1) return null;
  return { folder: path.slice(0, lastSlash), filename: path.slice(lastSlash + 1) };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (req.method !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json(500, { error: "SERVER_MISCONFIGURED" });

  const authorization = req.headers.get("authorization") ?? "";
  const token = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return json(401, { error: "UNAUTHORIZED" });

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const user = userData.user;
  if (userError || !user) return json(401, { error: "UNAUTHORIZED" });

  let parsedJson: unknown;
  try {
    parsedJson = await req.json();
  } catch {
    return json(400, { error: "INVALID_REQUEST" });
  }
  const body = parseBody(parsedJson);
  if (!body) return json(400, { error: "INVALID_REQUEST" });

  const { data: membership, error: membershipError } = await admin
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", body.organizationId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (membershipError) return json(500, { error: "AUTHORIZATION_UNAVAILABLE" });
  if (!membership) return json(403, { error: "FORBIDDEN" });

  const role = String(membership.role);

  if (body.operation === "preview") {
    const { data: media, error: mediaError } = await admin
      .from("media_assets")
      .select("id,organization_id,storage_bucket,storage_path,status")
      .eq("id", body.mediaAssetId)
      .eq("organization_id", body.organizationId)
      .maybeSingle();
    if (mediaError) return json(500, { error: "MEDIA_UNAVAILABLE" });
    if (!media || media.status === "FAILED") return json(404, { error: "MEDIA_NOT_FOUND" });

    const { data: signed, error: signError } = await admin.storage
      .from(String(media.storage_bucket))
      .createSignedUrl(String(media.storage_path), PREVIEW_TTL_SECONDS);
    if (signError || !signed?.signedUrl) return json(500, { error: "PREVIEW_SIGN_FAILED" });

    return json(200, {
      mediaAssetId: media.id,
      signedUrl: signed.signedUrl,
      expiresInSeconds: PREVIEW_TTL_SECONDS,
    });
  }

  if (!MANAGER_ROLES.has(role)) return json(403, { error: "FORBIDDEN" });

  if (body.operation === "issue-upload") {
    const normalizedFilename = normalizeFilename(body.filename);
    if (!normalizedFilename) return json(400, { error: "INVALID_FILENAME" });

    const sessionId = crypto.randomUUID();
    const expectedStoragePath = `${body.organizationId}/uploads/${sessionId}/${normalizedFilename}`;
    const expiresAt = new Date(Date.now() + UPLOAD_SESSION_TTL_MS).toISOString();

    const { error: insertError } = await admin
      .from("media_upload_sessions")
      .insert({
        id: sessionId,
        organization_id: body.organizationId,
        created_by: user.id,
        asset_type: body.assetType,
        original_filename: body.filename,
        normalized_filename: normalizedFilename,
        display_name: body.displayName ?? null,
        expected_storage_path: expectedStoragePath,
        expected_mime_type: body.mimeType,
        expected_size_bytes: body.sizeBytes,
        state: "ISSUED",
        expires_at: expiresAt,
      });
    if (insertError) return json(500, { error: "UPLOAD_SESSION_CREATE_FAILED" });

    const { data: uploadData, error: signError } = await admin.storage
      .from(MEDIA_BUCKET)
      .createSignedUploadUrl(expectedStoragePath);
    if (signError || !uploadData?.signedUrl || !uploadData.token) {
      await admin
        .from("media_upload_sessions")
        .update({ state: "FAILED", updated_at: new Date().toISOString() })
        .eq("id", sessionId)
        .eq("organization_id", body.organizationId);
      return json(500, { error: "UPLOAD_SIGN_FAILED" });
    }

    return json(200, {
      sessionId,
      signedUploadUrl: uploadData.signedUrl,
      uploadToken: uploadData.token,
      storageBucket: MEDIA_BUCKET,
      expiresAt,
    });
  }

  const { data: session, error: sessionError } = await admin
    .from("media_upload_sessions")
    .select("id,organization_id,state,media_asset_id,expected_storage_path,expected_mime_type,expected_size_bytes,expires_at")
    .eq("id", body.sessionId)
    .eq("organization_id", body.organizationId)
    .maybeSingle();
  if (sessionError) return json(500, { error: "UPLOAD_SESSION_UNAVAILABLE" });
  if (!session) return json(404, { error: "UPLOAD_SESSION_NOT_FOUND" });
  if (session.state === "FINALIZED" && typeof session.media_asset_id === "string") {
    return json(200, { sessionId: session.id, mediaAssetId: session.media_asset_id, reused: true });
  }
  if (session.state !== "ISSUED") return json(409, { error: "UPLOAD_SESSION_NOT_FINALIZABLE" });
  if (Date.parse(String(session.expires_at)) <= Date.now()) {
    await admin
      .from("media_upload_sessions")
      .update({ state: "EXPIRED", updated_at: new Date().toISOString() })
      .eq("id", session.id)
      .eq("organization_id", body.organizationId)
      .eq("state", "ISSUED");
    return json(409, { error: "UPLOAD_SESSION_EXPIRED" });
  }

  const storagePath = String(session.expected_storage_path);
  const identity = splitStoragePath(storagePath);
  if (!identity) return json(409, { error: "UPLOAD_STORAGE_INVALID" });

  const { data: objects, error: listError } = await admin.storage
    .from(MEDIA_BUCKET)
    .list(identity.folder, { limit: 100, search: identity.filename });
  if (listError) return json(503, { error: "UPLOAD_OBJECT_UNAVAILABLE" });
  const uploadedObject = objects?.find((entry) => entry.name === identity.filename);
  const metadata = asRecord(uploadedObject?.metadata);
  if (!uploadedObject || !metadata) return json(409, { error: "UPLOAD_OBJECT_NOT_FOUND" });

  const actualMimeType = typeof metadata.mimetype === "string" ? metadata.mimetype.toLowerCase() : "";
  const actualSizeBytes = Number(metadata.size);
  if (
    !actualMimeType
    || !Number.isSafeInteger(actualSizeBytes)
    || actualSizeBytes <= 0
    || actualMimeType !== String(session.expected_mime_type).toLowerCase()
    || actualSizeBytes !== Number(session.expected_size_bytes)
  ) {
    await admin
      .from("media_upload_sessions")
      .update({ state: "FAILED", updated_at: new Date().toISOString() })
      .eq("id", session.id)
      .eq("organization_id", body.organizationId)
      .eq("state", "ISSUED");
    return json(409, { error: "UPLOAD_METADATA_MISMATCH" });
  }

  const { data: mediaAssetId, error: finalizeError } = await admin.rpc("finalize_media_upload_session", {
    _organization_id: body.organizationId,
    _session_id: body.sessionId,
    _actor_user_id: user.id,
    _actual_mime_type: actualMimeType,
    _actual_size_bytes: actualSizeBytes,
  });
  if (finalizeError || typeof mediaAssetId !== "string") {
    return json(409, { error: "UPLOAD_FINALIZE_FAILED" });
  }

  return json(200, {
    sessionId: body.sessionId,
    mediaAssetId,
    reused: false,
  });
});
