import { redirect } from "next/navigation";

/**
 * Alphaexplora CI/CD Platform is an internal employee workspace — there is no
 * public landing page. The root path sends visitors straight to sign-in.
 *
 * We redirect to /login unconditionally rather than trying to detect an
 * existing session here: the session cookie is owned by the backend origin
 * (different host/port), so it is not readable from the frontend. The /login
 * page calls the backend `/auth/me` with credentials and bounces already
 * authenticated users on to /home.
 */
export default function RootPage() {
  redirect("/login");
}
