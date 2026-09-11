import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const FINAL_ASSEMBLY_MAX_COMPONENTS = 200;
const FINAL_ASSEMBLY_SIGNED_URL_TTL_SECONDS = 900;
const GENERATED_MEDIA_BUCKET = "generated-media";
const WORKER_HEADER = "x-pak-render-worker-token";
const WORKER_ID_RE = /^[A-Za-z0-9._:-]{1,128}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_RE = /^sha256:[0-9a-f]{64}$/;

type WorkerBody =
  | { operation: "claim"; workerId: string }
  | {
      operation: "complete";
      workerId: string;
      organizationId: string;
      jobId: string;
      assemblyId: string;
      output: {
        path: string;
        checksum: string;
        durationSeconds: number;
        width: number;
        height: number;
        sizeBytes: number;
      };
    }
  | {
      operation: "fail";
      workerId: string;
      organizationId: string;
      jobId: string;
      assemblyId: string;
      errorCode: string;
      errorMessage: string;
      retryable: boolean;
    };

type ClaimRow = {
  organization_id: string;
  job_id: string;
  assembly_id: string;
  plan_version_id: string;
  render_profile: "PAK_MASTER_1080P_V1";
  aspect_ratio: "16:9" | "9:16";
  readiness_hash: string;
  source_integrity_hash: string;
  expected_duration_seconds: number | string;
  component_count: number;
};

type ComponentRow = {
  ordinal: number;
  shot_id: string;
  media_asset_id: string;
  media_checksum: string;
  duration_seconds: number | string;
  storage_bucket: string;
  storage_path: string;
};

type MediaRow = {
  id: string;
  organization_id: string;
  asset_type: string;
  status: string;
  storage_bucket: string;
  storage_path: string;
  checksum: string | null;
  duration_seconds: number | string | null;
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function safeEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    diff |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return diff === 0;
}

function validWorkerId(value: unknown): value is string {
  return typeof value === "string" && WORKER_ID_RE.test(value);
}

function validUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

function parseBody(value: unknown): WorkerBody | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (!validWorkerId(body.workerId)) return null;

  if (body.operation === "claim") {
    return { operation: "claim", workerId: body.workerId };
  }

  if (!validUuid(body.organizationId) || !validUuid(body.jobId) || !validUuid(body.assemblyId)) return null;

  if (body.operation === "complete") {
    if (!body.output || typeof body.output !== "object" || Array.isArray(body.output)) return null;
    const output = body.output as Record<string, unknown>;
    if (typeof output.path !== "string" || !output.path
        || typeof output.checksum !== "string" || !SHA256_RE.test(output.checksum)
        || typeof output.durationSeconds !== "number" || !Number.isFinite(output.durationSeconds) || output.durationSeconds <= 0
        || typeof output.width !== "number" || !Number.isInteger(output.width) || output.width <= 0
        || typeof output.height !== "number" || !Number.isInteger(output.height) || output.height <= 0
        || typeof output.sizeBytes !== "number" || !Number.isSafeInteger(output.sizeBytes) || output.sizeBytes <= 0) {
      return null;
    }
    return {
      operation: "complete",
      workerId: body.workerId,
      organizationId: body.organizationId,
      jobId: body.jobId,
      assemblyId: body.assemblyId,
      output: {
        path: output.path,
        checksum: output.checksum,
        durationSeconds: output.durationSeconds,
        width: output.width,
        height: output.height,
        sizeBytes: output.sizeBytes,
      },
    };
  }

  if (body.operation === "fail") {
    if (typeof body.errorCode !== "string" || !body.errorCode || body.errorCode.length > 96
        || typeof body.errorMessage !== "string" || body.errorMessage.length > 1000
        || typeof body.retryable !== "boolean") {
      return null;
    }
    return {
      operation: "fail",
      workerId: body.workerId,
      organizationId: body.organizationId,
      jobId: body.jobId,
      assemblyId: body.assemblyId,
      errorCode: body.errorCode,
      errorMessage: body.errorMessage,
      retryable: body.retryable,
    };
  }

  return null;
}

function deterministicOutputPath(claim: ClaimRow): string {
  const hashPrefix = claim.readiness_hash.replace(/^sha256:/, "").slice(0, 16);
  return `${claim.organization_id}/final-video/${claim.plan_version_id}-${hashPrefix}.mp4`;
}

function numeric(value: number | string | null): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : Number.NaN;
}

