import React from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

const base = import.meta.env.BASE_URL;

const FadeIn = ({ children, delay = 0, className = "" }: { children: React.ReactNode, delay?: number, className?: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-100px" }}
    transition={{ duration: 0.6, delay, ease: "easeOut" }}
    className={className}
  >
    {children}
  </motion.div>
);

export default function Home() {
  return (
    <div className="min-h-screen overflow-hidden text-[#42342c]">
      
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 p-4 flex justify-between items-center bg-[#f5f1e8]/90 backdrop-blur-md border-b border-[#897a72]/10">
        <div className="flex items-center gap-2">
          <img src={`${base}brand/icon.png`} alt="WeName App Icon" className="w-8 h-8 rounded-lg shadow-sm" />
          <span className="font-bold text-xl tracking-tight">WeName</span>
        </div>
        <a href="https://apps.apple.com/ca/app/wename-find-baby-names/id6764540022" target="_blank" rel="noopener noreferrer">
          <Button className="bg-[#fbb02d] text-[#42342c] hover:bg-[#fbb02d]/90 font-semibold rounded-full px-6 shadow-sm border border-[#fbb02d]/50">
            Get the App
          </Button>
        </a>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-12">
        <div className="flex-1 space-y-6 z-10">
          <FadeIn>
            <h1 className="text-5xl md:text-6xl font-bold leading-tight text-[#42342c]">
              The baby name app for couples
            </h1>
          </FadeIn>
          <FadeIn delay={0.2}>
            <p className="text-xl text-[#897a72] leading-relaxed max-w-lg">
              Swipe through baby names separately, match on the names you both like, and build a shortlist together.
            </p>
          </FadeIn>
          <FadeIn delay={0.4} className="flex flex-col sm:flex-row gap-4 pt-4">
            <a href="https://apps.apple.com/ca/app/wename-find-baby-names/id6764540022" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center bg-black text-white px-6 py-3 rounded-full font-semibold hover:scale-105 transition-transform">
              Download on the App Store
            </a>
            <span className="inline-flex items-center justify-center bg-[#c8bfb5] text-[#7a6e66] px-6 py-3 rounded-full font-semibold cursor-default select-none">
              Google Play — Coming Soon
            </span>
          </FadeIn>
          <FadeIn delay={0.5}>
            <p className="text-sm font-hand text-[#897a72] italic">
              Free to start. Premium unlocks unlimited swipes, AI suggestions, and more name packs.
            </p>
          </FadeIn>
        </div>

        <div className="flex-1 relative w-full max-w-md mx-auto perspective-1000">
          <FadeIn delay={0.3} className="relative z-20 transform rotate-[-2deg] hover:rotate-0 transition-transform duration-500">
            <div className="bg-white p-4 pb-12 rounded-[24px] shadow-[0_12px_40px_rgba(66,52,44,0.12)] border border-[#897a72]/10 relative overflow-hidden">
              <img src={`${base}brand/boy-card-bg.jpg`} className="w-full h-[400px] object-cover rounded-[16px]" alt="" />
              <div className="absolute top-8 left-8 right-8 text-center text-white drop-shadow-md">
                <h3 className="text-5xl font-bold mb-2">Oliver</h3>
                <p className="text-lg opacity-90">"Olive tree"</p>
              </div>
              <img src={`${base}brand/like_sun.png`} className="absolute top-1/2 right-[-20px] w-24 h-24 transform -translate-y-1/2 rotate-12 drop-shadow-lg" alt="Like" />
            </div>
          </FadeIn>
          <FadeIn delay={0.5} className="absolute top-10 left-10 right-[-10px] z-10 transform rotate-[6deg] opacity-60">
            <div className="bg-white p-4 pb-12 rounded-[24px] shadow-lg">
              <img src={`${base}brand/girl-card-bg.jpg`} className="w-full h-[400px] object-cover rounded-[16px]" alt="" />
            </div>
          </FadeIn>
          
          <img src={`${base}brand/butterfly.png`} className="absolute -top-10 -left-10 w-20 h-20 z-30 animate-bounce" style={{ animationDuration: '3s' }} alt="" />
        </div>
      </section>

      {/* Problem / Solution Section */}
      <section className="py-24 px-6 bg-[#f2eddf] relative">
        <div className="max-w-3xl mx-auto text-center space-y-8 relative z-10">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-bold">Choosing a name should feel exciting, not overwhelming</h2>
          </FadeIn>
          <FadeIn delay={0.2}>
            <p className="text-xl text-[#897a72]">
              Baby name lists are endless. Conversations get repetitive. And it's hard to know which names your partner actually likes.
            </p>
          </FadeIn>
          <FadeIn delay={0.3}>
            <p className="text-xl text-[#42342c] font-medium">
              WeName makes it simple: you each swipe on names privately, then the app shows you the names you both love.
            </p>
          </FadeIn>
          <FadeIn delay={0.4}>
            <p className="text-lg text-[#897a72] font-hand text-2xl">
              No guessing. No giant spreadsheets. Just a fun way to find your favourites together.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* What is WeName? */}
      <section className="py-24 px-6 max-w-3xl mx-auto text-center">
        <FadeIn>
          <h2 className="text-3xl md:text-4xl font-bold mb-8">What is WeName?</h2>
        </FadeIn>
        <FadeIn delay={0.2}>
          <p className="text-xl text-[#897a72] leading-relaxed">
            WeName is a <strong className="text-[#42342c]">baby name app for couples</strong>. Each partner swipes through baby names independently, and WeName shows the names both people liked. It helps expecting parents build a shared shortlist without managing separate notes, screenshots, or text threads.
          </p>
        </FadeIn>
      </section>

      {/* How it Works Section */}
      <section className="py-24 px-6 max-w-5xl mx-auto">
        <FadeIn>
          <h2 className="text-4xl font-bold text-center mb-16 text-[#c53c5a]">How WeName works</h2>
        </FadeIn>
        
        <div className="grid md:grid-cols-2 gap-16">
          <FadeIn delay={0.1} className="space-y-4">
            <div className="w-12 h-12 bg-[#fbb02d] rounded-full flex items-center justify-center text-white font-bold text-xl mb-6">1</div>
            <h3 className="text-2xl font-bold">Swipe through names</h3>
            <p className="text-[#897a72] text-lg">Discover names one card at a time. Like the ones that feel right and pass on the ones that don't.</p>
          </FadeIn>
          
          <FadeIn delay={0.2} className="space-y-4">
            <div className="w-12 h-12 bg-[#3168a5] rounded-full flex items-center justify-center text-white font-bold text-xl mb-6">2</div>
            <h3 className="text-2xl font-bold">Invite your partner</h3>
            <p className="text-[#897a72] text-lg">Share your invite link so your partner can join and swipe from their own phone.</p>
          </FadeIn>
          
          <FadeIn delay={0.3} className="space-y-4">
            <div className="w-12 h-12 bg-[#c53c5a] rounded-full flex items-center justify-center text-white font-bold text-xl mb-6">3</div>
            <h3 className="text-2xl font-bold">See your matches</h3>
            <p className="text-[#897a72] text-lg">When you both like the same name, it becomes a match.</p>
          </FadeIn>
          
          <FadeIn delay={0.4} className="space-y-4">
            <div className="w-12 h-12 bg-[#31825a] rounded-full flex items-center justify-center text-white font-bold text-xl mb-6">4</div>
            <h3 className="text-2xl font-bold">Build your shortlist</h3>
            <p className="text-[#897a72] text-lg">Save, rank, and narrow down your favourite names together.</p>
          </FadeIn>
        </div>
      </section>

      {/* App Screenshots Section */}
      <section className="py-24 px-6 bg-[#f2eddf]">
        <div className="max-w-5xl mx-auto">
          <FadeIn className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">See WeName in action</h2>
            <p className="text-xl text-[#897a72]">A simple, beautiful experience built for couples.</p>
          </FadeIn>

          {/* Swipe screenshot — full-width feature row */}
          <FadeIn delay={0.1} className="flex flex-col md:flex-row items-center gap-10 md:gap-16 mb-20">
            <div className="flex-1 space-y-5 text-center md:text-left">
              <div className="w-12 h-12 bg-[#fbb02d] rounded-full flex items-center justify-center text-white font-bold text-xl mx-auto md:mx-0">1</div>
              <h3 className="text-2xl font-bold">Swipe through names</h3>
              <p className="text-[#897a72] text-lg leading-relaxed">Each partner swipes independently — like, pass, or save names one card at a time. Boy names, girl names, or both.</p>
            </div>
            <div className="flex-1 flex justify-center">
              <img
                src={`${base}brand/screenshot-swipe.png`}
                alt="WeName swipe cards showing Henry and Marilyn on iPhone"
                className="w-full drop-shadow-2xl"
                style={{ maxWidth: 420, borderRadius: 8 }}
              />
            </div>
          </FadeIn>

          {/* Names list + match popup row */}
          <div className="grid md:grid-cols-2 gap-12 items-center">

            {/* Names list screenshot */}
            <FadeIn delay={0.2} className="flex flex-col items-center gap-5">
              <img
                src={`${base}brand/screenshot-names.png`}
                alt="WeName names list showing Your Picks tab with Drew, Jordan, Archer and more"
                className="drop-shadow-2xl"
                style={{ maxWidth: 240, width: '100%', borderRadius: 44 }}
              />
              <div className="text-center">
                <p className="font-semibold text-[#42342c] text-lg">Build your shortlist</p>
                <p className="text-[#897a72] text-sm mt-1 max-w-[200px] mx-auto">Rank your favourites and manage every name in one place</p>
              </div>
            </FadeIn>


            {/* Match popup mockup */}
            <FadeIn delay={0.3} className="flex flex-col items-center gap-5">
              <div className="rounded-[44px] overflow-hidden shadow-2xl relative" style={{ width: 240, height: 500, border: '5px solid #1c1c1e' }}>
                <img src={`${base}brand/girl-card-bg.jpg`} className="absolute inset-0 w-full h-full object-cover" alt="" />
                <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.52)' }} />
                <div className="absolute inset-0 flex items-center justify-center px-5">
                  <div className="bg-white rounded-3xl w-full shadow-2xl text-center" style={{ padding: '22px 18px' }}>
                    <div style={{ fontSize: 32, marginBottom: 6 }}>🎉</div>
                    <p className="font-bold text-[#897a72] tracking-widest uppercase" style={{ fontSize: 9, marginBottom: 8 }}>It's a Match!</p>
                    <p className="font-bold text-[#c53c5a]" style={{ fontSize: 32, lineHeight: 1.1, marginBottom: 6 }}>Aria</p>
                    <p className="text-[#897a72] leading-snug" style={{ fontSize: 10, marginBottom: 16 }}>You and your partner both love this name!</p>
                    <div className="flex gap-2 flex-col">
                      <div className="rounded-full flex items-center justify-center" style={{ backgroundColor: '#3168a5', paddingTop: 9, paddingBottom: 9 }}>
                        <span className="text-white font-bold" style={{ fontSize: 11 }}>See All Matches</span>
                      </div>
                      <div className="rounded-full flex items-center justify-center" style={{ border: '1px solid rgba(137,122,114,0.35)', paddingTop: 8, paddingBottom: 8 }}>
                        <span className="text-[#897a72]" style={{ fontSize: 11 }}>Keep Swiping</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-center">
                <p className="font-semibold text-[#42342c] text-lg">Celebrate your matches</p>
                <p className="text-[#897a72] text-sm mt-1 max-w-[200px] mx-auto">See the names you both love the moment they match</p>
              </div>
            </FadeIn>

          </div>
        </div>
      </section>

      {/* Empathy Section */}
      <section className="py-24 px-6 relative overflow-hidden">
        <div className="absolute top-1/2 left-0 transform -translate-y-1/2 -translate-x-1/2 opacity-20">
          <img src={`${base}brand/like_sun.png`} className="w-64 h-64" alt="" />
        </div>
        <div className="max-w-4xl mx-auto text-center space-y-8 relative z-10">
          <FadeIn>
            <h2 className="text-3xl md:text-5xl font-bold text-[#3168a5]">Stop wondering what your partner thinks</h2>
          </FadeIn>
          <FadeIn delay={0.2}>
            <p className="text-xl text-[#897a72] leading-relaxed max-w-2xl mx-auto">
              Instead of asking "what do you think of this one?" over and over, WeName helps you see where your tastes overlap.
            </p>
          </FadeIn>
          <FadeIn delay={0.3}>
            <p className="text-xl text-[#42342c] font-medium max-w-2xl mx-auto">
              It's perfect for couples who want a more playful, low-pressure way to make one of life's sweetest decisions.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 px-6 bg-white/50">
        <div className="max-w-6xl mx-auto">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">Everything you need to choose together</h2>
          </FadeIn>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { title: "Beautiful name cards", desc: "Each name includes helpful details like pronunciation, origin, meaning, nicknames, and popularity.", color: "#3168a5" },
              { title: "Shared matches", desc: "See the names you both liked in one place.", color: "#c53c5a" },
              { title: "Personal favourites", desc: "Keep a private list of names you love before narrowing things down together.", color: "#fbb02d" },
              { title: "Partner invite links", desc: "Bring your partner in with a simple link or code.", color: "#31825a" },
              { title: "Shortlist ranking", desc: "Drag, reorder, and star your favourites as you get closer to the perfect name.", color: "#42342c" },
              { title: "AI name suggestions", desc: "Premium users can discover personalized suggestions based on the names they already like.", color: "#897a72" },
            ].map((feature, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <div className="bg-[#f5f1e8] p-8 rounded-3xl h-full border border-[#897a72]/10 hover:shadow-lg transition-shadow">
                  <h3 className="text-xl font-bold mb-3" style={{ color: feature.color }}>{feature.title}</h3>
                  <p className="text-[#897a72]">{feature.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Premium Section */}
      <section className="py-24 px-6 text-center max-w-3xl mx-auto">
        <FadeIn>
          <div className="inline-block px-4 py-1 rounded-full bg-[#fbb02d]/20 text-[#d97706] font-bold text-sm tracking-wide mb-6">PREMIUM</div>
          <h2 className="text-4xl font-bold mb-6">Want to keep going?</h2>
          <p className="text-xl text-[#897a72] mb-8">WeName is free to start. Upgrade to Premium for:</p>
          
          <ul className="text-left max-w-md mx-auto space-y-4 mb-12 text-lg">
            <li className="flex items-center gap-3"><span className="text-[#31825a]">✓</span> Unlimited daily swipes and likes</li>
            <li className="flex items-center gap-3"><span className="text-[#31825a]">✓</span> Unlimited match reveals</li>
            <li className="flex items-center gap-3"><span className="text-[#31825a]">✓</span> Access to themed name packs</li>
            <li className="flex items-center gap-3"><span className="text-[#31825a]">✓</span> AI name suggestions based on your taste</li>
          </ul>
          
          <p className="text-2xl font-bold mb-8">Premium: $7.99 one-time purchase</p>
          
          <Button className="bg-[#42342c] text-white hover:bg-[#42342c]/90 rounded-full px-8 py-6 text-lg">
            Download WeName
          </Button>
        </FadeIn>
      </section>

      {/* Possibilities Section */}
      <section className="py-24 px-6 bg-[#f2eddf] relative">
        <div className="max-w-4xl mx-auto text-center space-y-8 relative z-10">
          <FadeIn>
            <img src={`${base}brand/wename-logo.png`} alt="WeName" className="h-12 mx-auto mb-4 opacity-80" />
            <h2 className="text-3xl md:text-5xl font-bold text-[#42342c]">The name is in there somewhere</h2>
          </FadeIn>
          <FadeIn delay={0.2}>
            <p className="text-xl text-[#897a72] leading-relaxed max-w-2xl mx-auto">
              Maybe it's classic. Maybe it's unexpected. Maybe it's a name neither of you would have found on your own.
            </p>
          </FadeIn>
          <FadeIn delay={0.3}>
            <p className="text-xl text-[#c53c5a] font-medium max-w-2xl mx-auto">
              WeName helps you explore the possibilities together — until the right name starts to stand out.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 px-6 bg-[#f2eddf]">
        <div className="max-w-3xl mx-auto">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">Frequently asked questions</h2>
          </FadeIn>
          <div className="space-y-8">
            {[
              {
                q: "What is WeName?",
                a: "WeName is a baby name app for couples. It lets each partner swipe through baby names separately, then shows the names both people liked.",
              },
              {
                q: "Is WeName a baby name app for couples?",
                a: "Yes. WeName is designed for couples choosing a baby name together. Partners can swipe independently and build a shared shortlist of names they both like.",
              },
              {
                q: "Is there a Tinder-style app for baby names?",
                a: "WeName uses a swipe-based experience for baby names. You swipe on names you like, and when your partner likes the same name, it becomes a match.",
              },
              {
                q: "Can I use WeName without a partner?",
                a: "Yes. You can use WeName on your own to swipe through names, save favorites, and build a shortlist.",
              },
              {
                q: "Does WeName include baby name meanings?",
                a: "Yes. WeName includes name details such as meaning, origin, and pronunciation where available.",
              },
              {
                q: "Does WeName have AI baby name suggestions?",
                a: "Yes. WeName offers AI Suggestions based on names you like and your naming style.",
              },
              {
                q: "Is WeName free?",
                a: "WeName is free to download. Premium features are available through an optional in-app purchase.",
              },
            ].map((item, i) => (
              <FadeIn key={i} delay={i * 0.05}>
                <div className="bg-[#f5f1e8] rounded-2xl p-6 border border-[#897a72]/10">
                  <h3 className="text-lg font-bold text-[#42342c] mb-2">{item.q}</h3>
                  <p className="text-[#897a72]">{item.a}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="pt-24 pb-12 relative overflow-hidden flex flex-col items-center">
        <div className="absolute bottom-0 left-0 right-0 h-32 opacity-80 pointer-events-none" style={{ backgroundImage: `url(${base}brand/grass-flower-border.png)`, backgroundRepeat: 'repeat-x', backgroundPosition: 'bottom' }}></div>
        
        <FadeIn className="text-center z-10 px-6 max-w-2xl mb-32">
          <img src={`${base}brand/wename-logo.png`} alt="WeName" className="h-16 mx-auto mb-8 drop-shadow-sm" />
          <h2 className="text-3xl font-bold mb-6">Start finding baby names together</h2>
          <p className="text-xl text-[#897a72] mb-10">Download WeName and start building a shortlist of names you both love.</p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="https://apps.apple.com/ca/app/wename-find-baby-names/id6764540022" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center bg-black text-white px-6 py-3 rounded-full font-semibold hover:scale-105 transition-transform">
              Download on the App Store
            </a>
            <span className="inline-flex items-center justify-center bg-[#c8bfb5] text-[#7a6e66] px-6 py-3 rounded-full font-semibold cursor-default select-none">
              Google Play — Coming Soon
            </span>
          </div>
        </FadeIn>

        <div className="w-full px-6 flex flex-col md:flex-row justify-between items-center text-sm text-[#897a72] border-t border-[#897a72]/20 pt-6 pb-6 z-10">
          <p>Made for couples choosing a name together.</p>
          <div className="flex gap-4 mt-4 md:mt-0">
            <Link href="/privacy" className="hover:text-[#42342c]">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-[#42342c]">Terms</Link>
            <Link href="/support" className="hover:text-[#42342c]">Support</Link>
          </div>
        </div>
      </section>

    </div>
  );
}