import { ROLE_PERMISSIONS, type AppRole, type Permission } from "./roles";

export function can(role: AppRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
