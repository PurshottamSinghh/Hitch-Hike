"use client";

import {
  Search,
  Car,
  MapPin,
  Trophy,
  User,
  ChevronRight,
} from "lucide-react";

const NAV_ITEMS = [
  { id: "find", label: "Find Ride", icon: Search, active: true },
  { id: "offer", label: "Offer Ride", icon: Car },
  { id: "trips", label: "My Trips", icon: MapPin },
  { id: "board", label: "Leaderboard", icon: Trophy },
  { id: "profile", label: "Profile", icon: User },
];

export default function Sidebar() {
  return (
    <>
      {/* ─── Desktop Sidebar (left) ─────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-[72px] h-full bg-[#0d1117] border-r border-white/[0.06] py-6 items-center gap-1 z-30">
        {/* Logo */}
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-extrabold text-lg mb-8 shadow-lg shadow-indigo-500/30">
          H
        </div>

        {/* Nav icons */}
        <nav className="flex flex-col items-center gap-1 flex-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                title={item.label}
                className={`group relative w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200
                  ${
                    item.active
                      ? "bg-indigo-500/15 text-indigo-400"
                      : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]"
                  }`}
              >
                <Icon size={20} strokeWidth={item.active ? 2.2 : 1.8} />
                {item.active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-indigo-500 rounded-r-full" />
                )}
                {/* Tooltip */}
                <span className="absolute left-full ml-3 px-2.5 py-1 bg-slate-800 text-xs font-medium text-slate-200 rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap shadow-xl">
                  {item.label}
                  <ChevronRight
                    size={10}
                    className="absolute -left-1 top-1/2 -translate-y-1/2 text-slate-800"
                  />
                </span>
              </button>
            );
          })}
        </nav>

        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-emerald-500/20 cursor-pointer hover:scale-110 transition-transform">
          PS
        </div>
      </aside>

      {/* ─── Mobile Bottom Bar ──────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-[#0d1117]/95 backdrop-blur-xl border-t border-white/[0.06] flex items-center justify-around z-50 px-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl transition-all
                ${
                  item.active
                    ? "text-indigo-400"
                    : "text-slate-500 hover:text-slate-400"
                }`}
            >
              <Icon size={20} strokeWidth={item.active ? 2.2 : 1.6} />
              <span className="text-[10px] font-medium">{item.label}</span>
              {item.active && (
                <span className="absolute bottom-1 w-5 h-[2px] bg-indigo-500 rounded-full" />
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
}
