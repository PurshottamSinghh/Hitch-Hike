import { cn } from "@/lib/utils";

export function PhoneFrame({
  children,
  className,
  hideNav = false,
}: {
  children: React.ReactNode;
  className?: string;
  hideNav?: boolean;
}) {
  return (
    <div className="relative min-h-screen w-full bg-gradient-sky">
      {/* ambient blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-32 h-72 w-72 rounded-full bg-accent/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-[40vh] h-80 w-80 rounded-full bg-primary/15 blur-3xl"
      />
      <main
        className={cn(
          "relative mx-auto w-full max-w-md px-5 pb-32 pt-6",
          hideNav && "pb-10",
          className,
        )}
      >
        {children}
      </main>
    </div>
  );
}

export function Avatar({
  initials,
  tone = "indigo",
  size = "md",
  ring,
}: {
  initials: string;
  tone?: "indigo" | "coral" | "mint" | "violet";
  size?: "sm" | "md" | "lg" | "xl";
  ring?: boolean;
}) {
  const tones: Record<string, string> = {
    indigo: "bg-primary/12 text-primary",
    coral: "bg-accent/15 text-accent",
    mint: "bg-success/15 text-success",
    violet: "bg-[oklch(0.92_0.06_305)] text-[oklch(0.45_0.18_305)]",
  };
  const sizes: Record<string, string> = {
    sm: "h-7 w-7 text-[10px]",
    md: "h-9 w-9 text-xs",
    lg: "h-11 w-11 text-sm",
    xl: "h-14 w-14 text-base",
  };
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-wide",
        tones[tone],
        sizes[size],
        ring && "ring-2 ring-surface",
      )}
    >
      {initials}
    </span>
  );
}

export function Pill({
  children,
  tone = "muted",
  className,
}: {
  children: React.ReactNode;
  tone?: "muted" | "primary" | "accent" | "success";
  className?: string;
}) {
  const tones: Record<string, string> = {
    muted: "bg-muted text-muted-foreground",
    primary: "bg-primary-muted text-primary",
    accent: "bg-accent-muted text-accent",
    success: "bg-success/12 text-success",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SectionHeader({
  title,
  action,
  subtitle,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between">
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight text-foreground">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[12px] text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
