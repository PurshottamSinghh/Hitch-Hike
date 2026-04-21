"use client";

import { useState, useEffect } from "react";
import { X, Trophy, Medal, Star, Target, Users, TrendingUp, Award } from "lucide-react";

export default function LeaderboardModal({ isOpen, onClose }) {
  const [leaderboard, setLeaderboard] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const [lbRes, profRes] = await Promise.all([
        fetch("/api/gamification/leaderboard/", { headers }),
        fetch("/api/rides/auth/profile/", { headers })
      ]);

      if (!lbRes.ok || !profRes.ok) throw new Error("Failed to fetch data");

      const lbData = await lbRes.json();
      const profData = await profRes.json();

      setLeaderboard(lbData.results || lbData);
      setCurrentUser(profData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-[#020617]/90 backdrop-blur-md">
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Card */}
      <div className="relative w-full max-w-2xl gs-surface overflow-hidden border-indigo-500/20 shadow-indigo-500/10">
        
        {/* Header */}
        <div className="p-8 border-b border-white/5 bg-indigo-500/5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Trophy size={32} />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white italic tracking-tight uppercase">Leaderboard</h2>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Global Rocket Rankings</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-white/5 text-slate-400 hover:text-white transition-all">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-4">
              <div className="w-10 h-10 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
              <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Syncing Ranks...</p>
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* User Stats Card */}
              {currentUser && (
                <div className="p-6 bg-indigo-500/10 border border-indigo-500/30 rounded-[28px] relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                    <Trophy size={80} />
                  </div>
                  <div className="flex items-center gap-4 relative z-10">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center font-black text-white text-xl">
                      {currentUser.username[0].toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-white font-bold leading-none">{currentUser.username}</h3>
                      <p className="text-indigo-400 text-[10px] font-bold uppercase tracking-widest mt-1">Your Performance</p>
                    </div>
                    <div className="gs-btn-accent pointer-events-none px-4 py-2">
                      <Star size={16} fill="currentColor" />
                      <span>{currentUser.stats?.total_points || 0}</span>
                    </div>
                  </div>
                  
                  {/* Badges */}
                  <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                    {currentUser.achievements?.map((ach, i) => (
                      <div key={i} className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-yellow-500 shadow-inner" title={ach.achievement.name}>
                        <Award size={20} />
                      </div>
                    ))}
                    {!currentUser.achievements?.length && (
                      <p className="text-[10px] text-slate-500 font-medium italic">Complete rides to unlock your first badge!</p>
                    )}
                  </div>
                </div>
              )}

              {/* Leaderboard List */}
              <div className="space-y-3">
                {leaderboard.map((user, index) => {
                  const isTopThree = index < 3;
                  return (
                    <div 
                      key={user.username}
                      className={`flex items-center gap-4 p-4 rounded-3xl border transition-all 
                        ${isTopThree 
                          ? "bg-white/5 border-indigo-500/20 scale-[1.02] shadow-lg shadow-indigo-500/5" 
                          : "bg-white/2 border-white/5 hover:border-white/10"}`}
                    >
                      <div className="w-10 flex justify-center">
                        {index === 0 ? <Medal className="text-yellow-400" size={28} /> :
                         index === 1 ? <Medal className="text-slate-300" size={26} /> :
                         index === 2 ? <Medal className="text-amber-600" size={24} /> :
                         <span className="text-slate-500 font-black text-sm">{index + 1}</span>}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-white truncate">{user.student_name || user.username}</h3>
                          {isTopThree && <span className="gs-badge bg-indigo-500/20 text-indigo-400 text-[9px]">Legend</span>}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[10px] font-bold uppercase text-slate-500 tracking-wider">
                          <div className="flex items-center gap-1"><Users size={12} /> {user.total_rides} Rides</div>
                          <div className="flex items-center gap-1"><TrendingUp size={12} /> {user.current_streak} Streak</div>
                        </div>
                      </div>

                      <div className="gs-points-pill px-3 py-1 bg-white/5 rounded-full text-indigo-400 font-black text-sm flex items-center gap-1.5 border border-white/5">
                        <Star size={14} fill="currentColor" />
                        {user.total_points}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-white/2 border-t border-white/5 flex items-center justify-between px-8">
          <p className="text-[10px] font-black uppercase text-slate-600 tracking-widest">Next Reset: Monday 12 AM</p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Live Sync</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.2); border-radius: 10px; }
      `}</style>
    </div>
  );
}
