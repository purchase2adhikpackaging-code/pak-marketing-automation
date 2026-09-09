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

  it("defaults to deny for unsupported permission values at runtime", () => {
    expect(can("ANALYST", "unknown:permission" as Permission)).toBe(false);
  });
});
