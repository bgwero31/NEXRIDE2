// File: src/app/login/page.jsx

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { get, ref } from "firebase/database";
import { auth, db } from "../../lib/firebase";
import NexrideBrand from "../../components/ui/NexrideBrand";
import PremiumButton from "../../components/ui/PremiumButton";

export default function LoginPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setMounted(true), []);

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
    <main className="nx-auth-shell">
      <div className="nx-auth-bg" />
      <section className={`nx-auth-card ${mounted ? "mounted" : ""}`}>
        <NexrideBrand subtitle="Ride smarter. Negotiate better." />

        <div className="nx-hero-word" aria-label="NEXRIDE">
          {"NEXRIDE".split("").map((letter, index) => (
            <span key={`${letter}-${index}`} style={{ animationDelay: `${index * 90}ms` }}>{letter}</span>
          ))}
        </div>

        <p className="nx-auth-copy">A blue-black premium ride app with Uber-style tracking and inDrive-style fare negotiation.</p>

        <form onSubmit={handleLogin} className="nx-stack">
          <label className="nx-field">
            <span>Email address</span>
            <input className="nx-input" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="nx-field">
            <span>Password</span>
            <input className="nx-input" type="password" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>

          {error ? <div className="nx-alert-error">{error}</div> : null}

          <PremiumButton type="submit" disabled={loading}>{loading ? "Opening app..." : "Login to NEXRIDE"}</PremiumButton>
          <Link href="/signup" className="nx-btn nx-btn-secondary">Create account</Link>
        </form>

        <div className="nx-auth-pills">
          <span>Map-first</span>
          <span>Driver offers</span>
          <span>OTP pickup</span>
        </div>
      </section>
    </main>
  );
}
