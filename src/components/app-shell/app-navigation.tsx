"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAVIGATION, isNavigationItemActive } from "./navigation";

export function AppNavigation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="min-h-11 rounded-lg border border-slate-700 px-4 text-sm font-medium text-slate-100 lg:hidden"
        aria-expanded={open}
        aria-controls="primary-navigation"
        aria-label={open ? "Close navigation" : "Open navigation"}
        onClick={() => setOpen((value) => !value)}
      >
        Menu
      </button>
      <nav
        id="primary-navigation"
        aria-label="Primary"
        className={`${open ? "grid" : "hidden"} gap-1 pt-4 lg:grid lg:pt-0`}
      >
        {APP_NAVIGATION.map((item) => {
          const active = isNavigationItemActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              onClick={() => setOpen(false)}
              className={
                active
                  ? "rounded-lg bg-slate-800 px-3 py-2.5 text-sm font-medium text-white"
                  : "rounded-lg px-3 py-2.5 text-sm text-slate-300 transition hover:bg-slate-800 hover:text-white"
              }
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
