import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Editorial() {
  return (
    <div className="min-h-screen max-w-[390px] mx-auto bg-[#fafaf8] text-[#3d2c1e] flex flex-col relative px-8 py-12 font-sans selection:bg-amber-200">
      {/* Top Bar */}
      <div className="flex justify-end mb-16">
        <button 
          className="p-2 rounded-full hover:bg-black/5 transition-colors"
          aria-label="Close"
        >
          <X className="w-6 h-6 text-[#3d2c1e]/60" />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col justify-center">
        {/* Header Section */}
        <div className="space-y-6 mb-16">
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-sm font-medium tracking-wide">
            $7.99 / month
          </div>
          
          <h1 
            className="text-[4rem] leading-[1.1] font-bold tracking-tight"
            style={{ fontFamily: '"Fredoka", "Outfit", "Satoshi", sans-serif' }}
          >
            ✦<br />
            Premium
          </h1>
        </div>

        {/* Features List */}
        <div className="space-y-4 mb-20 text-lg text-[#3d2c1e]/80">
          <p className="flex items-start">
            <span className="mr-3 opacity-50">—</span>
            <span>Unlimited swipes, likes and matches</span>
          </p>
          <p className="flex items-start">
            <span className="mr-3 opacity-50">—</span>
            <span>All name packs unlocked</span>
          </p>
          <p className="flex items-start">
            <span className="mr-3 opacity-50">—</span>
            <span>AI suggestions tailored to you</span>
          </p>
        </div>

        {/* Footer / CTA */}
        <div className="mt-auto space-y-6 pb-8">
          <Button 
            className="w-full h-16 text-lg font-medium bg-amber-400 hover:bg-amber-500 text-amber-950 rounded-2xl shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            Unlock Premium
          </Button>
          
          <div className="text-center">
            <button className="text-[#3d2c1e]/40 text-sm hover:text-[#3d2c1e]/60 transition-colors font-medium">
              Restore purchase
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Editorial;
