/** Outputs shared by the boot sequence and the matching commands. */

import Image from "next/image";
import { SKILLS, SOCIAL_LINKS } from "./constants";
import { LINK_CLASS } from "./styles";

export function Whoami() {
  return (
    <div className="flex flex-row gap-4 items-center">
      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 border-term-accent/50 shrink-0">
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
        <p className="text-term-fg font-bold text-lg">Gentry Riggen</p>
        <p className="text-term-accent">Software Leader &amp; Developer</p>
      </div>
    </div>
  );
}

export function Bio() {
  return (
    <p className="leading-relaxed">
      🚀 I build products and lead teams. These days I&apos;m focused on leading
      projects and empowering teams to ship exceptional work — while still
      getting my hands dirty with code. 💻
    </p>
  );
}

export function Skills() {
  return (
    <div className="space-y-1.5">
      {SKILLS.map((group) => (
        <div key={group.category} className="flex flex-wrap gap-x-1">
          <span className="text-term-key w-28 shrink-0">{group.category}/</span>
          <span>
            {group.items.map((item, i) => (
              <span key={item}>
                <span className="text-term-fg">{item}</span>
                {i < group.items.length - 1 && (
                  <span className="text-term-faint">{" · "}</span>
                )}
              </span>
            ))}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Links() {
  return (
    <div className="space-y-1">
      {SOCIAL_LINKS.map((link) => (
        <div key={link.label} className="flex items-center gap-2">
          <span className="text-term-key w-12">[{link.icon}]</span>
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`${LINK_CLASS} break-all`}
          >
            {link.url}
          </a>
        </div>
      ))}
    </div>
  );
}

export function HireMe() {
  return (
    <div className="space-y-2">
      <p>Awesome! Let&apos;s connect.</p>
      <Links />
      <p>
        I&apos;m always open to interesting opportunities and conversations.
        Don&apos;t be a stranger!
      </p>
    </div>
  );
}
