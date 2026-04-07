// File: src/app/login/page.jsx

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../lib/firebase";

const pageStyle = {
  minHeight: "100vh",
  width: "100%",
  position: "relative",
  overflow: "hidden",
  background:
    "radial-gradient(circle at 20% 20%, rgba(139,92,246,0.22), transparent 24%), radial-gradient(circle at 80% 18%, rgba(168,85,247,0.18), transparent 20%), radial-gradient(circle at 50% 70%, rgba(99,102,241,0.18), transparent 28%), linear-gradient(180deg, #050510 0%, #090916 45%, #03030a 100%)",
  color: "#fff",
};

const gridOverlay = {
  position: "absolute",
  inset: 0,
  opacity: 0.08,
  backgroundImage:
    "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
  backgroundSize: "34px 34px",
  pointerEvents: "none",
};

const glowOrb = (style = {}) => ({
  position: "absolute",
  borderRadius: "999px",
  filter: "blur(40px)",
  pointerEvents: "none",
  ...style,
});

const wrapStyle = {
  minHeight: "100vh",
  width: "100%",
  maxWidth: 480,
  margin: "0 auto",
  padding: "20px 16px 28px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  position: "relative",
  zIndex: 2,
};

const shellStyle = {
  width: "100%",
  position: "relative",
};

const glassCard = {
  position: "relative",
  width: "100%",
  borderRadius: 30,
  padding: 20,
  background:
    "linear-gradient(180deg, rgba(16,18,32,0.78), rgba(8,10,20,0.88))",
  border: "1px solid rgba(255,255,255,0.09)",
  backdropFilter: "blur(18px)",
  boxShadow: "0 30px 80px rgba(0,0,0,0.42)",
  overflow: "hidden",
};

const miniTopBar = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  marginBottom: 18,
};

const brandRow = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const brandMark = {
  width: 44,
  height: 44,
  borderRadius: 16,
  background:
    "linear-gradient(135deg, rgba(168,85,247,1) 0%, rgba(124,58,237,1) 45%, rgba(79,70,229,1) 100%)",
  boxShadow: "0 16px 30px rgba(124,58,237,0.35)",
  position: "relative",
  overflow: "hidden",
};

const brandMarkInner = {
  position: "absolute",
  inset: 1,
  borderRadius: 15,
  background:
    "linear-gradient(135deg, rgba(255,255,255,0.14), rgba(255,255,255,0.02))",
};

const pill = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 12px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.08)",
  fontSize: 12,
  fontWeight: 800,
  color: "#ddd6fe",
  whiteSpace: "nowrap",
};

const liveDot = {
  width: 8,
  height: 8,
  borderRadius: 999,
  background: "#a855f7",
  boxShadow: "0 0 14px rgba(168,85,247,0.95)",
};

const heroTitle = {
  fontSize: 33,
  lineHeight: 1.02,
  fontWeight: 1000,
  letterSpacing: "-0.04em",
  margin: 0,
};

const subText = {
  fontSize: 14,
  lineHeight: 1.55,
  color: "#a1a1bf",
};

const sectionLabel = {
  fontSize: 12,
  fontWeight: 800,
  color: "#c4b5fd",
  marginBottom: 8,
};

const inputShell = {
  borderRadius: 18,
  padding: 2,
  background:
    "linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.03))",
};

const inputStyle = {
  width: "100%",
  border: "none",
  outline: "none",
  borderRadius: 16,
  background: "rgba(10,12,24,0.96)",
  color: "#fff",
  padding: "15px 15px",
  fontSize: 15,
};

const selectorGrid = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
};

const selectorBtn = (active) => ({
  border: active
    ? "1px solid rgba(168,85,247,0.34)"
    : "1px solid rgba(255,255,255,0.08)",
  background: active
    ? "linear-gradient(180deg, rgba(168,85,247,0.20), rgba(124,58,237,0.08))"
    : "rgba(255,255,255,0.03)",
  color: active ? "#f5f3ff" : "#b4b4cc",
  borderRadius: 18,
  padding: "14px 12px",
  fontWeight: 900,
  fontSize: 14,
  textAlign: "center",
  boxShadow: active ? "0 12px 26px rgba(124,58,237,0.18)" : "none",
});

const primaryBtn = {
  width: "100%",
  border: "none",
  borderRadius: 20,
  padding: "16px 18px",
  fontSize: 15,
  fontWeight: 1000,
  color: "#ffffff",
  background:
    "linear-gradient(90deg, rgba(168,85,247,1) 0%, rgba(124,58,237,1) 50%, rgba(79,70,229,1) 100%)",
  boxShadow: "0 18px 34px rgba(124,58,237,0.34)",
};

const secondaryBtn = {
  width: "100%",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 20,
  padding: "15px 18px",
  fontSize: 15,
  fontWeight: 900,
  color: "#fff",
  background: "rgba(255,255,255,0.03)",
};

