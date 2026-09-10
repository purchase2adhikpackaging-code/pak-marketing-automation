import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell/app-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function ApplicationLayout({ children }: { children: ReactNode }) {
  const e2eAuthBypass = process.env.CI === "true" && process.env.E2E_AUTH_BYPASS === "true";

  if (!e2eAuthBypass) {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      redirect("/login");
    }
  }

  return <AppShell>{children}</AppShell>;
}
