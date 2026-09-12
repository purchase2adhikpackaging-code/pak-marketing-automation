import { describe, expect, it } from "vitest";

import {
  MEDIA_UPLOAD_LIMITS,
  isAllowedMediaUpload,
  type MediaUploadAssetType,
} from "./upload-contract";

describe("media upload contract", () => {
  it("uses explicit bounded upload limits", () => {
    expect(MEDIA_UPLOAD_LIMITS).toEqual({
      IMAGE: 25 * 1024 * 1024,
      VIDEO: 512 * 1024 * 1024,
      AUDIO: 100 * 1024 * 1024,
      DOCUMENT: 50 * 1024 * 1024,
    });
  });

  it.each<[MediaUploadAssetType, string]>([
    ["IMAGE", "image/png"],
    ["VIDEO", "video/mp4"],
    ["AUDIO", "audio/mpeg"],
    ["DOCUMENT", "application/pdf"],
    ["DOCUMENT", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ])("allows approved %s MIME values", (assetType, mimeType) => {
    expect(isAllowedMediaUpload({ assetType, mimeType, sizeBytes: 1024 })).toBe(true);
  });

  it.each([
    "text/html",
    "application/javascript",
    "text/javascript",
    "application/x-sh",
    "application/x-msdownload",
  ])("rejects executable/script-capable MIME %s", (mimeType) => {
    expect(isAllowedMediaUpload({ assetType: "DOCUMENT", mimeType, sizeBytes: 1024 })).toBe(false);
  });

  it("rejects MIME/type mismatch and oversized media", () => {
    expect(isAllowedMediaUpload({ assetType: "IMAGE", mimeType: "video/mp4", sizeBytes: 1024 })).toBe(false);
    expect(isAllowedMediaUpload({
      assetType: "IMAGE",
      mimeType: "image/png",
      sizeBytes: MEDIA_UPLOAD_LIMITS.IMAGE + 1,
    })).toBe(false);
  });
});
