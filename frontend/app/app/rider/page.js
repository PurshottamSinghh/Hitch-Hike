"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
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

function matchToDriver(match, index) {
  return {
    id: match.ride_offer_id,
    name: match.driver_name,
    vehicle: VEHICLES[index % VEHICLES.length],
    seats: match.available_seats,
    detourMins: Math.round(match.extra_seconds / 60),
    distance: `${(match.extra_seconds / 120).toFixed(1)} mi`,
    rating: (4.5 + Math.random() * 0.5).toFixed(1),
    coords: match.driver_origin?.coordinates || [-83.61, 41.66],
    accepted: false,
  };
}

export default function RiderPage() {
  const { coords: userCoords } = useUserLocation();
  const [searchState, setSearchState] = useState("idle");
  const [drivers, setDrivers] = useState([]);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [activeRide, setActiveRide] = useState(null);
  const rideRequestIdRef = useRef(null);
  const router = useRouter();

  // Simple client-side auth guard
  useEffect(() => {
    const user = localStorage.getItem("user");
    if (!user) {
      router.push("/login");
      return;
    }
    const parsed = JSON.parse(user);
    if (parsed.profile?.role !== "rider") {
      router.push(`/app/${parsed.profile?.role || "driver"}`);
    }
  }, [router]);

  // Poll for Rider request status when in "pending_acceptance"
  useEffect(() => {
    let interval;
    if (searchState === "pending_acceptance" && rideRequestIdRef.current) {
      const checkStatus = async () => {
        try {
          const data = await fetchRideRequestById(rideRequestIdRef.current);
          if (data.status === "accepted") {
            setSearchState("confirmed");
            setActiveRide(data);
            clearInterval(interval);
          } else if (data.status === "rejected") {
            setSearchState("results");
            setErrorMsg("Request was declined. Please try another driver.");
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

        // Bypassing fetchRankedMatches for Phase 2: Dispatch Engine broad-broadcast
        // Instead of waiting for results to pick from, we immediately move to searching
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
    <div className="flex h-screen w-screen overflow-hidden text-white bg-[#0d1117]">
      <Sidebar />

      <div className="flex flex-1 flex-col md:flex-row relative">
        <div className="w-full md:w-[380px] lg:w-[400px] xl:w-[420px] h-[45vh] md:h-full shrink-0 z-10">
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

        <div className="flex-1 relative">
          <MapView
            mapboxToken={MAPBOX_TOKEN}
            userCoords={userCoords}
            drivers={searchState === "results" ? drivers : []}
            selectedDriver={selectedDriver}
          />

          {searchState === "pending_acceptance" && (
            <div className="absolute inset-0 z-20 bg-[#0a0e1a]/80 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in duration-500">
              <div className="w-20 h-20 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin mb-6" />
              <h2 className="text-xl font-bold mb-2">Searching for Drivers...</h2>
              <p className="text-sm text-slate-400 font-medium tracking-wide">Hang tight! We are finding the best match for you.</p>
            </div>
          )}

          {searchState === "confirmed" && activeRide && (
            <div className="absolute inset-0 z-20 flex flex-col">
              <MapView
                mapboxToken={MAPBOX_TOKEN}
                userCoords={userCoords}
                drivers={[]}
                selectedDriver={{
                  id: activeRide.id,
                  name: activeRide.driver_username,
                  // Simulate Driver starting position slightly off-campus
                  coords: [
                    activeRide.pickup_location.coordinates[0] - 0.015,
                    activeRide.pickup_location.coordinates[1] + 0.012
                  ]
                }}
              />
              
              <div className="absolute bottom-10 left-6 right-6 z-30">
                <div className="bg-[#1a1f33]/90 backdrop-blur-2xl border border-white/[0.1] rounded-[2rem] p-6 shadow-2xl animate-in slide-in-from-bottom duration-500">
                   <div className="flex items-center justify-between mb-6">
                     <div className="flex items-center gap-4">
                       <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                         <User size={24} className="text-white" />
                       </div>
                       <div>
                         <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-0.5">Driver is coming</p>
                         <h2 className="text-lg font-black text-white">{activeRide.driver_username || "Driver"}</h2>
                       </div>
                     </div>
                     <div className="text-right">
                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-0.5">ETA</p>
                        <p className="text-lg font-black text-indigo-400">6 min</p>
                     </div>
                   </div>

                   <button
                     onClick={() => {
                        setSearchState("idle");
                        setActiveRide(null);
                     }}
                     className="w-full py-4 bg-white/[0.04] border border-white/[0.08] text-slate-400 font-black text-xs uppercase tracking-[0.2em] rounded-2xl transition-all hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/20 active:scale-[0.98]"
                   >
                     Cancel Ride
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
