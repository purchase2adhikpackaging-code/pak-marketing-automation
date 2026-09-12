const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;

function assertSafeSegment(value: string, label: string): void {
  if (!value || !SAFE_SEGMENT.test(value) || value === "." || value === "..") {
    throw new Error(`Invalid ${label}`);
  }
}

function sanitizeFilename(filename: string): string {
  if (!filename || filename.includes("/") || filename.includes("\\") || filename === "." || filename === "..") {
    throw new Error("Invalid filename");
  }

  const lastDot = filename.lastIndexOf(".");
  const hasExtension = lastDot > 0 && lastDot < filename.length - 1;
  const stem = hasExtension ? filename.slice(0, lastDot) : filename;
  const extension = hasExtension ? filename.slice(lastDot + 1) : "";

  const safeStem = stem
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9._-]/g, "")
    .replace(/-+/g, "-");

  if (!safeStem) throw new Error("Invalid filename");
  if (extension) assertSafeSegment(extension, "file extension");

  return extension ? `${safeStem}.${extension}` : safeStem;
}

export function buildMediaStoragePath(organizationId: string, category: string, filename: string): string {
  assertSafeSegment(organizationId, "organization id");
  assertSafeSegment(category, "media category");
  return `${organizationId}/${category}/${sanitizeFilename(filename)}`;
}

export function buildMediaObjectIdentity(
  organizationId: string,
  bucket: string,
  category: string,
  filename: string,
): { bucket: string; path: string } {
  assertSafeSegment(bucket, "storage bucket");
  return {
    bucket,
    path: buildMediaStoragePath(organizationId, category, filename),
  };
}
