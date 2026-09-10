import { describe, expect, it, vi } from "vitest";

const redirect = vi.fn(() => {
  throw new Error("NEXT_REDIRECT");
});

vi.mock("next/navigation", () => ({ redirect }));

import HomePage from "./page";

describe("root route", () => {
  it("redirects into the authenticated workspace", () => {
    expect(() => HomePage()).toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/dashboard");
  });
});
