export const APP_ROLES = ["OWNER", "ADMIN", "EDITOR", "REVIEWER", "ANALYST"] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const ALL_PERMISSIONS = [
  "settings:manage",
  "members:manage",
  "content:create",
  "content:edit",
  "content:approve",
  "publishing:manage",
  "analytics:view",
  "knowledge:view",
  "knowledge:manage",
  "knowledge:delete",
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<AppRole, readonly Permission[]> = {
  OWNER: ALL_PERMISSIONS,
  ADMIN: [
    "settings:manage",
    "members:manage",
    "content:create",
    "content:edit",
    "content:approve",
    "publishing:manage",
    "analytics:view",
    "knowledge:view",
    "knowledge:manage",
    "knowledge:delete",
  ],
  EDITOR: ["content:create", "content:edit", "analytics:view", "knowledge:view", "knowledge:manage"],
  REVIEWER: ["content:approve", "analytics:view", "knowledge:view"],
  ANALYST: ["analytics:view", "knowledge:view"],
};
