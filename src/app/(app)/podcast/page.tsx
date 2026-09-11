import { B3_MODULE_READINESS } from "@/components/app-shell/module-readiness";
import { ModuleReadinessPage } from "@/components/app-shell/module-readiness-page";

export default function PodcastPage() {
  return <ModuleReadinessPage config={B3_MODULE_READINESS["/podcast"]} />;
}
