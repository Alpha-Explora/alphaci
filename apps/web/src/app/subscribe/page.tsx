import { redirect } from "next/navigation";

/**
 * Alphaexplora CI/CD Platform is an internal employee workspace: every user is
 * a verified company GitHub org member and is fully entitled, so there is no
 * billing/subscription surface. This route is retained only to neutralize any
 * legacy links — it redirects straight to the workspace.
 */
export default function SubscribePage() {
  redirect("/home");
}
