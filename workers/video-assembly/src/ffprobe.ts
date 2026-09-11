export type ExpectedVideoProfile = {
  width: number;
  height: number;
  fps: number;
};

export type ValidatedVideoProbe = {
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
  sizeBytes: number;
};

type ProbeStream = {
  codec_type?: unknown;
  width?: unknown;
  height?: unknown;
  r_frame_rate?: unknown;
};

type ProbeFormat = {
  duration?: unknown;
  size?: unknown;
};

type ProbeDocument = {
  streams?: unknown;
  format?: unknown;
};

function finitePositiveNumber(value: unknown, label: string): number {
  const numberValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    throw new Error(`Invalid ${label}`);
  }
  return numberValue;
}

function parseFps(value: unknown): number {
  if (typeof value !== "string") throw new Error("Invalid frame rate");
  const [numeratorRaw, denominatorRaw] = value.split("/");
  const numerator = Number(numeratorRaw);
  const denominator = Number(denominatorRaw ?? "1");
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0 || numerator <= 0) {
    throw new Error("Invalid frame rate");
  }
  return numerator / denominator;
}

export function validateVideoProbe(
  input: ProbeDocument,
  expected: ExpectedVideoProfile,
): ValidatedVideoProbe {
  if (!input || typeof input !== "object") throw new Error("Invalid ffprobe payload");
  if (!Array.isArray(input.streams)) throw new Error("Video stream is required");

  const videoStream = input.streams.find((stream): stream is ProbeStream =>
    !!stream && typeof stream === "object" && (stream as ProbeStream).codec_type === "video",
  );
  if (!videoStream) throw new Error("Video stream is required");

  const width = finitePositiveNumber(videoStream.width, "video width");
  const height = finitePositiveNumber(videoStream.height, "video height");
  const fps = parseFps(videoStream.r_frame_rate);
  if (!Number.isInteger(width) || !Number.isInteger(height)) throw new Error("Invalid video dimensions");
  if (width !== expected.width || height !== expected.height) throw new Error("Unexpected video dimensions");
  if (Math.abs(fps - expected.fps) > 0.01) throw new Error("Unexpected frame rate");

  if (!input.format || typeof input.format !== "object") throw new Error("Video format metadata is required");
  const format = input.format as ProbeFormat;
  const durationSeconds = finitePositiveNumber(format.duration, "video duration");
  const sizeBytes = finitePositiveNumber(format.size, "video size");
  if (!Number.isSafeInteger(sizeBytes)) throw new Error("Invalid video size");

  return { durationSeconds, width, height, fps, sizeBytes };
}
