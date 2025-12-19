"use client";

import Image from "next/image";
import { useRef } from "react";

interface ProfileImageProps {
  onClick: () => void;
  isBouncing: boolean;
  isCooldown: boolean;
}

export default function ProfileImage({
  onClick,
  isBouncing,
  isCooldown,
}: ProfileImageProps) {
  const imageContainerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      ref={imageContainerRef}
      onClick={onClick}
      className={`relative w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40 shrink-0 rounded-xl sm:rounded-2xl overflow-hidden ring-1 ring-gray-400/30 dark:ring-white/20 mx-auto md:mx-0 cursor-pointer transition-transform duration-200 hover:scale-105 ${
        isBouncing
          ? isCooldown
            ? "animate-shake-no"
            : "animate-bounce-click"
          : ""
      }`}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label="Click me three times for a surprise!"
    >
      <Image
        src="/gentry-riggen_web Medium.jpeg"
        alt="Gentry Riggen"
        fill
        className="object-cover"
        priority
      />
    </div>
  );
}
