import { buildMediaStoragePath } from "@/modules/media/storage-path";

export const GENERATED_MEDIA_BUCKET = "generated-media";
export const DEFAULT_MAX_GENERATED_VIDEO_BYTES = 256 * 1024 * 1024;

type GeneratedVideoPathInput = {
  organizationId: string;
  planVersionId: string;
  shotId: string;
  attemptId: string;
};

export type ValidatedGeneratedVideo = {
  bytes: Uint8Array;
  mimeType: string;
  byteLength: number;
};

export function buildGeneratedVideoObjectPath(input: GeneratedVideoPathInput): string {
  return buildMediaStoragePath(
    input.organizationId,
    "generated-video",
    `${input.planVersionId}-${input.shotId}-${input.attemptId}.mp4`,
  );
}

export async function assertGeneratedVideoResponse(
  response: Response,
  maxBytes = DEFAULT_MAX_GENERATED_VIDEO_BYTES,
): Promise<ValidatedGeneratedVideo> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) {
    throw new Error("Generated video maximum byte limit is invalid.");
  }
  if (!response.ok) {
    throw new Error(`Generated video download failed with HTTP ${response.status}.`);
  }

  const mimeType = (response.headers.get("content-type") ?? "")
    .split(";", 1)[0]!
    .trim()
    .toLowerCase();
  if (!mimeType.startsWith("video/")) {
    throw new Error("Generated media response is not a video.");
  }

  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error("Generated video exceeds the maximum allowed size.");
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("Generated video response body is empty.");

  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value?.byteLength) continue;
    byteLength += value.byteLength;
    if (byteLength > maxBytes) {
      await reader.cancel();
      throw new Error("Generated video exceeds the maximum allowed size.");
    }
    chunks.push(value);
  }

  if (byteLength === 0) {
    throw new Error("Generated video response body is empty.");
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { bytes, mimeType, byteLength };
}
