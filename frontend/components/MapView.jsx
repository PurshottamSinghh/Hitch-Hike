"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import Map, { Marker, Source, Layer } from "react-map-gl/mapbox";
import { Crosshair } from "lucide-react";

/**
 * Full-bleed Mapbox map with:
 *  - Pulsing blue-dot for user location
 *  - Car markers for drivers
 *  - GeoJSON route line when a driver is selected
 *
 * @param {{ mapboxToken, userCoords, drivers, selectedDriver }} props
 */
export default function MapView({
  mapboxToken,
  userCoords,
  drivers,
  selectedDriver,
  waypoints = [], // [{lng, lat}, ...]
}) {
  const mapRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Helper to fit map to points
  const fitPoints = useCallback((pts) => {
    if (!pts || pts.length < 2 || !mapRef.current) return;
    
    const lngs = pts.map(p => p.lng);
    const lats = pts.map(p => p.lat);
    
    const bounds = [
      [Math.min(...lngs) - 0.005, Math.min(...lats) - 0.005],
      [Math.max(...lngs) + 0.005, Math.max(...lats) + 0.005],
    ];

    mapRef.current.fitBounds(bounds, {
      padding: { top: 80, bottom: 80, left: 60, right: 60 },
      duration: 1200,
    });
  }, []);

  // Fly to user coords on first load (if no waypoints)
  useEffect(() => {
    if (mapLoaded && userCoords && waypoints.length === 0 && mapRef.current) {
      mapRef.current.flyTo({
        center: [userCoords.lng, userCoords.lat],
        zoom: 13,
        duration: 1800,
      });
    }
  }, [mapLoaded, userCoords, waypoints.length]);

  // Handle waypoints/selectedDriver fitting
  useEffect(() => {
    if (!mapLoaded) return;
    
    if (waypoints.length > 0) {
      fitPoints(waypoints);
    } else if (selectedDriver && userCoords) {
      fitPoints([
        { lng: userCoords.lng, lat: userCoords.lat },
        { lng: selectedDriver.coords[0], lat: selectedDriver.coords[1] }
      ]);
    }
  }, [waypoints, selectedDriver, userCoords, mapLoaded, fitPoints]);

  const handleRecenter = useCallback(() => {
    if (userCoords && mapRef.current) {
      mapRef.current.flyTo({
        center: [userCoords.lng, userCoords.lat],
        zoom: 14,
        duration: 1000,
      });
    }
  }, [userCoords]);

  const [routeData, setRouteData] = useState(null);

  // Fetch real roadway route
  useEffect(() => {
    const fetchRoute = async () => {
      let coordsString = "";
      
      if (waypoints.length >= 2) {
        coordsString = waypoints.map(w => `${w.lng},${w.lat}`).join(';');
      } else if (selectedDriver && userCoords) {
        coordsString = `${selectedDriver.coords[0]},${selectedDriver.coords[1]};${userCoords.lng},${userCoords.lat}`;
      } else {
        setRouteData(null);
        return;
      }

      try {
        const query = await fetch(
          `https://api.mapbox.com/directions/v5/mapbox/driving/${coordsString}?steps=true&geometries=geojson&access_token=${mapboxToken}`
        );
        const json = await query.json();
        if (!json.routes || json.routes.length === 0) return;
        
        const data = json.routes[0];
        const route = data.geometry.coordinates;
        
        setRouteData({
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: route,
          },
        });
      } catch (err) {
        console.error("Failed to fetch directions:", err);
      }
    };

    fetchRoute();
  }, [selectedDriver, userCoords, mapboxToken, waypoints]);

  return (
    <div className="relative w-full h-full">
      <Map
        ref={mapRef}
        mapboxAccessToken={mapboxToken}
        initialViewState={{
          longitude: userCoords?.lng || -81.6944,
          latitude: userCoords?.lat || 41.4993,
          zoom: 13,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        onLoad={() => setMapLoaded(true)}
        attributionControl={false}
      >
        {/* ── User Blue Dot ──────────────────────────────────────────── */}
        {userCoords && (
          <Marker
            longitude={userCoords.lng}
            latitude={userCoords.lat}
            anchor="center"
          >
            <div className="user-marker" title="Your Location" />
          </Marker>
        )}

        {/* ── Driver Markers ─────────────────────────────────────────── */}
        {drivers.map((driver) => (
          <Marker
            key={driver.id}
            longitude={driver.coords[0]}
            latitude={driver.coords[1]}
            anchor="center"
          >
            <div
              className={`driver-marker ${
                selectedDriver?.id === driver.id
                  ? "!bg-gradient-to-br !from-indigo-500 !to-indigo-400 !shadow-indigo-500/50"
                  : ""
              }`}
              title={driver.name}
            >
              🚗
            </div>
          </Marker>
        ))}

        {/* ── Special Waypoint Markers (e.g. Destination) ─────────────── */}
        {waypoints.length > 2 && (
            <Marker 
                longitude={waypoints[waypoints.length - 1].lng} 
                latitude={waypoints[waypoints.length - 1].lat}
            >
                <div className="w-6 h-6 rounded-full bg-rose-500 border-4 border-white shadow-xl animate-bounce" />
            </Marker>
        )}

        {/* ── Route Line ─────────────────────────────────────────────── */}
        {routeData && (
          <>
            {/* Glow layer */}
            <Source id="route-glow" type="geojson" data={routeData}>
              <Layer
                id="route-glow-layer"
                type="line"
                paint={{
                  "line-color": "#6366f1",
                  "line-width": 8,
                  "line-opacity": 0.2,
                  "line-blur": 6,
                }}
              />
            </Source>
            {/* Main line */}
            <Source id="route" type="geojson" data={routeData}>
              <Layer
                id="route-layer"
                type="line"
                paint={{
                  "line-color": "#818cf8",
                  "line-width": 3,
                  "line-opacity": 0.9,
                  "line-dasharray": [2, 1.5],
                }}
              />
            </Source>
          </>
        )}
      </Map>

      {/* ── Recenter Button ────────────────────────────────────────── */}
      {userCoords && (
        <button
          onClick={handleRecenter}
          className="absolute bottom-6 right-6 w-11 h-11 rounded-xl bg-[#1a1f33]/90 backdrop-blur-md border border-white/[0.08] flex items-center justify-center text-slate-300 hover:text-white hover:bg-[#222842] hover:border-indigo-500/30 transition-all shadow-xl cursor-pointer z-10"
          title="Recenter on location"
        >
          <Crosshair size={18} />
        </button>
      )}

      {/* ── Map Overlay: GPS acquiring screen ──────────────────────── */}
      {!userCoords && (
        <div className="absolute inset-0 z-20 bg-[#0a0e1a]/80 backdrop-blur-sm flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin mb-5" />
          <p className="text-sm font-semibold text-slate-300">
            Acquiring your location…
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Please allow GPS access in your browser
          </p>
        </div>
      )}
    </div>
  );
}

