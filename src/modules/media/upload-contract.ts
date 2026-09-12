export type MediaUploadAssetType = "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT";

export const MEDIA_UPLOAD_LIMITS = {
  IMAGE: 25 * 1024 * 1024,
  VIDEO: 512 * 1024 * 1024,
  AUDIO: 100 * 1024 * 1024,
  DOCUMENT: 50 * 1024 * 1024,
} as const satisfies Record<MediaUploadAssetType, number>;

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

function allowedMimeForType(assetType: MediaUploadAssetType, mimeType: string): boolean {
  const mime = mimeType.trim().toLowerCase();
  if (!mime || mime.includes(";") || mime === "image/svg+xml") return false;

  switch (assetType) {
    case "IMAGE":
      return mime.startsWith("image/");
    case "VIDEO":
      return mime.startsWith("video/");
    case "AUDIO":
      return mime.startsWith("audio/");
    case "DOCUMENT":
      return DOCUMENT_MIME_TYPES.has(mime);
  }
}

export function isAllowedMediaUpload(input: {
  assetType: MediaUploadAssetType;
  mimeType: string;
  sizeBytes: number;
}): boolean {
  return Number.isSafeInteger(input.sizeBytes)
    && input.sizeBytes > 0
    && input.sizeBytes <= MEDIA_UPLOAD_LIMITS[input.assetType]
    && allowedMimeForType(input.assetType, input.mimeType);
}
