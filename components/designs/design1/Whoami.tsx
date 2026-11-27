import Image from "next/image";

export default function Whoami() {
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
