import type { VideoProvider } from "./provider";
import type {
  VideoGenerationHandle,
  VideoGenerationRequest,
  VideoGenerationResult,
  VideoGenerationStatus,
} from "./types";

export class FakeVideoProvider implements VideoProvider {
  readonly name = "fake";
  private readonly requests = new Map<string, VideoGenerationRequest>();
  private readonly handles = new Map<string, VideoGenerationHandle>();

  async validateConfiguration(): Promise<void> {}

  async submit(request: VideoGenerationRequest): Promise<VideoGenerationHandle> {
    const existing = this.handles.get(request.idempotencyKey);
    if (existing) return existing;

    const handle = {
      provider: this.name,
      externalId: `fake:${request.idempotencyKey}`,
    };

    this.requests.set(handle.externalId, request);
    this.handles.set(request.idempotencyKey, handle);
    return handle;
  }

  async getStatus(handle: VideoGenerationHandle): Promise<VideoGenerationStatus> {
    this.requireRequest(handle);
    return { state: "COMPLETED", progress: 100 };
  }

  async getResult(handle: VideoGenerationHandle): Promise<VideoGenerationResult> {
    const request = this.requireRequest(handle);
    return {
      outputUrl: `https://example.invalid/${encodeURIComponent(handle.externalId)}.mp4`,
      mimeType: "video/mp4",
      durationSeconds: request.durationSeconds,
      raw: { fake: true },
    };
  }

  async cancel(handle: VideoGenerationHandle): Promise<void> {
    this.requireRequest(handle);
  }

  private requireRequest(handle: VideoGenerationHandle): VideoGenerationRequest {
    if (handle.provider !== this.name) throw new Error("Provider mismatch");
    const request = this.requests.get(handle.externalId);
    if (!request) throw new Error("Unknown generation handle");
    return request;
  }
}
