import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRelativeTime(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const min = Math.round(diff / 60000);
  if (Math.abs(min) < 60) return min <= 0 ? `${-min}m ago` : `in ${min}m`;
  const hr = Math.round(min / 60);
  if (Math.abs(hr) < 24) return hr <= 0 ? `${-hr}h ago` : `in ${hr}h`;
  const day = Math.round(hr / 24);
  return day <= 0 ? `${-day}d ago` : `in ${day}d`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}
