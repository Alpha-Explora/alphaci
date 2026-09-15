import type { AnchorHTMLAttributes, ReactNode } from "react";

export interface SkipLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  children?: ReactNode;
  href?: string;
}

export function SkipLink({
  children = "Skip to main content",
  className,
  href = "#main",
  ...props
}: Readonly<SkipLinkProps>) {
  const classNames = ["skip-link", className ?? ""].filter(Boolean).join(" ");

  return (
    <a className={classNames} href={href} {...props}>
      {children}
    </a>
  );
}

