import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
      <Header />
      <main>
        <Hero />
        <section id="about" className="py-20 px-6" aria-label="About section">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold mb-6 text-center">
              About
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed text-center max-w-2xl mx-auto">
              Welcome to my personal website. I&apos;m passionate about creating
              beautiful, functional web experiences that make a difference.
            </p>
          </div>
        </section>
        <section
          id="contact"
          className="py-20 px-6 bg-gray-50 dark:bg-gray-800"
          aria-label="Contact section"
        >
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Contact</h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
              Feel free to reach out if you&apos;d like to connect or collaborate.
            </p>
            <a
              href="mailto:hello@gentryriggen.com"
              className="inline-block px-8 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
            >
              Send Email
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
