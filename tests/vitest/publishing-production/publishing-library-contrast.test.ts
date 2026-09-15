import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("publishing library contrast", () => {
  it("renders the released-book table text in black on the white card", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/app/(app)/publishing/library/page.tsx"),
      "utf8",
    );

    expect(source).toContain('<table className="min-w-full text-left text-sm text-black">');
    expect(source).toContain('<thead className="text-black">');
    expect(source).toContain('className="py-3 font-medium text-black"');
    expect(source).toContain('className="text-black underline"');
  });
});
