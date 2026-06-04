// File: src/app/login/page.jsx

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signInWithEmailAndPassword } from "firebase/auth";
import { get, ref } from "firebase/database";
import { auth, db } from "../../lib/firebase";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const brandLetters = useMemo(() => "NEXRIDE".split(""), []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setError("Enter your email and password.");
      return;
    }

    try {
      setLoading(true);

      const cred = await signInWithEmailAndPassword(auth, cleanEmail, cleanPassword);
      const uid = cred.user.uid;
      const snap = await get(ref(db, `users/${uid}`));
      const userData = snap.val();

      if (userData?.role === "driver") router.push("/driver");
      else router.push("/rider");
    } catch (err) {
      console.error(err);
      setError("Login failed. Check your details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="nx-shell">
      <style>{`
        @keyframes loginCardIn {
          from { opacity: 0; transform: translateY(24px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes loginLetterIn {
          0% { transform: translateY(14px); opacity: 0; filter: blur(5px); }
          35% { transform: translateY(0); opacity: 1; filter: blur(0); }
          100% { transform: translateY(0); opacity: 1; filter: blur(0); }
        }
      `}</style>

      <div
        className="nx-container"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          paddingTop: 24,
          paddingBottom: 24,
        }}
      >
        <div
          className="nx-card"
          style={{
            width: "100%",
            borderRadius: 34,
            padding: 22,
            animation: mounted ? "loginCardIn 650ms ease both" : "none",
          }}
        >
          <div className="nx-logo" style={{ marginBottom: 18 }}>
            <div className="nx-logo-mark" />
            <div>
              <div style={{ fontSize: 18, fontWeight: 1000, letterSpacing: 0.4 }}>NEXRIDE</div>
              <div className="nx-soft-text">Smart rides, real drivers</div>
            </div>
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: 58,
              lineHeight: 0.92,
              fontWeight: 1000,
              letterSpacing: "-0.07em",
            }}
          >
            {brandLetters.map((letter, index) => (
              <span
                key={`${letter}-${index}`}
                style={{
                  display: "inline-block",
                  background:
                    "linear-gradient(180deg, #ffffff 0%, #9beaff 35%, #0066ff 100%)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                  animation: "loginLetterIn 1.8s ease both",
                  animationDelay: `${index * 80}ms`,
                  textShadow: "0 18px 42px rgba(0,102,255,0.35)",
                }}
              >
                {letter}
              </span>
            ))}
          </h1>

          <p className="nx-subtitle" style={{ margin: "16px 0 22px", fontSize: 14 }}>
            Login to request rides, accept trips, track drivers, and keep the whole ride flow smooth.
          </p>

          <form onSubmit={handleLogin} className="nx-grid" style={{ gap: 13 }}>
            <div className="nx-grid" style={{ gap: 8 }}>
              <label className="nx-soft-text" style={{ fontWeight: 900 }}>Email address</label>
              <input
                className="nx-input"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="nx-grid" style={{ gap: 8 }}>
              <label className="nx-soft-text" style={{ fontWeight: 900 }}>Password</label>
              <input
                className="nx-input"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error ? <div className="nx-alert-error">{error}</div> : null}

            <button className="nx-primary-btn" type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Login"}
            </button>

            <Link href="/signup" style={{ display: "block" }}>
              <button type="button" className="nx-secondary-btn">
                Create account
              </button>
            </Link>
          </form>

          <div
            style={{
              marginTop: 17,
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span className="nx-pill">Live tracking</span>
            <span className="nx-pill">Driver offers</span>
            <span className="nx-pill">OTP pickup</span>
          </div>
        </div>
      </div>
    </main>
  );
}
