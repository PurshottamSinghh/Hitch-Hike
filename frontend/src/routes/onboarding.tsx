import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Check, MapPin, Shield, Users, Car, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import * as api from "../lib/api";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Welcome — Hitch-Hike" },
      { name: "description", content: "Set up your Hitch-Hike account in seconds." },
    ],
  }),
  component: Onboarding,
});

type Role = "driver" | "rider" | "both";

function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [address, setAddress] = useState("");
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const steps = ["Name", "Address", "Role"];
  const emailLooksCampus = isCampusEmail(email);
  const canNext =
    (step === 0 && name.trim().length > 1 && emailLooksCampus && password.length >= 8) ||
    (step === 1 && address.trim().length > 3) ||
    (step === 2 && role !== null);

  const next = async () => {
    if (step < 2) setStep(step + 1);
    else {
      try {
        setLoading(true);
        setError("");
        // API only accepts "driver" | "rider". Map UI "both" to rider (can change in profile later).
        const backendRole = role === "driver" ? "driver" : "rider";
        await api.register({
          username: name,
          email,
          password,
          role: backendRole,
          home_address: address,
        });
        navigate({ to: "/home" });
      } catch (err: any) {
        setError(err.message || "Failed to register.");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-sky">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 top-0 h-96 w-96 rounded-full bg-accent/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 bottom-0 h-96 w-96 rounded-full bg-primary/25 blur-3xl"
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-6 pb-10 pt-12">
        {/* progress */}
        <div className="mb-10 flex items-center gap-2">
          {steps.map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-all duration-500",
                i <= step ? "bg-primary" : "bg-border",
              )}
            />
          ))}
        </div>

        <div className="flex-1">
          {step === 0 && (
            <div className="animate-rise">
              <p className="text-[13px] font-semibold uppercase tracking-[0.2em] text-accent">
                Welcome to Hitch-Hike
              </p>
              <h1 className="mt-2 text-balance text-[32px] font-bold leading-[1.1] tracking-tight text-foreground">
                What should we call you?
              </h1>
              <p className="mt-3 text-pretty text-[15px] leading-relaxed text-muted-foreground">
                This is how other Toledo students will see you when matching for a ride.
              </p>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your username"
                className="mt-8 w-full border-0 border-b-2 border-border bg-transparent pb-3 text-[26px] font-semibold tracking-tight outline-none transition-colors focus:border-primary"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="School Email (@utoledo.edu)"
                className="mt-4 w-full border-0 border-b-2 border-border bg-transparent pb-3 text-[18px] tracking-tight outline-none transition-colors focus:border-primary"
              />
              {email.length > 0 && !emailLooksCampus && (
                <p className="mt-2 text-[12px] text-destructive">
                  Please use your `@utoledo.edu` or `@rockets.utoledo.edu` email.
                </p>
              )}
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password (min 8 chars)"
                className="mt-4 w-full border-0 border-b-2 border-border bg-transparent pb-3 text-[18px] tracking-tight outline-none transition-colors focus:border-primary"
              />
            </div>
          )}

          {step === 1 && (
            <div className="animate-rise">
              <p className="text-[13px] font-semibold uppercase tracking-[0.2em] text-accent">
                Step 02
              </p>
              <h1 className="mt-2 text-balance text-[32px] font-bold leading-[1.1] tracking-tight text-foreground">
                Where do you start your day?
              </h1>
              <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
                We'll suggest carpools that pass near home — never your exact address to other
                users.
              </p>
              <div className="mt-8 flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-soft focus-within:border-primary">
                <MapPin className="h-5 w-5 shrink-0 text-primary" />
                <input
                  autoFocus
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Search your address"
                  className="w-full border-0 bg-transparent text-[15px] outline-none"
                />
              </div>
              <div className="mt-3 space-y-2">
                {[
                  "2801 W Bancroft St, Toledo, OH",
                  "1310 Tower View Blvd, Toledo, OH",
                  "5403 Sylvania Ave, Sylvania, OH",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setAddress(suggestion)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-transparent bg-surface/60 px-4 py-3 text-left text-[13px] text-foreground transition-colors hover:border-border hover:bg-surface"
                  >
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{suggestion}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-rise">
              <p className="text-[13px] font-semibold uppercase tracking-[0.2em] text-accent">
                Step 03
              </p>
              <h1 className="mt-2 text-balance text-[32px] font-bold leading-[1.1] tracking-tight text-foreground">
                How will you commute?
              </h1>
              <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
                You can change this anytime. Most students choose Both.
              </p>
              <div className="mt-8 space-y-3">
                {(
                  [
                    {
                      id: "driver",
                      title: "Driver",
                      desc: "Offer rides, earn coffee money.",
                      icon: Car,
                    },
                    {
                      id: "rider",
                      title: "Rider",
                      desc: "Find a seat to class, fast.",
                      icon: Users,
                    },
                    {
                      id: "both",
                      title: "Both",
                      desc: "Maximum flexibility — recommended.",
                      icon: Shield,
                    },
                  ] as const
                ).map((opt) => {
                  const Icon = opt.icon;
                  const active = role === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => setRole(opt.id)}
                      className={cn(
                        "flex w-full items-center gap-4 rounded-2xl border bg-surface p-4 text-left transition-all",
                        active
                          ? "border-primary shadow-glow"
                          : "border-border hover:border-border-strong",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-11 w-11 items-center justify-center rounded-xl",
                          active
                            ? "bg-gradient-aurora text-primary-foreground"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="flex-1">
                        <p className="text-[15px] font-semibold tracking-tight text-foreground">
                          {opt.title}
                        </p>
                        <p className="text-[12px] text-muted-foreground">{opt.desc}</p>
                      </div>
                      {active && (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="h-3.5 w-3.5" strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 flex items-center justify-between">
          <Link
            to="/"
            className="text-[13px] font-medium text-muted-foreground hover:text-foreground"
          >
            Back
          </Link>
          <button
            disabled={!canNext || loading}
            onClick={next}
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[14px] font-semibold transition-all",
              canNext && !loading
                ? "bg-primary text-primary-foreground shadow-glow hover:scale-[1.02] active:scale-95"
                : "bg-muted text-muted-foreground",
            )}
          >
            {loading ? "Loading..." : step === 2 ? "Enter Hitch-Hike" : "Continue"}
            {!loading && <ArrowRight className="h-4 w-4" />}
          </button>
        </div>
        {error && (
          <p className="mt-3 text-right text-[12px] text-destructive">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

function isCampusEmail(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized.endsWith("@utoledo.edu") || normalized.endsWith("@rockets.utoledo.edu");
}
