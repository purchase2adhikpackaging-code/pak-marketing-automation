export type AppNavigationItem = {
  label: string;
  href: string;
};

export const APP_NAVIGATION: readonly AppNavigationItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Content Studio", href: "/content-studio" },
  { label: "Scene Planning", href: "/scene-planning" },
  { label: "AI Representative", href: "/ai-representative" },
  { label: "Campus / Locations", href: "/campus-locations" },
  { label: "Podcast", href: "/podcast" },
  { label: "Manual Generation", href: "/manual-generation" },
  { label: "Student Testimonials", href: "/student-testimonials" },
  { label: "Media Library", href: "/media-library" },
  { label: "Knowledge Base", href: "/knowledge-base" },
  { label: "Content Calendar", href: "/content-calendar" },
  { label: "Approval Center", href: "/approval-center" },
  { label: "Publishing", href: "/publishing" },
  { label: "Analytics", href: "/analytics" },
  { label: "Settings", href: "/settings" },
] as const;

export function isNavigationItemActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  return href !== "/" && pathname.startsWith(`${href}/`);
}
