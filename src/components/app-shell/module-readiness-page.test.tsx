import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { B3_MODULE_READINESS } from "./module-readiness";
import { ModuleReadinessPage } from "./module-readiness-page";

const ACTIVE_ROUTES = new Set(["/dashboard", "/content-studio", "/knowledge-base", "/media-library", "/settings"]);

describe("B3 module readiness surface", () => {
  it("renders operator-facing readiness, dependency, roadmap metadata and real workflow links without fake actions", () => {
    const config = B3_MODULE_READINESS["/analytics"];

    render(<ModuleReadinessPage config={config} />);

    expect(screen.getByRole("heading", { name: "Analytics" })).toBeInTheDocument();
    expect(screen.getByLabelText("Readiness: Planned")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Current availability" })).toBeInTheDocument();
    expect(screen.getByText(/publishing performance analytics are not active/i)).toBeInTheDocument();
    expect(screen.getByText(/real publishing outcomes and normalized metric ingestion/i)).toBeInTheDocument();
    expect(screen.getByText("Phase 12", { selector: ":not(.sr-only)" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Dashboard" })).toHaveAttribute("href", "/dashboard");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("defines exactly eight still-future B3 routes with links to implemented workflows only", () => {
    const configs = Object.values(B3_MODULE_READINESS);

    expect(configs).toHaveLength(8);
    expect(configs.filter((config) => config.status === "Foundation only").map((config) => config.route)).toEqual([
      "/manual-generation",
    ]);
    expect(configs.filter((config) => config.status === "Planned")).toHaveLength(7);

    for (const config of configs) {
      expect(config.relatedLinks.length).toBeGreaterThanOrEqual(1);
      expect(config.relatedLinks.length).toBeLessThanOrEqual(2);
      for (const link of config.relatedLinks) {
        expect(ACTIVE_ROUTES.has(link.href), `${config.route} links to non-active ${link.href}`).toBe(true);
      }
    }
  });
});
