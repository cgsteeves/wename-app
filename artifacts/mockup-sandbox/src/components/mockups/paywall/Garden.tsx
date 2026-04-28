import React from 'react';
import { Button } from '@/components/ui/button';

export function Garden() {
  return (
    <div className="w-full h-full min-h-screen max-w-[390px] mx-auto bg-[#f5f0e8] text-zinc-800 flex flex-col font-sans relative overflow-hidden">
      {/* Decorative Header */}
      <img 
        src="/__mockup/images/grass-flower-border.png" 
        alt="Grass and flowers"
        className="w-full object-cover" 
        style={{ height: '120px', objectPosition: 'top' }} 
      />

      <div className="flex-1 px-8 pt-6 pb-12 flex flex-col relative z-10">
        {/* Butterfly decoration */}
        <div className="absolute top-4 right-6 opacity-80 animate-pulse" style={{ animationDuration: '3s' }}>
          <img src="/__mockup/images/butterfly.png" alt="Butterfly" className="w-8 h-8 object-contain" />
        </div>

        {/* Header Section */}
        <div className="text-center mb-10 mt-4">
          <h1 className="text-3xl font-serif text-[#3e4a3d] leading-tight mb-4 tracking-tight">
            You're this close to your baby's name
          </h1>
          <p className="text-[#6b7669] text-[15px] font-medium px-4">
            Join couples who found their name together
          </p>
        </div>

        {/* Features List */}
        <div className="flex-1 flex flex-col gap-6 justify-center max-w-[280px] mx-auto w-full">
          <div className="flex items-start gap-4">
            <div className="w-6 h-6 rounded-full bg-[#4a7c59]/20 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-[#4a7c59] text-xs">🌿</span>
            </div>
            <div>
              <h3 className="font-semibold text-[#3e4a3d] text-[15px]">Unlimited Swipes</h3>
              <p className="text-[#6b7669] text-sm mt-0.5 leading-snug">Swipe on as many names as you want every day</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-6 h-6 rounded-full bg-[#4a7c59]/20 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-[#4a7c59] text-xs">🌿</span>
            </div>
            <div>
              <h3 className="font-semibold text-[#3e4a3d] text-[15px]">All Name Packs</h3>
              <p className="text-[#6b7669] text-sm mt-0.5 leading-snug">Unlock Classic, Arabic, Spiritual, and more</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-6 h-6 rounded-full bg-[#4a7c59]/20 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-[#4a7c59] text-xs">🌿</span>
            </div>
            <div>
              <h3 className="font-semibold text-[#3e4a3d] text-[15px]">AI Suggestions</h3>
              <p className="text-[#6b7669] text-sm mt-0.5 leading-snug">Get personalized names based on your matches</p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-auto pt-8 flex flex-col items-center gap-4">
          <Button 
            className="w-full h-14 bg-[#4a7c59] hover:bg-[#3d6849] text-white rounded-2xl text-[17px] font-semibold shadow-sm transition-all active:scale-[0.98]"
          >
            Unlock Premium · $7.99/mo
          </Button>
          
          <button className="text-[#8c968a] text-sm font-medium hover:text-[#4a7c59] transition-colors">
            Restore purchase
          </button>
        </div>
      </div>
      
      {/* Subtle bottom decoration */}
      <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-[#4a7c59]/5 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -top-16 -right-16 w-64 h-64 bg-[#4a7c59]/5 rounded-full blur-3xl pointer-events-none" />
    </div>
  );
}

export default Garden;
