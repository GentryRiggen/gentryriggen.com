export default function HeroHeader() {
  return (
    <div className="text-center mb-6 sm:mb-8 md:mb-10 overflow-visible px-4 sm:px-6 md:px-8 lg:px-12">
      <h1 className="text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-black mb-2 sm:mb-3 md:mb-4 tracking-tighter leading-none pt-2 sm:pt-3 md:pt-4">
        <span className="bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent animate-gradient inline-block pr-2 sm:pr-4 md:pr-6">
          GENTRY
        </span>
        <br className="leading-none" />
        <span className="bg-gradient-to-r from-blue-600 via-cyan-500 to-teal-400 bg-clip-text text-transparent animate-gradient inline-block -mt-2 sm:-mt-3 md:-mt-4">
          RIGGEN
        </span>
      </h1>
      <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-gray-600 dark:text-gray-400 font-light tracking-wide uppercase mt-2 sm:mt-3 md:mt-4">
        Software Leader & Developer
      </p>
    </div>
  );
}
