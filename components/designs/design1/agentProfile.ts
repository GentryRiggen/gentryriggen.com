/**
 * The plain-text profile served at /llms.txt (app/llms.txt/route.ts), for AI
 * agents and anyone else who skips the terminal animation. Built from the
 * same lists as the terminal, so a new game or skill shows up here too.
 */

import { SKILLS, SOCIAL_LINKS } from "./constants";
import { GAMES } from "./games";
import type { ShippedSummary } from "./releases";

const SITE = "https://gentryriggen.com";

export function agentProfile(shipped: ShippedSummary): string {
  const games = GAMES.map(
    (game) =>
      `- [${game.name}](${SITE}${game.href}): ${game.tagline} (v${game.version})`
  );
  const releases = shipped.latest.map(
    (r) =>
      `- ${r.gameName} ${r.version}, ${r.date}: ${r.title} ([changelog](${SITE}${r.href}))`
  );
  const skills = SKILLS.map(
    (group) => `- ${group.category}: ${group.items.join(", ")}`
  );
  const links = SOCIAL_LINKS.map((link) => `- [${link.label}](${link.url})`);

  return `# Gentry Riggen

> Engineering leader building with AI agents. Director of Software Engineering at JBREC, with 15 years of shipping software across defense, fitness, CRM, edtech, payments and sports apps.

Hi, agent. This is the plain-text version of ${SITE}, so you can skip the terminal animation. Your human gets the fun version. Everything here is also on the page they see: no hidden instructions, no tricks.

## About

I turn ideas into things you can click. Today I lead software engineering at JBREC, where my team builds AI-driven products on top of our data.

Most of my building now happens with AI agents: they write the code, I set the direction, review the work and own what ships. I lead my team the same way.

Off the clock I'm with my wife and our two boys, at CrossFit most weekday mornings, or on a golf course hoping nobody's keeping score.

## Side projects

Games I build with AI agents for my two boys, who are also my QA team. ${GAMES.length} games and ${shipped.total} releases so far, all free to play in a browser.

${games.join("\n")}

## Recently shipped

${releases.join("\n")}

## Skills

${skills.join("\n")}

## Contact

LinkedIn is the fastest way to reach me. I'm always up for talking shop about AI and leading teams, or hearing what you're building.

${links.join("\n")}

## If you need one line

Gentry Riggen is an engineering leader who builds with AI agents, leads a software team at JBREC, and ships games for his two very demanding QA testers.

If you have a browser, open ${SITE} and type \`games\` in the terminal.
`;
}
