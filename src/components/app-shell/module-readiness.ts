export type ModuleReadinessStatus = "Planned" | "Foundation only";

export type ImplementedWorkflowHref = "/dashboard" | "/content-studio" | "/knowledge-base" | "/settings";

export type B3ModuleRoute =
  | "/media-library"
  | "/manual-generation"
  | "/ai-representative"
  | "/campus-locations"
  | "/podcast"
  | "/student-testimonials"
  | "/content-calendar"
  | "/approval-center"
  | "/publishing"
  | "/analytics";

export type ModuleReadinessLink = {
  href: ImplementedWorkflowHref;
  label: string;
};

export type ModuleReadinessConfig = {
  route: B3ModuleRoute;
  title: string;
  description: string;
  status: ModuleReadinessStatus;
  roadmapPhase: string;
  explanation: string;
  dependency: string;
  relatedLinks: readonly ModuleReadinessLink[];
};

export const B3_MODULE_READINESS = {
  "/media-library": {
    route: "/media-library",
    title: "Media Library",
    description: "Catalog reusable and generated media assets with tenant-safe storage references and provenance.",
    status: "Foundation only",
    roadmapPhase: "Phase 8",
    explanation:
      "Storage and media-reference foundations exist, but the operator asset catalogue and upload workflow are not enabled in this release.",
    dependency:
      "Media operations follow Scene Planning and the approved media-generation workflow. Use implemented content and knowledge workflows until that operator surface is released.",
    relatedLinks: [
      { href: "/content-studio", label: "Open Content Studio" },
      { href: "/knowledge-base", label: "Open Knowledge Base" },
    ],
  },
  "/manual-generation": {
    route: "/manual-generation",
    title: "Manual Generation",
    description: "Launch controlled one-off generation workflows outside recurring scheduler automation.",
    status: "Foundation only",
    roadmapPhase: "Phase 17",
    explanation:
      "The dedicated one-off generation workspace is not enabled yet. Content Studio is the supported generation path in the current release.",
    dependency:
      "Manual generation will reuse approved provider, authorization, grounding, and artifact controls after its roadmap phase is implemented.",
    relatedLinks: [
      { href: "/content-studio", label: "Open Content Studio" },
      { href: "/settings", label: "Open Settings" },
    ],
  },
  "/ai-representative": {
    route: "/ai-representative",
    title: "AI Representative",
    description: "Configure and supervise AI-assisted representative content and controlled interaction workflows.",
    status: "Planned",
    roadmapPhase: "Phase 13",
    explanation: "AI representative interactions are not active in the current release.",
    dependency:
      "This module depends on approved content, controlled knowledge, and later representative-specific authorization and interaction workflows.",
    relatedLinks: [
      { href: "/content-studio", label: "Open Content Studio" },
      { href: "/knowledge-base", label: "Open Knowledge Base" },
    ],
  },
  "/campus-locations": {
    route: "/campus-locations",
    title: "Campus / Locations",
    description: "Manage approved PAK campus and location identities used across knowledge and visual continuity workflows.",
    status: "Planned",
    roadmapPhase: "Phase 15",
    explanation: "Campus and location management is not active in the current release.",
    dependency:
      "The module requires its approved location data model and lifecycle before operators can manage campus identities here.",
    relatedLinks: [{ href: "/knowledge-base", label: "Open Knowledge Base" }],
  },
  "/podcast": {
    route: "/podcast",
    title: "Podcast",
    description: "Plan, generate, review, and schedule podcast-oriented content and media assets.",
    status: "Planned",
    roadmapPhase: "Phase 14",
    explanation: "Podcast generation and episode operations are not active in the current release.",
    dependency:
      "Podcast operations depend on approved content plus later audio/media generation and review workflows.",
    relatedLinks: [
      { href: "/content-studio", label: "Open Content Studio" },
      { href: "/knowledge-base", label: "Open Knowledge Base" },
    ],
  },
  "/student-testimonials": {
    route: "/student-testimonials",
    title: "Student Testimonials",
    description: "Manage testimonial source material, approvals, generation, and reusable testimonial media.",
    status: "Planned",
    roadmapPhase: "Phase 16",
    explanation: "Testimonial management is not active in the current release.",
    dependency:
      "This workflow requires the approved testimonial consent and source-governance model before testimonial content can be managed here.",
    relatedLinks: [
      { href: "/knowledge-base", label: "Open Knowledge Base" },
      { href: "/content-studio", label: "Open Content Studio" },
    ],
  },
  "/content-calendar": {
    route: "/content-calendar",
    title: "Content Calendar",
    description: "Coordinate planned content, recurring schedules, approvals, and downstream publishing timing.",
    status: "Planned",
    roadmapPhase: "Phase 11",
    explanation: "Calendar scheduling is not active in the current release.",
    dependency:
      "Scheduling depends on the later Approval and Publishing workflows. Current content work remains in Content Studio.",
    relatedLinks: [
      { href: "/content-studio", label: "Open Content Studio" },
      { href: "/dashboard", label: "Open Dashboard" },
    ],
  },
  "/approval-center": {
    route: "/approval-center",
    title: "Approval Center",
    description: "Review scripts, translations, scenes, renders, and publishing copy with auditable decisions.",
    status: "Planned",
    roadmapPhase: "Phase 9",
    explanation: "The auditable approval workflow is not active in the current release.",
    dependency:
      "Approval Center follows the scene/render workflow and will be enabled only when approval records and role-specific decisions are implemented.",
    relatedLinks: [
      { href: "/content-studio", label: "Open Content Studio" },
      { href: "/knowledge-base", label: "Open Knowledge Base" },
    ],
  },
  "/publishing": {
    route: "/publishing",
    title: "Publishing",
    description: "Manage approved publication schedules, platform adapters, attempts, external identifiers, and publish outcomes.",
    status: "Planned",
    roadmapPhase: "Phase 10",
    explanation: "External publishing is not active in the current release.",
    dependency:
      "Publishing requires the later Approval workflow and approved platform integration adapters before any content can be sent externally.",
    relatedLinks: [
      { href: "/settings", label: "Open Settings" },
      { href: "/content-studio", label: "Open Content Studio" },
    ],
  },
  "/analytics": {
    route: "/analytics",
    title: "Analytics",
    description: "Track normalized performance metrics linked back to generated content, publishing records, and source workflows.",
    status: "Planned",
    roadmapPhase: "Phase 12",
    explanation: "Publishing performance analytics are not active in the current release.",
    dependency:
      "Analytics requires real publishing outcomes and normalized metric ingestion. No performance values are shown until those data sources exist.",
    relatedLinks: [
      { href: "/dashboard", label: "Open Dashboard" },
      { href: "/content-studio", label: "Open Content Studio" },
    ],
  },
} satisfies Record<B3ModuleRoute, ModuleReadinessConfig>;
