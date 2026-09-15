import Image from "next/image";

export function PipelineLogo({ size = 28 }: Readonly<{ size?: number }>) {
  return (
    <Image
      src="/alphaci-logo.png"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      unoptimized
      className="block object-contain"
    />
  );
}

