import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Car, Check, Clock, MapPin, Users } from "lucide-react";
import { PhoneFrame, Avatar } from "@/components/app-shell";
import { BottomNav } from "@/components/bottom-nav";
import { RoutePreviewSVG } from "@/components/ride-card";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/create")({
  head: () => ({
    meta: [{ title: "Create a ride — Loop" }],
  }),
  component: Create,
});

type Mode = "driver" | "rider";

function Create() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("driver");
  const [step, setStep] = useState(0);
  const [from, setFrom] = useState("Westgate Plaza, Toledo");
  const [to, setTo] = useState("Main Campus");
  const [time, setTime] = useState("8:30 AM");
  const [seats, setSeats] = useState(3);

  const next = () => {
    if (step < 2) setStep(step + 1);
    else navigate({ to: "/home" });
  };

  return (
    <PhoneFrame>
      <BottomNav />

      <header>
        <p className="text-[13px] font-semibold uppercase tracking-[0.2em] text-accent">New ride</p>
        <h1 className="mt-1 text-[28px] font-bold leading-tight tracking-tight text-foreground">
          {mode === "driver" ? "Offer a seat" : "Request a ride"}
        </h1>

        {/* mode switch */}
        <div className="mt-4 grid grid-cols-2 gap-1 rounded-2xl border border-border bg-surface p-1 shadow-soft">
          {(["driver", "rider"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "rounded-xl px-3 py-2.5 text-[13px] font-semibold tracking-tight transition-all",
                mode === m
                  ? "bg-gradient-aurora text-primary-foreground shadow-glow"
                  : "text-muted-foreground",
              )}
            >
              {m === "driver" ? "I'm driving" : "I need a ride"}
            </button>
          ))}
        </div>
      </header>

      {/* progress */}
      <div className="mt-6 flex items-center gap-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-all duration-500",
              i <= step ? "bg-primary" : "bg-border",
            )}
          />
        ))}
      </div>

      <div className="mt-6">
        {step === 0 && (
          <div className="animate-rise space-y-3">
            <Field icon={MapPin} label="From">
              <input
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full bg-transparent text-[15px] font-semibold text-foreground outline-none"
              />
            </Field>
            <Field icon={MapPin} label="To" tone="accent">
              <input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full bg-transparent text-[15px] font-semibold text-foreground outline-none"
              />
            </Field>

            <div className="rounded-3xl border border-border bg-gradient-card p-4 shadow-soft">
              <RoutePreviewSVG />
              <div className="mt-2 flex items-center justify-between text-[12px] text-muted-foreground">
                <span className="truncate">{from}</span>
                <span className="rounded-full bg-muted px-2 py-0.5 font-semibold">~14 min</span>
                <span className="truncate text-right">{to}</span>
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="animate-rise space-y-3">
            <Field icon={Clock} label="Departure time">
              <input
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-transparent text-[15px] font-semibold text-foreground outline-none"
              />
            </Field>

            <div className="rounded-2xl border border-border bg-surface p-4 shadow-soft">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Smart suggestions
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {["8:15 AM", "8:30 AM", "8:45 AM"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setTime(t)}
                    className={cn(
                      "rounded-xl border px-2 py-3 text-[13px] font-semibold transition-all",
                      time === t
                        ? "border-primary bg-primary-muted text-primary"
                        : "border-border text-foreground hover:border-border-strong",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {mode === "driver" && (
              <Field icon={Users} label="Available seats">
                <div className="flex items-center gap-3">
                  {[1, 2, 3, 4].map((n) => (
                    <button
                      key={n}
                      onClick={() => setSeats(n)}
                      className={cn(
                        "h-9 w-9 rounded-xl text-[14px] font-bold transition-all",
                        seats === n
                          ? "bg-primary text-primary-foreground shadow-glow"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </Field>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="animate-rise">
            <div className="overflow-hidden rounded-3xl bg-gradient-aurora p-5 text-primary-foreground shadow-glow noise">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] opacity-80">
                Confirm
              </p>
              <h2 className="mt-1 text-[22px] font-bold leading-tight tracking-tight">
                {mode === "driver"
                  ? `${seats} seats from ${from.split(",")[0]}`
                  : `Looking for a ride from ${from.split(",")[0]}`}
              </h2>

              <div className="mt-4 rounded-2xl bg-white/12 p-3 backdrop-blur-md">
                <RoutePreviewSVG variant="coral" />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[
                  { label: "Departs", value: time },
                  { label: "Drive", value: "14 min" },
                  {
                    label: mode === "driver" ? "Seats" : "Riders",
                    value: mode === "driver" ? seats : 1,
                  },
                ].map((s) => (
                  <div key={s.label} className="rounded-xl bg-white/10 p-2.5 backdrop-blur-md">
                    <p className="text-[10px] uppercase tracking-wider opacity-70">{s.label}</p>
                    <p className="mt-0.5 text-[15px] font-bold tracking-tight">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 shadow-soft">
              <Avatar initials="RP" tone="indigo" size="md" />
              <div className="min-w-0 flex-1 text-[12px] text-muted-foreground">
                Posting as <b className="text-foreground">Raj P.</b> ·{" "}
                <span className="text-success font-semibold">@utoledo verified</span>
              </div>
              <Car className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <button
          onClick={() => (step > 0 ? setStep(step - 1) : navigate({ to: "/home" }))}
          className="text-[13px] font-medium text-muted-foreground hover:text-foreground"
        >
          {step === 0 ? "Cancel" : "Back"}
        </button>
        <button
          onClick={next}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3.5 text-[14px] font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.02] active:scale-95"
        >
          {step === 2 ? (
            <>
              Publish ride <Check className="h-4 w-4" strokeWidth={3} />
            </>
          ) : (
            <>
              Continue <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </PhoneFrame>
  );
}

function Field({
  icon: Icon,
  label,
  tone = "primary",
  children,
}: {
  icon: typeof MapPin;
  label: string;
  tone?: "primary" | "accent";
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-soft">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl",
            tone === "accent" ? "bg-accent/12 text-accent" : "bg-primary/10 text-primary",
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <div className="mt-0.5">{children}</div>
        </div>
      </div>
    </div>
  );
}
