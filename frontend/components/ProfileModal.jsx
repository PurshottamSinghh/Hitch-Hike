"use client";

import { X, User, LogOut, Mail, Shield, Award, Calendar } from "lucide-react";
import { logout } from "@/lib/api";
import { useEffect, useState } from "react";

export default function ProfileModal({ isOpen, onClose }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (isOpen) {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 animate-in fade-in duration-300">
      <div 
        className="absolute inset-0 bg-[#06080c]/80 backdrop-blur-xl" 
        onClick={onClose} 
      />
      
      <div className="relative w-full max-w-lg bg-[#141824]/90 border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Background Glow */}
        <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-indigo-500/20 to-transparent" />
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-xl bg-white/5 text-slate-400 hover:text-white transition-colors z-10"
        >
          <X size={20} />
        </button>

        <div className="relative p-8 pt-12">
          {/* Profile Header */}
          <div className="flex flex-col items-center mb-10 text-center">
            <div className="w-24 h-24 rounded-[2rem] bg-indigo-500 p-1 mb-6 shadow-2xl shadow-indigo-500/20 rotate-3 transition-transform hover:rotate-0">
               <div className="w-full h-full rounded-[1.8rem] bg-[#141824] flex items-center justify-center">
                 <User size={48} className="text-white" />
               </div>
            </div>
            <h2 className="text-3xl font-black text-white italic tracking-tight uppercase">
              {user?.username || "Rocket Member"}
            </h2>
            <p className="text-xs font-bold text-indigo-400 uppercase tracking-[0.2em] mt-1">
              {user?.profile?.role === 'driver' ? 'Certified Driver' : 'Active Rider'}
            </p>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
            <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/[0.06] flex items-center gap-4 group hover:bg-white/[0.06] transition-all">
                <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-white transition-colors">
                    <Mail size={18} />
                </div>
                <div>
                   <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-0.5">Campus Email</p>
                   <p className="text-xs font-bold text-white truncate max-w-[140px]">{user?.email || "No Email Found"}</p>
                </div>
            </div>

            <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/[0.06] flex items-center gap-4 group hover:bg-white/[0.06] transition-all">
                <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-white transition-colors">
                    <Shield size={18} />
                </div>
                <div>
                   <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-0.5">Status</p>
                   <p className="text-xs font-bold text-emerald-400 uppercase">Verified Member</p>
                </div>
            </div>

            <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/[0.06] flex items-center gap-4 group hover:bg-white/[0.06] transition-all">
                <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-white transition-colors">
                    <Award size={18} />
                </div>
                <div>
                   <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-0.5">Points Tier</p>
                   <p className="text-xs font-bold text-amber-400 uppercase">Bronze Rocket</p>
                </div>
            </div>

            <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/[0.06] flex items-center gap-4 group hover:bg-white/[0.06] transition-all">
                <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-white transition-colors">
                    <Calendar size={18} />
                </div>
                <div>
                   <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-0.5">Joined</p>
                   <p className="text-xs font-bold text-white">Spring 2026</p>
                </div>
            </div>
          </div>

          {/* Logout Section */}
          <button
            onClick={logout}
            className="w-full py-5 flex items-center justify-center gap-3 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 rounded-3xl font-black text-xs uppercase tracking-[0.2em] transition-all animate-pulse hover:animate-none"
          >
            <LogOut size={18} />
            Logout from Rocket Network
          </button>
        </div>
      </div>
    </div>
  );
}
