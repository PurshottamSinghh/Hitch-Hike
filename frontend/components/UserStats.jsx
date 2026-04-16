"use client";

import { useState, useEffect } from "react";
import { Star } from "lucide-react";

export default function UserStats() {
  const [points, setPoints] = useState(0);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;

        const res = await fetch("/api/rides/auth/profile/", {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        setPoints(data.stats?.total_points || 0);
      } catch (err) {
        console.error("Failed to fetch points", err);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-2xl group hover:bg-indigo-500/20 transition-all cursor-default">
      <div className="relative">
        <Star size={18} fill="#fbbf24" className="text-yellow-500 animate-pulse" />
        <div className="absolute inset-0 bg-yellow-400/20 blur-md rounded-full" />
      </div>
      <div className="flex flex-col">
        <span className="text-xs font-black text-white leading-none tracking-tight">{points}</span>
        <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest">Points</span>
      </div>
    </div>
  );
}
