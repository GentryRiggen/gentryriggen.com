import { SKILLS } from "./constants";

export default function Skills() {
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
