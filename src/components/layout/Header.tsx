import React from 'react';
import { Button } from '../ui';

export const Header = ({ onStart }: { onStart?: () => void }) => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-[#232f3e] bg-[#232f3e] text-white">
      <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center pt-2">
            <img 
              src="https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg" 
              alt="Amazon Logo" 
              className="h-6 brightness-0 invert" 
              referrerPolicy="no-referrer"
            />
            <span className="ml-2 text-sm font-light text-[#ff9900] translate-y-1 tracking-tight">ReviewSummariser</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <Button 
            size="sm" 
            className="bg-[#ff9900] hover:bg-[#db8a00] text-[#232f3e] font-bold border-none"
            onClick={onStart}
          >
            Get Started
          </Button>
        </div>
      </div>
    </header>
  );
};
