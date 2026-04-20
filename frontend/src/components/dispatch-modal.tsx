import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Avatar, Pill } from "@/components/app-shell";
import { RoutePreviewSVG } from "@/components/ride-card";
import { Sparkles, MapPin, Clock } from "lucide-react";
import { formatTime } from "@/lib/utils";

export interface RideRequest {
  id: number;
  pickupString: string;
  dropoffString: string;
  desiredTime: string;
  seatsNeeded: number;
  username: string;
  initials: string;
  major?: string;
  rating?: number;
}

interface DispatchModalProps {
  isOpen: boolean;
  request: RideRequest | null;
  onAccept: (id: number) => void;
  onReject: (id: number) => void;
  onClose: () => void;
}

export function DispatchModal({
  isOpen,
  request,
  onAccept,
  onReject,
  onClose,
}: DispatchModalProps) {
  if (!request) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px] rounded-3xl bg-surface border-border overflow-hidden p-0 shadow-glow">
        <div className="relative bg-gradient-aurora p-6 pb-8 text-primary-foreground">
          <div className="absolute top-4 right-4 animate-pulse">
            <Pill tone="accent" className="bg-white/20 text-white shadow-glow">
              <Sparkles className="h-3.5 w-3.5" /> High Match
            </Pill>
          </div>
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold tracking-tight">
              New Ride Request!
            </DialogTitle>
            <DialogDescription className="text-primary-foreground/80 mt-1">
              Someone needs a ride along your route.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-6 flex items-center gap-3">
            <Avatar initials={request.initials} tone="coral" size="xl" ring />
            <div>
              <p className="text-lg font-bold">{request.username}</p>
              <p className="text-xs opacity-90">
                {request.major || "Student"} · ★ {request.rating || 5.0}
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="rounded-2xl border border-border p-4 bg-background">
            <div className="flex items-center gap-2 text-sm text-foreground mb-3">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="font-semibold">{formatTime(request.desiredTime)}</span>
              <span className="text-muted-foreground ml-auto">{request.seatsNeeded} seat(s)</span>
            </div>
            <RoutePreviewSVG variant="indigo" />
            <div className="mt-2 text-sm">
              <div className="flex items-start gap-2 mb-2">
                <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <span className="font-medium">{request.pickupString}</span>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                <span className="font-medium text-muted-foreground">{request.dropoffString}</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="p-6 pt-0 flex gap-3">
          <button
            onClick={() => onReject(request.id)}
            className="flex-1 rounded-2xl py-3 border border-border text-muted-foreground font-semibold hover:bg-muted transition-colors"
          >
            Pass
          </button>
          <button
            onClick={() => onAccept(request.id)}
            className="flex-1 rounded-2xl py-3 bg-primary text-primary-foreground font-bold shadow-glow hover:scale-[1.02] active:scale-95 transition-all"
          >
            Accept Ride
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
