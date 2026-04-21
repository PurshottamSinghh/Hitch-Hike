"use client";

import { useState } from "react";
import {
  Search,
  Car,
  MapPin,
  Trophy,
  User,
  ChevronRight,
  LogOut
} from "lucide-react";
import LeaderboardModal from "./LeaderboardModal";

const NAV_ITEMS = [
  { id: "find", label: "Fleet View", icon: Search, active: true },
  { id: "offer", label: "Offer Ride", icon: Car },
  { id: "trips", label: "My Trips", icon: MapPin },
  { id: "profile", label: "Profile", icon: User },
];

export default function Sidebar() {
  return (
    <>
      {/* ─── Desktop Sidebar ─────────────────────────────────────────── */}
      <aside className="fixed left-6 top-28 bottom-6 w-20 z-40 hidden lg:flex flex-col items-center py-8 gs-surface overflow-hidden">
        {/* Nav items */}
        <nav className="flex flex-col gap-4 w-full px-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                title={item.label}
                className={`relative w-full aspect-square rounded-2xl flex items-center justify-center transition-all group
                  ${item.active 
                    ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30" 
                    : "text-slate-500 hover:text-white hover:bg-white/5"}`}
              >
                <Icon size={24} strokeWidth={2.5} />
                <span className="absolute left-full ml-4 px-3 py-1.5 bg-slate-800 text-[10px] font-black uppercase tracking-widest text-white rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-all translate-x-[-10px] group-hover:translate-x-0">
                  {item.label}
                </span>
                {item.active && (
                  <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-indigo-400 rounded-r-full blur-[2px]" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="mt-auto flex flex-col gap-6">
          <button className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-all">
            <LogOut size={20} />
          </button>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 border-2 border-white/20 shadow-lg" />
        </div>
      </aside>

      {/* ─── Mobile Bottom Bar ──────────────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-6 left-6 right-6 h-20 gs-surface flex items-center justify-around px-4 z-[1000]">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`flex flex-col items-center gap-1 group
                ${item.active ? "text-indigo-400" : "text-slate-500"}`}
            >
              <div className={`p-2.5 rounded-2xl transition-all ${item.active ? "bg-indigo-500/20 shadow-inner" : ""}`}>
                <Icon size={22} strokeWidth={item.active ? 2.5 : 2} />
              </div>
            </button>
          );
        })}
        <button className="w-12 h-12 rounded-2xl bg-indigo-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/40">
          <Car size={24} fill="currentColor" />
        </button>
      </nav>
    </>
  );
}