const errorStyle = {
  padding: 12,
  borderRadius: 16,
  background: "rgba(255, 91, 91, 0.08)",
  border: "1px solid rgba(255, 91, 91, 0.18)",
  color: "#ffd5d5",
  fontSize: 13,
  fontWeight: 700,
};

const footerRow = {
  marginTop: 16,
  display: "flex",
  justifyContent: "center",
};

const footerText = {
  fontSize: 13,
  color: "#9f9fba",
};

const animatedWordWrap = {
  display: "inline-flex",
  gap: 2,
  flexWrap: "wrap",
};

const letterStyle = (index) => ({
  display: "inline-block",
  animation: `nexrideReveal 700ms ease both`,
  animationDelay: `${index * 70}ms`,
});

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("rider");
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
      await signInWithEmailAndPassword(auth, cleanEmail, cleanPassword);

      router.push(role === "driver" ? "/driver" : "/rider");
    } catch (err) {
      console.error(err);
      setError("Login failed. Check your details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={pageStyle}>
      <style>{`
        @keyframes nexrideReveal {
          0% {
            opacity: 0;
            transform: translateY(14px) scale(0.96);
            filter: blur(4px);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0);
          }
        }

        @keyframes floatGlow {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
          100% { transform: translateY(0px); }
        }

        @keyframes fadeCardIn {
          0% {
            opacity: 0;
            transform: translateY(24px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      <div style={gridOverlay} />

      <div
        style={glowOrb({
          width: 180,
          height: 180,
          top: 90,
          left: -30,
          background: "rgba(168,85,247,0.24)",
          animation: "floatGlow 6s ease-in-out infinite",
        })}
      />
      <div
        style={glowOrb({
          width: 220,
          height: 220,
          right: -60,
          top: 50,
          background: "rgba(91,33,182,0.22)",
          animation: "floatGlow 7s ease-in-out infinite",
        })}
      />
      <div
        style={glowOrb({
          width: 220,
          height: 220,
          bottom: -30,
          left: "15%",
          background: "rgba(79,70,229,0.18)",
          animation: "floatGlow 8s ease-in-out infinite",
        })}
      />

      <div style={wrapStyle}>
        <div style={shellStyle}>
          <div
            style={{
              ...glassCard,
              animation: mounted ? "fadeCardIn 700ms ease both" : "none",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(135deg, rgba(255,255,255,0.08), transparent 26%, transparent 70%, rgba(255,255,255,0.04))",
                pointerEvents: "none",
              }}
            />

            <div style={miniTopBar}>
              <div style={brandRow}>
                <div style={brandMark}>
                  <div style={brandMarkInner} />
                </div>

                <div>
                  <div
                    style={{
                      fontWeight: 1000,
                      fontSize: 12,
                      color: "#d8b4fe",
                      letterSpacing: "0.22em",
                      marginBottom: 3,
                    }}
                  >
                    PREMIUM ACCESS
                  </div>

                  <div
                    style={{
                      fontWeight: 900,
                      fontSize: 14,
                      color: "#f5f3ff",
                    }}
                  >
                    Welcome back
                  </div>
                </div>
              </div>

              <div style={pill}>
                <span style={liveDot} />
                Secure Login
              </div>
            </div>

            <div style={{ marginBottom: 22 }}>
              <h1 style={heroTitle}>
                <span style={animatedWordWrap}>
                  {brandLetters.map((letter, index) => (
                    <span key={`${letter}-${index}`} style={letterStyle(index)}>
                      {letter}
                    </span>
                  ))}
                </span>
              </h1>

              <div style={{ ...subText, marginTop: 10, maxWidth: 320 }}>
                Sign in to your rider or driver dashboard with a cleaner,
                premium glass experience built for a modern ride-hailing app.
              </div>
            </div>

            <form
              onSubmit={handleLogin}
              style={{ display: "grid", gap: 14, position: "relative", zIndex: 2 }}
            >
              <div>
                <div style={sectionLabel}>Choose account</div>
                <div style={selectorGrid}>
                  <button
                    type="button"
                    onClick={() => setRole("rider")}
                    style={selectorBtn(role === "rider")}
                  >
                    Rider
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole("driver")}
                    style={selectorBtn(role === "driver")}
                  >
                    Driver
                  </button>
                </div>
              </div>

              <div>
                <div style={sectionLabel}>Email address</div>
                <div style={inputShell}>
                  <input
                    style={inputStyle}
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <div style={sectionLabel}>Password</div>
                <div style={inputShell}>
                  <input
                    style={inputStyle}
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              {error ? <div style={errorStyle}>{error}</div> : null}

              <button style={primaryBtn} type="submit" disabled={loading}>
                {loading
                  ? "Signing in..."
                  : `Login as ${role === "driver" ? "Driver" : "Rider"}`}
              </button>

              <Link href="/signup">
                <button type="button" style={secondaryBtn}>
                  Create account
                </button>
              </Link>
            </form>

            <div style={footerRow}>
              <div style={footerText}>
                Your journey begins behind the glass.
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
  }
