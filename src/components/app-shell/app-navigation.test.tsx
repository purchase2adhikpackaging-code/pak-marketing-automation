import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const usePathname = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => usePathname(),
}));

import { AppNavigation } from "./app-navigation";

describe("AppNavigation", () => {
  beforeEach(() => {
    usePathname.mockReturnValue("/content-studio");
  });

  it("renders Operational, Administration, and Roadmap groups in workflow-first order", () => {
    render(<AppNavigation />);

    const operational = screen.getByText("Operational");
    const administration = screen.getByText("Administration");
    const roadmap = screen.getByText("Roadmap");

    expect(operational.compareDocumentPosition(administration) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(administration.compareDocumentPosition(roadmap) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("marks only the current route as active", () => {
    render(<AppNavigation />);

    expect(screen.getByRole("link", { name: "Content Studio" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Settings" }).getAttribute("aria-current")).toBeNull();
  });

  it("uses an accessible collapsed mobile disclosure without losing grouped navigation", () => {
    render(<AppNavigation />);

    const openButton = screen.getByRole("button", { name: "Open navigation" });
    expect(openButton.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(openButton);

    expect(screen.getByRole("button", { name: "Close navigation" }).getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("navigation", { name: "Primary" })).not.toBeNull();
    expect(screen.getByText("Operational")).not.toBeNull();
    expect(screen.getByText("Roadmap")).not.toBeNull();
  });
});
