# 🚀 Hitch-Hike: The Official User Guide

Welcome to **Hitch-Hike**, the premium campus ride-sharing platform designed exclusively for the University of Toledo Rockets.

---

## 🛡️ Access & Security
Hitch-Hike uses **UToledo SSO Enforcement**.
- **Constraint**: You must register with a `@utoledo.edu` or `@rockets.utoledo.edu` email address.
- **Authentication**: We use secure JWT (JSON Web Tokens) for all sessions. Your session will automatically expire and prompt for re-login if inactivity is detected.

---

## 🗺️ The Rider Mission (Get a Ride)
**Goal**: Request a ride from your current campus location to any destination.

1. **Set Destination**: Click on the Map or use the search bar in the **Action Panel**.
2. **Launch Search**: The system will optimize rocket matchmaking to find the nearest online driver.
3. **Track in Real-Time**: Once matched, you will see your driver's live GPS location as they navigate toward your pickup point.
4. **Estimated Arrival**: View live ETAs for pickup and drop-off.
5. **Cancellation**: If your plans change, you can cancel the ride directly from the tracking card.

---

## 🏎️ The Driver Mission (Give a Ride)
**Goal**: Help fellow Rockets while earning leaderboard points.

1. **Go Online**: Toggle the "Go Online" switch in the Driver Dashboard.
2. **GPS Signaling**: Your browser will begin sending secure location pings to our backend every 5 seconds.
3. **Accept Requests**: Incoming ride requests from nearby riders will appear in your **Active Missions** list.
4. **Navigate**: Use the built-in Mapbox routing to navigate to the Pickup and then to the Destination.
5. **Complete Mission**: Hit "Complete Ride" once you've arrived to finalize the transaction and update your stats.

---

## 📊 Leaderboard & Gamification
- **Level Up**: Earn points for every successful ride.
- **Trophy System**: Access the global Leaderboard via the **Trophy icon** in the top navigation bar to see where you rank among the campus elite.

---

## 🛠️ Technical Architecture
Hitch-Hike is built on a high-performance modern stack:
- **Frontend**: Next.js (App Router) with Lucide Icons and a custom Vanilla CSS Glassmorphic theme.
- **Backend**: Django REST Framework + SimpleJWT.
- **Database**: PostgreSQL with PostGIS for high-accuracy spatial queries.
- **Maps**: Mapbox GL JS for real-time visualization and multi-waypoint routing.

---

## 🔧 Troubleshooting
- **Session Expired**: If you see an error related to tokens, the app will automatically redirect you to the Login screen. Simply log back in to refresh your JWT.
- **GPS Issues**: Ensure you have granted location permissions to your browser for accurate pickup coordinates.

---

*Fly high, Rockets!* 🚀
