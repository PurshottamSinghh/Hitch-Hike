import { Avatar } from "@/components/app-shell";
import { Pill } from "@/components/app-shell";
import { cn } from "@/lib/utils";
import { formatTime, formatRelativeTime } from "@/lib/utils";

export type Ride = {
  id: string;
  driver: { name: string; initials: string; rating: number; major: string };
  origin: string;
  destination: string;
  departAt: string; // ISO
  durationMin: number;
  seatsTotal: number;
  seatsAvailable: number;
  priceUsd: number;
  matchScore: number; // 0-100
  status: "pending" | "confirmed" | "in_progress" | "completed" | "cancelled" | string;
  routePreview: { from: [number, number]; to: [number, number] };
};
import { ArrowRight, Clock, Users } from "lucide-react";

export function RoutePreviewSVG({
  className,
  variant = "indigo",
}: {
  className?: string;
  variant?: "indigo" | "coral";
}) {
  const stroke = variant === "coral" ? "var(--accent)" : "var(--primary)";
  return (
    <svg viewBox="0 0 200 60" className={cn("h-12 w-full", className)} aria-hidden>
      <defs>
        <linearGradient id={`g-${variant}`} x1="0" x2="1">
          <stop offset="0" stopColor={stroke} stopOpacity="0.15" />
          <stop offset="1" stopColor={stroke} stopOpacity="0.6" />
        </linearGradient>
      </defs>
      <path
        d="M 8 42 C 50 42 60 12 100 18 S 160 50 192 22"
        fill="none"
        stroke={`url(#g-${variant})`}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="1 5"
      />
      <circle cx="8" cy="42" r="4" fill={stroke} />
      <circle cx="192" cy="22" r="4" fill={stroke} />
      <circle cx="192" cy="22" r="9" fill="none" stroke={stroke} strokeOpacity="0.25" />
    </svg>
  );
}

export function RideCard({
  ride,
  highlight = false,
  onClick,
}: {
  ride: Ride;
  highlight?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative w-full rounded-3xl border border-border bg-gradient-card p-4 text-left shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:shadow-elevated",
        highlight && "border-transparent shadow-glow ring-1 ring-primary/20",
      )}
    >
      {highlight && (
        <span className="absolute -top-2 left-4 rounded-full bg-gradient-aurora px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground shadow-glow">
          Best match
        </span>
      )}
      <div className="flex items-center gap-3">
        <Avatar initials={ride.driver.initials} tone="indigo" size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[14px] font-semibold tracking-tight text-foreground">
              {ride.driver.name}
            </p>
            <span className="text-[11px] text-muted-foreground">· ★ {ride.driver.rating}</span>
          </div>
          <p className="truncate text-[12px] text-muted-foreground">{ride.driver.major}</p>
        </div>
        <div className="text-right">
          <div className="text-[11px] font-semibold tracking-wide text-muted-foreground">MATCH</div>
          <div
            className={cn(
              "text-lg font-bold leading-none tracking-tight",
              ride.matchScore >= 95
                ? "text-accent"
                : ride.matchScore >= 85
                  ? "text-primary"
                  : "text-foreground",
            )}
          >
            {ride.matchScore}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3 rounded-2xl bg-muted/60 p-3">
        <div className="flex flex-col items-center gap-1 pt-1">
          <span className="h-2 w-2 rounded-full bg-primary" />
          <span className="h-6 w-px bg-border-strong" />
          <span className="h-2 w-2 rounded-sm bg-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-foreground">{ride.origin}</p>
          <p className="mt-2 truncate text-[13px] font-medium text-foreground">
            {ride.destination}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-[12px]">
        <div className="flex items-center gap-3 text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {formatTime(ride.departAt)} · {formatRelativeTime(ride.departAt)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {ride.seatsAvailable}/{ride.seatsTotal}
          </span>
        </div>
        <span className="inline-flex items-center gap-1 font-semibold text-foreground">
          ${ride.priceUsd.toFixed(2)}
          <ArrowRight className="h-3.5 w-3.5 opacity-50 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </button>
  );
}

export function StatusPill({ status }: { status: Ride["status"] }) {
  const map: Record<Ride["status"], { label: string; tone: any }> = {
    pending: { label: "Pending", tone: "muted" },
    confirmed: { label: "Confirmed", tone: "primary" },
    in_progress: { label: "On the way", tone: "accent" },
    completed: { label: "Completed", tone: "success" },
    cancelled: { label: "Cancelled", tone: "muted" },
  };
  return <Pill tone={map[status].tone}>{map[status].label}</Pill>;
}
