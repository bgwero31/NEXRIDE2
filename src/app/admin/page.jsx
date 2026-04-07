// File: src/app/admin/page.jsx

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { get, onValue, ref } from "firebase/database";
import { auth, db } from "../../lib/firebase";

import MobileShell from "../../components/ui/MobileShell";
import FloatingTopBar from "../../components/ui/FloatingTopBar";
import BottomSheet from "../../components/ui/BottomSheet";
import MapPlaceholder from "../../components/ui/MapPlaceholder";
import ActionCard from "../../components/ui/ActionCard";

const cityOptions = [
  "harare",
  "bulawayo",
  "gweru",
  "mutare",
  "masvingo",
  "zvishavane",
  "kwekwe",
  "kadoma",
];

function cityLabel(city) {
  if (!city) return "Unknown";
  return city.charAt(0).toUpperCase() + city.slice(1);
}

function statusPill(status) {
  const base = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 0.4,
    border: "1px solid transparent",
    textTransform: "uppercase",
  };

  if (status === "open") {
    return {
      ...base,
      color: "#eaffdc",
      background: "rgba(45,200,95,0.12)",
      border: "1px solid rgba(45,200,95,0.22)",
    };
  }

  if (
    status === "accepted" ||
    status === "matched" ||
    status === "arrived" ||
    status === "picked" ||
    status === "enroute"
  ) {
    return {
      ...base,
      color: "#d9f6ff",
      background: "rgba(0,198,255,0.12)",
      border: "1px solid rgba(0,198,255,0.25)",
    };
  }

  if (status === "completed") {
    return {
      ...base,
      color: "#e8f0ff",
      background: "rgba(110,140,255,0.12)",
      border: "1px solid rgba(110,140,255,0.22)",
    };
  }

  return {
    ...base,
    color: "#f5f7fa",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
  };
}

