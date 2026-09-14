export const MAX_RESEARCH_QUERY_CHARS = 300;
export const MAX_RESEARCH_RESULTS = 8;
export const MAX_RESEARCH_TITLE_CHARS = 500;
export const MAX_RESEARCH_URL_CHARS = 2048;
export const MAX_RESEARCH_HOST_CHARS = 255;
export const MAX_RESEARCH_EXCERPT_CHARS = 4000;
export const RESEARCH_PROVIDER_TIMEOUT_MS = 12_000;

export type ResearchRunStatus = "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED";
export type ResearchCandidateStatus = "SUGGESTED" | "CONVERTED" | "DISMISSED";
export type ResearchProvider = "EXA_MCP";
