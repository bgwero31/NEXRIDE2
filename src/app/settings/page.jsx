// File: src/app/settings/page.jsx

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { get, ref, update } from "firebase/database";
import { auth, db } from "../../lib/firebase";

import MobileShell from "../../components/ui/MobileShell";
import ActionCard from "../../components/ui/ActionCard";
import PremiumButton from "../../components/ui/PremiumButton";
import NexrideBrand from "../../components/ui/NexrideBrand";

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

function dashboardFor(role) {
  if (role === "driver") return "/driver";
  if (role === "admin") return "/admin";
  return "/rider";
}

export default function SettingsPage() {
  const router = useRouter();

  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [settings, setSettings] = useState(null);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("harare");
  const [carName, setCarName] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [defaultPickup, setDefaultPickup] = useState("");
  const [defaultDropoff, setDefaultDropoff] = useState("");
  const [preferredPayment, setPreferredPayment] = useState("cash");
  const [rideMode, setRideMode] = useState("standard");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const role = useMemo(() => profile?.role || "rider", [profile]);
  const dashboardHref = useMemo(() => dashboardFor(role), [role]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setAuthReady(true);

      if (!currentUser) {
        router.push("/login");
        return;
      }

      setUser(currentUser);
      setError("");

      try {
        setLoading(true);

        const [profileSnap, settingsSnap, userSnap] = await Promise.all([
          get(ref(db, `profiles/${currentUser.uid}`)),
          get(ref(db, `appSettings/${currentUser.uid}`)),
          get(ref(db, `users/${currentUser.uid}`)),
        ]);

        const profileData = profileSnap.val() || {};
        const userData = userSnap.val() || {};
        const settingsData = settingsSnap.val() || {};
        const mergedProfile = {
          ...profileData,
          role: profileData.role || userData.role || "rider",
          email: userData.email || currentUser.email || "",
        };

        setProfile(mergedProfile);
        setSettings(settingsData);

        setFullName(mergedProfile.fullName || "");
        setPhone(mergedProfile.phone || "");
        setCity(mergedProfile.city || settingsData.city || "harare");
        setCarName(mergedProfile.carName || "");
        setPlateNumber(mergedProfile.plateNumber || "");
        setDefaultPickup(settingsData.defaultPickup || "");
        setDefaultDropoff(settingsData.defaultDropoff || "");
        setPreferredPayment(settingsData.preferredPayment || "cash");
        setRideMode(settingsData.rideMode || "standard");
        setNotificationsEnabled(settingsData.notificationsEnabled !== false);
      } catch (err) {
        console.error(err);
        setError("Failed to load settings.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, [router]);

  const saveSettings = async (e) => {
    e.preventDefault();
    if (!user) return;

    setError("");
    setSuccess("");

    const cleanName = fullName.trim();
    const cleanPhone = phone.trim();
    const cleanCity = city.trim().toLowerCase();
    const cleanCarName = carName.trim();
    const cleanPlate = plateNumber.trim().toUpperCase();

    if (!cleanName || !cleanPhone || !cleanCity) {
      setError("Name, phone, and city are required.");
      return;
    }

    if (role === "driver" && (!cleanCarName || !cleanPlate)) {
      setError("Driver vehicle name and plate number are required.");
      return;
    }

    try {
      setSaving(true);
      const now = Date.now();

      await update(ref(db, `profiles/${user.uid}`), {
        fullName: cleanName,
        phone: cleanPhone,
        city: cleanCity,
        updatedAt: now,
        ...(role === "driver"
          ? {
              carName: cleanCarName,
              plateNumber: cleanPlate,
            }
          : {}),
      });

      await update(ref(db, `appSettings/${user.uid}`), {
        city: cleanCity,
        defaultPickup: defaultPickup.trim(),
        defaultDropoff: defaultDropoff.trim(),
        preferredPayment,
        rideMode,
        notificationsEnabled,
        updatedAt: now,
      });

      try {
        localStorage.setItem("nexride-last-place", cleanCity);
        localStorage.setItem("nexride-default-pickup", defaultPickup.trim());
        localStorage.setItem("nexride-default-dropoff", defaultDropoff.trim());
        localStorage.setItem("nexride-preferred-payment", preferredPayment);
        localStorage.setItem("nexride-ride-mode", rideMode);
      } catch {}

      setProfile((prev) => ({
        ...(prev || {}),
        fullName: cleanName,
        phone: cleanPhone,
        city: cleanCity,
        ...(role === "driver"
          ? {
              carName: cleanCarName,
              plateNumber: cleanPlate,
            }
          : {}),
      }));

      setSettings((prev) => ({
        ...(prev || {}),
        city: cleanCity,
        defaultPickup: defaultPickup.trim(),
        defaultDropoff: defaultDropoff.trim(),
        preferredPayment,
        rideMode,
        notificationsEnabled,
      }));

      setSuccess("Settings saved. Your app flow is now updated.");
    } catch (err) {
      console.error(err);
      setError("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (err) {
      console.error(err);
      setError("Failed to logout.");
    }
  };

  if (!authReady || loading) {
    return (
      <MobileShell>
        <div className="nx-settings-page" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ActionCard style={{ width: "100%", textAlign: "center", padding: 20 }}>
            <div style={{ fontSize: 24, fontWeight: 1000 }}>Loading settings...</div>
            <div className="nx-soft-text" style={{ marginTop: 8 }}>Preparing your connected app controls</div>
          </ActionCard>
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell>
      <div className="nx-settings-page">
        <div className="nx-settings-header">
          <NexrideBrand subtitle={`${profile?.fullName || "Account"} • ${cityLabel(city)} • ${role.toUpperCase()}`} />
          <div className="nx-settings-title">Settings</div>
        </div>

        <div className="nx-tab-grid" style={{ marginBottom: 14 }}>
          <a href={dashboardHref} className="nx-tab-card">
            <span className="nx-kbd">↩</span>
            <div style={{ fontWeight: 1000, marginTop: 10 }}>Back to app</div>
            <div className="nx-soft-text" style={{ fontSize: 12 }}>Open your dashboard</div>
          </a>
          <a href="/rider" className="nx-tab-card">
            <span className="nx-kbd">🚘</span>
            <div style={{ fontWeight: 1000, marginTop: 10 }}>Rider view</div>
            <div className="nx-soft-text" style={{ fontSize: 12 }}>Request a ride</div>
          </a>
        </div>

        <form onSubmit={saveSettings} className="nx-grid" style={{ gap: 14 }}>
          <ActionCard style={{ padding: 18 }}>
            <div className="nx-section-title">Profile controls</div>
            <div className="nx-grid" style={{ gap: 12, marginTop: 14 }}>
              <label className="nx-grid" style={{ gap: 7 }}>
                <span className="nx-soft-text" style={{ fontWeight: 900 }}>Full name</span>
                <input className="nx-input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" />
              </label>

              <label className="nx-grid" style={{ gap: 7 }}>
                <span className="nx-soft-text" style={{ fontWeight: 900 }}>Phone number</span>
                <input className="nx-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +263..." />
              </label>

              <label className="nx-grid" style={{ gap: 7 }}>
                <span className="nx-soft-text" style={{ fontWeight: 900 }}>Main city</span>
                <select className="nx-input" value={city} onChange={(e) => setCity(e.target.value)}>
                  {cityOptions.map((item) => (
                    <option key={item} value={item}>{cityLabel(item)}</option>
                  ))}
                </select>
              </label>
            </div>
          </ActionCard>

          {role === "driver" ? (
            <ActionCard style={{ padding: 18 }}>
              <div className="nx-section-title">Driver vehicle</div>
              <div className="nx-grid" style={{ gap: 12, marginTop: 14 }}>
                <label className="nx-grid" style={{ gap: 7 }}>
                  <span className="nx-soft-text" style={{ fontWeight: 900 }}>Vehicle name</span>
                  <input className="nx-input" value={carName} onChange={(e) => setCarName(e.target.value)} placeholder="Toyota Aqua, Honda Fit..." />
                </label>

                <label className="nx-grid" style={{ gap: 7 }}>
                  <span className="nx-soft-text" style={{ fontWeight: 900 }}>Plate number</span>
                  <input className="nx-input" value={plateNumber} onChange={(e) => setPlateNumber(e.target.value)} placeholder="ABC 1234" />
                </label>
              </div>
            </ActionCard>
          ) : null}

          <ActionCard style={{ padding: 18 }}>
            <div className="nx-section-title">Ride flow</div>
            <div className="nx-grid" style={{ gap: 12, marginTop: 14 }}>
              <label className="nx-grid" style={{ gap: 7 }}>
                <span className="nx-soft-text" style={{ fontWeight: 900 }}>Default pickup</span>
                <input className="nx-input" value={defaultPickup} onChange={(e) => setDefaultPickup(e.target.value)} placeholder="Home, work, school..." />
              </label>

              <label className="nx-grid" style={{ gap: 7 }}>
                <span className="nx-soft-text" style={{ fontWeight: 900 }}>Default drop-off</span>
                <input className="nx-input" value={defaultDropoff} onChange={(e) => setDefaultDropoff(e.target.value)} placeholder="Where you usually go" />
              </label>

              <label className="nx-grid" style={{ gap: 7 }}>
                <span className="nx-soft-text" style={{ fontWeight: 900 }}>Preferred payment</span>
                <select className="nx-input" value={preferredPayment} onChange={(e) => setPreferredPayment(e.target.value)}>
                  <option value="cash">Cash</option>
                  <option value="ecocash">EcoCash</option>
                  <option value="onemoney">OneMoney</option>
                  <option value="card">Card</option>
                </select>
              </label>

              <label className="nx-grid" style={{ gap: 7 }}>
                <span className="nx-soft-text" style={{ fontWeight: 900 }}>Ride style</span>
                <select className="nx-input" value={rideMode} onChange={(e) => setRideMode(e.target.value)}>
                  <option value="standard">Standard</option>
                  <option value="fastest">Fastest pickup</option>
                  <option value="comfort">Comfort</option>
                  <option value="budget">Budget first</option>
                </select>
              </label>
            </div>
          </ActionCard>

          <ActionCard style={{ padding: 18 }}>
            <div className="nx-section-title">App experience</div>
            <div className="nx-premium-list" style={{ marginTop: 14 }}>
              <button
                type="button"
                className="nx-setting-row"
                onClick={() => setNotificationsEnabled((value) => !value)}
                style={{ width: "100%", textAlign: "left" }}
              >
                <span>
                  <span style={{ display: "block", fontWeight: 1000 }}>Ride notifications</span>
                  <span className="nx-soft-text" style={{ fontSize: 12 }}>Save your notification preference for the app</span>
                </span>
                <span className="nx-pill">{notificationsEnabled ? "ON" : "OFF"}</span>
              </button>

              <div className="nx-setting-row">
                <span>
                  <span style={{ display: "block", fontWeight: 1000 }}>Account email</span>
                  <span className="nx-soft-text" style={{ fontSize: 12 }}>{profile?.email || user?.email || "No email"}</span>
                </span>
                <span className="nx-pill">LOCKED</span>
              </div>
            </div>
          </ActionCard>

          {error ? <div className="nx-alert-error">{error}</div> : null}
          {success ? <div className="nx-alert-success">{success}</div> : null}

          <PremiumButton type="submit" disabled={saving}>
            {saving ? "Saving settings..." : "Save app settings"}
          </PremiumButton>

          <PremiumButton variant="secondary" onClick={() => router.push(dashboardHref)}>
            Back to dashboard
          </PremiumButton>

          <PremiumButton variant="secondary" onClick={handleLogout}>
            Logout
          </PremiumButton>
        </form>
      </div>
    </MobileShell>
  );
}
