"use client";

import { useState } from "react";
import {
  MapPin,
  Navigation2,
  Search,
  Locate,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import DriverCard from "./DriverCard";
import LoadingSkeleton from "./LoadingSkeleton";

/**
 * Left-hand action panel — pickup/dropoff form + driver results list.
 *
 * @param {{ userCoords, drivers, selectedDriver, onSelectDriver, onAcceptDriver, onSearch, searchState }} props
 */
export default function ActionPanel({
  userCoords,
  drivers,
  selectedDriver,
  onSelectDriver,
  onAcceptDriver,
  onSearch,
  searchState,
}) {
  const [dropoff, setDropoff] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [selectedCoords, setSelectedCoords] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Mapbox token from parent or handle directly
  const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const handleInputChange = async (val) => {
    setDropoff(val);
    setSelectedCoords(null);
    if (val.length > 2) {
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
            val
          )}.json?access_token=${MAPBOX_TOKEN}&proximity=${userCoords?.lng},${userCoords?.lat}&limit=5`
        );
        const data = await res.json();
        setSuggestions(data.features || []);
        setShowSuggestions(true);
      } catch (err) {
        console.error("Geocoding error:", err);
      }
    } else {
      setSuggestions([]);
    }
  };

  const handleSelectSuggestion = (feat) => {
    setDropoff(feat.place_name);
    setSelectedCoords({
      lng: feat.center[0],
      lat: feat.center[1],
    });
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleSearch = () => {
    if (selectedCoords && userCoords) {
      onSearch(selectedCoords);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSearch();
  };

  return (
    <div className="h-full flex flex-col bg-[#0d1117] border-r border-white/[0.06] overflow-hidden">
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <div className="px-5 pt-6 pb-4 border-b border-white/[0.04]">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Sparkles size={16} className="text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">
              Find a Ride
            </h1>
            <p className="text-[11px] text-slate-500 font-medium">
              Smart matching powered by AI
            </p>
          </div>
        </div>
      </div>

      {/* ─── Search Form ────────────────────────────────────────────── */}
      <div className="px-5 py-4 space-y-3 border-b border-white/[0.04]">
        {/* Pickup — auto-filled from GPS */}
        <div className="relative">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50" />
          </div>
          <input
            type="text"
            id="pickup-location"
            readOnly
            value={
              userCoords
                ? "📍 Current Location"
                : "Requesting GPS access…"
            }
            className="w-full pl-10 pr-10 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-sm text-slate-300 font-medium placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/40 focus:bg-white/[0.06] transition-all cursor-default"
          />
          <Locate
            size={16}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-blue-400"
          />
        </div>

        {/* Vertical connector line */}
        <div className="flex justify-start pl-[18px]">
          <div className="w-[2px] h-4 bg-gradient-to-b from-blue-500/40 to-indigo-500/40 rounded-full" />
        </div>

        {/* Dropoff — user types here */}
        <div className="relative">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center">
            <MapPin size={14} className="text-indigo-400" />
          </div>
          <input
            type="text"
            id="dropoff-location"
            placeholder="Where are you going?"
            autoComplete="off"
            value={dropoff}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowSuggestions(suggestions.length > 0)}
            className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-sm text-slate-200 font-medium placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/40 focus:bg-white/[0.06] focus:ring-1 focus:ring-indigo-500/20 transition-all"
          />

          {/* Suggestions Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-[#161b22] border border-white/[0.08] rounded-xl shadow-2xl z-50 overflow-hidden">
              {suggestions.map((feat) => (
                <button
                  key={feat.id}
                  onClick={() => handleSelectSuggestion(feat)}
                  className="w-full px-4 py-3 text-left text-xs text-slate-300 hover:bg-white/[0.04] hover:text-white border-b border-white/[0.02] last:border-0 transition-colors flex items-center gap-3"
                >
                  <MapPin size={12} className="text-slate-500 shrink-0" />
                  <span className="truncate">{feat.place_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Search button */}
        <button
          id="search-matches-btn"
          onClick={handleSearch}
          disabled={!selectedCoords || !userCoords}
          className={`w-full py-3 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2
            ${
              selectedCoords && userCoords
                ? "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30 active:scale-[0.98]"
                : "bg-white/[0.04] text-slate-600 cursor-not-allowed"
            }`}
        >
          <Search size={16} />
          Search Matches
          <ArrowRight
            size={14}
            className={dropoff.trim() ? "animate-pulse" : ""}
          />
        </button>
      </div>

      {/* ─── Results Area ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {searchState === "idle" && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 flex items-center justify-center mb-4 border border-white/[0.04]">
              <Navigation2 size={28} className="text-indigo-400" />
            </div>
            <p className="text-sm font-medium text-slate-400 mb-1">
              Ready to ride?
            </p>
            <p className="text-xs text-slate-600 leading-relaxed max-w-[200px]">
              Enter your destination and we'll find the best drivers near you.
            </p>
          </div>
        )}

        {searchState === "loading" && <LoadingSkeleton />}

        {searchState === "pending_acceptance" && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 animate-in fade-in duration-500">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-indigo-500/20 rounded-full animate-ping" />
              <div className="relative w-16 h-16 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Search size={24} className="text-white animate-pulse" />
              </div>
            </div>
            <h3 className="text-sm font-bold text-white mb-1 uppercase tracking-wider">Broadcasting Request</h3>
            <p className="text-xs text-slate-500 leading-relaxed max-w-[200px]">
              Waiting for a driver to accept. You'll be notified immediately.
            </p>
          </div>
        )}
      </div>

      {/* ─── Footer Status ──────────────────────────────────────────── */}
      <div className="px-5 py-3 border-t border-white/[0.04] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              userCoords
                ? "bg-emerald-500 shadow-sm shadow-emerald-500/50"
                : "bg-amber-500 animate-pulse"
            }`}
          />
          <span className="text-[11px] text-slate-500 font-medium">
            {userCoords ? "GPS Active" : "Acquiring GPS…"}
          </span>
        </div>
        {userCoords && (
          <span className="text-[10px] text-slate-600 font-mono">
            {userCoords.lat.toFixed(4)}, {userCoords.lng.toFixed(4)}
          </span>
        )}
      </div>
    </div>
  );
}
