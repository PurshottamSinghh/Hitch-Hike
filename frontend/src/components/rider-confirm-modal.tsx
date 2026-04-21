import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Avatar, Pill } from "@/components/app-shell";
import { Clock, MapPin, Sparkles } from "lucide-react";
import { formatTime } from "@/lib/utils";

export interface RiderConfirmView {
  id: number;
  driverName: string;
  driverInitials: string;
  pickupString: string;
  dropoffString: string;
  desiredTime: string;
  seatsNeeded: number;
  note?: string;
}

interface Props {
  isOpen: boolean;
  request: RiderConfirmView | null;
  onAccept: (id: number) => void;
  onDecline: (id: number) => void;
  onClose: () => void;
  busy?: boolean;
}

/**
 * Global pop-up shown to RIDERS when a driver proactively offers a ride from
 * a schedule overlap. The backend creates a RideRequest in
 * `pending_rider_confirm` and the rider must explicitly accept (flips to
 * "accepted") or decline (flips to "rejected").
 */
export function RiderConfirmModal({
  isOpen,
  request,
  onAccept,
  onDecline,
  onClose,
  busy,
}: Props) {
  if (!request) return null;
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px] rounded-3xl bg-surface border-border overflow-hidden p-0 shadow-glow">
        <div className="relative bg-gradient-aurora p-6 pb-8 text-primary-foreground">
          <div className="absolute top-4 right-4">
            <Pill tone="accent" className="bg-white/20 text-white shadow-glow">
              <Sparkles className="h-3.5 w-3.5" /> Ride offered
            </Pill>
          </div>
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold tracking-tight">
              Driver offered you a ride
            </DialogTitle>
            <DialogDescription className="text-primary-foreground/80 mt-1">
              You share a class — accept to confirm pickup.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-6 flex items-center gap-3">
            <Avatar initials={request.driverInitials} tone="coral" size="xl" ring />
            <div>
              <p className="text-lg font-bold">{request.driverName}</p>
              <p className="text-xs opacity-90">Heading to your building</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="rounded-2xl border border-border p-4 bg-background">
            <div className="flex items-center gap-2 text-sm text-foreground mb-3">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="font-semibold">{formatTime(request.desiredTime)}</span>
              <span className="text-muted-foreground ml-auto">
                {request.seatsNeeded} seat(s)
              </span>
            </div>
            <div className="text-sm space-y-2">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <span className="font-medium">{request.pickupString}</span>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                <span className="font-medium text-muted-foreground">
                  {request.dropoffString}
                </span>
              </div>
            </div>
            {request.note && (
              <p className="mt-3 text-[12px] text-muted-foreground italic">
                {request.note}
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="p-6 pt-0 flex gap-3">
          <button
            disabled={busy}
            onClick={() => onDecline(request.id)}
            className="flex-1 rounded-2xl py-3 border border-border text-muted-foreground font-semibold hover:bg-muted transition-colors disabled:opacity-60"
          >
            Decline
          </button>
          <button
            disabled={busy}
            onClick={() => onAccept(request.id)}
            className="flex-1 rounded-2xl py-3 bg-primary text-primary-foreground font-bold shadow-glow hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-60"
          >
            Accept ride
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
