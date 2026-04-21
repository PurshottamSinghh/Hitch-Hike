import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Avatar, Pill } from "@/components/app-shell";
import { Calendar, MapPin, Sparkles } from "lucide-react";

export interface ProactiveMatchView {
  id: number;
  riderName: string;
  riderInitials: string;
  buildingLabel: string;
  dayLabel: string;
  riderStart: string;
  driverStart: string;
}

interface Props {
  isOpen: boolean;
  match: ProactiveMatchView | null;
  onOffer: (id: number) => void;
  onDecline: (id: number) => void;
  onClose: () => void;
  busy?: boolean;
}

/**
 * Fired by the global `DispatchListener` whenever the backend finds a
 * schedule overlap between the logged-in driver and a rider — same building,
 * same weekday, start-time within ±15 min. The driver can either "Offer a
 * ride" (creates a RideRequest in `pending_rider_confirm` that the rider
 * must confirm) or "Not today" (marks the match declined).
 */
export function ProactiveMatchModal({
  isOpen,
  match,
  onOffer,
  onDecline,
  onClose,
  busy,
}: Props) {
  if (!match) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px] rounded-3xl bg-surface border-border overflow-hidden p-0 shadow-glow">
        <div className="relative bg-gradient-aurora p-6 pb-8 text-primary-foreground">
          <div className="absolute top-4 right-4">
            <Pill tone="accent" className="bg-white/20 text-white shadow-glow">
              <Sparkles className="h-3.5 w-3.5" /> Schedule match
            </Pill>
          </div>
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold tracking-tight">
              Same class, same time
            </DialogTitle>
            <DialogDescription className="text-primary-foreground/80 mt-1">
              We found a rider heading to your class. Offer them a ride?
            </DialogDescription>
          </DialogHeader>

          <div className="mt-6 flex items-center gap-3">
            <Avatar initials={match.riderInitials} tone="coral" size="xl" ring />
            <div>
              <p className="text-lg font-bold">{match.riderName}</p>
              <p className="text-xs opacity-90">Student · same building</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-3">
          <div className="flex items-start gap-2 rounded-2xl border border-border bg-background px-4 py-3">
            <MapPin className="h-4 w-4 text-primary mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Destination
              </p>
              <p className="text-sm font-semibold">{match.buildingLabel}</p>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded-2xl border border-border bg-background px-4 py-3">
            <Calendar className="h-4 w-4 text-accent mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {match.dayLabel}
              </p>
              <p className="text-sm font-semibold">
                Your class {match.driverStart} · rider's class {match.riderStart}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="p-6 pt-0 flex gap-3">
          <button
            disabled={busy}
            onClick={() => onDecline(match.id)}
            className="flex-1 rounded-2xl py-3 border border-border text-muted-foreground font-semibold hover:bg-muted transition-colors disabled:opacity-60"
          >
            Not today
          </button>
          <button
            disabled={busy}
            onClick={() => onOffer(match.id)}
            className="flex-1 rounded-2xl py-3 bg-primary text-primary-foreground font-bold shadow-glow hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-60"
          >
            Offer a ride
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