async function outputObjectExists(
  admin: ReturnType<typeof createClient>,
  path: string,
): Promise<boolean> {
  const slash = path.lastIndexOf("/");
  if (slash <= 0 || slash === path.length - 1) return false;
  const folder = path.slice(0, slash);
  const filename = path.slice(slash + 1);
  const { data, error } = await admin.storage
    .from(GENERATED_MEDIA_BUCKET)
    .list(folder, { limit: 10, search: filename });
  if (error) return false;
  return (data ?? []).some((entry) => entry.name === filename);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204 });
  if (req.method !== "POST") return json(405, { error: "METHOD_NOT_ALLOWED" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) return json(500, { error: "SERVER_MISCONFIGURED" });

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const presentedToken = req.headers.get(WORKER_HEADER) ?? "";
  const { data: workerSecret, error: workerSecretError } = await admin.rpc("read_video_assembly_worker_secret");
  if (workerSecretError || typeof workerSecret !== "string" || !workerSecret) {
    return json(500, { error: "WORKER_AUTH_UNAVAILABLE" });
  }
  if (!presentedToken || !safeEqual(presentedToken, workerSecret)) {
    return json(401, { error: "UNAUTHORIZED" });
  }

  let parsedJson: unknown;
  try {
    parsedJson = await req.json();
  } catch {
    return json(400, { error: "INVALID_REQUEST" });
  }
  const body = parseBody(parsedJson);
  if (!body) return json(400, { error: "INVALID_REQUEST" });

  if (body.operation === "claim") {
    const { data: claimData, error: claimError } = await admin.rpc("claim_video_assembly_work", {
      _worker_id: body.workerId,
      _lease_seconds: 900,
    });
    if (claimError) return json(500, { error: "CLAIM_FAILED" });

    const claim = Array.isArray(claimData) ? (claimData[0] as ClaimRow | undefined) : undefined;
    if (!claim) return json(200, { manifest: null });
    if (claim.component_count < 1 || claim.component_count > FINAL_ASSEMBLY_MAX_COMPONENTS) {
      await admin.rpc("fail_video_assembly_work", {
        _worker_id: body.workerId,
        _organization_id: claim.organization_id,
        _job_id: claim.job_id,
        _assembly_id: claim.assembly_id,
        _error_code: "COMPONENT_COUNT_INVALID",
        _error_message: "Assembly component count is outside the allowed render boundary.",
        _retryable: false,
      });
      return json(409, { error: "COMPONENT_COUNT_INVALID" });
    }

    const { data: componentData, error: componentError } = await admin
      .from("video_assembly_components")
      .select("ordinal,shot_id,media_asset_id,media_checksum,duration_seconds,storage_bucket,storage_path")
      .eq("organization_id", claim.organization_id)
      .eq("assembly_id", claim.assembly_id)
      .order("ordinal", { ascending: true });
    if (componentError || !Array.isArray(componentData) || componentData.length !== claim.component_count) {
      await admin.rpc("fail_video_assembly_work", {
        _worker_id: body.workerId,
        _organization_id: claim.organization_id,
        _job_id: claim.job_id,
        _assembly_id: claim.assembly_id,
        _error_code: "COMPONENT_LINEAGE_INVALID",
        _error_message: "Assembly component snapshot is unavailable or incomplete.",
        _retryable: false,
      });
      return json(409, { error: "COMPONENT_LINEAGE_INVALID" });
    }

    const components = componentData as ComponentRow[];
    const mediaIds = components.map((component) => component.media_asset_id);
    const { data: mediaData, error: mediaError } = await admin
      .from("media_assets")
      .select("id,organization_id,asset_type,status,storage_bucket,storage_path,checksum,duration_seconds")
      .eq("organization_id", claim.organization_id)
      .in("id", mediaIds);
    if (mediaError || !Array.isArray(mediaData)) {
      await admin.rpc("fail_video_assembly_work", {
        _worker_id: body.workerId,
        _organization_id: claim.organization_id,
        _job_id: claim.job_id,
        _assembly_id: claim.assembly_id,
        _error_code: "MEDIA_LINEAGE_UNAVAILABLE",
        _error_message: "Assembly media lineage could not be verified.",
        _retryable: true,
      });
      return json(503, { error: "MEDIA_LINEAGE_UNAVAILABLE" });
    }

    const mediaById = new Map((mediaData as MediaRow[]).map((media) => [media.id, media]));
    const signedComponents: Array<Record<string, unknown>> = [];

    for (const component of components) {
      const media = mediaById.get(component.media_asset_id);
      const sameDuration = media?.duration_seconds !== null
        && Math.abs(numeric(media?.duration_seconds ?? null) - numeric(component.duration_seconds)) < 0.01;
      if (!media
          || media.organization_id !== claim.organization_id
          || media.asset_type !== "VIDEO"
          || media.status !== "ACTIVE"
          || media.storage_bucket !== component.storage_bucket
          || media.storage_path !== component.storage_path
          || media.checksum !== component.media_checksum
          || !sameDuration) {
        await admin.rpc("fail_video_assembly_work", {
          _worker_id: body.workerId,
          _organization_id: claim.organization_id,
          _job_id: claim.job_id,
          _assembly_id: claim.assembly_id,
          _error_code: "MEDIA_LINEAGE_INVALID",
          _error_message: "Assembly media no longer matches its immutable component snapshot.",
          _retryable: false,
        });
        return json(409, { error: "MEDIA_LINEAGE_INVALID" });
      }

      const { data: signed, error: signedError } = await admin.storage
        .from(component.storage_bucket)
        .createSignedUrl(component.storage_path, FINAL_ASSEMBLY_SIGNED_URL_TTL_SECONDS);
      if (signedError || !signed?.signedUrl) {
        await admin.rpc("fail_video_assembly_work", {
          _worker_id: body.workerId,
          _organization_id: claim.organization_id,
          _job_id: claim.job_id,
          _assembly_id: claim.assembly_id,
          _error_code: "INPUT_SIGNING_FAILED",
          _error_message: "A private assembly input URL could not be issued.",
          _retryable: true,
        });
        return json(503, { error: "INPUT_SIGNING_FAILED" });
      }

      signedComponents.push({
        ordinal: component.ordinal,
        shotId: component.shot_id,
        mediaAssetId: component.media_asset_id,
        signedDownloadUrl: signed.signedUrl,
        checksum: component.media_checksum,
        durationSeconds: numeric(component.duration_seconds),
      });
    }

    const outputPath = deterministicOutputPath(claim);
    const { data: uploadData, error: uploadError } = await admin.storage
      .from(GENERATED_MEDIA_BUCKET)
      .createSignedUploadUrl(outputPath, { upsert: true });
    if (uploadError || !uploadData?.signedUrl) {
      await admin.rpc("fail_video_assembly_work", {
        _worker_id: body.workerId,
        _organization_id: claim.organization_id,
        _job_id: claim.job_id,
        _assembly_id: claim.assembly_id,
        _error_code: "OUTPUT_SIGNING_FAILED",
        _error_message: "The private final-output upload URL could not be issued.",
        _retryable: true,
      });
      return json(503, { error: "OUTPUT_SIGNING_FAILED" });
    }

    const expiresAt = new Date(Date.now() + FINAL_ASSEMBLY_SIGNED_URL_TTL_SECONDS * 1000).toISOString();
    return json(200, {
      manifest: {
        schemaVersion: "final-assembly-render-v1",
        assemblyId: claim.assembly_id,
        jobId: claim.job_id,
        organizationId: claim.organization_id,
        renderProfile: claim.render_profile,
        aspectRatio: claim.aspect_ratio,
        expiresAt,
        output: {
          signedUploadUrl: uploadData.signedUrl,
          bucket: GENERATED_MEDIA_BUCKET,
          path: outputPath,
        },
        components: signedComponents,
      },
    });
  }

  if (body.operation === "complete") {
    if (!body.output.path.startsWith(`${body.organizationId}/final-video/`)) {
      return json(400, { error: "INVALID_OUTPUT_PATH" });
    }
    const exists = await outputObjectExists(admin, body.output.path);
    if (!exists) return json(409, { error: "OUTPUT_NOT_FOUND" });

    const { data: mediaAssetId, error: completionError } = await admin.rpc("complete_video_assembly_work", {
      _worker_id: body.workerId,
      _organization_id: body.organizationId,
      _job_id: body.jobId,
      _assembly_id: body.assemblyId,
      _storage_path: body.output.path,
      _checksum: body.output.checksum,
      _duration_seconds: body.output.durationSeconds,
      _width: body.output.width,
      _height: body.output.height,
      _size_bytes: body.output.sizeBytes,
    });
    if (completionError || typeof mediaAssetId !== "string") {
      return json(409, { error: "FINALIZE_FAILED" });
    }
    return json(200, { state: "COMPLETED", mediaAssetId });
  }

  const { data: nextState, error: failureError } = await admin.rpc("fail_video_assembly_work", {
    _worker_id: body.workerId,
    _organization_id: body.organizationId,
    _job_id: body.jobId,
    _assembly_id: body.assemblyId,
    _error_code: body.errorCode,
    _error_message: body.errorMessage,
    _retryable: body.retryable,
  });
  if (failureError || typeof nextState !== "string") return json(409, { error: "FAILURE_REPORT_REJECTED" });
  return json(200, { state: nextState });
});
