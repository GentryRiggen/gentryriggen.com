/** Body of `cat hobbies.txt`, shared by the boot sequence and the command. */
export default function Hobbies() {
  return (
    <div className="space-y-2">
      <p className="whitespace-pre-wrap leading-relaxed">
        Off the clock, I&apos;m all about my family 👨‍👩‍👦‍👦 — hanging out with my
        beautiful wife and our two boys. When I&apos;m not with them,
        you&apos;ll find me at the CrossFit box 🏋️ or out on the golf course ⛳.
      </p>
      <p className="leading-relaxed">
        ⚓ I also love building fun things for my kids, like a ship-building
        game:{" "}
        <a
          href="/ship-builder"
          className="text-green-600 dark:text-green-300 underline underline-offset-2 decoration-green-500/40 hover:decoration-green-500 hover:text-green-500 dark:hover:text-green-200 transition-colors"
        >
          /ship-builder
        </a>{" "}
        (or type{" "}
        <span className="text-green-600 dark:text-green-300">
          &apos;ships&apos;
        </span>
        ).
      </p>
      <p className="leading-relaxed">
        ✈️ And a plane game where you upgrade a slingshot plane until it reaches
        the finish line:{" "}
        <a
          href="/plane-builder"
          className="text-green-600 dark:text-green-300 underline underline-offset-2 decoration-green-500/40 hover:decoration-green-500 hover:text-green-500 dark:hover:text-green-200 transition-colors"
        >
          /plane-builder
        </a>{" "}
        (or type{" "}
        <span className="text-green-600 dark:text-green-300">
          &apos;planes&apos;
        </span>
        ).
      </p>
      <p className="leading-relaxed">
        💡 And a little incremental game where a lighthouse robot keeps the
        light on:{" "}
        <a
          href="/ever-onward"
          className="text-green-600 dark:text-green-300 underline underline-offset-2 decoration-green-500/40 hover:decoration-green-500 hover:text-green-500 dark:hover:text-green-200 transition-colors"
        >
          /ever-onward
        </a>{" "}
        (or type{" "}
        <span className="text-green-600 dark:text-green-300">
          &apos;onward&apos;
        </span>
        ).
      </p>
    </div>
  );
}
