import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell/app-shell";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { canBypassAuthForE2E, E2E_AUTH_BYPASS_HEADER } from "@/modules/auth/e2e-bypass";

export default async function ApplicationLayout({ children }: { children: ReactNode }) {
  const requestHeaders = await headers();
  const e2eAuthBypass = canBypassAuthForE2E({
    nodeEnv: process.env.NODE_ENV,
    bypassEnabled: process.env.E2E_AUTH_BYPASS,
    headerValue: requestHeaders.get(E2E_AUTH_BYPASS_HEADER),
  });

  if (!e2eAuthBypass) {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      redirect("/login");
    }
  }

  return <AppShell>{children}</AppShell>;
}
