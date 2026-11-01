import Image from "next/image";

import type { useAuthSession } from "@/features/auth/session";

type SettingsSession = ReturnType<typeof useAuthSession>["session"];

export function settingsAvatarInitial(
  session: SettingsSession,
): string {
  return (session?.user.name ?? session?.user.login ?? "U")
    .slice(0, 1)
    .toUpperCase();
}

export function SettingsUserAvatar({
  session,
  size,
  fontSize,
}: Readonly<{
  session: SettingsSession;
  size: number;
  fontSize: string;
}>) {
  if (session?.user.avatarUrl) {
    return (
      <Image
        src={session.user.avatarUrl}
        alt={session.user.name ?? session.user.login}
        width={size}
        height={size}
        style={{
          borderRadius: "50%",
          display: "block",
          border: "2px solid var(--bg-base)",
        }}
        unoptimized
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "50%",
        background: "var(--bg-elevated)",
        color: "var(--brand)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize,
        fontWeight: 700,
        border: "2px solid var(--bg-base)",
      }}
    >
      {settingsAvatarInitial(session)}
    </span>
  );
}
