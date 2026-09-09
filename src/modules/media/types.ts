export type MediaAssetType = "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT";

export type MediaAsset = {
  id: string;
  organizationId: string;
  assetType: MediaAssetType;
  storagePath: string;
  source: "UPLOAD" | "GENERATED" | "IMPORT";
  mimeType: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
  checksum?: string;
  generatingJobId?: string;
  sceneId?: string;
  status: "ACTIVE" | "ARCHIVED" | "FAILED";
  createdAt: string;
  updatedAt: string;
};
