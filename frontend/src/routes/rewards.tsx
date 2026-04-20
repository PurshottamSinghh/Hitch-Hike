import { createFileRoute } from "@tanstack/react-router";
import { Trophy, Crown, Leaf, DollarSign, Flame } from "lucide-react";
import { PhoneFrame, Avatar, Pill, SectionHeader } from "@/components/app-shell";
import { BottomNav } from "@/components/bottom-nav";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import * as api from "@/lib/api";

export const badges = [
  {
    id: "b1",
    name: "First Loop",
    description: "Completed your first ride",
    icon: "🌀",
    earned: true,
  },
  { id: "b2", name: "Eco Warrior", description: "Saved 100kg of CO₂", icon: "🌱", earned: true },
  { id: "b3", name: "Night Driver", description: "10 rides after 8pm", icon: "🌙", earned: true },
  {
    id: "b4",
    name: "Perfect Week",
    description: "5 rides in a single week",
    icon: "✨",
    earned: false,
    progress: 80,
  },
  {
    id: "b5",
    name: "Campus Connector",
    description: "Ride with 25 unique students",
    icon: "🤝",
    earned: false,
    progress: 64,
  },
  {
    id: "b6",
    name: "Century Club",
    description: "100 total rides",
    icon: "💯",
    earned: false,
    progress: 79,
  },
];

export const Route = createFileRoute("/rewards")({
  head: () => ({
    meta: [{ title: "Rewards — Loop" }],
  }),
  component: Rewards,
});

function Rewards() {
  const { data: rawProfile, isLoading: isProfileLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: api.fetchProfile,
  });
  const { data: rawLeaderboard = [] } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: api.fetchLeaderboard,
  });

  if (isProfileLoading || !rawProfile) {
    return (
      <PhoneFrame>
        <div className="flex p-4 text-muted-foreground">Loading...</div>
      </PhoneFrame>
    );
  }

  const currentUser = {
    level: rawProfile.stats?.level || 1,
    levelName: "Trusted Driver",
    xp: rawProfile.stats?.points || 0,
    xpNext: 1000 * (rawProfile.stats?.level || 1),
    co2SavedKg: rawProfile.stats?.points ? Math.floor(rawProfile.stats.points / 10) : 0,
    moneySavedUsd: rawProfile.stats?.points ? Math.floor(rawProfile.stats.points / 5) : 0,
    streak: rawProfile.stats?.streak_days || 0,
  };

  const leaderboard = rawLeaderboard.map((u: any, i: number) => ({
    rank: i + 1,
    name: u.username,
    initials: u.username.substring(0, 2).toUpperCase(),
    rides: u.stats?.rides_given + u.stats?.rides_taken || 0,
    co2: u.stats?.points ? Math.floor(u.stats.points / 10) : 0,
    isYou: u.username === rawProfile.username,
  }));

  const xpPct = (currentUser.xp / Math.max(currentUser.xpNext, 1)) * 100;

  return (
    <PhoneFrame>
      <BottomNav />

      <header>
        <p className="text-[13px] font-semibold uppercase tracking-[0.2em] text-accent">Rewards</p>
        <h1 className="mt-1 text-[28px] font-bold leading-tight tracking-tight text-foreground">
          Your impact
        </h1>
      </header>

      {/* Level card */}
      <section className="mt-6 overflow-hidden rounded-3xl bg-gradient-aurora p-5 text-primary-foreground shadow-glow noise">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider opacity-80">
              Level {currentUser.level}
            </p>
            <p className="mt-0.5 text-[22px] font-bold tracking-tight">{currentUser.levelName}</p>
          </div>
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md">
            <Crown className="h-7 w-7 text-accent" />
          </span>
        </div>
        <div className="mt-5">
          <div className="flex items-center justify-between text-[12px] opacity-90">
            <span>{currentUser.xp.toLocaleString()} XP</span>
            <span>{(currentUser.xpNext - currentUser.xp).toLocaleString()} to next</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-accent shadow-[0_0_12px_oklch(0.72_0.18_32_/_0.7)] transition-all duration-1000"
              style={{ width: `${xpPct}%` }}
            />
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="mt-5 grid grid-cols-3 gap-3">
        {[
          { icon: Leaf, value: `${currentUser.co2SavedKg}kg`, label: "CO₂ saved", tone: "success" },
          {
            icon: DollarSign,
            value: `$${currentUser.moneySavedUsd}`,
            label: "Saved",
            tone: "accent",
          },
          { icon: Flame, value: `${currentUser.streak}d`, label: "Streak", tone: "primary" },
        ].map((s) => {
          const Icon = s.icon;
          const tones: Record<string, string> = {
            success: "text-success bg-success/10",
            accent: "text-accent bg-accent/12",
            primary: "text-primary bg-primary/10",
          };
          return (
            <div
              key={s.label}
              className="rounded-2xl border border-border bg-surface p-3 shadow-soft"
            >
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-xl ${tones[s.tone]}`}
              >
                <Icon className="h-4 w-4" />
              </span>
              <p className="mt-2 text-[18px] font-bold tracking-tight text-foreground">{s.value}</p>
              <p className="text-[11px] text-muted-foreground">{s.label}</p>
            </div>
          );
        })}
      </section>

      {/* Badges */}
      <SectionHeader
        title="Achievements"
        subtitle={`${badges.filter((b) => b.earned).length}/${badges.length} earned`}
      />
      <section className="grid grid-cols-3 gap-3">
        {badges.map((b) => (
          <div
            key={b.id}
            className={cn(
              "rounded-2xl border p-3 text-center shadow-soft transition-all",
              b.earned
                ? "border-accent/30 bg-gradient-to-br from-accent/8 to-transparent"
                : "border-border bg-surface opacity-90",
            )}
          >
            <span
              className={cn(
                "mx-auto flex h-12 w-12 items-center justify-center rounded-2xl text-2xl",
                b.earned ? "bg-accent/15" : "bg-muted grayscale opacity-60",
              )}
            >
              {b.icon}
            </span>
            <p className="mt-2 text-[12px] font-bold tracking-tight text-foreground">{b.name}</p>
            <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">{b.description}</p>
            {!b.earned && b.progress !== undefined && (
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${b.progress}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </section>

      {/* Leaderboard */}
      <SectionHeader
        title="Leaderboard"
        subtitle="This month at UToledo"
        action={
          <Pill tone="primary">
            <Trophy className="h-3 w-3" /> Top 5%
          </Pill>
        }
      />
      <section className="overflow-hidden rounded-3xl border border-border bg-surface shadow-soft">
        {leaderboard.map((row: any, i: number) => (
          <div
            key={row.rank}
            className={cn(
              "flex items-center gap-3 px-4 py-3.5",
              i !== leaderboard.length - 1 && "border-b border-border",
              row.isYou && "bg-primary-muted/40",
            )}
          >
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold",
                row.rank === 1
                  ? "bg-accent text-accent-foreground"
                  : row.rank <= 3
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {row.rank}
            </span>
            <Avatar initials={row.initials} tone={row.isYou ? "coral" : "indigo"} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold tracking-tight text-foreground">
                {row.name}{" "}
                {row.isYou && <span className="text-[11px] font-normal text-primary">(you)</span>}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {row.rides} rides · {row.co2}kg CO₂
              </p>
            </div>
            {row.rank === 1 && <Crown className="h-4 w-4 text-accent" />}
          </div>
        ))}
      </section>

      <div className="mt-2 text-center text-[11px] text-muted-foreground">
        Resets in 11 days · keep your streak alive 🔥
      </div>
    </PhoneFrame>
  );
}
