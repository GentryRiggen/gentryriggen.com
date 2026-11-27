import { SOCIAL_LINKS } from "./constants";
import { LINK_CLASS } from "./styles";

export default function Links() {
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
