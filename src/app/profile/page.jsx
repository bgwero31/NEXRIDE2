"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { get, onValue, ref } from "firebase/database";
import { auth, db } from "../../lib/firebase";
import MobileShell from "../../components/ui/MobileShell";
import FloatingTopBar from "../../components/ui/FloatingTopBar";
import ActionCard from "../../components/ui/ActionCard";
import PremiumButton from "../../components/ui/PremiumButton";

function money(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

function dateTime(value) {
  if (!value) return "Recent";
  try {
    return new Date(Number(value)).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "Recent";
  }
}

function cityLabel(city) {
  if (!city) return "City";
  return String(city).charAt(0).toUpperCase() + String(city).slice(1);
}

export default function ProfilePage() {
  const router = useRouter();
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [settings, setSettings] = useState(null);
  const [completedTrips, setCompletedTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  const role = profile?.role || "rider";
  const photoUrl = profile?.photoUrl || profile?.profilePhotoUrl || settings?.photoUrl || "";
  const city = settings?.city || profile?.city || "harare";

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setAuthReady(true);
      if (!currentUser) {
        router.push("/login");
        return;
      }
      setUser(currentUser);
      try {
        setLoading(true);
        const [profileSnap, settingsSnap, userSnap] = await Promise.all([
          get(ref(db, `profiles/${currentUser.uid}`)),
          get(ref(db, `appSettings/${currentUser.uid}`)),
          get(ref(db, `users/${currentUser.uid}`)),
        ]);
        const p = profileSnap.val() || {};
        const u = userSnap.val() || {};
        setProfile({ ...p, role: p.role || u.role || "rider", email: u.email || currentUser.email || "" });
        setSettings(settingsSnap.val() || {});
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (!user) return;
    const unsub = onValue(ref(db, "completedTrips"), (snap) => {
      const data = snap.val() || {};
      const list = Object.entries(data)
        .map(([id, value]) => ({ id, ...value }))
        .filter((trip) => trip.riderId === user.uid || trip.driverId === user.uid)
        .sort((a, b) => Number(b.completedAt || b.updatedAt || 0) - Number(a.completedAt || a.updatedAt || 0));
      setCompletedTrips(list);
    });
    return () => unsub();
  }, [user]);

  const totals = useMemo(() => {
    const trips = completedTrips.length;
    const amount = completedTrips.reduce((sum, trip) => sum + Number(trip.agreedPrice || 0), 0);
    const km = completedTrips.reduce((sum, trip) => sum + Number(trip.distanceMeters || 0) / 1000, 0);
    return { trips, amount, km };
  }, [completedTrips]);

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  if (!authReady || loading) {
    return (
      <MobileShell>
        <div className="nx-center-loader"><ActionCard><h2 className="nx-sheet-title">Opening profile...</h2></ActionCard></div>
      </MobileShell>
    );
  }

  return (
    <MobileShell>
      <div className="nx-profile-page">
        <FloatingTopBar
          title="NEXRIDE"
          subtitle={`${profile?.fullName || "Account"} • ${cityLabel(city)}`}
          avatarUrl={photoUrl}
          role={role}
          onLogout={handleLogout}
        />
        <div style={{ height: 104 }} />

        <ActionCard className="nx-profile-hero">
          <div className="nx-profile-avatar-large">{photoUrl ? <img src={photoUrl} alt="" /> : "👤"}</div>
          <div style={{ minWidth: 0 }}>
            <div className="nx-eyebrow">Profile</div>
            <h1 className="nx-sheet-title">{profile?.fullName || "NEXRIDE user"}</h1>
            <p className="nx-sheet-copy">{role.toUpperCase()} • {profile?.phone || "Phone not added"} • {cityLabel(city)}</p>
          </div>
        </ActionCard>

        <div className="nx-stat-row" style={{ marginTop: 12 }}>
          <div className="nx-stat-card"><span>Trips</span><strong>{totals.trips}</strong><small>completed</small></div>
          <div className="nx-stat-card"><span>Total</span><strong>${money(totals.amount)}</strong><small>cash flow</small></div>
          <div className="nx-stat-card"><span>Distance</span><strong>{totals.km.toFixed(totals.km < 10 ? 1 : 0)}</strong><small>km</small></div>
        </div>

        <div className="nx-grid" style={{ marginTop: 14 }}>
          <a href="/settings" className="nx-page-link-card"><span>⚙ Settings</span><strong>›</strong></a>
          <a href="/safety" className="nx-page-link-card"><span>🛡 Safety center</span><strong>›</strong></a>
          <a href="/support" className="nx-page-link-card"><span>💬 Support</span><strong>›</strong></a>
        </div>

        <section id="history" style={{ marginTop: 18 }}>
          <div className="nx-section-title">Completed requests</div>
          <div className="nx-history-list" style={{ marginTop: 10 }}>
            {completedTrips.length ? completedTrips.map((trip) => {
              const otherName = role === "driver" ? trip.riderName : trip.driverName;
              return (
                <div key={trip.id} className="nx-history-item">
                  <div className="nx-offer-top">
                    <div>
                      <div className="nx-card-title">{otherName || "NEXRIDE trip"}</div>
                      <p className="nx-sheet-copy">{trip.pickupName || "Pickup"} → {trip.dropoffName || "Destination"}</p>
                    </div>
                    <div className="nx-offer-price">${money(trip.agreedPrice)}</div>
                  </div>
                  <div className="nx-history-meta">
                    <span>{trip.distanceText || "Distance saved"}</span>
                    <span>{trip.durationText || "ETA saved"}</span>
                    <span>{dateTime(trip.completedAt || trip.updatedAt)}</span>
                  </div>
                </div>
              );
            }) : (
              <ActionCard><div className="nx-card-title">No completed rides yet</div><p className="nx-sheet-copy">Your finished trips will appear here with distance, time, person and amount.</p></ActionCard>
            )}
          </div>
        </section>

        <PremiumButton style={{ marginTop: 14 }} onClick={() => router.push(role === "driver" ? "/driver" : "/rider")}>Back to live map</PremiumButton>
        <div className="nx-footer-brand">@NEXRIDE</div>
      </div>
    </MobileShell>
  );
}
