import React from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";

const base = import.meta.env.BASE_URL;

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

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[#3168a5]/8 border border-[#3168a5]/20 rounded-2xl p-5">
      <p className="text-sm text-[#42342c] leading-relaxed">{children}</p>
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

export default function DeleteAccount() {
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

      <main className="pt-32 pb-24 px-6 max-w-2xl mx-auto">

        <FadeIn>
          <div className="text-center mb-12">
            <div className="inline-block px-4 py-1 rounded-full bg-[#c53c5a]/10 text-[#c53c5a] font-bold text-sm tracking-wide mb-4">
              ACCOUNT
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-[#42342c]">
              Delete Your Account
            </h1>
            <p className="text-base text-[#897a72]">
              You can permanently delete your WeName account at any time from directly within the app.
            </p>
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="bg-white/60 border border-[#897a72]/15 rounded-3xl p-8 shadow-sm space-y-8">

            <div className="space-y-3">
              <h2 className="text-lg font-bold text-[#42342c]">How to delete your account</h2>
              <p className="text-sm text-[#897a72] leading-relaxed">
                Account deletion is handled entirely inside the WeName app. No email or support request needed.
              </p>
            </div>

            <div className="space-y-5">
              <Step number="1" title="Open WeName and go to Settings">
                Tap the <strong>Settings</strong> tab at the bottom of the screen.
              </Step>
              <Step number="2" title="Tap your account">
                Tap <strong>Account</strong> near the top of the Settings screen.
              </Step>
              <Step number="3" title="Scroll to the bottom and tap Delete Account">
                Tap <strong>Delete Account</strong> at the bottom of the Account screen.
              </Step>
              <Step number="4" title="Confirm deletion">
                A confirmation prompt will appear. Tap <strong>Delete</strong> to permanently delete your account and all associated data.
              </Step>
            </div>

            <WarningBox>
              <strong>This action is permanent and cannot be undone.</strong> Deleting your account immediately and permanently removes your profile, swipe history, matches, partner connection, and all other personal data from our systems.
            </WarningBox>

            <div className="space-y-3">
              <h2 className="text-lg font-bold text-[#42342c]">What gets deleted</h2>
              <div className="space-y-2">
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

            <div className="space-y-3">
              <h2 className="text-lg font-bold text-[#42342c]">Need help?</h2>
              <p className="text-sm text-[#897a72] leading-relaxed">
                If you are unable to access the app or have any trouble deleting your account, contact us and we will delete your data manually within 3 business days.
              </p>
              <a
                href="mailto:wenameapp@gmail.com"
                className="inline-block text-sm font-semibold text-[#c53c5a] underline hover:opacity-80 transition-opacity"
              >
                wenameapp@gmail.com
              </a>
            </div>

          </div>
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
