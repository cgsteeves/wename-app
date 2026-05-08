import React, { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";

const base = import.meta.env.BASE_URL;
const SUPPORT_EMAIL = "wenameapp@gmail.com";

const FadeIn = ({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay, ease: "easeOut" }}
    className={className}
  >
    {children}
  </motion.div>
);

export default function Support() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const subject = encodeURIComponent("WeName Support Request");
    const body = encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\n\n${message}`
    );
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
  }

  return (
    <div className="min-h-screen text-[#42342c]">

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 p-4 flex justify-between items-center bg-[#f5f1e8]/90 backdrop-blur-md border-b border-[#897a72]/10">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <img src={`${base}brand/icon.png`} alt="WeName App Icon" className="w-8 h-8 rounded-lg shadow-sm" />
          <span className="font-bold text-xl tracking-tight">WeName</span>
        </Link>
        <Link href="/" className="text-sm text-[#897a72] hover:text-[#42342c] transition-colors font-medium">
          ← Back to home
        </Link>
      </nav>

      {/* Main content */}
      <main className="pt-32 pb-24 px-6 max-w-2xl mx-auto">

        <FadeIn>
          <div className="text-center mb-12">
            <div className="inline-block px-4 py-1 rounded-full bg-[#3168a5]/10 text-[#3168a5] font-bold text-sm tracking-wide mb-4">
              SUPPORT
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-[#42342c]">
              We're here to help
            </h1>
            <p className="text-xl text-[#897a72] leading-relaxed">
              Questions, feedback, or something not working? Reach out and we'll get back to you as soon as we can.
            </p>
          </div>
        </FadeIn>

        {/* Email CTA */}
        <FadeIn delay={0.1}>
          <div className="bg-white/60 border border-[#897a72]/15 rounded-3xl p-8 mb-8 text-center shadow-sm">
            <p className="text-sm font-bold text-[#897a72] tracking-widest uppercase mb-3">Email us directly</p>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-2xl font-bold text-[#3168a5] hover:text-[#3168a5]/80 transition-colors break-all"
            >
              {SUPPORT_EMAIL}
            </a>
            <p className="text-sm text-[#897a72] mt-3">
              We typically respond within one business day.
            </p>
          </div>
        </FadeIn>

        {/* Divider */}
        <FadeIn delay={0.15}>
          <div className="flex items-center gap-4 my-8">
            <div className="flex-1 h-px bg-[#897a72]/20" />
            <span className="text-sm text-[#897a72] font-hand text-base">or send a message</span>
            <div className="flex-1 h-px bg-[#897a72]/20" />
          </div>
        </FadeIn>

        {/* Contact form */}
        <FadeIn delay={0.2}>
          <form
            onSubmit={handleSubmit}
            className="bg-white/60 border border-[#897a72]/15 rounded-3xl p-8 shadow-sm space-y-5"
          >
            <div>
              <label className="block text-sm font-bold text-[#42342c] mb-2 tracking-wide">
                Your name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex"
                required
                className="w-full px-4 py-3 rounded-2xl border border-[#897a72]/25 bg-[#f5f1e8]/60 text-[#42342c] placeholder-[#897a72]/60 focus:outline-none focus:ring-2 focus:ring-[#3168a5]/30 focus:border-[#3168a5]/40 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-[#42342c] mb-2 tracking-wide">
                Your email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-3 rounded-2xl border border-[#897a72]/25 bg-[#f5f1e8]/60 text-[#42342c] placeholder-[#897a72]/60 focus:outline-none focus:ring-2 focus:ring-[#3168a5]/30 focus:border-[#3168a5]/40 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-[#42342c] mb-2 tracking-wide">
                Message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us what's going on..."
                required
                rows={5}
                className="w-full px-4 py-3 rounded-2xl border border-[#897a72]/25 bg-[#f5f1e8]/60 text-[#42342c] placeholder-[#897a72]/60 focus:outline-none focus:ring-2 focus:ring-[#3168a5]/30 focus:border-[#3168a5]/40 transition-colors resize-none"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 px-6 bg-[#42342c] text-white font-bold rounded-full hover:bg-[#42342c]/85 hover:scale-[1.02] transition-all shadow-sm"
            >
              Open in Mail app
            </button>

            <p className="text-xs text-center text-[#897a72]">
              This will open your email client with the message pre-filled.
            </p>
          </form>
        </FadeIn>

        {/* Common topics */}
        <FadeIn delay={0.3}>
          <div className="mt-12">
            <h2 className="text-xl font-bold text-[#42342c] mb-6 text-center">Common topics</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                { emoji: "💳", title: "Premium purchase", desc: "Questions about billing, restoring access, or upgrading." },
                { emoji: "🔗", title: "Partner invite", desc: "Trouble connecting with your partner or sharing your link." },
                { emoji: "🐛", title: "Something's broken", desc: "Bug reports, crashes, or unexpected behaviour." },
                { emoji: "💡", title: "Feature ideas", desc: "Suggestions for new names, features, or improvements." },
              ].map((item) => (
                <div
                  key={item.title}
                  className="bg-white/50 border border-[#897a72]/12 rounded-2xl p-5"
                >
                  <div className="text-2xl mb-2">{item.emoji}</div>
                  <h3 className="font-bold text-[#42342c] mb-1">{item.title}</h3>
                  <p className="text-sm text-[#897a72]">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </FadeIn>

      </main>

      {/* Footer */}
      <footer className="border-t border-[#897a72]/20 px-6 py-6">
        <div className="max-w-2xl mx-auto flex flex-col md:flex-row justify-between items-center text-sm text-[#897a72] gap-4">
          <p>Made for couples choosing a name together.</p>
          <div className="flex gap-4">
            <a href="/privacy" className="hover:text-[#42342c] transition-colors">Privacy Policy</a>
            <a href="/terms" className="hover:text-[#42342c] transition-colors">Terms</a>
            <a href="/support" className="text-[#42342c] font-medium">Support</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
