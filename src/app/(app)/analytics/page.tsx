import { B3_MODULE_READINESS } from "@/components/app-shell/module-readiness";
import { ModuleReadinessPage } from "@/components/app-shell/module-readiness-page";

export default function AnalyticsPage() {
  return <ModuleReadinessPage config={B3_MODULE_READINESS["/analytics"]} />;
}
