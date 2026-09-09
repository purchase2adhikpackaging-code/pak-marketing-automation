import type { AppRole } from "@/modules/auth/roles";

export type Organization = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
};

export type OrganizationMembership = {
  id: string;
  organizationId: string;
  userId: string;
  role: AppRole;
  createdAt: string;
  updatedAt: string;
};
