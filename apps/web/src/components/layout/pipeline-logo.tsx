import Image from "next/image";

export function PipelineLogo({ size = 28 }: { size?: number }) {
  return (
    <Image
      src="/alphaci-logo.png"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      unoptimized
      style={{
        display: "block",
        width: size,
        height: size,
        borderRadius: Math.max(4, Math.round(size * 0.22)),
      }}
    />
  );
}
