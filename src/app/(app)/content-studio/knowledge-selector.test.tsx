import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { SelectableKnowledgeRecord } from "./knowledge-selector";
import { KnowledgeSelector } from "./knowledge-selector";

function knowledge(index: number): SelectableKnowledgeRecord {
  return {
    id: `${String(index).padStart(8, "0")}-1111-4111-8111-111111111111`,
    title: `Approved knowledge ${index}`,
    sourceType: index % 2 === 0 ? "DOCUMENT" : "MANUAL",
    ...(index % 2 === 0 ? { sourceLabel: `Manual ${index}` } : {}),
    revision: index,
  };
}

describe("KnowledgeSelector", () => {
  it("toggles approved source IDs and shows selected count", () => {
    const onChange = vi.fn();
    render(<KnowledgeSelector records={[knowledge(1), knowledge(2)]} selectedIds={[]} onChange={onChange} />);

    expect(screen.getByText("0 of 20 selected")).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: "Approved knowledge 1" }));
    expect(onChange).toHaveBeenCalledWith([knowledge(1).id]);
  });

  it("removes an already selected source", () => {
    const onChange = vi.fn();
    const first = knowledge(1);
    render(<KnowledgeSelector records={[first, knowledge(2)]} selectedIds={[first.id]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox", { name: first.title }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("enforces a maximum of 20 selected records", () => {
    const records = Array.from({ length: 21 }, (_, index) => knowledge(index + 1));
    const selectedIds = records.slice(0, 20).map((record) => record.id);
    render(<KnowledgeSelector records={records} selectedIds={selectedIds} onChange={vi.fn()} />);

    expect(screen.getByText("20 of 20 selected")).toBeTruthy();
    expect((screen.getByRole("checkbox", { name: records[20]!.title }) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("checkbox", { name: records[0]!.title }) as HTMLInputElement).disabled).toBe(false);
  });

  it("renders only metadata needed for selection and never source content", () => {
    const record = knowledge(2);
    render(<KnowledgeSelector records={[record]} selectedIds={[]} onChange={vi.fn()} />);

    expect(screen.getByText(record.title)).toBeTruthy();
    expect(screen.getByText("DOCUMENT")).toBeTruthy();
    expect(screen.getByText("Revision 2")).toBeTruthy();
    expect(document.body.textContent).not.toContain("full knowledge record content");
  });

  it("renders an explicit empty state with a real Knowledge Base recovery link", () => {
    render(<KnowledgeSelector records={[]} selectedIds={[]} onChange={vi.fn()} />);

    expect(screen.getByText("No ACTIVE Knowledge Base records are available for this organization.")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Open Knowledge Base/i }).getAttribute("href")).toBe("/knowledge-base");
  });
});
