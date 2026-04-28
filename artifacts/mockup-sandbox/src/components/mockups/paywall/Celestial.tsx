import React from "react";

export function Celestial() {
  return (
    <>
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');
      `}} />
      <div className="relative w-full max-w-[390px] mx-auto min-h-[100dvh] flex flex-col bg-gradient-to-b from-[#f59e0b] via-[#fef3c7] to-[#fffbeb] overflow-hidden text-neutral-800 shadow-2xl">
        {/* Texture Overlay */}
        <img 
          src="/__mockup/images/paper-texture.jpg" 
          alt=""
          style={{ opacity: 0.12 }} 
          className="absolute inset-0 w-full h-full object-cover pointer-events-none mix-blend-multiply" 
        />
        
        {/* Content Container */}
        <div className="relative z-10 flex flex-col items-center justify-between min-h-[100dvh] px-6 py-12">
          
          {/* Top section: Sun & Match Bubbles */}
          <div className="flex flex-col items-center w-full mt-6">
            <img 
              src="/__mockup/images/like_sun.png" 
              alt="Sun" 
              className="w-24 h-24 mx-auto mb-10 drop-shadow-md" 
            />
            
            {/* Match Bubbles */}
            <div className="flex items-center justify-center gap-4 mb-10 w-full">
              <div className="bg-white/80 backdrop-blur-md px-7 py-3.5 rounded-full shadow-md border border-amber-100/50">
                <span className="text-xl font-medium text-amber-900">Oliver</span>
              </div>
              <div className="text-amber-500 text-2xl animate-pulse">
                ♥
              </div>
              <div className="bg-white/80 backdrop-blur-md px-7 py-3.5 rounded-full shadow-md border border-amber-100/50">
                <span className="text-xl font-medium text-amber-900">Isla</span>
              </div>
            </div>
            
            {/* Headline */}
            <h1 
              className="text-[2.75rem] font-bold text-center text-amber-950 mb-10 leading-[1.1] tracking-tight"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Your perfect name<br />is out there
            </h1>
          </div>

          {/* Features */}
          <div className="flex flex-col gap-4 w-full px-4 mb-10">
            <div className="flex items-start gap-4">
              <span className="text-amber-500/80 text-xl mt-0.5">✦</span>
              <p className="text-amber-950/80 text-[1.1rem] font-medium">Unlimited daily swipes & likes</p>
            </div>
            <div className="flex items-start gap-4">
              <span className="text-amber-500/80 text-xl mt-0.5">✦</span>
              <p className="text-amber-950/80 text-[1.1rem] font-medium">Access to all name packs</p>
            </div>
            <div className="flex items-start gap-4">
              <span className="text-amber-500/80 text-xl mt-0.5">✦</span>
              <p className="text-amber-950/80 text-[1.1rem] font-medium">AI name suggestions</p>
            </div>
          </div>

          {/* Bottom section: CTA & Restore */}
          <div className="w-full flex flex-col items-center mt-auto pb-4 gap-4">
            <button className="w-full py-4 px-8 rounded-full bg-gradient-to-r from-amber-500 to-orange-400 text-white font-semibold text-[1.1rem] shadow-xl shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all border border-amber-400/50">
              Unlock Premium · $7.99/mo
            </button>
            <button className="text-amber-900/40 font-medium text-sm hover:text-amber-900/80 transition-colors uppercase tracking-wider mt-2">
              Restore purchase
            </button>
          </div>

        </div>
      </div>
    </>
  );
}
