import type {
  VideoGenerationHandle,
  VideoGenerationRequest,
  VideoGenerationResult,
  VideoGenerationStatus,
} from "./types";

export interface VideoProvider {
  readonly name: string;
  validateConfiguration(): Promise<void>;
  submit(request: VideoGenerationRequest): Promise<VideoGenerationHandle>;
  getStatus(handle: VideoGenerationHandle): Promise<VideoGenerationStatus>;
  getResult(handle: VideoGenerationHandle): Promise<VideoGenerationResult>;
  cancel?(handle: VideoGenerationHandle): Promise<void>;
}
