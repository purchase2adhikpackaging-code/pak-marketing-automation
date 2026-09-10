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

  it("marks only the current route as active", () => {
    render(<AppNavigation />);

    expect(screen.getByRole("link", { name: "Content Studio" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Settings" })).not.toHaveAttribute("aria-current");
  });

  it("uses an accessible collapsed mobile disclosure", () => {
    render(<AppNavigation />);

    const openButton = screen.getByRole("button", { name: "Open navigation" });
    expect(openButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(openButton);

    expect(screen.getByRole("button", { name: "Close navigation" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
  });
});