export default function AdminPage() {
  const router = useRouter();

  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);

  const [city, setCity] = useState("harare");

  const [openRequests, setOpenRequests] = useState([]);
  const [activeTrips, setActiveTrips] = useState([]);
  const [completedTrips, setCompletedTrips] = useState([]);
  const [onlineDrivers, setOnlineDrivers] = useState([]);

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [error, setError] = useState("");

  const totals = useMemo(() => {
    return {
      requests: openRequests.length,
      active: activeTrips.length,
      completed: completedTrips.length,
      drivers: onlineDrivers.length,
    };
  }, [openRequests, activeTrips, completedTrips, onlineDrivers]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setAuthReady(true);

      if (!currentUser) {
        router.push("/login");
        return;
      }

      setUser(currentUser);

      try {
        setLoadingProfile(true);

        const snap = await get(ref(db, `profiles/${currentUser.uid}`));
        const profileData = snap.val();

        if (!profileData) {
          setError("Profile not found.");
          return;
        }

        setProfile(profileData);

        const savedCity =
          profileData.city ||
          (typeof window !== "undefined"
            ? localStorage.getItem("nexride-last-place")
            : null) ||
          "harare";

        setCity(savedCity);
      } catch (err) {
        console.error(err);
        setError("Failed to load admin profile.");
      } finally {
        setLoadingProfile(false);
      }
    });

    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (!city) return;

    const requestsRef = ref(db, `rideRequests/${city}`);
    const activeTripsRef = ref(db, `activeTrips`);
    const completedTripsRef = ref(db, `completedTrips`);
    const driversRef = ref(db, `driversOnline/${city}`);

    const unsubRequests = onValue(requestsRef, (snap) => {
      const data = snap.val() || {};
      const arr = Object.entries(data).map(([id, value]) => ({
        id,
        ...value,
      }));
      setOpenRequests(
        arr
          .filter((item) => item.status === "open")
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      );
    });

    const unsubActiveTrips = onValue(activeTripsRef, (snap) => {
      const data = snap.val() || {};
      const arr = Object.entries(data).map(([id, value]) => ({
        id,
        ...value,
      }));
      setActiveTrips(
        arr
          .filter((item) => item.city === city)
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      );
    });

    const unsubCompletedTrips = onValue(completedTripsRef, (snap) => {
      const data = snap.val() || {};
      const arr = Object.entries(data).map(([id, value]) => ({
        id,
        ...value,
      }));
      setCompletedTrips(
        arr
          .filter((item) => item.city === city)
          .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0))
      );
    });

    const unsubDrivers = onValue(driversRef, (snap) => {
      const data = snap.val() || {};
      const arr = Object.entries(data).map(([id, value]) => ({
        id,
        ...value,
      }));
      setOnlineDrivers(arr.filter((driver) => driver.online));
    });

    return () => {
      unsubRequests();
      unsubActiveTrips();
      unsubCompletedTrips();
      unsubDrivers();
    };
  }, [city]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (err) {
      console.error(err);
      setError("Failed to logout.");
    }
  };

  if (!authReady || loadingProfile) {
    return (
      <MobileShell>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <ActionCard style={{ width: "100%", textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 1000 }}>
              Loading admin...
            </div>
            <div style={{ fontSize: 13, color: "#9fb3c8", marginTop: 8 }}>
              Preparing dashboard
            </div>
          </ActionCard>
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell>
      <MapPlaceholder
        label="Admin overview"
        sublabel="Requests, trips, and driver monitoring"
      />

      <FloatingTopBar
        title="NEXRIDE ADMIN"
        subtitle={`${profile?.fullName || "Admin"} • ${cityLabel(city)}`}
        right={
          <button
            onClick={handleLogout}
            style={{
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.04)",
              color: "#fff",
              borderRadius: 14,
              padding: "10px 14px",
              fontWeight: 800,
            }}
          >
            Logout
          </button>
        }
      />

      <BottomSheet height="62vh">
        <div style={{ display: "grid", gap: 12 }}>
          {error ? (
            <div
              style={{
                padding: 12,
                borderRadius: 14,
                background: "rgba(255, 91, 91, 0.08)",
                border: "1px solid rgba(255, 91, 91, 0.18)",
                color: "#ffd5d5",
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {error}
            </div>
          ) : null}

          <ActionCard>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 22, fontWeight: 1000 }}>Admin dashboard</div>
                <div style={{ fontSize: 13, color: "#9fb3c8", marginTop: 4 }}>
                  Live city overview
                </div>
              </div>

              <select
                className="nx-input"
                value={city}
                onChange={(e) => {
                  const nextCity = e.target.value;
                  setCity(nextCity);
                  try {
                    localStorage.setItem("nexride-last-place", nextCity);
                  } catch {}
                }}
                style={{ maxWidth: 150 }}
              >
                {cityOptions.map((item) => (
                  <option key={item} value={item}>
                    {cityLabel(item)}
                  </option>
                ))}
              </select>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              <div
                style={{
                  padding: 14,
                  borderRadius: 18,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div style={{ fontSize: 12, color: "#9fb3c8" }}>Open requests</div>
                <div style={{ fontSize: 24, fontWeight: 1000, marginTop: 4 }}>
                  {totals.requests}
                </div>
              </div>

              <div
                style={{
                  padding: 14,
                  borderRadius: 18,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div style={{ fontSize: 12, color: "#9fb3c8" }}>Active trips</div>
                <div style={{ fontSize: 24, fontWeight: 1000, marginTop: 4 }}>
                  {totals.active}
                </div>
              </div>

              <div
                style={{
                  padding: 14,
                  borderRadius: 18,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div style={{ fontSize: 12, color: "#9fb3c8" }}>Completed</div>
                <div style={{ fontSize: 24, fontWeight: 1000, marginTop: 4 }}>
                  {totals.completed}
                </div>
              </div>

              <div
                style={{
                  padding: 14,
                  borderRadius: 18,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div style={{ fontSize: 12, color: "#9fb3c8" }}>Drivers online</div>
                <div style={{ fontSize: 24, fontWeight: 1000, marginTop: 4 }}>
                  {totals.drivers}
                </div>
              </div>
            </div>
          </ActionCard>

          <ActionCard>
            <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>
              Online drivers
            </div>

            {onlineDrivers.length === 0 ? (
              <div style={{ fontSize: 13, color: "#9fb3c8" }}>
                No online drivers in this city.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {onlineDrivers.map((driver) => (
                  <div
                    key={driver.id}
                    style={{
                      padding: 12,
                      borderRadius: 16,
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <div style={{ fontWeight: 900 }}>{driver.name || "Driver"}</div>
                    <div style={{ fontSize: 13, color: "#9fb3c8", marginTop: 4 }}>
                      {driver.carName || "Vehicle"} • {driver.plateNumber || "No plate"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ActionCard>

          <ActionCard>
            <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>
              Open requests
            </div>

            {openRequests.length === 0 ? (
              <div style={{ fontSize: 13, color: "#9fb3c8" }}>
                No open requests right now.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {openRequests.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      padding: 12,
                      borderRadius: 16,
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        alignItems: "flex-start",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 900 }}>
                          {item.pickupName} → {item.dropoffName}
                        </div>
                        <div style={{ fontSize: 13, color: "#9fb3c8", marginTop: 4 }}>
                          {item.riderName || "Rider"} • $
                          {Number(item.offerPrice || 0).toFixed(2)}
                        </div>
                      </div>
                      <div style={statusPill(item.status || "open")}>
                        {item.status || "open"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ActionCard>

          <ActionCard>
            <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>
              Active trips
            </div>

            {activeTrips.length === 0 ? (
              <div style={{ fontSize: 13, color: "#9fb3c8" }}>
                No active trips right now.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {activeTrips.map((trip) => (
                  <div
                    key={trip.id}
                    style={{
                      padding: 12,
                      borderRadius: 16,
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        alignItems: "flex-start",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 900 }}>
                          {trip.pickupName} → {trip.dropoffName}
                        </div>
                        <div style={{ fontSize: 13, color: "#9fb3c8", marginTop: 4 }}>
                          {trip.riderName || "Rider"} • {trip.driverName || "Driver"}
                        </div>
                      </div>
                      <div style={statusPill(trip.status || "accepted")}>
                        {trip.status || "accepted"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ActionCard>

          <ActionCard>
            <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 10 }}>
              Completed trips
            </div>

            {completedTrips.length === 0 ? (
              <div style={{ fontSize: 13, color: "#9fb3c8" }}>
                No completed trips yet.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {completedTrips.slice(0, 10).map((trip) => (
                  <div
                    key={trip.id}
                    style={{
                      padding: 12,
                      borderRadius: 16,
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        alignItems: "flex-start",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 900 }}>
                          {trip.pickupName} → {trip.dropoffName}
                        </div>
                        <div style={{ fontSize: 13, color: "#9fb3c8", marginTop: 4 }}>
                          ${Number(trip.agreedPrice || 0).toFixed(2)} • {trip.driverName || "Driver"}
                        </div>
                      </div>
                      <div style={statusPill("completed")}>completed</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ActionCard>
        </div>
      </BottomSheet>
    </MobileShell>
  );
  }
