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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-bold text-[#42342c]">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm text-[#897a72] leading-relaxed">{children}</p>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2 pl-1">
      <span className="text-sm text-[#897a72] shrink-0">•</span>
      <p className="text-sm text-[#897a72] leading-relaxed">{children}</p>
    </div>
  );
}

function ExternalLink({ label, url }: { label: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm font-semibold text-[#c53c5a] underline hover:opacity-80 transition-opacity"
    >
      {label}
    </a>
  );
}

function InlineLink({ label, url }: { label: string; url: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="font-semibold text-[#c53c5a] underline hover:opacity-80 transition-opacity"
    >
      {label}
    </a>
  );
}

export default function Terms() {
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
              LEGAL
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 text-[#42342c]">
              Terms of Service
            </h1>
            <p className="text-base text-[#897a72]">Last updated April 15, 2026</p>
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="bg-white/60 border border-[#897a72]/15 rounded-3xl p-8 shadow-sm space-y-8">

            <Section title="1. Acceptance of Terms">
              <P>
                By downloading, installing, or using the WeName application ("App," "Service")
                operated by Christopher Steeves ("we," "our," or "us"), you agree to be bound by
                these Terms of Service ("Terms"). If you do not agree to these Terms, do not use
                the App.
              </P>
              <P>
                These Terms constitute a legally binding agreement between you and WeName. We may
                update these Terms from time to time. Continued use of the App after changes are
                posted constitutes your acceptance of the revised Terms.
              </P>
            </Section>

            <Section title="2. Description of Service">
              <P>
                WeName is a collaborative baby name discovery application that allows users to swipe
                through curated baby name lists, save favourites, and discover names that both
                partners like. The App is available at wename.app and as a mobile web application.
              </P>
              <Bullet>
                Free Tier: Free accounts may swipe on a limited number of names per day and access
                core features. Daily limits reset every 24 hours.
              </Bullet>
              <Bullet>
                Premium Tier: Premium accounts receive unlimited daily swipes and access to
                additional name packs and features. Premium access is subject to any applicable fees
                disclosed at the time of purchase.
              </Bullet>
              <Bullet>
                Guest Usage: You may explore certain features of the App without creating an account.
                Guest users may have limited access to features, and their data may not be saved
                across sessions. We recommend creating an account to preserve your swipe history and
                access all features.
              </Bullet>
            </Section>

            <Section title="3. Subscription Billing">
              <P>
                If you purchase a premium subscription, billing will be handled through the platform
                on which you downloaded the App (e.g., Apple App Store or Google Play Store). All
                payments are processed by the applicable platform provider and are subject to their
                respective terms and policies.
              </P>
              <P>
                All payments are non-refundable except as required by applicable law or the policies
                of the platform provider through which you made your purchase. Please review the
                refund policy of the applicable platform provider for more information.
              </P>
              <P>
                Subscriptions may auto-renew unless cancelled prior to the renewal date in accordance
                with the platform provider's cancellation policy. We do not process cancellations
                directly — cancellations must be managed through your App Store or Google Play
                account settings.
              </P>
            </Section>

            <Section title="4. Account Registration">
              <P>
                You may use certain features of the App as a guest without creating an account. To
                access partner-linking, match history, and other personalized features, you must
                create an account by providing a valid email address.
              </P>
              <Bullet>You must be at least 13 years of age to create an account.</Bullet>
              <Bullet>You are responsible for maintaining the confidentiality of your account credentials.</Bullet>
              <Bullet>You agree to provide accurate and current information when creating your account.</Bullet>
              <Bullet>You are responsible for all activity that occurs under your account.</Bullet>
              <Bullet>
                You must notify us immediately at{" "}
                <InlineLink label="wenameapp@gmail.com" url="mailto:wenameapp@gmail.com" />{" "}
                if you suspect unauthorized use of your account.
              </Bullet>
            </Section>

            <Section title="5. Partner Linking">
              <P>
                WeName allows you to link your account with a partner to discover names you both
                like. By linking with a partner:
              </P>
              <Bullet>You consent to sharing your liked names and matched names with your linked partner.</Bullet>
              <Bullet>Your partner will be able to see the names you have liked and any names you have matched on together.</Bullet>
              <Bullet>You may unlink from your partner at any time through the Partner section of Settings.</Bullet>
              <Bullet>Unlinking does not delete your individual swipe history or liked names.</Bullet>
              <P>
                You are solely responsible for the partner you choose to link with. WeName is not
                responsible for any disputes arising between you and your partner. WeName does not
                guarantee that you and your partner will reach agreement on any names or that the
                Service will produce outcomes that meet your expectations.
              </P>
            </Section>

            <Section title="6. Acceptable Use">
              <P>You agree not to use the App to:</P>
              <Bullet>Violate any applicable local, provincial, national, or international law or regulation.</Bullet>
              <Bullet>Attempt to gain unauthorized access to any portion of the App or its related systems.</Bullet>
              <Bullet>Reverse engineer, decompile, disassemble, or otherwise attempt to derive the source code of the App.</Bullet>
              <Bullet>Use automated scripts, bots, or other means to scrape or interact with the App in ways not intended by normal use.</Bullet>
              <Bullet>Transmit any viruses, malware, or other harmful code.</Bullet>
              <Bullet>Impersonate any person or entity, or falsely represent your affiliation with any person or entity.</Bullet>
              <Bullet>Use the App for any commercial purpose without our prior written consent.</Bullet>
              <P>
                We reserve the right to suspend or terminate your account at our sole discretion if
                we determine you have violated these Terms or engaged in conduct harmful to the App
                or other users.
              </P>
              <P>
                We reserve the right to enforce usage limits and prevent abuse of the Service,
                including excessive or automated usage that places an unreasonable burden on our
                infrastructure or degrades the experience of other users.
              </P>
            </Section>

            <Section title="7. Service Changes">
              <P>
                We reserve the right to modify, suspend, or discontinue any part of the Service at
                any time without notice. This includes the addition, modification, or removal of
                features, name packs, or other content. We shall not be liable to you or any third
                party for any modification, suspension, or discontinuation of the Service or any part
                thereof.
              </P>
            </Section>

            <Section title="8. User-Generated Content">
              <P>
                The App may allow you to submit custom baby names ("User Content"). By submitting
                User Content, you grant WeName a non-exclusive, royalty-free, worldwide licence to
                use, display, and process that content solely for the purpose of operating the App
                and providing the Service to you.
              </P>
              <P>
                You represent and warrant that any User Content you submit does not violate the
                rights of any third party, including intellectual property rights, privacy rights, or
                any applicable law.
              </P>
            </Section>

            <Section title="9. Intellectual Property">
              <P>
                All content, features, and functionality of the App — including but not limited to
                the name database, AI suggestions, design, graphics, logos, and source code — are the
                exclusive property of WeName and its licensors and are protected by applicable
                copyright, trademark, and other intellectual property laws.
              </P>
              <P>
                These Terms do not grant you any right, title, or interest in the App or its content
                beyond the limited licence to use the Service for its intended personal,
                non-commercial purpose.
              </P>
            </Section>

            <Section title="10. Privacy">
              <P>
                Your use of the App is also governed by our Privacy Policy, which is incorporated
                into these Terms by reference. Please review our Privacy Policy at{" "}
                <InlineLink label="wename.app/privacy" url="https://wename.app/privacy" />{" "}
                to understand our practices regarding the collection, use, and disclosure of your
                personal information.
              </P>
            </Section>

            <Section title="11. Third-Party Services">
              <P>
                The App integrates with third-party services including Supabase (database and
                authentication), SendGrid (email delivery), and OpenAI (AI name suggestions). Your
                use of these features is also subject to the respective terms and privacy policies of
                those third parties. We are not responsible for the availability, accuracy, or
                practices of any third-party services.
              </P>
            </Section>

            <Section title="12. Disclaimer of Warranties">
              <P>
                The App is provided on an "as is" and "as available" basis without warranties of any
                kind, either express or implied, including but not limited to implied warranties of
                merchantability, fitness for a particular purpose, or non-infringement.
              </P>
              <P>
                We do not warrant that the App will be uninterrupted, error-free, or free of viruses
                or other harmful components. We do not warrant the accuracy, completeness, or
                usefulness of any information provided through the App, including name meanings,
                origins, or pronunciations. WeName does not guarantee that you and your partner will
                reach agreement on any names or that the Service will produce outcomes that meet your
                expectations.
              </P>
            </Section>

            <Section title="13. Limitation of Liability">
              <P>
                To the fullest extent permitted by applicable law, WeName and its owner shall not be
                liable for any indirect, incidental, special, consequential, or punitive damages,
                including but not limited to loss of data, loss of profits, or loss of goodwill,
                arising out of or in connection with your use of or inability to use the App.
              </P>
              <P>
                In no event shall our total liability to you for any claims arising under these Terms
                exceed the greater of (a) the amount you have paid to us in the twelve months
                preceding the claim, or (b) CAD $10.
              </P>
            </Section>

            <Section title="14. Indemnification">
              <P>
                You agree to indemnify, defend, and hold harmless WeName and its owner from and
                against any claims, liabilities, damages, losses, and expenses (including reasonable
                legal fees) arising out of or in any way connected with your access to or use of the
                App, your violation of these Terms, or your violation of any rights of another person
                or entity.
              </P>
            </Section>

            <Section title="15. Termination">
              <P>
                You may stop using the App and delete your account at any time through the Account
                section of Settings. Upon account deletion, your personal data will be permanently
                removed from our systems as described in our Privacy Policy. Please note that some
                limited technical data may persist temporarily in backups or logs as described in our
                Privacy Policy.
              </P>
              <P>
                We reserve the right to suspend or terminate your access to the App at any time,
                with or without notice, for any reason including if we reasonably believe you have
                violated these Terms. Upon termination, your right to use the App will immediately
                cease.
              </P>
            </Section>

            <Section title="16. Governing Law and Dispute Resolution">
              <P>
                These Terms are governed by and construed in accordance with the laws of the Province
                of Ontario and the federal laws of Canada applicable therein, without regard to
                conflict of law principles.
              </P>
              <P>
                Any dispute arising out of or relating to these Terms or your use of the App shall
                first be attempted to be resolved through good-faith negotiation. If the dispute
                cannot be resolved informally, it shall be submitted to the courts of competent
                jurisdiction in Ottawa, Ontario, Canada, and you consent to the exclusive
                jurisdiction of those courts.
              </P>
            </Section>

            <Section title="17. Changes to These Terms">
              <P>
                We may revise these Terms at any time. When we make material changes, we will update
                the "Last Updated" date above and may provide notice through the App. Your continued
                use of the App following the posting of revised Terms constitutes your acceptance of
                the changes.
              </P>
              <P>
                We encourage you to review these Terms periodically to stay informed of any updates.
              </P>
            </Section>

            <Section title="18. Entire Agreement">
              <P>
                These Terms constitute the entire agreement between you and WeName regarding the use
                of the Service and supersede all prior and contemporaneous agreements,
                representations, and understandings between you and WeName relating to the subject
                matter herein.
              </P>
            </Section>

            <Section title="19. Contact Us">
              <P>
                If you have any questions, concerns, or feedback regarding these Terms, please
                contact us:
              </P>
              <P>Christopher Steeves (WeName){"\n"}Ottawa, Ontario, Canada</P>
              <ExternalLink label="wenameapp@gmail.com" url="mailto:wenameapp@gmail.com" />
              <ExternalLink label="wename.app" url="https://wename.app" />
            </Section>

          </div>
        </FadeIn>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#897a72]/20 px-6 py-6">
        <div className="max-w-2xl mx-auto flex flex-col md:flex-row justify-between items-center text-sm text-[#897a72] gap-4">
          <p>Made for couples choosing a name together.</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-[#42342c] transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="text-[#42342c] font-medium">Terms</Link>
            <Link href="/support" className="hover:text-[#42342c] transition-colors">Support</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
