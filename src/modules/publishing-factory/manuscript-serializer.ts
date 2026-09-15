import type { BookJob } from "./domain";
import type { BookManuscript, ChapterManuscript } from "./manuscript-domain";
import type { ResolvedBookVisual, ResolvedBookVisualBundle } from "./visual-production";

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

function renderVisualFigure(visual: ResolvedBookVisual): string {
  return `<figure class="book-figure book-figure-${escapeHtml(
    visual.placement,
  )}" data-visual-id="${escapeHtml(visual.id)}" data-visual-source="${escapeHtml(
    visual.sourceKind,
  )}"><img src="${escapeHtml(visual.dataUri)}" alt="${escapeHtml(
    visual.altText,
  )}" decoding="sync"><figcaption>${escapeHtml(visual.caption)}</figcaption></figure>`;
}

function renderCover(
  visual: ResolvedBookVisual,
  side: "front" | "back",
  job: BookJob,
): string {
  const overlay =
    side === "front"
      ? `<p class="cover-brand">Polish Railway Academy</p><p class="cover-programme">${escapeHtml(
          job.programmeCode,
        )} — ${escapeHtml(job.programmeTitle)}</p><h1>${escapeHtml(
          job.subjectCode,
        )}<span>${escapeHtml(job.subjectTitle)}</span></h1><p class="cover-type">Student Textbook</p><p class="cover-edition">Edition ${escapeHtml(
          job.edition,
        )} · Revision ${escapeHtml(job.revision)}</p>`
      : `<p class="cover-brand">Polish Railway Academy</p><h2>${escapeHtml(
          job.subjectCode,
        )} — ${escapeHtml(job.subjectTitle)}</h2><p class="cover-type">Professional railway education · ${escapeHtml(
          job.programmeCode,
        )}</p><p class="cover-edition">Edition ${escapeHtml(job.edition)}</p>`;

  return `<section class="book-cover book-cover-${side}" data-pak-cover="${side}" data-visual-id="${escapeHtml(
    visual.id,
  )}"><img class="book-cover-image" src="${escapeHtml(visual.dataUri)}" alt="${escapeHtml(
    visual.altText,
  )}" decoding="sync"><div class="book-cover-shade"></div><div class="book-cover-content">${overlay}</div></section>`;
}

function renderChapter(
  chapter: ChapterManuscript,
  chapterVisuals: readonly ResolvedBookVisual[] = [],
): string {
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

  const figures = chapterVisuals.map(renderVisualFigure).join("");

  return `<article class="chapter" id="chapter-${chapter.number}" data-component-id="${escapeHtml(
    chapter.chapterId,
  )}"><header class="chapter-header" data-pak-no-overlap="${escapeHtml(
    chapter.chapterId,
  )}-header"><p class="chapter-kicker">Chapter ${chapter.number}</p><h1>${escapeHtml(
    chapter.title,
  )}</h1><p>${escapeHtml(chapter.purpose)}</p></header>${figures}<section class="learning-outcomes callout" data-pak-box="${escapeHtml(
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
@page cover { size: A4; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font-family: Arial, Helvetica, sans-serif; color: #14212b; font-size: 10.5pt; line-height: 1.45; }
.book-cover { page: cover; position: relative; width: 210mm; height: 297mm; break-after: page; overflow: hidden; background: #071d33; color: #fff; }
.book-cover-image { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.book-cover-shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(4,21,38,.2) 0%, rgba(4,21,38,.5) 50%, rgba(4,21,38,.92) 100%); }
.book-cover-content { position: absolute; z-index: 2; left: 18mm; right: 18mm; bottom: 20mm; }
.book-cover-back .book-cover-content { bottom: 24mm; }
.cover-brand { margin: 0 0 5mm; font-size: 12pt; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
.cover-programme { margin: 0 0 8mm; font-size: 10pt; }
.book-cover h1 { margin: 0; color: #fff; font-size: 34pt; line-height: 1; }
.book-cover h1 span { display: block; margin-top: 5mm; font-size: 22pt; line-height: 1.12; max-width: 155mm; }
.book-cover h2 { color: #fff; font-size: 22pt; max-width: 155mm; }
.cover-type { display: inline-block; margin: 8mm 0 0; padding: 2.5mm 4mm; border-left: 3px solid #d8262e; background: rgba(7,29,51,.72); font-weight: 700; }
.cover-edition { margin-top: 6mm; font-size: 9.5pt; }
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
.book-figure { width: 100%; margin: 5mm 0 7mm; break-inside: avoid; }
.book-figure img { display: block; width: 100%; max-height: 150mm; object-fit: contain; border: 1px solid #c8d3dc; background: #fff; }
.book-figure figcaption { padding: 2.5mm 3mm; font-size: 8.5pt; line-height: 1.35; background: #f1f5f8; border-left: 3px solid #d8262e; }
.book-figure-technical-diagram img { max-height: 165mm; }
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
  visuals?: ResolvedBookVisualBundle;
  css?: string;
}): string {
  const { job, manuscript, visuals } = input;
  const css = input.css ?? DEFAULT_CSS;
  if (visuals && visuals.bookId !== job.bookId) {
    throw new Error(`Visual bundle book id mismatch: expected ${job.bookId}, received ${visuals.bookId}.`);
  }

  const frontCover = visuals?.visuals.find((visual) => visual.placement === "front-cover");
  const backCover = visuals?.visuals.find((visual) => visual.placement === "back-cover");
  const chapters = manuscript.chapters
    .map((chapter) =>
      renderChapter(
        chapter,
        visuals?.visuals.filter((visual) => visual.chapterId === chapter.chapterId) ?? [],
      ),
    )
    .join("");

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
${frontCover ? renderCover(frontCover, "front", job) : ""}
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
${backCover ? renderCover(backCover, "back", job) : ""}
</main>
</body>
</html>`;
}
