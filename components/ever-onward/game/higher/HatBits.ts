/** Hat colours by foreman id, as whole class names so Tailwind sees them. */
export const HAT_BG: Readonly<Record<number, string>> = {
  0: "bg-slate-700",
  1: "bg-red-500",
  2: "bg-sky-500",
  3: "bg-pink-400",
  4: "bg-yellow-300",
  5: "bg-violet-400",
  6: "bg-green-500",
};

/** Width classes for a meter, in tenths. */
export const FILL: readonly string[] = [
  "w-0",
  "w-[10%]",
  "w-[20%]",
  "w-[30%]",
  "w-[40%]",
  "w-[50%]",
  "w-[60%]",
  "w-[70%]",
  "w-[80%]",
  "w-[90%]",
  "w-full",
];
