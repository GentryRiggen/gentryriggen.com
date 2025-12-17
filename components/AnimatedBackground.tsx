"use client";

import { useState, useEffect, useRef } from "react";

export default function AnimatedBackground() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({
        x: (e.clientX / window.innerWidth) * 2 - 1, // Normalize to -1 to 1
        y: (e.clientY / window.innerHeight) * 2 - 1,
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Different parallax intensities for each orb (in pixels) - subtle effect
  // Some orbs move in opposite direction for more dynamic effect
  const parallaxIntensities = [60, -45, 75, -36, 54, -30, 48];

  const getParallaxStyle = (intensity: number) => {
    const offsetX = mousePosition.x * intensity;
    const offsetY = mousePosition.y * intensity;
    return {
      transform: `translate(${offsetX}px, ${offsetY}px)`,
      transition: "transform 0.05s ease-out",
      willChange: "transform",
    };
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-0 overflow-hidden pointer-events-none"
    >
      {/* Large floating gradient orbs */}
      <div
        className="absolute animate-float-1"
        style={getParallaxStyle(parallaxIntensities[0])}
      >
        <div className="w-[600px] h-[600px] bg-gradient-to-br from-purple-500/40 via-pink-500/30 to-orange-500/40 rounded-full blur-3xl dark:from-purple-600/30 dark:via-pink-600/25 dark:to-orange-600/30 animate-float-1-inner" />
      </div>
      <div
        className="absolute animate-float-2"
        style={getParallaxStyle(parallaxIntensities[1])}
      >
        <div className="w-[500px] h-[500px] bg-gradient-to-br from-blue-500/40 via-cyan-500/35 to-teal-500/40 rounded-full blur-3xl dark:from-blue-600/30 dark:via-cyan-600/25 dark:to-teal-600/30 animate-float-2-inner" />
      </div>
      <div
        className="absolute animate-float-3"
        style={getParallaxStyle(parallaxIntensities[2])}
      >
        <div className="w-[700px] h-[700px] bg-gradient-to-br from-indigo-500/35 via-violet-500/30 to-fuchsia-500/35 rounded-full blur-3xl dark:from-indigo-600/25 dark:via-violet-600/20 dark:to-fuchsia-600/25 animate-float-3-inner" />
      </div>

      {/* Medium floating orbs */}
      <div
        className="absolute animate-float-4"
        style={getParallaxStyle(parallaxIntensities[3])}
      >
        <div className="w-[400px] h-[400px] bg-gradient-to-br from-green-500/35 via-emerald-500/30 to-teal-500/35 rounded-full blur-3xl dark:from-green-600/25 dark:via-emerald-600/20 dark:to-teal-600/25 animate-float-4-inner" />
      </div>
      <div
        className="absolute animate-float-5"
        style={getParallaxStyle(parallaxIntensities[4])}
      >
        <div className="w-[350px] h-[350px] bg-gradient-to-br from-rose-500/35 via-pink-500/30 to-purple-500/35 rounded-full blur-3xl dark:from-rose-600/25 dark:via-pink-600/20 dark:to-purple-600/25 animate-float-5-inner" />
      </div>

      {/* Smaller accent orbs */}
      <div
        className="absolute animate-float-6"
        style={getParallaxStyle(parallaxIntensities[5])}
      >
        <div className="w-[300px] h-[300px] bg-gradient-to-br from-amber-500/30 via-orange-500/25 to-red-500/30 rounded-full blur-2xl dark:from-amber-600/20 dark:via-orange-600/15 dark:to-red-600/20 animate-float-6-inner" />
      </div>
      <div
        className="absolute animate-float-7"
        style={getParallaxStyle(parallaxIntensities[6])}
      >
        <div className="w-[250px] h-[250px] bg-gradient-to-br from-cyan-500/30 via-blue-500/25 to-indigo-500/30 rounded-full blur-2xl dark:from-cyan-600/20 dark:via-blue-600/15 dark:to-indigo-600/20 animate-float-7-inner" />
      </div>
    </div>
  );
}
