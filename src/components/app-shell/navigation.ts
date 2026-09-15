export type AppNavigationItem = {
  label: string;
  href: string;
};

export type AppNavigationGroup = {
  label: "Operational" | "Administration" | "Roadmap";
  items: readonly AppNavigationItem[];
};

export const APP_NAVIGATION_GROUPS: readonly AppNavigationGroup[] = [
  {
    label: "Operational",
    items: [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Content Studio", href: "/content-studio" },
      { label: "Scene Planning", href: "/scene-planning" },
      { label: "Media Library", href: "/media-library" },
      { label: "Knowledge Base", href: "/knowledge-base" },
      { label: "Approval Center", href: "/approval-center" },
    ],
  },
  {
    label: "Administration",
    items: [{ label: "Settings", href: "/settings" }],
  },
  {
    label: "Roadmap",
    items: [
      { label: "Publishing", href: "/publishing" },
      { label: "Content Calendar", href: "/content-calendar" },
      { label: "Analytics", href: "/analytics" },
      { label: "AI Representative", href: "/ai-representative" },
      { label: "Podcast", href: "/podcast" },
      { label: "Campus / Locations", href: "/campus-locations" },
      { label: "Student Testimonials", href: "/student-testimonials" },
      { label: "Manual Generation", href: "/manual-generation" },
    ],
  },
];

export const APP_NAVIGATION: readonly AppNavigationItem[] = APP_NAVIGATION_GROUPS.flatMap(
  (group) => group.items,
);

export function isNavigationItemActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  return href !== "/" && pathname.startsWith(`${href}/`);
}
