import type { VideoProvider } from "../provider";
import type {
  VideoGenerationHandle,
  VideoGenerationRequest,
  VideoGenerationResult,
  VideoGenerationStatus,
  VideoProviderError,
} from "../types";
import {
  LTX_DEFAULT_FPS,
  LTX_DEFAULT_MODEL,
  LTX_TEXT_TO_VIDEO_ENDPOINT,
  mapLtxCameraMotion,
  normalizeLtxDuration,
  resolveLtxResolution,
} from "./capabilities";
import { LtxProviderRequestError, mapLtxError } from "./error-mapping";
import type { LtxJobStatusPayload, LtxSubmitResponse } from "./types";

export { normalizeLtxDuration, resolveLtxResolution } from "./capabilities";

export type LtxVideoProviderOptions = {
  apiKey: string;
  fetchFn?: typeof fetch;
};

function responseInvalid(message: string): LtxProviderRequestError {
  return new LtxProviderRequestError({
    code: "LTX_RESPONSE_INVALID",
    message,
    retryable: false,
  });
}

function serviceUnavailable(message: string): LtxProviderRequestError {
  return new LtxProviderRequestError({
    code: "LTX_SERVICE_UNAVAILABLE",
    message,
    retryable: true,
  });
}

function jobFailure(error: LtxJobStatusPayload["error"]): VideoProviderError {
  if (!error) {
    return {
      code: "LTX_RESPONSE_INVALID",
      message: "LTX generation failed without structured error metadata.",
      retryable: false,
    };
  }
  return mapLtxError(422, { type: "error", error });
}

export class LtxVideoProvider implements VideoProvider {
  readonly name = "ltx";
  private readonly apiKey: string;
  private readonly fetchFn: typeof fetch;

  constructor(options: LtxVideoProviderOptions) {
    this.apiKey = options.apiKey.trim();
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async validateConfiguration(): Promise<void> {
    if (!this.apiKey) {
      throw new LtxProviderRequestError({
        code: "LTX_AUTHENTICATION",
        message: "LTX API key is not configured.",
        retryable: false,
      });
    }
  }

  async submit(request: VideoGenerationRequest): Promise<VideoGenerationHandle> {
    await this.validateConfiguration();
    if (request.generateAudio) {
      throw new LtxProviderRequestError({
        code: "LTX_GENERATED_AUDIO_DISABLED",
        message: "Provider-generated audio is disabled for the Phase 7 generation profile.",
        retryable: false,
      });
    }

    const cameraMotion = mapLtxCameraMotion(request.cameraMotion);
    const body = {
      prompt: request.prompt,
      model: LTX_DEFAULT_MODEL,
      duration: normalizeLtxDuration(request.durationSeconds),
      resolution: resolveLtxResolution(request.aspectRatio),
      fps: LTX_DEFAULT_FPS,
      generate_audio: false,
      ...(cameraMotion ? { camera_motion: cameraMotion } : {}),
    };

    const response = await this.call(LTX_TEXT_TO_VIDEO_ENDPOINT, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(body),
    });
    const payload = await this.parseJson(response);
    if (!response.ok) throw new LtxProviderRequestError(mapLtxError(response.status, payload));

    if (!payload || typeof payload !== "object") throw responseInvalid("LTX returned an invalid submission response.");
    const submitted = payload as Partial<LtxSubmitResponse>;
    if (typeof submitted.id !== "string" || !submitted.id.trim()) {
      throw responseInvalid("LTX submission response did not include a job ID.");
    }

    return { provider: this.name, externalId: submitted.id };
  }

  async getStatus(handle: VideoGenerationHandle): Promise<VideoGenerationStatus> {
    const payload = await this.fetchJob(handle);
    if (payload.status === "pending") return { state: "QUEUED" };
    if (payload.status === "processing") {
      return typeof payload.progress === "number"
        ? { state: "PROCESSING", progress: Math.max(0, Math.min(100, payload.progress)) }
        : { state: "PROCESSING" };
    }
    if (payload.status === "completed") return { state: "COMPLETED", progress: 100 };
    if (payload.status === "failed") return { state: "FAILED", error: jobFailure(payload.error) };
    throw responseInvalid("LTX returned an unknown job status.");
  }

  async getResult(handle: VideoGenerationHandle): Promise<VideoGenerationResult> {
    const payload = await this.fetchJob(handle);
    if (payload.status === "failed") throw new LtxProviderRequestError(jobFailure(payload.error));
    if (payload.status !== "completed") {
      throw new LtxProviderRequestError({
        code: "LTX_RESULT_NOT_READY",
        message: "LTX generation result is not ready.",
        retryable: true,
      });
    }
    const outputUrl = payload.result?.video_url;
    if (typeof outputUrl !== "string" || !outputUrl.trim()) {
      throw responseInvalid("Completed LTX job did not include a video URL.");
    }
    return { outputUrl, mimeType: "video/mp4" };
  }

  private async fetchJob(handle: VideoGenerationHandle): Promise<LtxJobStatusPayload> {
    this.assertHandle(handle);
    await this.validateConfiguration();
    const response = await this.call(`${LTX_TEXT_TO_VIDEO_ENDPOINT}/${encodeURIComponent(handle.externalId)}`, {
      method: "GET",
      headers: this.headers(false),
    });
    const payload = await this.parseJson(response);
    if (!response.ok) throw new LtxProviderRequestError(mapLtxError(response.status, payload));
    if (!payload || typeof payload !== "object") throw responseInvalid("LTX returned an invalid job response.");

    const candidate = payload as Partial<LtxJobStatusPayload>;
    if (
      typeof candidate.id !== "string" ||
      !candidate.id.trim() ||
      !["pending", "processing", "completed", "failed"].includes(String(candidate.status))
    ) {
      throw responseInvalid("LTX returned an invalid job response.");
    }
    return candidate as LtxJobStatusPayload;
  }

  private assertHandle(handle: VideoGenerationHandle): void {
    if (handle.provider !== this.name || !handle.externalId.trim()) {
      throw new Error("Provider mismatch or invalid LTX generation handle.");
    }
  }

  private headers(includeJson: boolean): Record<string, string> {
    return {
      authorization: `Bearer ${this.apiKey}`,
      ...(includeJson ? { "content-type": "application/json" } : {}),
    };
  }

  private async call(url: string, init: RequestInit): Promise<Response> {
    try {
      return await this.fetchFn(url, init);
    } catch {
      throw serviceUnavailable("LTX API is temporarily unavailable.");
    }
  }

  private async parseJson(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }
}
