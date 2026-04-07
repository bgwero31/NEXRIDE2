// File: src/app/login/page.jsx

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signInWithEmailAndPassword } from "firebase/auth";
import { get, ref } from "firebase/database";
import { auth, db } from "../../lib/firebase";

const pageStyle = {
  minHeight: "100vh",
  width: "100%",
  position: "relative",
  overflow: "hidden",
  background:
    "radial-gradient(circle at 20% 18%, rgba(132, 34, 255, 0.18), transparent 20%), radial-gradient(circle at 80% 22%, rgba(92, 38, 255, 0.16), transparent 22%), radial-gradient(circle at 50% 78%, rgba(162, 89, 255, 0.14), transparent 28%), linear-gradient(180deg, #04030a 0%, #080611 45%, #020205 100%)",
  color: "#fff",
};

const gridOverlay = {
  position: "absolute",
  inset: 0,
  opacity: 0.05,
  backgroundImage:
    "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
  backgroundSize: "36px 36px",
  pointerEvents: "none",
};

const glowOrb = (style = {}) => ({
  position: "absolute",
  borderRadius: "999px",
  filter: "blur(48px)",
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

const cardStyle = {
  width: "100%",
  borderRadius: 32,
  padding: 22,
  background:
    "linear-gradient(180deg, rgba(10,10,18,0.82), rgba(6,6,14,0.92))",
  border: "1px solid rgba(255,255,255,0.08)",
  backdropFilter: "blur(18px)",
  boxShadow: "0 30px 80px rgba(0,0,0,0.44)",
  position: "relative",
  overflow: "hidden",
};

const topMiniLogo = {
  width: 56,
  height: 56,
  borderRadius: 20,
  background:
    "linear-gradient(135deg, rgba(164,88,255,1) 0%, rgba(112,53,255,1) 60%, rgba(68,47,255,1) 100%)",
  boxShadow: "0 18px 36px rgba(112,53,255,0.35)",
  marginBottom: 18,
};

const heroText = {
  fontSize: 15,
  lineHeight: 1.7,
  color: "#aaa6c4",
  marginTop: 14,
  marginBottom: 26,
};

const sectionLabel = {
  fontSize: 12,
  fontWeight: 800,
  color: "#c8b8ff",
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
  background: "rgba(7,8,18,0.96)",
  color: "#fff",
  padding: "16px 16px",
  fontSize: 15,
};

const primaryBtn = {
  width: "100%",
  border: "none",
  borderRadius: 20,
  padding: "16px 18px",
  fontSize: 15,
  fontWeight: 1000,
  color: "#ffffff",
  background:
    "linear-gradient(90deg, rgba(185,97,255,1) 0%, rgba(137,69,255,1) 50%, rgba(87,73,255,1) 100%)",
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

const footerText = {
  marginTop: 18,
  fontSize: 13,
  color: "#9a95b4",
  textAlign: "center",
};

const animatedWordWrap = {
  display: "inline-flex",
  gap: 2,
  flexWrap: "wrap",
};

const letterStyle = (index) => ({
  display: "inline-block",
  background:
    "linear-gradient(180deg, #0a0a0f 0%, #171124 25%, #4c1d95 70%, #c084fc 100%)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
  animation: `nexrideShift 2.8s ease-in-out infinite`,
  animationDelay: `${index * 120}ms`,
  textShadow: "0 0 0 rgba(0,0,0,0)",
});

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

      if (!userData?.role) {
        router.push("/rider");
        return;
      }

      if (userData.role === "driver") {
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
    <main style={pageStyle}>
      <style>{`
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

        @keyframes floatGlow {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
          100% { transform: translateY(0px); }
        }

        @keyframes nexrideShift {
          0% {
            transform: translateY(12px);
            opacity: 0;
            filter: blur(4px);
          }
          18% {
            transform: translateY(0);
            opacity: 1;
            filter: blur(0);
          }
          70% {
            transform: translateY(0);
            opacity: 1;
            filter: blur(0);
          }
          100% {
            transform: translateY(0);
            opacity: 1;
            filter: blur(0);
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
          background: "rgba(87,73,255,0.18)",
          animation: "floatGlow 8s ease-in-out infinite",
        })}
      />

      <div style={wrapStyle}>
        <div style={{ width: "100%" }}>
          <div
            style={{
              ...cardStyle,
              animation: mounted ? "fadeCardIn 700ms ease both" : "none",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(135deg, rgba(255,255,255,0.06), transparent 26%, transparent 70%, rgba(255,255,255,0.03))",
                pointerEvents: "none",
              }}
            />

            <div style={topMiniLogo} />

            <h1
              style={{
                fontSize: 64,
                lineHeight: 0.95,
                fontWeight: 1000,
                letterSpacing: "-0.06em",
                margin: 0,
              }}
            >
              <span style={animatedWordWrap}>
                {brandLetters.map((letter, index) => (
                  <span key={`${letter}-${index}`} style={letterStyle(index)}>
                    {letter}
                  </span>
                ))}
              </span>
            </h1>

            <div style={heroText}>
              Sign in to your dashboard with a premium glass experience built
              for a modern ride-hailing app.
            </div>

            <form
              onSubmit={handleLogin}
              style={{ display: "grid", gap: 14, position: "relative", zIndex: 2 }}
            >
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
                {loading ? "Signing in..." : "Login"}
              </button>

              <Link href="/signup">
                <button type="button" style={secondaryBtn}>
                  Create account
                </button>
              </Link>
            </form>

            <div style={footerText}>Move smart. Ride NEXRIDE.</div>
          </div>
        </div>
      </div>
    </main>
  );
  }
