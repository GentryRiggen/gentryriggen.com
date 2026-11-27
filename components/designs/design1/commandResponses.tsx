/**
 * Command response definitions for the interactive terminal.
 *
 * Each recognized command maps to either a static string/JSX-friendly string,
 * or a function that returns one. Unrecognized commands pull from a pool of
 * witty fallback messages.
 */

import { type ReactNode } from "react";
import About from "./About";
import SideProjects from "./SideProjects";
import { Bio, HireMe, Links, Skills, Whoami } from "./Sections";
import { GAMES, gameForCommand, type Game } from "./games";
import { LINK_CLASS } from "./styles";
import ThemePicker from "./ThemePicker";
import { TERMINAL_THEMES, findTerminalTheme } from "./terminalTheme";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The result of processing a user command */
export interface CommandResult {
  /** The response text/lines to display (string or JSX) */
  output: ReactNode;
  /** If true, the caller should clear all previous output */
  shouldClear: boolean;
  /** If true, the caller should fire a confetti burst */
  shouldConfetti?: boolean;
  /** If set, the caller should navigate here shortly after showing the output */
  navigateTo?: string;
  /** If set, the caller should switch the terminal to this theme id */
  terminalTheme?: string;
}

// ---------------------------------------------------------------------------
// Boot commands (used for `history`)
// ---------------------------------------------------------------------------

