// File: src/app/login/page.jsx

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { get, ref } from "firebase/database";
import { auth, db } from "../../lib/firebase";
import PremiumButton from "../../components/ui/PremiumButton";
import { unlockNexrideVoice } from "../../lib/nexrideVoice";

export default function LoginPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Permissions Popup State
  const [showPermissions, setShowPermissions] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Check if user has already seen the permissions popup
    const hasSeenPerms = localStorage.getItem("nexride-perms-shown");
    if (!hasSeenPerms) {
      setShowPermissions(true);
    }
  }, []);

  const handleContinue = () => {
    localStorage.setItem("nexride-perms-shown", "true");
    setShowPermissions(false);
    // Optional: unlock voice when they click continue
    try { unlockNexrideVoice("rider"); } catch {}
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setError("Enter email and password.");
      return;
    }

    try {
      setLoading(true);
      try { unlockNexrideVoice("rider"); } catch {}

      const cred = await signInWithEmailAndPassword(auth, cleanEmail, cleanPassword);
      const [profileSnap, userSnap] = await Promise.all([
        get(ref(db, `profiles/${cred.user.uid}`)),
        get(ref(db, `users/${cred.user.uid}`)),
      ]);
      const role = profileSnap.val()?.role || userSnap.val()?.role || "rider";
      router.push(role === "driver" ? "/driver" : role === "admin" ? "/admin" : "/rider");
    } catch (err) {
      console.error(err);
      setError("Login failed. Check your email and password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="nx-login-container">
      {/* FULL BACKGROUND IMAGE */}
      <div className="nx-login-bg">
        <div className="nx-login-bg-overlay" />
      </div>

      {/* 3D PERMISSIONS POPUP (Only shows if not seen before) */}
      {showPermissions && (
        <div className="nx-permission-backdrop">
          <div className="nx-permission-3d-card">
            <h2>Enable NEXRIDE</h2>
            <p>Turn on GPS, alerts, and voice for live rides.</p>
            
            <div className="nx-permission-actions">
              <button className="nx-pill-btn">📍 Enable GPS</button>
              <button className="nx-pill-btn">🔔 Notifications</button>
              <button className="nx-pill-btn">🔊 Test Voice</button>
            </div>

            <div className="nx-status-ready">🟢 Ready</div>

            <button 
              className="nx-btn nx-btn-primary nx-btn-block" 
              onClick={handleContinue}
            >
              Continue to NEXRIDE
            </button>
          </div>
        </div>
      )}

      {/* GLASS LOGIN SHEET */}
      <section className={`nx-login-sheet ${mounted ? "mounted" : ""}`}>
        <div className="nx-auth-sheet-handle" />
        
        <div className="nx-login-brand-mini">
          {/* Using the proper logo file here instead of the wide background image */}
          <img src="/nexridebackground10.jpg" alt="NEXRIDE" className="nx-mini-logo" />
          <div>
            <h1 className="nx-mini-title">NEXRIDE</h1>
            <p className="nx-mini-sub">Where Every Ride Feels Right</p>
          </div>
        </div>

        <h2 className="nx-auth-sheet-title" style={{ marginTop: 24 }}>Welcome</h2>
        <p className="nx-auth-sheet-subtitle">Log in to continue.</p>

        <form onSubmit={handleLogin} className="nx-auth-form">
          <label className="nx-auth-input-group">
            <input
              type="email"
              className="nx-auth-input"
              placeholder=" "
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <span className="nx-auth-label">Email address</span>
          </label>

          <label className="nx-auth-input-group">
            <input
              type={showPassword ? "text" : "password"}
              className="nx-auth-input"
              placeholder=" "
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <span className="nx-auth-label">Password</span>
            <button
              type="button"
              className="nx-auth-eye"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </label>

          {error ? <div className="nx-alert-error">{error}</div> : null}

          <div className="nx-auth-actions">
            <PremiumButton type="submit" loading={loading} fullWidth>
              Log In
            </PremiumButton>
          </div>
        </form>

        <div className="nx-auth-divider">
          <span>New to NEXRIDE?</span>
        </div>

        <Link href="/signup" className="nx-btn nx-btn-secondary nx-btn-block">
          Create an account
        </Link>
      </section>
    </main>
  );
}
