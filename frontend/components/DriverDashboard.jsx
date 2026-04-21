"use client";

import { useState, useEffect, useRef } from "react";
import { Check, X, User, Clock, MapPin, Power, Bell, AlertCircle } from "lucide-react";
import { fetchPendingRequests, updateRequestStatus, completeRideRequest } from "@/lib/api";
import MapView from "@/components/MapView";
import useUserLocation from "@/hooks/useUserLocation";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export default function DriverDashboard() {
  const [requests, setRequests] = useState([]);
  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeModalRequest, setActiveModalRequest] = useState(null);
  const [activeRide, setActiveRide] = useState(null);
  const { coords: userCoords } = useUserLocation();
  
  // Track seen request IDs to trigger pop-ups only for new ones
  const seenRequestIds = useRef(new Set());

  // Polling logic & Location updates
  useEffect(() => {
    if (!isOnline) {
      setRequests([]);
      return;
    }

    const sendLocation = async () => {
      if (userCoords) {
        try {
          const token = localStorage.getItem("token");
          await fetch("/api/rides/auth/location/", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              latitude: userCoords.lat,
              longitude: userCoords.lng
            })
          });
        } catch (err) {
          console.error("Location update failed:", err);
        }
      }
    };

    const poll = async () => {
      try {
        const pending = await fetchPendingRequests();
        
        // Check for new requests to trigger modal
        pending.forEach(req => {
          if (!seenRequestIds.current.has(req.id)) {
            setActiveModalRequest(req);
            seenRequestIds.current.add(req.id);
          }
        });

        setRequests(pending);
        setLoading(false);
      } catch (err) {
        console.error("Polling error:", err);
      }
    };

    poll();
    sendLocation();
    const interval = setInterval(() => {
        poll();
        sendLocation();
    }, 5000);
    return () => clearInterval(interval);
  }, [isOnline, userCoords?.lat, userCoords?.lng]);

  const handleAction = async (requestId, action) => {
    try {
      const res = await updateRequestStatus(requestId, action);
      
      if (action === "accept") {
        // Transition to Active Ride
        const acceptedReq = requests.find(r => r.id === requestId) || activeModalRequest;
        setActiveRide({ ...acceptedReq, status: "accepted" });
      }

      // Update local state
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      if (activeModalRequest?.id === requestId) {
        setActiveModalRequest(null);
      }
    } catch (err) {
      console.error(`Failed to ${action} request:`, err);
    }
  };

  const handleComplete = async () => {
    if (!activeRide) return;
    try {
      await completeRideRequest(activeRide.id);
      setActiveRide(null);
      // Optional: Show success toast
    } catch (err) {
      console.error("Failed to complete ride:", err);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[#0d1117] text-slate-200 relative overflow-hidden">
      {/* ─── Header ────────────────────────────────────────────────── */}
      <header className="px-6 py-5 border-b border-white/[0.06] flex items-center justify-between bg-[#0d1117]/80 backdrop-blur-xl sticky top-0 z-30">
        <div>
          <h1 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
            Hitch-Hike Driver
            {isOnline && (
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </h1>
          <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest">
            {isOnline ? "Steering the flow" : "Ready to earn?"}
          </p>
        </div>

        <button
          onClick={() => setIsOnline(!isOnline)}
          className={`flex items-center gap-2 px-4 py-2 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all duration-500 border ${
            isOnline
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.1)]"
              : "bg-white/[0.03] border-white/[0.08] text-slate-400 hover:text-slate-200"
          }`}
        >
          <Power size={14} className={isOnline ? "animate-spin-slow" : ""} />
          {isOnline ? "Go Offline" : "Go Online"}
        </button>
      </header>

      {/* ─── Active Ride UI ────────────────────────────────────────── */}
      {activeRide ? (
        <div className="flex-1 relative">
          <MapView
            mapboxToken={MAPBOX_TOKEN}
            userCoords={userCoords}
            drivers={[]}
            waypoints={[
                { lng: userCoords.lng, lat: userCoords.lat }, // Start (Driver)
                { lng: activeRide.pickup_location.coordinates[0], lat: activeRide.pickup_location.coordinates[1] }, // Pickup
                { lng: activeRide.dropoff_location.coordinates[0], lat: activeRide.dropoff_location.coordinates[1] } // Destination
            ]}
          />
          
          <div className="absolute bottom-10 left-6 right-6 z-30">
            <div className="bg-[#1a1f33]/90 backdrop-blur-2xl border border-white/[0.1] rounded-[2rem] p-6 shadow-2xl animate-in slide-in-from-bottom duration-500">
               <div className="flex items-center justify-between mb-6">
                 <div className="flex items-center gap-4">
                   <div className="w-12 h-12 rounded-2xl bg-indigo-500 flex items-center justify-center">
                     <User size={24} className="text-white" />
                   </div>
                   <div>
                     <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-0.5">Heading to Pickup</p>
                     <h2 className="text-lg font-black text-white">{activeRide.passenger_username || "Hitchhiker"}</h2>
                   </div>
                 </div>
                 <div className="text-right">
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-0.5">ETA</p>
                    <p className="text-lg font-black text-emerald-400">4 min</p>
                 </div>
               </div>

               <div className="flex items-center gap-2 mb-6 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.05]">
                  <MapPin size={16} className="text-indigo-400 shrink-0" />
                  <p className="text-xs font-medium text-slate-300 truncate">
                    {activeRide.pickup_location?.coordinates?.join(', ')}
                  </p>
               </div>

               <button
                 onClick={handleComplete}
                 className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98]"
               >
                 Complete Ride
               </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* ─── Main Feed ─────────────────────────────────────────────── */}
          <main className="flex-1 overflow-y-auto px-6 py-8">
            {!isOnline ? (
              <div className="h-full flex flex-col items-center justify-center text-center max-w-xs mx-auto">
                <div className="w-20 h-20 rounded-full bg-slate-800/50 flex items-center justify-center mb-6 border border-white/[0.04]">
                  <Power size={32} className="text-slate-600" />
                </div>
                <h2 className="text-xl font-black text-white mb-2">You are Offline</h2>
                <p className="text-sm text-slate-500 font-medium">
                  Go online to start receiving ride requests from nearby hitchhikers.
                </p>
              </div>
            ) : requests.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                <div className="relative mb-6">
                  <Clock size={48} className="text-slate-500 animate-pulse" />
                  <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full" />
                </div>
                <p className="text-sm font-bold text-slate-300 uppercase tracking-widest">Searching for Rides</p>
                <p className="text-xs text-slate-600 mt-2 font-medium">Sit tight, we'll notify you as soon as someone needs a lift.</p>
              </div>
            ) : (
              <div className="grid gap-4 max-w-2xl mx-auto w-full">
                <div className="flex items-center justify-between mb-2">
                   <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400">Nearby Requests</h3>
                   <span className="text-[10px] font-bold text-slate-600 bg-white/[0.03] px-2 py-0.5 rounded-full border border-white/[0.04]">
                      {requests.length} Active
                   </span>
                </div>
                {requests.map((req) => (
                  <RequestCard key={req.id} req={req} onAction={handleAction} />
                ))}
              </div>
            )}
          </main>

          {/* ─── Incoming Modal Pop-up ──────────────────────────────────── */}
          {activeModalRequest && (
            <div className="fixed inset-0 z-50 flex items-center justify-center px-6">
              <div className="absolute inset-0 bg-[#06080c]/80 backdrop-blur-md" onClick={() => setActiveModalRequest(null)} />
              <div className="relative w-full max-w-sm bg-[#1a1f33] border border-white/[0.1] rounded-[2.5rem] p-8 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in duration-300">
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 rounded-full bg-indigo-500/20 flex items-center justify-center mb-6 relative">
                     <Bell size={28} className="text-indigo-400 animate-bounce" />
                     <div className="absolute top-0 right-0 w-4 h-4 bg-rose-500 rounded-full border-4 border-[#1a1f33]" />
                  </div>
                  
                  <h2 className="text-2xl font-black text-white mb-1 uppercase tracking-tighter">New Request Found!</h2>
                  <p className="text-sm text-slate-400 font-medium mb-8">A rider is looking for a lift nearby.</p>

                  <div className="w-full bg-white/[0.03] rounded-3xl p-5 border border-white/[0.06] mb-8 text-left space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-white/[0.08]">
                        <User size={14} className="text-slate-400" />
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Rider</p>
                        <p className="text-xs font-bold text-white">{activeModalRequest.passenger_username || "Hitchhiker"}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <MapPin size={14} className="text-indigo-400 mt-1 shrink-0" />
                      <div>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Pickup</p>
                        <p className="text-xs font-medium text-slate-300 line-clamp-1">
                          {activeModalRequest.pickup_location?.coordinates?.join(', ') || "Unknown Location"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 w-full">
                    <button
                      onClick={() => handleAction(activeModalRequest.id, "accept")}
                      className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleAction(activeModalRequest.id, "reject")}
                      className="px-6 py-4 bg-white/[0.04] border border-white/[0.08] text-slate-400 font-black text-xs uppercase rounded-2xl hover:bg-red-500/10 hover:text-red-400 transition-all active:scale-95"
                    >
                      Pass
                    </button>
                  </div>
                </div>
                
                <button 
                    onClick={() => setActiveModalRequest(null)}
                    className="absolute top-6 right-6 text-slate-600 hover:text-slate-400 transition-colors"
                >
                    <X size={20} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RequestCard({ req, onAction }) {
  return (
    <div className="group bg-white/[0.02] border border-white/[0.06] rounded-3xl p-5 hover:bg-white/[0.04] hover:border-indigo-500/30 transition-all shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform">
            <User size={18} className="text-white" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white">{req.passenger_username || "Hitchhiker"}</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
              Matched {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        </div>
        <div className="flex h-6 items-center px-2 py-0.5 rounded-lg bg-amber-500/10 text-amber-500 text-[9px] font-black uppercase tracking-widest border border-amber-500/20">
          Pending
        </div>
      </div>

      <div className="space-y-2 mb-6">
        <div className="flex items-center gap-2">
          <MapPin size={12} className="text-indigo-400" />
          <p className="text-xs text-slate-400 font-medium truncate">
            {req.pickup_location?.coordinates?.reverse().join(', ')}
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => onAction(req.id, "accept")}
          className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
        >
          <Check size={14} /> Accept
        </button>
        <button
          onClick={() => onAction(req.id, "reject")}
          className="px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/10 text-slate-500 text-[10px] font-black uppercase tracking-widest transition-all"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
