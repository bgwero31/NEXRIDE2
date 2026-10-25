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

  useEffect(() => {
    // Trigger mount animation
    setMounted(true);
    // Unlock voice for iOS/Android (needs user interaction first, but this gets it ready)
    try { unlockNexrideVoice("rider"); } catch {}
  }, []);

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
    <main className="nx-auth-shell-v2">
      {/* Animated Background Elements */}
      <div className="nx-auth-bg-v2">
        <div className="nx-auth-glow-1" />
        <div className="nx-auth-glow-2" />
      </div>

      {/* Top Branding Area */}
      <div className={`nx-auth-brand-area ${mounted ? "mounted" : ""}`}>
        <div className="nx-auth-logo-mark">
          <img src="/nexride-icon.svg" alt="NEXRIDE" />
        </div>
        <h1 className="nx-auth-logo-text">NEXRIDE</h1>
        <p className="nx-auth-tagline">Move Better.</p>
      </div>

      {/* Bottom Login Card (Slides up like a Bottom Sheet) */}
      <section className={`nx-auth-sheet ${mounted ? "mounted" : ""}`}>
        <div className="nx-auth-sheet-handle" />
        
        <h2 className="nx-auth-sheet-title">Welcome back</h2>
        <p className="nx-auth-sheet-subtitle">Log in to continue to your account.</p>

        <form onSubmit={handleLogin} className="nx-auth-form">
          <label className="nx-auth-input-group">
            <input
              type="email"
              className="nx-auth-input"
              placeholder=" "
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
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
              autoComplete="current-password"
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
