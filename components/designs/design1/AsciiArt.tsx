"use client";

export default function AsciiArt() {
  const art = `
 ██████╗ ███████╗███╗   ██╗████████╗██████╗ ██╗   ██╗
██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝██╔══██╗╚██╗ ██╔╝
██║  ███╗█████╗  ██╔██╗ ██║   ██║   ██████╔╝ ╚████╔╝
██║   ██║██╔══╝  ██║╚██╗██║   ██║   ██╔══██╗  ╚██╔╝
╚██████╔╝███████╗██║ ╚████║   ██║   ██║  ██║   ██║
 ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚═╝  ╚═╝   ╚═╝
  `.trim();

  return (
    <pre
      className="text-green-600 dark:text-green-400 text-[0.45rem] sm:text-[0.55rem] md:text-xs leading-tight select-none overflow-x-auto"
      aria-hidden="true"
    >
      {art}
    </pre>
  );
}
