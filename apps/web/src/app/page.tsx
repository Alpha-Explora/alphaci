import { redirect } from "next/navigation";

import LandingView from "@/features/public-site";
import { PUBLIC_SITE_ENABLED } from "@/shared/composition/build-profile";

export default function RootPage() {
  if (!PUBLIC_SITE_ENABLED) redirect("/login");

  return <LandingView />;
}
