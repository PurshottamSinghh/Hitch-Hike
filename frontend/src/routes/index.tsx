import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowRight, Shield, Sparkles, Leaf } from "lucide-react";
import { useEffect, useState } from "react";
import * as api from "../lib/api";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Hitch-Hike — Carpool, only at UToledo" },
      {
        name: "description",
        content:
          "Verified-student carpooling for the University of Toledo. Match by schedule, save money, build community.",
      },
      { property: "og:title", content: "Hitch-Hike — Carpool, only at UToledo" },
      {
        property: "og:description",
        content: "A premium, verified-student carpool community for UToledo.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const [mode, setMode] = useState<"start" | "login">("start");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    let isMounted = true;
    (async () => {
      const result = await api.finishMicrosoftAuthFromUrl();
      if (!isMounted || !result.handled) return;
      if (result.success) {
        router.navigate({ to: "/home" });
        return;
      }
      setMode("login");
      setError(result.error || "Microsoft sign-in failed.");
    })();
    return () => {
      isMounted = false;
    };
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await api.login(email, password);
      router.navigate({ to: "/home" });
    } catch (err: any) {
      setError(err.message || "Failed to login. Please try again.");
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-sky">
      {/* ambient */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 top-10 h-96 w-96 rounded-full bg-primary/25 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 top-1/2 h-96 w-96 rounded-full bg-accent/25 blur-3xl"
      />

      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col px-6 pb-10 pt-12">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-aurora shadow-glow">
            <span className="h-3.5 w-3.5 rounded-full border-[2.5px] border-primary-foreground" />
          </span>
          <span className="text-[16px] font-bold tracking-tight text-foreground">Hitch-Hike</span>
          <span className="ml-auto rounded-full border border-border bg-surface/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur-md">
            UToledo only
          </span>
        </div>

        {/* Hero */}
        <div className="mt-16">
          <p className="text-[13px] font-semibold uppercase tracking-[0.25em] text-accent">
            A campus movement
          </p>
          <h1 className="mt-3 text-balance text-[44px] font-bold leading-[1.02] tracking-tight text-foreground">
            Carpool with{" "}
            <span className="bg-gradient-aurora bg-clip-text text-transparent">your people.</span>
          </h1>
          <p className="mt-4 max-w-xs text-pretty text-[15px] leading-relaxed text-muted-foreground">
            Verified Toledo students. Smart-matched by schedule. Smaller bills, warmer mornings.
          </p>
        </div>

        {/* Floating preview card */}
        <div className="relative mt-10 animate-float">
          <div className="rounded-3xl border border-border bg-gradient-card p-4 shadow-elevated">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/12 text-[12px] font-bold text-primary">
                MC
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold tracking-tight text-foreground">
                  Maya · 8:30am ride
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Westgate → Main Campus · 2 seats
                </p>
              </div>
              <span className="rounded-full bg-accent-muted px-2 py-1 text-[11px] font-bold text-accent">
                96
              </span>
            </div>
          </div>
          <span className="absolute -right-2 -top-2 inline-flex items-center gap-1 rounded-full bg-success px-2.5 py-1 text-[10px] font-bold text-success-foreground shadow-soft">
            <Sparkles className="h-3 w-3" /> Best match
          </span>
        </div>

        <div className="mt-auto pt-12">
          {/* trust signals */}
          <div className="mb-6 flex justify-center gap-5 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Shield className="h-3.5 w-3.5 text-success" /> @utoledo SSO
            </span>
            <span className="inline-flex items-center gap-1">
              <Leaf className="h-3.5 w-3.5 text-success" /> Carbon tracked
            </span>
          </div>

          {mode === "start" ? (
            <>
              <button
                onClick={() => api.beginMicrosoftAuth("/")}
                className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-foreground py-4 text-[14px] font-semibold text-background shadow-elevated transition-transform hover:scale-[1.01] active:scale-[0.99]"
              >
                <MicrosoftMark />
                Continue with Microsoft
              </button>
              <button
                onClick={() => setMode("login")}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-border bg-surface/70 py-3.5 text-[13px] font-semibold text-foreground backdrop-blur-md transition-colors hover:bg-surface"
              >
                Use username/password <ArrowRight className="h-3.5 w-3.5" />
              </button>
              <Link
                to="/onboarding"
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-border bg-surface/70 py-3.5 text-[13px] font-semibold text-foreground backdrop-blur-md transition-colors hover:bg-surface"
              >
                New user? Create Account <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </>
          ) : (
            <form
              onSubmit={handleLogin}
              className="space-y-3 animate-in fade-in slide-in-from-bottom-2"
            >
              <input
                type="text"
                placeholder="Username or Rocket Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-2xl border border-border bg-surface p-4 text-[14px] outline-none transition-colors focus:border-primary"
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-2xl border border-border bg-surface p-4 text-[14px] outline-none transition-colors focus:border-primary"
                required
              />
              {error && <p className="text-[12px] text-destructive px-2">{error}</p>}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMode("start")}
                  className="rounded-2xl border border-border bg-surface px-6 py-4 text-[14px] font-semibold transition-colors hover:bg-surface/80"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-2xl bg-primary py-4 text-[14px] font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.01] active:scale-[0.99]"
                >
                  Sign In
                </button>
              </div>
            </form>
          )}

          <p className="mt-6 text-center text-[10px] text-muted-foreground">
            By continuing you agree to Hitch-Hike community standards.
          </p>
        </div>
      </div>
    </div>
  );
}

function MicrosoftMark() {
  return (
    <svg viewBox="0 0 21 21" className="h-4 w-4" aria-hidden>
      <rect x="1" y="1" width="9" height="9" fill="#f35325" />
      <rect x="11" y="1" width="9" height="9" fill="#81bc06" />
      <rect x="1" y="11" width="9" height="9" fill="#05a6f0" />
      <rect x="11" y="11" width="9" height="9" fill="#ffba08" />
    </svg>
  );
}

