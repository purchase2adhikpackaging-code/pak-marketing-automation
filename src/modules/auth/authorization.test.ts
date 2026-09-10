import { describe, expect, it } from "vitest";

import { can } from "./authorization";
import { ALL_PERMISSIONS, type Permission } from "./roles";

describe("RBAC authorization", () => {
  it("allows OWNER every canonical permission", () => {
    for (const permission of ALL_PERMISSIONS) {
      expect(can("OWNER", permission)).toBe(true);
    }
  });

  it("allows REVIEWER to approve but not manage settings", () => {
    expect(can("REVIEWER", "content:approve")).toBe(true);
    expect(can("REVIEWER", "settings:manage")).toBe(false);
  });

  it("allows ANALYST analytics access but denies content creation", () => {
    expect(can("ANALYST", "analytics:view")).toBe(true);
    expect(can("ANALYST", "content:create")).toBe(false);
  });

  it("maps Knowledge Base permissions by role", () => {
    expect(can("OWNER", "knowledge:view")).toBe(true);
    expect(can("OWNER", "knowledge:manage")).toBe(true);
    expect(can("OWNER", "knowledge:delete")).toBe(true);

    expect(can("ADMIN", "knowledge:view")).toBe(true);
    expect(can("ADMIN", "knowledge:manage")).toBe(true);
    expect(can("ADMIN", "knowledge:delete")).toBe(true);

    expect(can("EDITOR", "knowledge:view")).toBe(true);
    expect(can("EDITOR", "knowledge:manage")).toBe(true);
    expect(can("EDITOR", "knowledge:delete")).toBe(false);

    expect(can("REVIEWER", "knowledge:view")).toBe(true);
    expect(can("REVIEWER", "knowledge:manage")).toBe(false);
    expect(can("REVIEWER", "knowledge:delete")).toBe(false);

    expect(can("ANALYST", "knowledge:view")).toBe(true);
    expect(can("ANALYST", "knowledge:manage")).toBe(false);
    expect(can("ANALYST", "knowledge:delete")).toBe(false);
  });

  it("defaults to deny for unsupported permission values at runtime", () => {
    expect(can("ANALYST", "unknown:permission" as Permission)).toBe(false);
  });
});
