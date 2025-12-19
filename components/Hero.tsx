"use client";

import { useState } from "react";
import Footer from "./Footer";
import HeroHeader from "./HeroHeader";
import HeroCard from "./HeroCard";
import HeroContent from "./HeroContent";
import ProfileImage from "./ProfileImage";
import { useConfetti } from "./hooks/useConfetti";
import { useClickCounter } from "./hooks/useClickCounter";

export default function Hero() {
  const [isCooldown, setIsCooldown] = useState(false);
  const { triggerConfetti } = useConfetti();
  const { handleClick, isBouncing } = useClickCounter(
    () => triggerConfetti(setIsCooldown),
    isCooldown
  );

  return (
    <section className="min-h-screen flex flex-col items-center justify-start sm:justify-center px-6 sm:px-6 py-4 sm:py-8 md:py-12 lg:py-16 overflow-visible">
      <div className="max-w-4xl mx-auto w-full overflow-visible">
        <HeroHeader />

        <HeroCard>
          <ProfileImage
            onClick={handleClick}
            isBouncing={isBouncing}
            isCooldown={isCooldown}
          />
          <HeroContent />
        </HeroCard>

        <Footer />
      </div>
    </section>
  );
}
