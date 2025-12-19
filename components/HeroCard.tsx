"use client";

import { ReactNode } from "react";

interface HeroCardProps {
  children: ReactNode;
}

export default function HeroCard({ children }: HeroCardProps) {
  return (
    <div className="bg-gray-100/80 dark:bg-white/5 backdrop-blur-sm border border-gray-300/50 dark:border-white/10 rounded-2xl sm:rounded-3xl p-8 sm:p-8 md:p-10 lg:p-12 mb-6 md:mb-8">
      <div className="flex flex-col md:flex-row gap-5 sm:gap-6 md:gap-6 lg:gap-8 items-start">
        {children}
      </div>
    </div>
  );
}
