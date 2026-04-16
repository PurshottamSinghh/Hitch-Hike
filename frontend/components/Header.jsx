import { Trophy, Rocket, Menu, User as UserIcon } from "lucide-react";
import UserStats from "./UserStats";
import { useState } from "react";
import ProfileModal from "./ProfileModal";

export default function Header({ onTrophyClick }) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-[50] p-4 flex justify-center">
        <div className="w-full max-w-7xl gs-surface px-6 py-3 flex items-center justify-between">
          
          {/* Logo Section */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30">
              <Rocket size={24} fill="currentColor" />
            </div>
            <div>
              <h1 className="text-xl font-black italic tracking-tighter text-white uppercase leading-none">
                Hitch-Hike
              </h1>
              <span className="text-[10px] font-bold text-indigo-400 tracking-[0.2em] uppercase">
                Rocket Campus
              </span>
            </div>
          </div>

          {/* Actions Section */}
          <div className="flex items-center gap-4">
            <div 
              onClick={() => setIsProfileOpen(true)}
              className="cursor-pointer hover:scale-105 transition-transform"
            >
              <UserStats />
            </div>
            
            <button 
              onClick={() => setIsProfileOpen(true)}
              className="p-2.5 rounded-xl bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all border border-white/5"
              title="View Profile"
            >
              <UserIcon size={18} />
            </button>

            <div className="h-6 w-[1px] bg-white/10" />

            <button 
              onClick={onTrophyClick}
              className="gs-btn-accent"
            >
              <Trophy size={18} fill="currentColor" />
              <span className="hidden sm:inline">Leaderboard</span>
            </button>

            <button className="p-2 rounded-xl hover:bg-white/5 text-slate-400 lg:hidden">
              <Menu size={24} />
            </button>
          </div>
        </div>
      </header>

      <ProfileModal 
        isOpen={isProfileOpen} 
        onClose={() => setIsProfileOpen(false)} 
      />
    </>
  );
}
