import type { BookJob } from "./domain";
import type { BookManuscript, ChapterManuscript } from "./manuscript-domain";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeMarkdown(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function listMarkdown(values: readonly string[]): string {
  return values.map((value) => `- ${escapeMarkdown(value)}`).join("\n");
}

function chapterMarkdown(chapter: ChapterManuscript): string {
  const parts: string[] = [
    `# Chapter ${chapter.number} — ${escapeMarkdown(chapter.title)}`,
    "",
    escapeMarkdown(chapter.purpose),
    "",
    "## Learning Outcomes",
    listMarkdown(chapter.learningOutcomes),
    "",
    "## Key Terms",
    ...chapter.keyTerms.map(
      (term) => `- **${escapeMarkdown(term.term)}:** ${escapeMarkdown(term.explanation)}`,
    ),
  ];

  for (const section of chapter.sections) {
    parts.push("", `## ${escapeMarkdown(section.heading)}`, "");
    for (const paragraph of section.paragraphs) {
      parts.push(escapeMarkdown(paragraph), "");
    }
  }

  if (chapter.workedExamples.length > 0) {
    parts.push("## Worked Examples");
    for (const example of chapter.workedExamples) {
      parts.push(
        `### ${escapeMarkdown(example.title)}`,
        "",
        `**Problem:** ${escapeMarkdown(example.problem)}`,
        "",
        ...example.solutionSteps.map(
          (step, index) => `${index + 1}. ${escapeMarkdown(step)}`,
        ),
        "",
        `**Conclusion:** ${escapeMarkdown(example.conclusion)}`,
        "",
      );
    }
  }

  if (chapter.practicalActivities.length > 0) {
    parts.push("## Practical Activities");
    for (const activity of chapter.practicalActivities) {
      parts.push(
        `### ${escapeMarkdown(activity.title)}`,
        "",
        `**Objective:** ${escapeMarkdown(activity.objective)}`,
        "",
        "**Safety:**",
        listMarkdown(activity.safety),
        "",
        "**Tasks:**",
        listMarkdown(activity.tasks),
        "",
        "**Records:**",
        listMarkdown(activity.records),
        "",
      );
    }
  }

  parts.push(
    "## Safety Notes",
    listMarkdown(chapter.safetyNotes),
    "",
    "## Knowledge Check",
    listMarkdown(chapter.knowledgeChecks),
    "",
    "## Chapter Summary",
    listMarkdown(chapter.summary),
    "",
    "## Review Questions",
    listMarkdown(chapter.reviewQuestions),
    "",
    `**Source IDs:** ${chapter.sourceIds.map(escapeMarkdown).join(", ")}`,
  );

  return parts.join("\n");
}

export function serializeBookManuscript(manuscript: BookManuscript): string {
  return [
    `# ${escapeMarkdown(manuscript.programmeCode)} — ${escapeMarkdown(manuscript.subjectCode)} ${escapeMarkdown(manuscript.subjectTitle)}`,
    "",
    `**Book ID:** ${escapeMarkdown(manuscript.bookId)}`,
    `**Level:** ${escapeMarkdown(manuscript.level)}`,
    `**Edition:** ${escapeMarkdown(manuscript.edition)}`,
    `**Revision:** ${escapeMarkdown(manuscript.revision)}`,
    `**Blueprint SHA-256:** ${manuscript.blueprintSha256}`,
    "",
    `**Knowledge Pack Locks:** ${manuscript.knowledgePacks
      .map((pack) => `${escapeMarkdown(pack.packId)}:${pack.sha256}`)
      .join(", ")}`,
    "",
    ...manuscript.chapters.flatMap((chapter) => [chapterMarkdown(chapter), ""]),
  ].join("\n");
}

function renderList(items: readonly string[], className?: string): string {
  return `<ul${className ? ` class="${className}"` : ""}>${items
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("")}</ul>`;
}

function renderChapter(chapter: ChapterManuscript): string {
  const sections = chapter.sections
    .map(
      (section, index) => `<section class="teaching-section" id="${escapeHtml(
        chapter.chapterId,
      )}-section-${index + 1}" data-component-id="${escapeHtml(
        chapter.chapterId,
      )}-section-${index + 1}"><h2>${escapeHtml(section.heading)}</h2>${section.paragraphs
        .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
        .join("")}</section>`,
    )
    .join("");

  const workedExamples = chapter.workedExamples
    .map(
      (example, index) => `<section class="callout worked-example" data-pak-box="${escapeHtml(
        chapter.chapterId,
      )}-worked-${index + 1}" data-component-id="${escapeHtml(
        chapter.chapterId,
      )}-worked-${index + 1}"><h2>Worked Example — ${escapeHtml(
        example.title,
      )}</h2><p><strong>Problem:</strong> ${escapeHtml(
        example.problem,
      )}</p><ol>${example.solutionSteps
        .map((step) => `<li>${escapeHtml(step)}</li>`)
        .join("")}</ol><p><strong>Conclusion:</strong> ${escapeHtml(
        example.conclusion,
      )}</p></section>`,
    )
    .join("");

  const practicalActivities = chapter.practicalActivities
    .map(
      (activity, index) => `<section class="callout practical" data-pak-box="${escapeHtml(
        chapter.chapterId,
      )}-practical-${index + 1}" data-component-id="${escapeHtml(
        chapter.chapterId,
      )}-practical-${index + 1}"><h2>Practical Activity — ${escapeHtml(
        activity.title,
      )}</h2><p><strong>Objective:</strong> ${escapeHtml(activity.objective)}</p><h3>Safety</h3>${renderList(
        activity.safety,
      )}<h3>Tasks</h3>${renderList(activity.tasks)}<h3>Records</h3>${renderList(
        activity.records,
      )}</section>`,
    )
    .join("");

  return `<article class="chapter" id="chapter-${chapter.number}" data-component-id="${escapeHtml(
    chapter.chapterId,
  )}"><header class="chapter-header" data-pak-no-overlap="${escapeHtml(
    chapter.chapterId,
  )}-header"><p class="chapter-kicker">Chapter ${chapter.number}</p><h1>${escapeHtml(
    chapter.title,
  )}</h1><p>${escapeHtml(chapter.purpose)}</p></header><section class="learning-outcomes callout" data-pak-box="${escapeHtml(
    chapter.chapterId,
  )}-outcomes"><h2>Learning Outcomes</h2>${renderList(
    chapter.learningOutcomes,
  )}</section><section class="key-terms"><h2>Key Terms</h2><dl>${chapter.keyTerms
    .map(
      (term) => `<dt>${escapeHtml(term.term)}</dt><dd>${escapeHtml(term.explanation)}</dd>`,
    )
    .join("")}</dl></section>${sections}${workedExamples}${practicalActivities}<section class="callout safety-note" data-pak-box="${escapeHtml(
    chapter.chapterId,
  )}-safety"><h2>Safety Notes</h2>${renderList(
    chapter.safetyNotes,
  )}</section><section><h2>Knowledge Check</h2>${renderList(
    chapter.knowledgeChecks,
  )}</section><section><h2>Chapter Summary</h2>${renderList(
    chapter.summary,
  )}</section><section><h2>Review Questions</h2>${renderList(
    chapter.reviewQuestions,
  )}</section><footer class="chapter-sources"><strong>Source IDs:</strong> ${chapter.sourceIds
    .map(escapeHtml)
    .join(", ")}</footer></article>`;
}

const DEFAULT_CSS = `
@page { size: A4; margin: 16mm 16mm 18mm; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: Arial, Helvetica, sans-serif; color: #14212b; font-size: 10.5pt; line-height: 1.45; }
.book-front { break-after: page; padding-top: 28mm; }
.book-front h1 { font-size: 25pt; line-height: 1.15; margin: 10mm 0 4mm; }
.book-front .programme { font-size: 12pt; font-weight: 700; letter-spacing: .02em; }
.identity-grid { margin-top: 18mm; border-top: 1px solid #60758a; padding-top: 6mm; display: grid; gap: 2mm; }
.chapter { break-before: page; }
.chapter:first-of-type { break-before: auto; }
.chapter-header { padding: 7mm 0 4mm; border-bottom: 2px solid #0b2d4d; margin-bottom: 6mm; }
.chapter-kicker { text-transform: uppercase; letter-spacing: .12em; font-size: 8.5pt; font-weight: 700; }
h1 { color: #0b2d4d; }
h2 { color: #143f63; margin: 6mm 0 2.5mm; break-after: avoid; }
h3 { color: #143f63; break-after: avoid; }
p, li, dd { orphans: 3; widows: 3; overflow-wrap: anywhere; }
.callout { width: 100%; height: auto; min-height: 0; padding: 4mm 5mm; margin: 5mm 0; border: 1px solid #9fb2c2; background: #f7f9fb; break-inside: avoid; overflow: visible; }
.learning-outcomes { border-left: 3px solid #d8262e; }
.safety-note { border-left: 3px solid #d8a73c; }
.worked-example { border-left: 3px solid #2e7d5a; }
.practical { border-left: 3px solid #0b2d4d; }
dl { display: grid; grid-template-columns: minmax(28mm, 1fr) 3fr; column-gap: 4mm; row-gap: 2mm; }
dt { font-weight: 700; }
dd { margin: 0; }
.chapter-sources { margin-top: 8mm; padding-top: 3mm; border-top: 1px solid #c8d3dc; font-size: 8.5pt; overflow-wrap: anywhere; }
`;

export function renderBookHtml(input: {
  job: BookJob;
  manuscript: BookManuscript;
  css?: string;
}): string {
  const { job, manuscript } = input;
  const css = input.css ?? DEFAULT_CSS;
  const chapters = manuscript.chapters.map(renderChapter).join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(`${job.programmeCode} — ${job.subjectCode} ${job.subjectTitle}`)}</title>
<style>${css}</style>
</head>
<body>
<main class="book" data-book-id="${escapeHtml(job.bookId)}">
<section class="book-front" data-component-id="front-matter">
<p class="programme">${escapeHtml(job.programmeCode)} — ${escapeHtml(job.programmeTitle)}</p>
<h1>${escapeHtml(job.subjectCode)} — ${escapeHtml(job.subjectTitle)}</h1>
<p>Student Textbook</p>
<div class="identity-grid" data-pak-box="book-identity">
<div><strong>Book ID:</strong> ${escapeHtml(job.bookId)}</div>
<div><strong>Edition:</strong> ${escapeHtml(job.edition)}</div>
<div><strong>Revision:</strong> ${escapeHtml(job.revision)}</div>
<div><strong>Qualification level:</strong> ${escapeHtml(job.level)}</div>
</div>
</section>
${chapters}
</main>
</body>
</html>`;
}
