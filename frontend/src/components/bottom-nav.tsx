import { Link, useLocation } from "@tanstack/react-router";
import { Home, Calendar, Plus, Users, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

type NavItem = {
  to: string;
  label: string;
  icon: typeof Home;
  primary?: boolean;
};

const items: NavItem[] = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/schedule", label: "Schedule", icon: Calendar },
  { to: "/create", label: "", icon: Plus, primary: true },
  { to: "/discover", label: "Discover", icon: Users },
  { to: "/rewards", label: "Rewards", icon: Trophy },
];

export function BottomNav() {
  const location = useLocation();
  const path = location.pathname;

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center pb-[max(env(safe-area-inset-bottom),0.75rem)]"
      aria-label="Primary"
    >
      <div className="pointer-events-auto mx-3 flex w-full max-w-md items-end justify-between rounded-3xl border border-border bg-surface/85 px-2 py-2 shadow-elevated backdrop-blur-xl">
        {items.map((item) => {
          const Icon = item.icon;
          const active = path === item.to || (item.to !== "/home" && path.startsWith(item.to));
          if (item.primary) {
            return (
              <Link
                key={item.to}
                to={item.to}
                className="group -mt-7 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-accent text-accent-foreground shadow-coral transition-transform duration-300 ease-[var(--motion-spring)] hover:scale-105 active:scale-95"
                aria-label="Create ride"
              >
                <Icon className="h-6 w-6" strokeWidth={2.4} />
              </Link>
            );
          }
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 rounded-2xl px-2 py-1.5 text-[11px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
                  active && "bg-primary-muted",
                )}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.4 : 2} />
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
