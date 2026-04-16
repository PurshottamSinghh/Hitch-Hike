"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import LeaderboardModal from "@/components/LeaderboardModal";
import ActionPanel from "@/components/ActionPanel";
import MapView from "@/components/MapView";
import useUserLocation from "@/hooks/useUserLocation";
import {
  createRideRequest,
  fetchRankedMatches,
  confirmMatch,
  fetchRideRequestById,
} from "@/lib/api";
import { Check, User } from "lucide-react";
import { useRouter } from "next/navigation";

/* ══════════════════════════════════════════════════════════════════════════
 * Mapbox Token
 * ══════════════════════════════════════════════════════════════════════════ */
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const VEHICLES = [
  "Toyota Camry · Gray",
  "Honda Civic · White",
  "Ford Escape · Blue",
  "Tesla Model 3 · Black",
  "Hyundai Elantra · Red",
];

export default function RiderPage() {
  const { coords: userCoords } = useUserLocation();
  const [searchState, setSearchState] = useState("idle");
  const [drivers, setDrivers] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [activeRide, setActiveRide] = useState(null);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const rideRequestIdRef = useRef(null);
  const router = useRouter();

  // Simple client-side auth guard
  useEffect(() => {
    const user = localStorage.getItem("user");
    if (!user) {
      router.push("/login");
      return;
    }
  }, [router]);

  // Poll for Rider request status when in "pending_acceptance"
  useEffect(() => {
    let interval;
    if (searchState === "pending_acceptance" && rideRequestIdRef.current) {
      console.log(`📡 Polling status for Request #${rideRequestIdRef.current}...`);
      const checkStatus = async () => {
        try {
          const data = await fetchRideRequestById(rideRequestIdRef.current);
          console.log(`   > Status: ${data.status}`);
          
          if (data.status === "accepted" || data.status === "matched") {
            console.log("✅ Match confirmed! Navigating to ride details...");
            setSearchState("confirmed");
            setActiveRide(data);
            clearInterval(interval);
          } else if (data.status === "rejected" || data.status === "cancelled") {
            setSearchState("results");
            setErrorMsg(data.status === "rejected" ? "Request was declined by the driver." : "Ride was cancelled.");
            clearInterval(interval);
          }
        } catch (err) {
          console.error("Status check failed:", err);
        }
      };

      interval = setInterval(checkStatus, 3000);
    }
    return () => clearInterval(interval);
  }, [searchState]);

  const handleSearch = useCallback(
    async (dropoffCoords) => {
      if (!userCoords) return;

      setSearchState("loading");
      setSelectedDriver(null);
      setErrorMsg(null);

      try {
        const pickup = { lng: userCoords.lng, lat: userCoords.lat };
        const rideRequest = await createRideRequest(pickup, dropoffCoords);
        rideRequestIdRef.current = rideRequest.id;
        setSearchState("pending_acceptance");
      } catch (err) {
        console.error("Search failed:", err);
        setErrorMsg(err.message || "Something went wrong");
        setSearchState("error");
      }
    },
    [userCoords]
  );

  const handleSelectDriver = useCallback((driver) => {
    setSelectedDriver((prev) => (prev?.id === driver.id ? null : driver));
  }, []);

  const handleAcceptDriver = useCallback(
    async (driver) => {
      if (!rideRequestIdRef.current) return;
      setSearchState("pending_acceptance");
      console.log(`⏳ Rider waiting for Driver #${driver.id} to accept Request #${rideRequestIdRef.current}`);
    },
    []
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden text-white bg-var(--color-bg-primary)">
      <Header onTrophyClick={() => setIsLeaderboardOpen(true)} />
      <Sidebar />
      <LeaderboardModal 
        isOpen={isLeaderboardOpen} 
        onClose={() => setIsLeaderboardOpen(false)} 
      />

      <div className="flex flex-1 flex-col lg:flex-row relative mt-24">
        {/* Left Action Panel */}
        <div className="w-full lg:w-[400px] xl:w-[450px] h-[45vh] lg:h-full shrink-0 z-10 p-6">
          <ActionPanel
            userCoords={userCoords}
            drivers={drivers}
            selectedDriver={selectedDriver}
            onSelectDriver={handleSelectDriver}
            onAcceptDriver={handleAcceptDriver}
            onSearch={handleSearch}
            searchState={searchState}
            errorMsg={errorMsg}
          />
        </div>

        {/* Map View Section */}
        <div className="flex-1 relative m-6 lg:ml-0 overflow-hidden gs-surface border-indigo-500/10">
          <MapView
            mapboxToken={MAPBOX_TOKEN}
            userCoords={userCoords}
            drivers={searchState === "results" ? drivers : []}
            selectedDriver={selectedDriver}
          />

          {searchState === "pending_acceptance" && (
            <div className="absolute inset-0 z-20 bg-[#0a0e1a]/85 backdrop-blur-xl flex flex-col items-center justify-center animate-in fade-in duration-500">
              <div className="w-20 h-20 rounded-full border-4 border-indigo-500/10 border-t-indigo-500 animate-spin mb-8 shadow-lg shadow-indigo-500/20" />
              <h2 className="text-2xl font-black italic uppercase tracking-tight mb-2">Searching Drivers</h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Optimizing Rocket Matchmaking...</p>
            </div>
          )}

          {searchState === "confirmed" && activeRide && (
            <div className="absolute inset-0 z-20 flex flex-col">
              <MapView
                mapboxToken={MAPBOX_TOKEN}
                userCoords={userCoords}
                drivers={[]}
                waypoints={[
                  activeRide.driver_coords || { 
                    lng: activeRide.pickup_location.coordinates[0] - 0.015,
                    lat: activeRide.pickup_location.coordinates[1] + 0.012
                  },
                  { lng: activeRide.pickup_location.coordinates[0], lat: activeRide.pickup_location.coordinates[1] },
                  { lng: activeRide.dropoff_location.coordinates[0], lat: activeRide.dropoff_location.coordinates[1] }
                ]}
              />
              
              <div className="absolute bottom-10 left-6 right-6 z-30 flex justify-center">
                <div className="w-full max-w-xl bg-var(--color-bg-card) backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom-10 duration-500">
                   <div className="flex items-center justify-between mb-8">
                     <div className="flex items-center gap-5">
                       <div className="w-16 h-16 rounded-[20px] bg-indigo-500 flex items-center justify-center shadow-xl shadow-indigo-500/20">
                         <User size={32} className="text-white" />
                       </div>
                       <div>
                         <p className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-[0.2em] mb-1">Incoming Match</p>
                         <h2 className="text-2xl font-black text-white italic tracking-tight">{activeRide.driver_username || "Driver"}</h2>
                       </div>
                     </div>
                     <div className="text-right">
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">ETA</p>
                        <div className="gs-btn-accent pointer-events-none py-1.5 px-4 text-sm font-black">6 MIN</div>
                     </div>
                   </div>

                   <button
                     onClick={() => {
                        setSearchState("idle");
                        setActiveRide(null);
                     }}
                     className="w-full py-5 bg-white/5 border border-white/10 text-slate-400 font-black text-[10px] uppercase tracking-[0.3em] rounded-2xl transition-all hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20"
                   >
                     Cancel This Ride
                   </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
