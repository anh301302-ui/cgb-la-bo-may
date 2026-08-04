"use client";

import Image from "next/image";

export function Logo({ size = 40, showText = true }: { size?: number; showText?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="logo-glow" style={{ width: size, height: size }}>
        <Image
          src="/logo.webp"
          alt="Logo"
          width={size}
          height={size}
          className="object-contain"
          priority
        />
      </div>
      {showText && (
        <span className="font-serif text-lg tracking-[0.2em] text-ink-text uppercase">
          Boost
        </span>
      )}
    </div>
  );
}
