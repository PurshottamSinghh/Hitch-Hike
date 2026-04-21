import { createFileRoute } from "@tanstack/react-router";
import { Plus, Sparkles } from "lucide-react";
import { PhoneFrame, Avatar, Pill, SectionHeader } from "@/components/app-shell";
import { BottomNav } from "@/components/bottom-nav";
import { useQuery } from "@tanstack/react-query";
import * as api from "@/lib/api";

export const Route = createFileRoute("/groups")({
  head: () => ({
    meta: [{ title: "Carpool groups — Hitch-Hike" }],
  }),
  component: Groups,
});

function Groups() {
  const { data: rawGroups = [], isLoading } = useQuery({
    queryKey: ["groups"],
    queryFn: api.fetchGroups,
  });

  if (isLoading) {
    return (
      <PhoneFrame>
        <div className="flex p-4 text-muted-foreground">Loading groups...</div>
      </PhoneFrame>
    );
  }

  const groups = rawGroups.map((g: any) => ({
    id: g.id.toString(),
    name: g.nickname || "Unnamed group",
    emoji: "🚗",
    members:
      g.members?.map((username: string) => ({
        initials: username.substring(0, 2).toUpperCase(),
        tone: "indigo",
      })) || [],
    frequency: g.last_ride_date ? "Recent activity" : "Active",
    ridesShared: g.rides_completed || 0,
    co2SavedKg: (g.rides_completed || 0) * 2,
  }));

  return (
    <PhoneFrame>
      <BottomNav />

      <header className="flex items-start justify-between">
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-[0.2em] text-accent">
            Your circle
          </p>
          <h1 className="mt-1 text-[28px] font-bold leading-tight tracking-tight text-foreground">
            Carpool groups
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Recurring crews, named by AI from how you ride.
          </p>
        </div>
        <button className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-glow">
          <Plus className="h-4 w-4" />
        </button>
      </header>

      <div className="mt-6 space-y-4">
        {groups.map((g: any, i: number) => (
          <article
            key={g.id}
            className="animate-rise overflow-hidden rounded-3xl border border-border bg-gradient-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-elevated"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-muted text-2xl">
                  {g.emoji}
                </span>
                <div>
                  <p className="text-[16px] font-bold tracking-tight text-foreground">{g.name}</p>
                  <p className="text-[12px] text-muted-foreground">{g.frequency}</p>
                </div>
              </div>
              <Pill tone="accent">
                <Sparkles className="h-3 w-3" /> AI-named
              </Pill>
            </div>

            {/* members */}
            <div className="mt-4 flex items-center gap-2">
              <div className="flex -space-x-2">
                {g.members.map((m: any, idx: number) => (
                  <Avatar key={idx} initials={m.initials} tone={m.tone} size="md" ring />
                ))}
              </div>
              <span className="text-[12px] text-muted-foreground">{g.members.length} members</span>
            </div>

            {/* stats */}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-2xl bg-muted/60 p-3">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Rides shared
                </p>
                <p className="mt-1 text-[18px] font-bold tracking-tight text-foreground">
                  {g.ridesShared}
                </p>
              </div>
              <div className="rounded-2xl bg-success/10 p-3">
                <p className="text-[10px] uppercase tracking-wider text-success">CO₂ saved</p>
                <p className="mt-1 text-[18px] font-bold tracking-tight text-success">
                  {g.co2SavedKg}kg
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>

      <SectionHeader title="Suggested" subtitle="Based on overlapping schedules" />
      <div className="rounded-3xl border border-dashed border-border bg-surface p-5 text-center shadow-soft">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/12 text-2xl">
          🚀
        </span>
        <p className="mt-3 text-[14px] font-semibold tracking-tight text-foreground">
          Start a new crew
        </p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          We'll auto-match 3+ classmates from your major nearby.
        </p>
        <button className="mt-3 rounded-full bg-primary px-4 py-2 text-[12px] font-semibold text-primary-foreground shadow-glow">
          Find members
        </button>
      </div>
    </PhoneFrame>
  );
}
