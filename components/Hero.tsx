import Image from "next/image";
import Footer from "./Footer";

export default function Hero() {
  return (
    <section className="min-h-screen flex flex-col items-center justify-start sm:justify-center px-6 sm:px-6 py-4 sm:py-12 md:py-20 lg:py-32">
      <div className="max-w-4xl mx-auto w-full">
        {/* Hero Name - Centered */}
        <div className="text-center mb-12 sm:mb-16 md:mb-24">
          <h1 className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-black mb-4 sm:mb-5 md:mb-6 tracking-tighter leading-none">
            <span className="bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent animate-gradient">
              GENTRY
            </span>
            <br />
            <span className="bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-400 bg-clip-text text-transparent animate-gradient">
              RIGGEN
            </span>
          </h1>
          <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-600 dark:text-gray-400 font-light tracking-wide uppercase mt-4 sm:mt-5 md:mt-8">
            Software Leader & Developer
          </p>
        </div>

        {/* Content Card */}
        <div className="bg-gray-100/80 dark:bg-white/5 backdrop-blur-sm border border-gray-300/50 dark:border-white/10 rounded-2xl sm:rounded-3xl p-8 sm:p-8 md:p-10 lg:p-12 mb-8 md:mb-16">
          <div className="flex flex-col md:flex-row gap-5 sm:gap-6 md:gap-6 lg:gap-8 items-start">
            {/* Image - Smaller on mobile, hidden on very small screens */}
            <div className="relative w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40 shrink-0 rounded-xl sm:rounded-2xl overflow-hidden ring-1 ring-gray-400/30 dark:ring-white/20 mx-auto md:mx-0">
              <Image
                src="/gentry-riggen_web Medium.jpeg"
                alt="Gentry Riggen"
                fill
                className="object-cover"
                priority
              />
            </div>

            {/* Content */}
            <div className="flex-1 space-y-5 sm:space-y-5 md:space-y-6 md:ml-0">
              <p className="text-lg sm:text-lg md:text-xl text-gray-700 dark:text-gray-300 leading-relaxed">
                I build products and lead teams using{" "}
                <span className="font-semibold text-purple-400">React</span>,{" "}
                <span className="font-semibold text-blue-400">Next.js</span>,{" "}
                <span className="font-semibold text-green-400">Node.js</span>,{" "}
                <span className="font-semibold text-cyan-400">TypeScript</span>,{" "}
                <span className="font-semibold text-teal-400">
                  Tailwind CSS
                </span>
                ,{" "}
                <span className="font-semibold text-indigo-400">Postgres</span>,{" "}
                <span className="font-semibold text-pink-400">Prisma</span>,{" "}
                <span className="font-semibold text-violet-400">GraphQL</span>,{" "}
                <span className="font-semibold text-blue-300">Docker</span>,{" "}
                <span className="font-semibold text-orange-400">Terraform</span>
                ,{" "}
                <span className="font-semibold text-gray-400">
                  GitHub Actions
                </span>
                , and more. These days I&apos;m focused on leading projects and
                empowering teams to ship exceptional work—while still getting my
                hands dirty with code.
              </p>
              <p className="text-lg sm:text-lg md:text-xl text-gray-700 dark:text-gray-300 leading-relaxed">
                Off the clock, you&apos;ll find me at the gym doing constantly
                varied functional movements—AKA CrossFit 🏋️‍♂️. The grind never
                stops, whether it&apos;s debugging or deadlifting.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <Footer />
      </div>
    </section>
  );
}
