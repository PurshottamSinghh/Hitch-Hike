import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Sparkles, Trash2 } from "lucide-react";
import { PhoneFrame, Pill, SectionHeader } from "@/components/app-shell";
import { BottomNav } from "@/components/bottom-nav";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api";

export const Route = createFileRoute("/schedule")({
  head: () => ({
    meta: [{ title: "Schedule — Hitch-Hike" }],
  }),
  component: Schedule,
});

const DAYS = ["M", "T", "W", "T", "F"];
type ClassBlock = {
  id: string;
  scheduleId: number;
  course: string;
  code: string;
  day: 0 | 1 | 2 | 3 | 4;
  startMin: number;
  endMin: number;
  room: string;
  hasMatch?: boolean;
};
const DAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const HOURS = Array.from({ length: 11 }, (_, i) => 8 + i); // 8am..6pm

function Schedule() {
  const queryClient = useQueryClient();
  const [day, setDay] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    course_name: "",
    course_code: "",
    day_of_week: "mon" as "mon" | "tue" | "wed" | "thu" | "fri",
    start_time: "09:00",
    end_time: "10:15",
    location: "",
  });

  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ["classSchedules"],
    queryFn: api.fetchClassSchedules,
  });

  const createScheduleMutation = useMutation({
    mutationFn: api.createClassSchedule,
    onSuccess: async () => {
      setError("");
      setShowAddForm(false);
      setForm({
        course_name: "",
        course_code: "",
        day_of_week: "mon",
        start_time: "09:00",
        end_time: "10:15",
        location: "",
      });
      await queryClient.invalidateQueries({ queryKey: ["classSchedules"] });
    },
    onError: (err: any) => {
      setError(err?.message || "Could not save class.");
    },
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: api.deleteClassSchedule,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["classSchedules"] });
    },
  });

  const classBlocks: ClassBlock[] = schedules
    .map((schedule) => {
      const dayIndex = dayToIndex(schedule.day_of_week);
      if (dayIndex === null) return null;
      return {
        id: `c${schedule.id}`,
        scheduleId: schedule.id,
        course: schedule.course_name,
        code: schedule.course_code || "Course",
        day: dayIndex,
        startMin: timeToMinutes(schedule.start_time),
        endMin: timeToMinutes(schedule.end_time),
        room: schedule.location || "TBD",
        hasMatch: false,
      } as ClassBlock;
    })
    .filter(Boolean) as ClassBlock[];
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
        <button
          onClick={() => setShowAddForm((prev) => !prev)}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-[12px] font-semibold text-primary-foreground shadow-glow"
        >
          <Plus className="h-3.5 w-3.5" /> Add class
        </button>
      </div>

      {showAddForm && (
        <div className="mt-4 rounded-2xl border border-border bg-surface p-4 shadow-soft space-y-2">
          <input
            value={form.course_name}
            onChange={(e) => setForm((prev) => ({ ...prev, course_name: e.target.value }))}
            placeholder="Course name"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-primary"
          />
          <input
            value={form.course_code}
            onChange={(e) => setForm((prev) => ({ ...prev, course_code: e.target.value }))}
            placeholder="Course code"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-primary"
          />
          <div className="grid grid-cols-3 gap-2">
            <select
              value={form.day_of_week}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  day_of_week: e.target.value as "mon" | "tue" | "wed" | "thu" | "fri",
                }))
              }
              className="rounded-xl border border-border bg-background px-2 py-2 text-[13px] outline-none focus:border-primary"
            >
              <option value="mon">Mon</option>
              <option value="tue">Tue</option>
              <option value="wed">Wed</option>
              <option value="thu">Thu</option>
              <option value="fri">Fri</option>
            </select>
            <input
              type="time"
              value={form.start_time}
              onChange={(e) => setForm((prev) => ({ ...prev, start_time: e.target.value }))}
              className="rounded-xl border border-border bg-background px-2 py-2 text-[13px] outline-none focus:border-primary"
            />
            <input
              type="time"
              value={form.end_time}
              onChange={(e) => setForm((prev) => ({ ...prev, end_time: e.target.value }))}
              className="rounded-xl border border-border bg-background px-2 py-2 text-[13px] outline-none focus:border-primary"
            />
          </div>
          <input
            value={form.location}
            onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
            placeholder="Location (optional)"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-[13px] outline-none focus:border-primary"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowAddForm(false)}
              className="rounded-xl border border-border px-3 py-2 text-[12px] font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setError("");
                if (!form.course_name.trim()) {
                  setError("Course name is required.");
                  return;
                }
                createScheduleMutation.mutate(form);
              }}
              disabled={createScheduleMutation.isPending}
              className="rounded-xl bg-primary px-3 py-2 text-[12px] font-semibold text-primary-foreground"
            >
              {createScheduleMutation.isPending ? "Saving..." : "Save"}
            </button>
          </div>
          {error && <p className="text-[12px] text-destructive">{error}</p>}
        </div>
      )}

      {/* Day grid */}
      <div className="relative mt-4 rounded-3xl border border-border bg-surface p-3 shadow-soft">
        {isLoading && (
          <p className="px-2 pb-3 text-[12px] text-muted-foreground">Loading schedule...</p>
        )}
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
                  "absolute left-12 right-2 overflow-hidden rounded-2xl border p-3 pr-9 shadow-soft transition-all hover:-translate-y-0.5",
                  b.hasMatch
                    ? "border-accent/30 bg-gradient-to-br from-accent/12 to-accent/5"
                    : "border-primary/20 bg-gradient-to-br from-primary/10 to-primary/4",
                )}
                style={{ top: `${top}px`, height: `${height}px` }}
              >
                <button
                  onClick={() => deleteScheduleMutation.mutate(b.scheduleId)}
                  title="Remove class"
                  className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
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

function timeToMinutes(value: string) {
  const [h, m] = value.split(":").map((v) => Number(v));
  return (h || 0) * 60 + (m || 0);
}

function dayToIndex(day: string): 0 | 1 | 2 | 3 | 4 | null {
  const map: Record<string, 0 | 1 | 2 | 3 | 4> = {
    mon: 0,
    tue: 1,
    wed: 2,
    thu: 3,
    fri: 4,
  };
  return map[day] ?? null;
}
