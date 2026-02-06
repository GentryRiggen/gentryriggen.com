"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import AsciiArt from "./AsciiArt";
import CommandBlock from "./CommandBlock";
import { SKILLS, SOCIAL_LINKS } from "./constants";
import InteractivePrompt from "./InteractivePrompt";
import TerminalWindow from "./TerminalWindow";

/** Delay before the first command starts typing after MOTD appears */
const INITIAL_COMMAND_DELAY = 600;
/** Delay between each subsequent command */
const INTER_COMMAND_DELAY = 400;

export default function Terminal() {
  const [visibleCommands, setVisibleCommands] = useState(0);
  const [showMotd, setShowMotd] = useState(false);
  const [isBootComplete, setIsBootComplete] = useState(false);
  const [isCleared, setIsCleared] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleWindowClick = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  // Show MOTD after a small delay to simulate boot
  useEffect(() => {
    const timeout = setTimeout(() => setShowMotd(true), 300);
    return () => clearTimeout(timeout);
  }, []);

  const advanceCommand = useCallback(() => {
    setVisibleCommands((prev) => {
      const next = prev + 1;
      // Boot sequence has 5 commands (indices 0-4). When the 5th completes,
      // mark boot as done so the interactive prompt appears.
      if (next >= 5) {
        // Use a microtask to avoid setting state during render
        queueMicrotask(() => setIsBootComplete(true));
      }
      return next;
    });
  }, []);

  /** Called by InteractivePrompt when the user runs `clear` */
  const handleClear = useCallback(() => {
    setIsCleared(true);
  }, []);

  // When cleared, hide the boot sequence output and show only the interactive prompt
  const showBootContent = !isCleared;

  return (
    <TerminalWindow
      title="gentry@portfolio ~ (bash)"
      onClick={handleWindowClick}
    >
      {/* Boot / MOTD */}
      {showBootContent && showMotd && (
        <div className="mb-6 animate-fadeIn">
          <AsciiArt />
          <p className="mt-3 text-gray-500 dark:text-green-500/60 text-xs">
            Welcome to Gentry Riggen&apos;s portfolio terminal v1.0.0
          </p>
          <p className="text-gray-500 dark:text-green-500/60 text-xs">
            Last login:{" "}
            {new Date().toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          <div className="mt-2 mb-4 border-t border-gray-300 dark:border-green-500/20" />
        </div>
      )}

      {/* Command 1: whoami */}
      {showBootContent && showMotd && (
        <CommandBlock
          command="whoami"
          startDelay={INITIAL_COMMAND_DELAY}
          onComplete={advanceCommand}
        >
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-green-500/40 shrink-0">
              <Image
                src="/gentry-riggen_web Medium.jpeg"
                alt="Gentry Riggen"
                width={80}
                height={80}
                unoptimized
                className="object-cover w-full h-full"
              />
            </div>
            <div>
              <p className="text-green-600 dark:text-green-400 font-bold text-lg">
                Gentry Riggen
              </p>
              <p className="text-amber-600 dark:text-amber-400">
                Software Leader & Developer
              </p>
            </div>
          </div>
        </CommandBlock>
      )}

      {/* Command 2: cat bio.txt */}
      {showBootContent && visibleCommands >= 1 && (
        <CommandBlock
          command="cat bio.txt"
          startDelay={INTER_COMMAND_DELAY}
          onComplete={advanceCommand}
        >
          <p className="whitespace-pre-wrap leading-relaxed">
            🚀 I build products and lead teams using React, Next.js, Node.js,
            TypeScript, Tailwind CSS, Postgres, Prisma, GraphQL, Docker,
            Terraform, GitHub Actions, and more. These days I&apos;m focused on
            leading projects and empowering teams to ship exceptional work —
            while still getting my hands dirty with code. 💻
          </p>
        </CommandBlock>
      )}

      {/* Command 3: cat hobbies.txt */}
      {showBootContent && visibleCommands >= 2 && (
        <CommandBlock
          command="cat hobbies.txt"
          startDelay={INTER_COMMAND_DELAY}
          onComplete={advanceCommand}
        >
          <p className="whitespace-pre-wrap leading-relaxed">
            Off the clock, I&apos;m all about my family 👨‍👩‍👦‍👦 — hanging out with my
            beautiful wife and our two boys. When I&apos;m not with them, you&apos;ll
            find me at the CrossFit box 🏋️ or out on the golf course ⛳.
          </p>
        </CommandBlock>
      )}

      {/* Command 4: ls -la skills/ */}
      {showBootContent && visibleCommands >= 3 && (
        <CommandBlock
          command="ls -la skills/"
          startDelay={INTER_COMMAND_DELAY}
          onComplete={advanceCommand}
        >
          <div className="space-y-2">
            {SKILLS.map((group) => (
              <div key={group.category} className="flex flex-wrap gap-x-1">
                <span className="text-amber-600 dark:text-amber-400 w-28 shrink-0">
                  {group.category}/
                </span>
                <span className="text-gray-600 dark:text-gray-400">
                  {group.items.map((item, i) => (
                    <span key={item}>
                      <span className="text-green-600 dark:text-green-300">
                        {item}
                      </span>
                      {i < group.items.length - 1 && (
                        <span className="text-gray-400 dark:text-gray-600">
                          {" | "}
                        </span>
                      )}
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </CommandBlock>
      )}

      {/* Command 5: cat links.txt */}
      {showBootContent && visibleCommands >= 4 && (
        <CommandBlock
          command="cat links.txt"
          startDelay={INTER_COMMAND_DELAY}
          onComplete={advanceCommand}
        >
          <div className="space-y-1">
            {SOCIAL_LINKS.map((link) => (
              <div key={link.label} className="flex items-center gap-2">
                <span className="text-amber-600 dark:text-amber-400 w-12">
                  [{link.icon}]
                </span>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-600 dark:text-green-300 underline underline-offset-2 decoration-green-500/40 hover:decoration-green-500 hover:text-green-500 dark:hover:text-green-200 transition-colors"
                >
                  {link.url}
                </a>
              </div>
            ))}
          </div>
        </CommandBlock>
      )}

      {/* Interactive prompt — replaces the static BlinkingCursor */}
      {isBootComplete && (
        <div className="animate-fadeIn">
          <InteractivePrompt onClear={handleClear} inputRef={inputRef} />
        </div>
      )}
    </TerminalWindow>
  );
}
