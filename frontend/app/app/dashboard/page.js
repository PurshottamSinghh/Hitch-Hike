"use client";

import { useRouter } from "next/navigation";
import { Rocket, Stepper, Car, ChevronRight, MapPin, ShieldCheck, Trophy } from "lucide-react";
import Header from "@/components/Header";
import { useState } from "react";
import LeaderboardModal from "@/components/LeaderboardModal";

export default function DashboardSelection() {
  const router = useRouter();
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);

  const choices = [
    {
      id: "rider",
      title: "Get a Ride",
      subtitle: "Need to get across campus?",
      desc: "Find reliable student drivers near you and earn points for your journey.",
      icon: Rocket,
      color: "bg-indigo-500",
      glow: "shadow-indigo-500/30",
      path: "/app/rider"
    },
    {
      id: "driver",
      title: "Give a Ride",
      subtitle: "Heading to a class anyway?",
      desc: "Help your fellow Rockets, reduce campus traffic, and climb the leaderboard.",
      icon: Car,
      color: "bg-amber-500",
      glow: "shadow-amber-500/30",
      path: "/app/driver"
    }
  ];

  return (
    <div className="min-h-screen bg-var(--color-bg-primary) flex flex-col relative overflow-hidden">
      {/* Premium background decorations */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-500/10 blur-[150px] rounded-full" />
      
      <Header onTrophyClick={() => setIsLeaderboardOpen(true)} />
      
      <LeaderboardModal 
        isOpen={isLeaderboardOpen} 
        onClose={() => setIsLeaderboardOpen(false)} 
      />

      <main className="flex-1 flex flex-col items-center justify-center p-6 mt-16">
        <div className="text-center mb-12 animate-fadeInUp">
          <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase mb-2">
            Welcome Back, Rocket
          </h2>
          <p className="text-slate-400 font-bold uppercase tracking-[0.3em] text-[10px]">
            Select your mission for today
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl h-[500px]">
          {choices.map((choice, index) => (
            <div 
              key={choice.id}
              onClick={() => router.push(choice.path)}
              className="gs-card-hero group animate-fadeInUp"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className={`icon-wrapper ${choice.color} text-white shadow-2xl ${choice.glow}`}>
                <choice.icon size={40} fill="currentColor" />
              </div>
              
              <div>
                <p className="text-indigo-400 font-black uppercase tracking-widest text-[10px] mb-2">
                  {choice.subtitle}
                </p>
                <h3 className="text-3xl font-black text-white italic tracking-tight uppercase mb-4">
                  {choice.title}
                </h3>
                <p className="text-slate-400 text-sm font-medium leading-relaxed max-w-[280px]">
                  {choice.desc}
                </p>
              </div>

              <div className="mt-4 flex items-center gap-2 text-white font-black text-xs uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                Launch Mission <ChevronRight size={16} className="text-indigo-400" />
              </div>
            </div>
          ))}
        </div>

        {/* Footer info */}
        <div className="mt-16 flex items-center gap-12 text-slate-500 animate-fadeInUp" style={{ animationDelay: "0.3s" }}>
          <div className="flex items-center gap-2">
            <MapPin size={16} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Main Campus Active</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Safe & Verified</span>
          </div>
          <div className="flex items-center gap-2">
            <Trophy size={16} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Leaderboard Live</span>
          </div>
        </div>
      </main>
    </div>
  );
}
