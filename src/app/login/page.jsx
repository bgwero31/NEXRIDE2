// File: src/app/login/page.jsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../lib/firebase";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("rider");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password.trim()) {
      setError("Enter your email and password.");
      return;
    }

    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email.trim(), password);

      if (role === "driver") {
        router.push("/driver");
      } else {
        router.push("/rider");
      }
    } catch (err) {
      console.error(err);
      setError("Login failed. Check your details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="nx-shell">
      <div
        className="nx-container"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          className="nx-card"
          style={{
            width: "100%",
            padding: 20,
            borderRadius: 28,
          }}
        >
          <div style={{ marginBottom: 18 }}>
            <div className="nx-logo" style={{ marginBottom: 16 }}>
              <div className="nx-logo-mark" />
              <div>
                <div style={{ fontWeight: 1000, fontSize: 18 }}>NEXRIDE</div>
                <div className="nx-soft-text">Welcome back</div>
              </div>
            </div>

            <div className="nx-title" style={{ fontSize: 28, marginBottom: 8 }}>
              Login
            </div>
            <div className="nx-subtitle">
              Sign in to continue to your rider or driver dashboard.
            </div>
          </div>

          <form onSubmit={handleLogin} className="nx-grid">
            <div className="nx-grid" style={{ gap: 8 }}>
              <label className="nx-soft-text">Email</label>
              <input
                className="nx-input"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="nx-grid" style={{ gap: 8 }}>
              <label className="nx-soft-text">Password</label>
              <input
                className="nx-input"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="nx-grid" style={{ gap: 8 }}>
              <label className="nx-soft-text">Login as</label>
              <select
                className="nx-input"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="rider">Rider</option>
                <option value="driver">Driver</option>
              </select>
            </div>

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

            <button className="nx-btn nx-btn-primary" type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Login"}
            </button>

            <Link href="/signup">
              <button type="button" className="nx-btn nx-btn-secondary">
                Create account
              </button>
            </Link>
          </form>
        </div>
      </div>
    </main>
  );
}
