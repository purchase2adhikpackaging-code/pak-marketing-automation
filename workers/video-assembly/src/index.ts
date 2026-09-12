import { createHash } from "node:crypto";
import { createWriteStream, promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { spawn } from "node:child_process";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

import { validateVideoProbe } from "./ffprobe.js";
import { buildFfmpegArgs, buildRenderProfile, type RenderAspectRatio } from "./render.js";

const MAX_COMPONENTS = 200;
const MAX_INPUT_BYTES = 512 * 1024 * 1024;
const MAX_RECONCILE_OUTPUT_BYTES = 1024 * 1024 * 1024;
const IDLE_DELAY_MS = 5_000;
const ERROR_DELAY_MS = 15_000;
const WORKER_HEADER = "x-pak-render-worker-token";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_RE = /^sha256:[0-9a-f]{64}$/;

type ManifestComponent = {
  ordinal: number;
  shotId: string;
  mediaAssetId: string;
  signedDownloadUrl: string;
  checksum: string;
  durationSeconds: number;
};

type RenderManifest = {
  schemaVersion: "final-assembly-render-v1";
  assemblyId: string;
  jobId: string;
  organizationId: string;
  renderProfile: "PAK_MASTER_1080P_V1";
  aspectRatio: RenderAspectRatio;
  expiresAt: string;
  output: {
    signedUploadUrl: string;
    existingSignedDownloadUrl?: string;
    bucket: "generated-media";
    path: string;
  };
  components: ManifestComponent[];
};

type ProbeDocument = {
  streams?: Array<Record<string, unknown>>;
  format?: Record<string, unknown>;
};

type CompletionMetadata = {
  path: string;
  checksum: string;
  durationSeconds: number;
  width: number;
  height: number;
  sizeBytes: number;
};

class WorkerError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, message: string, retryable: boolean) {
    super(message);
    this.name = "WorkerError";
    this.code = code;
    this.retryable = retryable;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function safeWorkerId(): string {
  const configured = process.env.PAK_RENDER_WORKER_ID?.trim();
  if (configured && /^[A-Za-z0-9._:-]{1,128}$/.test(configured)) return configured;
  return `render-worker:${process.pid}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function parseManifest(value: unknown): RenderManifest {
  const record = asRecord(value);
  const output = asRecord(record?.output);
  const components = record?.components;
  if (
    record?.schemaVersion !== "final-assembly-render-v1"
    || typeof record.assemblyId !== "string" || !UUID_RE.test(record.assemblyId)
    || typeof record.jobId !== "string" || !UUID_RE.test(record.jobId)
    || typeof record.organizationId !== "string" || !UUID_RE.test(record.organizationId)
    || record.renderProfile !== "PAK_MASTER_1080P_V1"
    || (record.aspectRatio !== "16:9" && record.aspectRatio !== "9:16")
    || typeof record.expiresAt !== "string" || !Number.isFinite(Date.parse(record.expiresAt))
    || Date.parse(record.expiresAt) <= Date.now()
    || !output
    || typeof output.signedUploadUrl !== "string" || !URL.canParse(output.signedUploadUrl)
    || (output.existingSignedDownloadUrl !== undefined
      && (typeof output.existingSignedDownloadUrl !== "string" || !URL.canParse(output.existingSignedDownloadUrl)))
    || output.bucket !== "generated-media"
    || typeof output.path !== "string"
    || !output.path.startsWith(`${record.organizationId}/final-video/`)
    || !Array.isArray(components)
    || components.length < 1
    || components.length > MAX_COMPONENTS
  ) {
    throw new WorkerError("MANIFEST_INVALID", "Render manifest is invalid or expired.", false);
  }

  const parsedComponents: ManifestComponent[] = components.map((componentValue, index) => {
    const component = asRecord(componentValue);
    if (
      !component
      || component.ordinal !== index + 1
      || typeof component.shotId !== "string" || !UUID_RE.test(component.shotId)
      || typeof component.mediaAssetId !== "string" || !UUID_RE.test(component.mediaAssetId)
      || typeof component.signedDownloadUrl !== "string" || !URL.canParse(component.signedDownloadUrl)
      || typeof component.checksum !== "string" || !SHA256_RE.test(component.checksum)
      || typeof component.durationSeconds !== "number" || !Number.isFinite(component.durationSeconds)
      || component.durationSeconds <= 0 || component.durationSeconds > 600
    ) {
      throw new WorkerError("MANIFEST_INVALID", "Render component manifest is invalid.", false);
    }
    return {
      ordinal: component.ordinal,
      shotId: component.shotId,
      mediaAssetId: component.mediaAssetId,
      signedDownloadUrl: component.signedDownloadUrl,
      checksum: component.checksum,
      durationSeconds: component.durationSeconds,
    };
  });

  return {
    schemaVersion: "final-assembly-render-v1",
    assemblyId: record.assemblyId,
    jobId: record.jobId,
    organizationId: record.organizationId,
    renderProfile: "PAK_MASTER_1080P_V1",
    aspectRatio: record.aspectRatio,
    expiresAt: record.expiresAt,
    output: {
      signedUploadUrl: output.signedUploadUrl,
      ...(typeof output.existingSignedDownloadUrl === "string"
        ? { existingSignedDownloadUrl: output.existingSignedDownloadUrl }
        : {}),
      bucket: "generated-media",
      path: output.path,
    },
    components: parsedComponents,
  };
}

async function runProcess(command: string, args: string[], maxOutputBytes = 1024 * 1024): Promise<string> {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes <= maxOutputBytes) stdout.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderrBytes += chunk.length;
      if (stderrBytes <= maxOutputBytes) stderr.push(chunk);
    });
    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code !== 0) {
        const detail = Buffer.concat(stderr).toString("utf8").slice(0, 4000);
        reject(new WorkerError("PROCESS_FAILED", `${command} failed${detail ? `: ${detail}` : ""}`, true));
        return;
      }
      resolve(Buffer.concat(stdout).toString("utf8"));
    });
  });
}

async function probe(path: string): Promise<ProbeDocument> {
  let text: string;
  try {
    text = await runProcess("ffprobe", [
      "-v", "error",
      "-show_streams",
      "-show_format",
      "-of", "json",
      path,
    ]);
  } catch (error) {
    if (error instanceof WorkerError) {
      throw new WorkerError("VIDEO_PROBE_FAILED", "Video input/output is corrupt or unreadable.", false);
    }
    throw error;
  }
  try {
    return JSON.parse(text) as ProbeDocument;
  } catch {
    throw new WorkerError("VIDEO_PROBE_FAILED", "ffprobe returned invalid metadata.", false);
  }
}

function validateInputProbe(document: ProbeDocument): void {
  const video = Array.isArray(document.streams)
    ? document.streams.find((stream) => stream.codec_type === "video")
    : undefined;
  const duration = Number(document.format?.duration);
  if (!video || !Number.isFinite(duration) || duration <= 0) {
    throw new WorkerError("INPUT_VIDEO_INVALID", "A render input does not contain valid video.", false);
  }
}

async function downloadToFile(
  url: string,
  path: string,
  maxBytes: number,
  expectedChecksum?: string,
): Promise<{ checksum: string; sizeBytes: number }> {
  let response: Response;
  try {
    response = await fetch(url, { method: "GET" });
  } catch {
    throw new WorkerError("DOWNLOAD_FAILED", "A signed media download failed.", true);
  }
  if (!response.ok || !response.body) {
    throw new WorkerError("DOWNLOAD_FAILED", `A signed media download returned HTTP ${response.status}.`, true);
  }

  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new WorkerError("MEDIA_TOO_LARGE", "Media exceeds the render worker size limit.", false);
  }

  const hash = createHash("sha256");
  let sizeBytes = 0;
  const limiter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      sizeBytes += chunk.length;
      if (sizeBytes > maxBytes) {
        callback(new WorkerError("MEDIA_TOO_LARGE", "Media exceeds the render worker size limit.", false));
        return;
      }
      hash.update(chunk);
      callback(null, chunk);
    },
  });

  try {
    await pipeline(
      Readable.from(response.body as AsyncIterable<Uint8Array>),
      limiter,
      createWriteStream(path, { flags: "wx" }),
    );
  } catch (error) {
    if (error instanceof WorkerError) throw error;
    throw new WorkerError("DOWNLOAD_FAILED", "A signed media download could not be persisted.", true);
  }

  const checksum = `sha256:${hash.digest("hex")}`;
  if (expectedChecksum && checksum !== expectedChecksum) {
    throw new WorkerError("INPUT_CHECKSUM_MISMATCH", "A render input checksum does not match its immutable snapshot.", false);
  }
  return { checksum, sizeBytes };
}

async function checksumFile(path: string): Promise<string> {
  const hash = createHash("sha256");
  const handle = await fs.open(path, "r");
  try {
    for await (const chunk of handle.createReadStream()) hash.update(chunk);
  } finally {
    await handle.close().catch(() => undefined);
  }
  return `sha256:${hash.digest("hex")}`;
}

async function uploadOutput(url: string, path: string): Promise<void> {
  const bytes = await fs.readFile(path);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "PUT",
      headers: { "content-type": "video/mp4" },
      body: bytes,
    });
  } catch {
    throw new WorkerError("OUTPUT_UPLOAD_FAILED", "Final video upload failed.", true);
  }
  if (!response.ok) {
    throw new WorkerError("OUTPUT_UPLOAD_FAILED", `Final video upload returned HTTP ${response.status}.`, true);
  }
}

function expectedDuration(manifest: RenderManifest): number {
  return manifest.components.reduce((sum, component) => sum + component.durationSeconds, 0);
}

async function inspectFinalOutput(
  path: string,
  manifest: RenderManifest,
): Promise<CompletionMetadata> {
  const profile = buildRenderProfile({ aspectRatio: manifest.aspectRatio });
  let validated;
  try {
    validated = validateVideoProbe(await probe(path), profile);
  } catch (error) {
    if (error instanceof WorkerError) throw error;
    throw new WorkerError("OUTPUT_VALIDATION_FAILED", "Final video does not match the render profile.", true);
  }
  const expected = expectedDuration(manifest);
  const tolerance = Math.max(2, expected * 0.05);
  if (Math.abs(validated.durationSeconds - expected) > tolerance) {
    throw new WorkerError("OUTPUT_DURATION_MISMATCH", "Final video duration is outside the permitted tolerance.", true);
  }
  return {
    path: manifest.output.path,
    checksum: await checksumFile(path),
    durationSeconds: validated.durationSeconds,
    width: validated.width,
    height: validated.height,
    sizeBytes: validated.sizeBytes,
  };
}

async function callEdge(
  edgeUrl: string,
  workerToken: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(edgeUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [WORKER_HEADER]: workerToken,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new WorkerError("EDGE_UNAVAILABLE", "Render control plane is unavailable.", true);
  }
  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // Safe normalized errors are preferred, but non-JSON is still an infrastructure failure.
  }
  if (!response.ok) {
    const code = asRecord(payload)?.error;
    throw new WorkerError(
      typeof code === "string" ? code : "EDGE_REQUEST_FAILED",
      `Render control plane returned HTTP ${response.status}.`,
      response.status >= 500 || response.status === 429,
    );
  }
  return asRecord(payload) ?? {};
}

async function reportComplete(
  edgeUrl: string,
  workerToken: string,
  workerId: string,
  manifest: RenderManifest,
  output: CompletionMetadata,
): Promise<void> {
  await callEdge(edgeUrl, workerToken, {
    operation: "complete",
    workerId,
    organizationId: manifest.organizationId,
    jobId: manifest.jobId,
    assemblyId: manifest.assemblyId,
    output,
  });
}

async function reportFailure(
  edgeUrl: string,
  workerToken: string,
  workerId: string,
  manifest: RenderManifest,
  error: WorkerError,
): Promise<void> {
  await callEdge(edgeUrl, workerToken, {
    operation: "fail",
    workerId,
    organizationId: manifest.organizationId,
    jobId: manifest.jobId,
    assemblyId: manifest.assemblyId,
    errorCode: error.code,
    errorMessage: error.message.slice(0, 1000),
    retryable: error.retryable,
  });
}

async function tryReconcileExisting(
  manifest: RenderManifest,
  directory: string,
): Promise<CompletionMetadata | null> {
  if (!manifest.output.existingSignedDownloadUrl) return null;
  const outputPath = join(directory, "existing-final.mp4");
  try {
    await downloadToFile(
      manifest.output.existingSignedDownloadUrl,
      outputPath,
      MAX_RECONCILE_OUTPUT_BYTES,
    );
    return await inspectFinalOutput(outputPath, manifest);
  } catch {
    await fs.rm(outputPath, { force: true }).catch(() => undefined);
    return null;
  }
}

async function renderManifest(manifest: RenderManifest, directory: string): Promise<CompletionMetadata> {
  const inputPaths: string[] = [];
  for (const component of manifest.components) {
    const filename = `${String(component.ordinal).padStart(4, "0")}-${basename(component.mediaAssetId)}.mp4`;
    const path = join(directory, filename);
    await downloadToFile(component.signedDownloadUrl, path, MAX_INPUT_BYTES, component.checksum);
    validateInputProbe(await probe(path));
    inputPaths.push(path);
  }

  const outputPath = join(directory, "final.mp4");
  const profile = buildRenderProfile({ aspectRatio: manifest.aspectRatio });
  try {
    await runProcess("ffmpeg", buildFfmpegArgs(profile, inputPaths, outputPath), 256 * 1024);
  } catch (error) {
    if (error instanceof WorkerError) {
      throw new WorkerError("RENDER_FAILED", "FFmpeg could not create the final visual master.", true);
    }
    throw error;
  }

  const metadata = await inspectFinalOutput(outputPath, manifest);
  await uploadOutput(manifest.output.signedUploadUrl, outputPath);
  return metadata;
}

async function processOne(
  edgeUrl: string,
  workerToken: string,
  workerId: string,
): Promise<boolean> {
  const claim = await callEdge(edgeUrl, workerToken, { operation: "claim", workerId });
  if (claim.manifest === null || claim.manifest === undefined) return false;

  const manifest = parseManifest(claim.manifest);
  const directory = await fs.mkdtemp(join(tmpdir(), "pak-final-video-"));
  try {
    const reconciled = await tryReconcileExisting(manifest, directory);
    if (reconciled) {
      await reportComplete(edgeUrl, workerToken, workerId, manifest, reconciled);
      return true;
    }

    try {
      const output = await renderManifest(manifest, directory);
      await reportComplete(edgeUrl, workerToken, workerId, manifest, output);
      return true;
    } catch (error) {
      const normalized = error instanceof WorkerError
        ? error
        : new WorkerError("WORKER_INTERNAL", "Render worker encountered an internal error.", true);
      await reportFailure(edgeUrl, workerToken, workerId, manifest, normalized).catch(() => undefined);
      return true;
    }
  } finally {
    await fs.rm(directory, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function main(): Promise<void> {
  const edgeUrl = requireEnv("PAK_RENDER_EDGE_URL");
  const workerToken = requireEnv("PAK_RENDER_WORKER_TOKEN");
  const workerId = safeWorkerId();

  for (;;) {
    try {
      const worked = await processOne(edgeUrl, workerToken, workerId);
      if (!worked) await delay(IDLE_DELAY_MS);
    } catch {
      // Deliberately avoid logging request bodies, signed URLs, or credentials.
      await delay(ERROR_DELAY_MS);
    }
  }
}

void main();