export const BOOT_COMMANDS = [
  "whoami",
  "cat bio.txt",
  "cat about.txt",
  "ls ~/side-projects/",
  "cat skills.md",
  "cat links.txt",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function currentDateString(): string {
  return new Date().toString();
}

function fakeUptime(): string {
  const days = Math.floor(Math.random() * 365) + 30;
  const hours = Math.floor(Math.random() * 24);
  const mins = Math.floor(Math.random() * 60);
  return ` ${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}:${String(new Date().getSeconds()).padStart(2, "0")} up ${days} days, ${hours}:${String(mins).padStart(2, "0")}, 1 user, load average: 0.42, 0.37, 0.31`;
}

// ---------------------------------------------------------------------------
// Unrecognized-command fallbacks
// ---------------------------------------------------------------------------

const UNKNOWN_RESPONSES: readonly string[] = [
  "Command not found. Have you tried turning it off and on again?",
  "I don't know that one, but try 'help' for available commands.",
  "404: Command not found. But you found a great portfolio!",
  "That command is still in beta. Try 'help' instead.",
  "Hmm, my neural network doesn't recognize that. Try 'help'?",
  "I'm a portfolio terminal, not a supercomputer... yet.",
  "Error: ENOENT - No such command or file. But 'help' works!",
  "Unknown command. But I appreciate your curiosity! Type 'help'.",
  "Segmentation fault (just kidding). Try 'help'.",
  "$> command not found. Try 'hire me' instead.",
  "I asked ChatGPT and even it doesn't know that command.",
  "That command requires a firmware update. Try 'help' in the meantime.",
  "Permission denied. Just kidding - I just don't know that one.",
  "Kernel panic! Not really. But I don't know that command.",
  "ECONNREFUSED to that command. 'help' might guide you.",
  "Loading... just kidding. Command not found.",
  "My quantum processor can't resolve that. Try 'help'.",
  "In a parallel universe, that command might work.",
  "The hamsters powering this terminal don't recognize that.",
  "That's above my pay grade. I'm just a portfolio terminal.",
  "Have you tried 'help'? It's a real page-turner.",
  "I'll add that to my backlog. Sprint 47, maybe.",
  "ERROR 418: I'm a teapot. Also, unknown command.",
  "That's not in my PATH. But 'help' always is.",
  "Compiling... just kidding, I have no idea what that is.",
  "Runtime exception: FunCommandNotFoundError",
  "beep boop... does not compute. Try 'help'!",
  "I'm flattered you think I can do that.",
  "My documentation says nothing about that. Type 'help'.",
  "I've searched my entire 1MB of RAM. Nothing found.",
  "Oops, that command fell into /dev/null.",
  "My magic 8-ball says: 'Command not found. Try again later.'",
];

const SUDO_RESPONSES: readonly string[] = [
  "sudo? I don't even know you!",
  "Access denied. Root privileges require a job offer first.",
  "Nice try! sudo access is reserved for production servers.",
  "Permission denied. Try 'sudo hire me' instead.",
  "You're not in the sudoers file. This incident will be reported.",
  "Root access? In this economy?",
];

const EDITOR_RESPONSES: readonly string[] = [
  "vim: I'd tell you how to quit, but nobody knows.",
  "nano: The friendlier editor. But this terminal is friendlier still.",
  "emacs: Great OS, just needs a good text editor.",
  "Editor wars? I prefer 'Ctrl+Z' in life.",
  "Opening editor... just kidding, this is a portfolio.",
];

const FORTUNE_RESPONSES: readonly string[] = [
  "A wise programmer once said: 'It works on my machine.'",
  "Your code will compile on the first try today. (Just kidding.)",
  "The best time to refactor was yesterday. The second best time is now.",
  "In the land of spaghetti code, the man with clean functions is king.",
  "Today's fortune: You will find the bug in the last place you look.",
  "A semicolon saved is a semicolon earned.",
  "There are only two hard things in CS: cache invalidation, naming things, and off-by-one errors.",
  "Weeks of coding can save you hours of planning.",
  "It's not a bug, it's a feature request.",
  "Keep calm and git commit.",
];

const MAN_RESPONSES: readonly string[] = [
  "MAN(ual) PAGE: This terminal is designed to impress, not to compute.\nFor real documentation, try hiring me.",
  "RTFM? There is no FM. Just type 'help' and explore.",
  "man: No manual entry found. But 'help' is always there for you.",
];

// ---------------------------------------------------------------------------
// Help text
// ---------------------------------------------------------------------------

const CONFETTI_RESPONSES: readonly string[] = [
  "Time to celebrate! You found the party command!",
  "Woohoo! Confetti cannons activated!",
  "It's raining confetti! Quick, make a wish!",
  "Party mode: ENGAGED.",
  "This calls for a celebration!",
  "Achievement unlocked: Party Animal!",
];

const HELP_LEFT = 17;

const HELP_TEXT = `Available commands (a leading / works too):
${[
  ["help", "Show this help message"],
  ["whoami", "Who's this guy?"],
  ["bio", "Read bio"],
  ["about", "Life off the clock"],
  ["games", "List my side projects"],
  ["skills", "Show skills"],
  ["links", "Show social links"],
  ["hire me", "Get in touch"],
  ...GAMES.map((game) => [game.command, game.help]),
  ["ls", "List directory contents"],
  ["pwd", "Print working directory"],
  ["date", "Show current date/time"],
  ["uptime", "Show system uptime"],
  ["history", "Show command history"],
  ["cat <file>", "Read a file (try: resume.pdf)"],
  ["echo <msg>", "Echo a message"],
  ["clear", "Clear terminal output"],
  ["ping", "Ping-pong"],
  ["curl", "Try fetching something"],
  ["neofetch", "System information"],
  ["cowsay", "A cow says things"],
  ["fortune", "Get a random fortune"],
  ["weather", "Check the weather"],
  ["coffee", "Brew some coffee"],
  ["matrix", "Enter the matrix"],
  ["confetti", "Celebrate!"],
  ["/theme", "Change the color theme"],
  ["claude", "Start Claude Code"],
  ["/model", "Pick a model"],
  ["/cost", "See what this session cost"],
  ["git status", "Check repository status"],
  ["git blame", "Find out who did it"],
  ["exit", "Try to leave"],
  ["", ""],
  ["vim/nano/emacs", "Start an editor (or not)"],
  ["sudo <cmd>", "Run as root (good luck)"],
]
  .map(([cmd, text]) => (cmd ? `  ${cmd.padEnd(HELP_LEFT)}${text}` : ""))
  .join("\n")}`;

// ---------------------------------------------------------------------------
// Neofetch output
// ---------------------------------------------------------------------------

const NEOFETCH_OUTPUT = `       _,met\$\$\$\$\$gg.          gentry@portfolio
    ,g\$\$\$\$\$\$\$\$\$\$\$\$\$\$p.       ----------------
  ,g\$\$P"     """Y\$\$."$.      OS: PortfolioOS 1.0.0
 ,\$\$P'              \`\$\$\$.    Host: gentryriggen.com
',\$\$P       ,ggs.     \`\$\$b:  Kernel: Next.js 16.x
\`d\$\$'     ,\$P"'   .    \$\$\$  Shell: React 19.x
 \$\$P      d\$'     ,    \$\$P  DE: Tailwind CSS 4.x
 \$\$:      \$\$.   -    ,d\$\$'  Terminal: Portfolio Terminal
 \$\$;      Y\$b._   _,d\$P'   CPU: TypeScript @ 5.x GHz
 Y\$\$.    \`.\`"Y\$\$\$\$P"'      Memory: Unlimited Passion
 \`\$\$b      "-.__           Uptime: Always shipping
  \`Y\$\$                     Packages: npm (way too many)
   \`Y\$\$.
     \`\$\$b.
       \`Y\$\$b.
          \`"Y\$b._`;

// ---------------------------------------------------------------------------
// Cowsay
// ---------------------------------------------------------------------------

function cowsay(message: string): string {
  const border = "-".repeat(message.length + 2);
  return ` ${border}
< ${message} >
 ${border}
        \\   ^__^
         \\  (oo)\\_______
            (__)\\       )\\/\\
                ||----w |
                ||     ||`;
}

const COWSAY_MESSAGES: readonly string[] = [
  "Moo! Hire this guy!",
  "I'm a cow in a terminal. Life is good.",
  "TypeScript is udderly amazing.",
  "This portfolio is legen-dairy.",
  "Got milk? Got code? Got hired?",
];

// ---------------------------------------------------------------------------
// Coffee ASCII art
// ---------------------------------------------------------------------------

const COFFEE_ART = `    ( (
     ) )
  .______.
  |      |]
  \\      /
   \`----'

  Brewing fresh coffee...
  Your mass is ready! Best enjoyed with clean code.`;

// ---------------------------------------------------------------------------
// Rich JSX output for boot-sequence commands
// ---------------------------------------------------------------------------

function gameOutput(game: Game): ReactNode {
  return (
    <div className="space-y-1">
      <p>{game.blurb}</p>
      <p>
        {game.launch}{" "}
        <a href={game.href} className={LINK_CLASS}>
          {game.href}
        </a>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Command matching & response
// ---------------------------------------------------------------------------

/**
 * Process a user command and return the appropriate response.
 *
 * @param rawInput - The raw string the user typed
 * @param commandHistory - The list of previously executed commands (for `history`)
 */
export function getCommandResponse(
  rawInput: string,
  commandHistory: readonly string[]
): CommandResult {
  // Claude Code style slash commands: `/help` is `help`.
  const trimmed = rawInput.trim().replace(/^\/(?=\S)/, "");
  const lower = trimmed.toLowerCase();

  // Empty input
  if (trimmed === "") {
    return { output: "", shouldClear: false };
  }

  // --- clear ---
  if (lower === "clear") {
    return { output: "", shouldClear: true };
  }

  // --- help ---
  if (lower === "help" || lower === "--help" || lower === "-h") {
    return { output: HELP_TEXT, shouldClear: false };
  }

  // --- games ---
  const game = gameForCommand(lower);
  if (game) {
    return {
      output: gameOutput(game),
      shouldClear: false,
      navigateTo: game.href,
    };
  }

  // --- side projects ---
  if (
    [
      "games",
      "projects",
      "side-projects",
      "ls ~/side-projects/",
      "ls ~/side-projects",
      "ls side-projects",
      "ls side-projects/",
      "cat hobbies.txt",
    ].includes(lower)
  ) {
    const output =
      lower === "cat hobbies.txt" ? (
        <div className="space-y-3">
          <About />
          <SideProjects />
        </div>
      ) : (
        <SideProjects />
      );
    return { output, shouldClear: false };
  }

  // --- skills ---
  if (
    [
      "skills",
      "ls -la skills/",
      "ls skills/",
      "ls skills",
      "cat skills.md",
    ].includes(lower)
  ) {
    return { output: <Skills />, shouldClear: false };
  }

  // --- bio / about / links ---
  if (lower === "bio" || lower === "cat bio.txt") {
    return { output: <Bio />, shouldClear: false };
  }
  if (lower === "about" || lower === "cat about.txt") {
    return { output: <About />, shouldClear: false };
  }
  if (lower === "links" || lower === "cat links.txt") {
    return { output: <Links />, shouldClear: false };
  }

  // --- theme ---
  if (lower === "theme" || lower === "themes") {
    return { output: <ThemePicker />, shouldClear: false };
  }
  if (lower.startsWith("theme ")) {
    const theme = findTerminalTheme(trimmed.slice(6));
    if (!theme) {
      return {
        output: `theme: no theme called '${trimmed.slice(6).trim()}'. Try: ${TERMINAL_THEMES.map((t) => t.id).join(", ")}`,
        shouldClear: false,
      };
    }
    return {
      output: `Theme set to ${theme.name}.`,
      shouldClear: false,
      terminalTheme: theme.id,
    };
  }

  // --- Claude Code jokes ---
  if (lower === "claude" || lower === "claude code") {
    return {
      output:
        "You're already in it. This whole page is the session; I'm just the one typing.",
      shouldClear: false,
    };
  }
  if (lower === "model" || lower.startsWith("model ")) {
    return {
      output:
        "Current model: gentry-1 (handcrafted, caffeinated, occasionally hallucinates golf scores).",
      shouldClear: false,
    };
  }
  if (lower === "cost") {
    return {
      output:
        "Total cost:            $0.00\nTotal duration (wall): however long you've been reading\nCoffee consumed:       3 cups",
      shouldClear: false,
    };
  }
  if (lower === "ultrathink" || lower === "think harder") {
    return {
      output:
        "✻ Thinking very hard...\n\nConclusion: you should probably hire me.",
      shouldClear: false,
    };
  }

  // --- ls ---
  if (
    lower === "ls" ||
    lower === "ls -la" ||
    lower === "ls -al" ||
    lower === "ll" ||
    lower === "dir"
  ) {
    return {
      output: `total 42
drwxr-xr-x  8 gentry staff  256 ${new Date().toLocaleDateString()}  .
drwxr-xr-x  3 gentry staff   96 ${new Date().toLocaleDateString()}  ..
-rw-r--r--  1 gentry staff  420 ${new Date().toLocaleDateString()}  about.txt
-rw-r--r--  1 gentry staff  512 ${new Date().toLocaleDateString()}  bio.txt
-rw-r--r--  1 gentry staff  256 ${new Date().toLocaleDateString()}  links.txt
-rw-r--r--  1 gentry staff 1337 ${new Date().toLocaleDateString()}  resume.pdf
drwxr-xr-x  ${GAMES.length + 2} gentry staff  192 ${new Date().toLocaleDateString()}  side-projects/
-rw-r--r--  1 gentry staff  128 ${new Date().toLocaleDateString()}  skills.md`,
      shouldClear: false,
    };
  }

  // --- cd ---
  if (lower === "cd" || lower.startsWith("cd ")) {
    return {
      output:
        "Nice try, but this is a single-page app. No directories to change to!",
      shouldClear: false,
    };
  }

  // --- sudo ---
  if (lower.startsWith("sudo")) {
    return { output: pickRandom(SUDO_RESPONSES), shouldClear: false };
  }

  // --- rm -rf ---
  if (lower.includes("rm -rf") || lower.includes("rm -r")) {
    return {
      output: "Nice try! This portfolio is protected by plot armor.",
      shouldClear: false,
    };
  }

  // --- exit ---
  if (lower === "exit" || lower === "quit" || lower === "logout") {
    return {
      output:
        "You can check out any time you like, but you can never leave...\n(Hotel California playing in the background)",
      shouldClear: false,
    };
  }

  // --- pwd ---
  if (lower === "pwd") {
    return { output: "/home/gentry/portfolio", shouldClear: false };
  }

  // --- whoami ---
  if (lower === "whoami") {
    return { output: <Whoami />, shouldClear: false };
  }

  // --- date ---
  if (lower === "date") {
    return { output: currentDateString(), shouldClear: false };
  }

  // --- cat resume.pdf ---
  if (
    lower === "cat resume.pdf" ||
    lower === "cat resume" ||
    lower === "open resume.pdf"
  ) {
    return {
      output:
        "I'd love to chat! Reach out on LinkedIn:\nhttps://linkedin.com/in/gentryriggen",
      shouldClear: false,
    };
  }

  // --- cat (other files) ---
  if (lower.startsWith("cat ")) {
    const file = trimmed.slice(4).trim();
    if (file === "about.md") {
      return {
        output:
          "# About Gentry Riggen\n\nSoftware leader and developer passionate about building great\nproducts with great teams. Based in the real world, deployed\nto the cloud.",
        shouldClear: false,
      };
    }
    return {
      output: `cat: ${file}: No such file or directory`,
      shouldClear: false,
    };
  }

  // --- echo ---
  if (lower.startsWith("echo ")) {
    return { output: trimmed.slice(5), shouldClear: false };
  }
  if (lower === "echo") {
    return { output: "", shouldClear: false };
  }

  // --- ping ---
  if (lower === "ping" || lower.startsWith("ping ")) {
    return { output: "PONG!", shouldClear: false };
  }

  // --- man ---
  if (lower === "man" || lower.startsWith("man ")) {
    return { output: pickRandom(MAN_RESPONSES), shouldClear: false };
  }

  // --- vim / nano / emacs ---
  if (
    lower === "vim" ||
    lower === "vi" ||
    lower === "nano" ||
    lower === "emacs" ||
    lower.startsWith("vim ") ||
    lower.startsWith("vi ") ||
    lower.startsWith("nano ") ||
    lower.startsWith("emacs ")
  ) {
    return { output: pickRandom(EDITOR_RESPONSES), shouldClear: false };
  }

  // --- curl ---
  if (lower === "curl" || lower.startsWith("curl ")) {
    return {
      output: "Have you tried fetch()? This is a modern portfolio, after all.",
      shouldClear: false,
    };
  }

  // --- git status ---
  if (lower === "git status") {
    return {
      output:
        "On branch main\nYour branch is up to date with 'origin/main'.\n\nnothing to commit, working tree clean\nEverything committed. Life is good.",
      shouldClear: false,
    };
  }

  // --- git blame ---
  if (lower === "git blame" || lower.startsWith("git blame ")) {
    return { output: "It was me. It's always me.", shouldClear: false };
  }

  // --- git (other) ---
  if (lower.startsWith("git ")) {
    return {
      output: `git: '${trimmed.slice(4)}' is not a git command. See 'git --help'.`,
      shouldClear: false,
    };
  }

  // --- uptime ---
  if (lower === "uptime") {
    return { output: fakeUptime(), shouldClear: false };
  }

  // --- neofetch ---
  if (
    lower === "neofetch" ||
    lower === "fastfetch" ||
    lower === "screenfetch"
  ) {
    return { output: NEOFETCH_OUTPUT, shouldClear: false };
  }

  // --- cowsay ---
  if (lower === "cowsay") {
    return { output: cowsay(pickRandom(COWSAY_MESSAGES)), shouldClear: false };
  }
  if (lower.startsWith("cowsay ")) {
    return { output: cowsay(trimmed.slice(7)), shouldClear: false };
  }

  // --- fortune ---
  if (lower === "fortune") {
    return { output: pickRandom(FORTUNE_RESPONSES), shouldClear: false };
  }

  // --- matrix ---
  if (lower === "matrix") {
    return {
      output:
        "You take the red pill... you stay in the terminal.\nYou take the blue pill... you close the browser.\n\nWelcome to the Matrix, Neo.",
      shouldClear: false,
    };
  }

  // --- coffee / brew coffee ---
  if (
    lower === "coffee" ||
    lower === "brew coffee" ||
    lower === "make coffee"
  ) {
    return { output: COFFEE_ART, shouldClear: false };
  }

  // --- hire / hire me ---
  if (lower === "hire" || lower === "hire me" || lower === "contact") {
    return { output: <HireMe />, shouldClear: false };
  }

  // --- weather ---
  if (lower === "weather" || lower === "wttr" || lower === "wttr.in") {
    return {
      output: `Weather Report for /home/gentry/portfolio:

  Temperature:  72F (22C) - perfectly comfortable
  Humidity:     Low - no sweat
  Wind:         Tailwind CSS at 4.0 knots
  Forecast:     100% chance of great code today
  UV Index:     High - wear sunscreen outside, ship code inside`,
      shouldClear: false,
    };
  }

  // --- history ---
  if (lower === "history") {
    const allCommands = [...BOOT_COMMANDS, ...commandHistory];
    const lines = allCommands.map(
      (cmd, i) => `  ${String(i + 1).padStart(4)}  ${cmd}`
    );
    return { output: lines.join("\n"), shouldClear: false };
  }

  // --- whoami variations ---
  if (lower === "who" || lower === "w" || lower === "id") {
    return {
      output:
        "uid=1000(gentry) gid=1000(developer) groups=1000(developer),27(sudo-wishful-thinking)",
      shouldClear: false,
    };
  }

  // --- hostname ---
  if (lower === "hostname") {
    return { output: "gentryriggen.com", shouldClear: false };
  }

  // --- uname ---
  if (lower === "uname" || lower === "uname -a") {
    return {
      output:
        "PortfolioOS 1.0.0 gentryriggen.com 6.1.0-portfolio #1 SMP TypeScript x86_64 Next.js",
      shouldClear: false,
    };
  }

  // --- touch / mkdir ---
  if (lower.startsWith("touch ") || lower.startsWith("mkdir ")) {
    return {
      output: "Read-only file system. This portfolio is immutable!",
      shouldClear: false,
    };
  }

  // --- which / whereis / type ---
  if (
    lower.startsWith("which ") ||
    lower.startsWith("whereis ") ||
    lower.startsWith("type ")
  ) {
    return {
      output: `/usr/local/bin/${trimmed.split(" ")[1] ?? "unknown"}`,
      shouldClear: false,
    };
  }

  // --- confetti / party / celebrate ---
  if (
    lower === "confetti" ||
    lower === "party" ||
    lower === "celebrate" ||
    lower === "cheers" ||
    lower === "hooray" ||
    lower === "yay" ||
    lower === "woo" ||
    lower === "woohoo" ||
    lower === "fireworks" ||
    lower === "tada"
  ) {
    return {
      output: pickRandom(CONFETTI_RESPONSES),
      shouldClear: false,
      shouldConfetti: true,
    };
  }

  // --- Unrecognized command ---
  return { output: pickRandom(UNKNOWN_RESPONSES), shouldClear: false };
}
