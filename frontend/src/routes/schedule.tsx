import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Sparkles } from "lucide-react";
import { PhoneFrame, Pill, SectionHeader } from "@/components/app-shell";
import { BottomNav } from "@/components/bottom-nav";
// Schedule data inlined temporarily since backend doesn't handle class schedules yet
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/schedule")({
  head: () => ({
    meta: [{ title: "Schedule — Loop" }],
  }),
  component: Schedule,
});

const DAYS = ["M", "T", "W", "T", "F"];
export type ClassBlock = {
  id: string;
  course: string;
  code: string;
  day: 0 | 1 | 2 | 3 | 4;
  startMin: number;
  endMin: number;
  room: string;
  hasMatch?: boolean;
};

export const classBlocks: ClassBlock[] = [
  {
    id: "c1",
    course: "Algorithms",
    code: "CSE 3500",
    day: 0,
    startMin: 9 * 60,
    endMin: 10 * 60 + 15,
    room: "NI 1043",
    hasMatch: true,
  },
  {
    id: "c2",
    course: "Linear Algebra",
    code: "MATH 2890",
    day: 0,
    startMin: 11 * 60,
    endMin: 12 * 60 + 15,
    room: "UH 4040",
  },
  {
    id: "c3",
    course: "Software Eng.",
    code: "CSE 4214",
    day: 1,
    startMin: 10 * 60,
    endMin: 11 * 60 + 30,
    room: "PL 1140",
    hasMatch: true,
  },
  {
    id: "c4",
    course: "Tech Comm.",
    code: "ENGL 2950",
    day: 2,
    startMin: 9 * 60,
    endMin: 10 * 60 + 15,
    room: "FH 2400",
  },
  {
    id: "c5",
    course: "Algorithms",
    code: "CSE 3500",
    day: 2,
    startMin: 14 * 60,
    endMin: 15 * 60 + 15,
    room: "NI 1043",
  },
  {
    id: "c6",
    course: "Software Eng.",
    code: "CSE 4214",
    day: 3,
    startMin: 10 * 60,
    endMin: 11 * 60 + 30,
    room: "PL 1140",
    hasMatch: true,
  },
  {
    id: "c7",
    course: "Lab — Networks",
    code: "CSE 3550",
    day: 4,
    startMin: 13 * 60,
    endMin: 15 * 60,
    room: "NI 2090",
  },
];
const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const HOURS = Array.from({ length: 11 }, (_, i) => 8 + i); // 8am..6pm

function Schedule() {
  const [day, setDay] = useState<0 | 1 | 2 | 3 | 4>(0);
  const blocks = classBlocks.filter((b) => b.day === day);

  return (
    <PhoneFrame>
      <BottomNav />

      <header>
        <p className="text-[13px] font-semibold uppercase tracking-[0.2em] text-accent">
          This week
        </p>
        <h1 className="mt-1 text-[28px] font-bold leading-tight tracking-tight text-foreground">
          Your schedule
        </h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Tap a day to see classes and ride matches.
        </p>
      </header>

      {/* week strip */}
      <div className="mt-6 flex items-center justify-between rounded-2xl border border-border bg-surface p-2 shadow-soft">
        <button className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex flex-1 justify-between px-1">
          {DAYS.map((d, i) => {
            const active = i === day;
            const hasMatch = classBlocks.some((b) => b.day === i && b.hasMatch);
            return (
              <button
                key={i}
                onClick={() => setDay(i as 0 | 1 | 2 | 3 | 4)}
                className={cn(
                  "relative flex h-12 w-10 flex-col items-center justify-center rounded-xl text-[12px] font-semibold transition-all",
                  active
                    ? "bg-gradient-aurora text-primary-foreground shadow-glow"
                    : "text-foreground hover:bg-muted",
                )}
              >
                <span className="text-[10px] opacity-70">{d}</span>
                <span className="text-[15px] font-bold">{8 + i}</span>
                {hasMatch && !active && (
                  <span className="absolute bottom-1.5 h-1 w-1 rounded-full bg-accent" />
                )}
              </button>
            );
          })}
        </div>
        <button className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Day header */}
      <div className="mt-6 flex items-end justify-between">
        <div>
          <h2 className="text-[20px] font-bold tracking-tight text-foreground">
            {DAY_LABELS[day]}
          </h2>
          <p className="text-[12px] text-muted-foreground">
            {blocks.length} classes · {blocks.filter((b) => b.hasMatch).length} ride matches
            available
          </p>
        </div>
        <button className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-[12px] font-semibold text-primary-foreground shadow-glow">
          <Plus className="h-3.5 w-3.5" /> Add class
        </button>
      </div>

      {/* Day grid */}
      <div className="relative mt-4 rounded-3xl border border-border bg-surface p-3 shadow-soft">
        <div className="relative" style={{ height: `${HOURS.length * 56}px` }}>
          {/* hour lines */}
          {HOURS.map((h, i) => (
            <div
              key={h}
              className="absolute left-0 right-0 flex items-center gap-3"
              style={{ top: `${i * 56}px` }}
            >
              <span className="w-10 shrink-0 text-right text-[10px] font-semibold tracking-wide text-muted-foreground">
                {h > 12 ? h - 12 : h}
                {h >= 12 ? "p" : "a"}
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>
          ))}

          {/* blocks */}
          {blocks.map((b) => {
            const top = ((b.startMin - 8 * 60) / 60) * 56;
            const height = ((b.endMin - b.startMin) / 60) * 56;
            return (
              <div
                key={b.id}
                className={cn(
                  "absolute left-12 right-2 overflow-hidden rounded-2xl border p-3 shadow-soft transition-all hover:-translate-y-0.5",
                  b.hasMatch
                    ? "border-accent/30 bg-gradient-to-br from-accent/12 to-accent/5"
                    : "border-primary/20 bg-gradient-to-br from-primary/10 to-primary/4",
                )}
                style={{ top: `${top}px`, height: `${height}px` }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold tracking-tight text-foreground">
                      {b.course}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {b.code} · {b.room}
                    </p>
                  </div>
                  {b.hasMatch && (
                    <Pill tone="accent">
                      <Sparkles className="h-3 w-3" /> Match
                    </Pill>
                  )}
                </div>
                <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                  {fmt(b.startMin)} – {fmt(b.endMin)}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <SectionHeader title="Smart suggestions" subtitle="Based on your day" />
      <div className="rounded-3xl border border-border bg-gradient-card p-4 shadow-soft">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/15 text-accent">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[14px] font-semibold tracking-tight text-foreground">
              3 classmates head to NI 1043 at 8:45am
            </p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Tap to request a shared ride for Algorithms.
            </p>
            <button className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-[12px] font-semibold text-primary-foreground shadow-glow">
              Find a match
            </button>
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
}

function fmt(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h >= 12 ? "p" : "a";
  const hh = h > 12 ? h - 12 : h;
  return `${hh}:${m.toString().padStart(2, "0")}${ampm}`;
}
