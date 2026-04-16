"use client";

import { Clock, Users, Navigation, Zap, Check } from "lucide-react";

/**
 * Individual driver result card in the action panel.
 *
 * @param {{ driver: object, isSelected: boolean, onSelect: Function, onAccept: Function }} props
 */
export default function DriverCard({ driver, isSelected, onSelect, onAccept }) {
  const detourColor =
    driver.detourMins <= 5
      ? "text-emerald-400"
      : driver.detourMins <= 10
      ? "text-amber-400"
      : "text-rose-400";

  const detourBg =
    driver.detourMins <= 5
      ? "bg-emerald-500/10"
      : driver.detourMins <= 10
      ? "bg-amber-500/10"
      : "bg-rose-500/10";

  return (
    <div
      onClick={() => onSelect(driver)}
      className={`group relative rounded-2xl p-4 cursor-pointer transition-all duration-300
        border animate-fadeInUp
        ${
          isSelected
            ? "bg-indigo-500/10 border-indigo-500/40 shadow-lg shadow-indigo-500/10"
            : "bg-[var(--color-bg-card)] border-white/[0.04] hover:bg-[var(--color-bg-card-hover)] hover:border-white/[0.08]"
        }`}
    >
      {/* Top row — Avatar, Name, Accept */}
      <div className="flex items-center gap-3 mb-3">
        {/* Avatar with gradient ring */}
        <div
          className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 transition-shadow
            ${
              isSelected
                ? "bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/40"
                : "bg-gradient-to-br from-slate-600 to-slate-700"
            }`}
        >
          {driver.name.charAt(0)}
        </div>

        {/* Name + Vehicle */}
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm text-slate-100 truncate">
            {driver.name}
          </h4>
          <p className="text-xs text-slate-500">{driver.vehicle}</p>
        </div>

        {/* Accept Match button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAccept(driver);
          }}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-300 flex items-center gap-1.5
            ${
              driver.accepted
                ? "bg-emerald-500/20 text-emerald-400 cursor-default"
                : "bg-indigo-500 hover:bg-indigo-400 text-white shadow-md shadow-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/40 active:scale-95"
            }`}
          disabled={driver.accepted}
        >
          {driver.accepted ? (
            <>
              <Check size={13} /> Matched
            </>
          ) : (
            <>
              <Zap size={13} /> Accept
            </>
          )}
        </button>
      </div>

      {/* Info pills */}
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 bg-white/[0.04] px-2.5 py-1 rounded-full">
          <Users size={12} className="text-slate-500" />
          {driver.seats} {driver.seats === 1 ? "seat" : "seats"}
        </span>
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${detourColor} ${detourBg}`}
        >
          <Clock size={12} />+{driver.detourMins} min detour
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 bg-white/[0.04] px-2.5 py-1 rounded-full">
          <Navigation size={12} className="text-slate-500" />
          {driver.distance}
        </span>
      </div>

      {/* Selection indicator bar */}
      {isSelected && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 bg-indigo-500 rounded-r-full" />
      )}
    </div>
  );
}
