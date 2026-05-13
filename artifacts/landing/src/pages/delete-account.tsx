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

function Step({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="shrink-0 w-8 h-8 rounded-full bg-[#c53c5a]/10 flex items-center justify-center">
        <span className="text-sm font-bold text-[#c53c5a]">{number}</span>
      </div>
      <div className="space-y-1 pt-0.5">
        <p className="font-semibold text-[#42342c] text-sm">{title}</p>
        <p className="text-sm text-[#897a72] leading-relaxed">{children}</p>
      </div>
    </div>
  );
}

function WarningBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#c53c5a]/8 border border-[#c53c5a]/20 rounded-2xl p-5">
      <p className="text-sm text-[#42342c] leading-relaxed">{children}</p>
    </div>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#3168a5]/8 border border-[#3168a5]/20 rounded-2xl p-5">
      <p className="text-sm text-[#42342c] leading-relaxed">{children}</p>
    </div>
  );
}

const inputClass =
  "w-full px-4 py-3 rounded-2xl border border-[#897a72]/25 bg-[#f5f1e8]/60 text-[#42342c] placeholder-[#897a72]/60 focus:outline-none focus:ring-2 focus:ring-[#c53c5a]/25 focus:border-[#c53c5a]/40 transition-colors";

export default function DeleteAccount() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const subject = encodeURIComponent("Account Deletion Request — WeName");
    const body = encodeURIComponent(
      `Hi WeName team,\n\nI would like to request permanent deletion of my account and all associated data.\n\nName: ${name}\nEmail: ${email}${note ? `\n\nAdditional information:\n${note}` : ""}\n\nPlease confirm once the deletion is complete.\n\nThank you`
    );
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
  }

  return (
    <div className="min-h-screen text-[#42342c]">

      <nav className="fixed top-0 left-0 right-0 z-50 p-4 flex justify-between items-center bg-[#f5f1e8]/90 backdrop-blur-md border-b border-[#897a72]/10">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <img src={`${base}brand/icon.png`} alt="WeName App Icon" className="w-8 h-8 rounded-lg shadow-sm" />
          <span className="font-bold text-xl tracking-tight">WeName</span>
        </Link>
        <Link href="/" className="text-sm text-[#897a72] hover:text-[#42342c] transition-colors font-medium">
          ← Back to home
        </Link>
      </nav>

      <main className="pt-32 pb-24 px-6 max-w-2xl mx-auto space-y-6">

        <FadeIn>
          <div className="text-center mb-10">
            <div className="inline-block px-4 py-1 rounded-full bg-[#c53c5a]/10 text-[#c53c5a] font-bold text-sm tracking-wide mb-4">
              ACCOUNT
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-[#42342c]">
              Delete Your Account
            </h1>
            <p className="text-base text-[#897a72]">
              You can delete your account directly from the app in seconds, or submit a request below and we'll handle it for you.
            </p>
          </div>
        </FadeIn>

        {/* In-app steps */}
        <FadeIn delay={0.1}>
          <div className="bg-white/60 border border-[#897a72]/15 rounded-3xl p-8 shadow-sm space-y-6">
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-[#42342c]">Delete from the app</h2>
              <p className="text-sm text-[#897a72]">The fastest way — no email needed.</p>
            </div>

            <div className="space-y-5">
              <Step number="1" title="Open WeName and go to Settings">
                Tap the <strong>Settings</strong> tab at the bottom of the screen.
              </Step>
              <Step number="2" title="Tap Account">
                Tap <strong>Account</strong> near the top of the Settings screen.
              </Step>
              <Step number="3" title="Tap Delete Account">
                Scroll to the bottom and tap <strong>Delete Account</strong>.
              </Step>
              <Step number="4" title="Confirm">
                Tap <strong>Delete</strong> in the confirmation prompt to permanently remove your account and all data.
              </Step>
            </div>

            <WarningBox>
              <strong>Deletion is permanent and immediate.</strong> Your profile, swipe history, matches, partner connection, and all personal data are removed from our systems and cannot be recovered.
            </WarningBox>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-[#42342c]">What gets deleted</p>
              <div className="space-y-1.5">
                {[
                  "Your profile (display name, email, preferences)",
                  "Your entire swipe history (liked and disliked names)",
                  "All name matches between you and your partner",
                  "Your partner connection and invitation codes",
                  "Your subscription entitlements via RevenueCat",
                  "Your authentication credentials",
                ].map((item) => (
                  <div key={item} className="flex gap-2 pl-1">
                    <span className="text-sm text-[#c53c5a] shrink-0">✕</span>
                    <p className="text-sm text-[#897a72] leading-relaxed">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            <InfoBox>
              Some limited technical logs and automated backups may persist temporarily for security and reliability purposes. These are not accessible to users and are automatically purged over time.
            </InfoBox>
          </div>
        </FadeIn>

        {/* Divider */}
        <FadeIn delay={0.2}>
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-[#897a72]/20" />
            <span className="text-sm text-[#897a72]">or request deletion by email</span>
            <div className="flex-1 h-px bg-[#897a72]/20" />
          </div>
        </FadeIn>

        {/* Request form */}
        <FadeIn delay={0.25}>
          <form
            onSubmit={handleSubmit}
            className="bg-white/60 border border-[#897a72]/15 rounded-3xl p-8 shadow-sm space-y-5"
          >
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-[#42342c]">Submit a deletion request</h2>
              <p className="text-sm text-[#897a72] leading-relaxed">
                Can't access the app? Fill in your details and we'll permanently delete your account and all associated data within 3 business days.
              </p>
            </div>

            <div>
              <label className="block text-sm font-bold text-[#42342c] mb-2">
                Your name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex"
                required
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-[#42342c] mb-2">
                Email address on your account
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-[#42342c] mb-2">
                Anything else we should know? <span className="text-[#897a72] font-normal">(optional)</span>
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. I no longer have access to my account email..."
                rows={3}
                className={`${inputClass} resize-none`}
              />
            </div>

            <button
              type="submit"
              className="w-full py-3 px-6 bg-[#c53c5a] text-white font-bold rounded-full hover:bg-[#c53c5a]/85 hover:scale-[1.02] transition-all shadow-sm"
            >
              Send Deletion Request
            </button>

            <p className="text-xs text-center text-[#897a72]">
              This will open your email app with the request pre-filled. We will confirm deletion within 3 business days.
            </p>
          </form>
        </FadeIn>

      </main>

      <footer className="border-t border-[#897a72]/20 px-6 py-6">
        <div className="max-w-2xl mx-auto flex flex-col md:flex-row justify-between items-center text-sm text-[#897a72] gap-4">
          <p>Made for couples choosing a name together.</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-[#42342c] transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-[#42342c] transition-colors">Terms</Link>
            <Link href="/support" className="hover:text-[#42342c] transition-colors">Support</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
