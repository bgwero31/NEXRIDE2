// File: src/app/signup/page.jsx

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { ref, set } from "firebase/database";
import { auth, db } from "../../lib/firebase";

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

export default function SignupPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("harare");
  const [role, setRole] = useState("rider");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [carName, setCarName] = useState("");
  const [plateNumber, setPlateNumber] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");

    const cleanName = fullName.trim();
    const cleanPhone = phone.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();
    const cleanCity = city.trim().toLowerCase();
    const cleanCarName = carName.trim();
    const cleanPlateNumber = plateNumber.trim().toUpperCase();

    if (!cleanName || !cleanPhone || !cleanEmail || !cleanPassword || !cleanCity) {
      setError("Please fill all required fields.");
      return;
    }

    if (cleanPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (role === "driver" && (!cleanCarName || !cleanPlateNumber)) {
      setError("Drivers must enter vehicle name and plate number.");
      return;
    }

    try {
      setLoading(true);

      const cred = await createUserWithEmailAndPassword(
        auth,
        cleanEmail,
        cleanPassword
      );

      const uid = cred.user.uid;
      const now = Date.now();

      await set(ref(db, `users/${uid}`), {
        role,
        email: cleanEmail,
        createdAt: now,
      });

      await set(ref(db, `profiles/${uid}`), {
        fullName: cleanName,
        phone: cleanPhone,
        city: cleanCity,
        photoURL: "",
        rating: 5,
        tripsCount: 0,
        role,
        ...(role === "driver"
          ? {
              vehicleType: "car",
              carName: cleanCarName,
              plateNumber: cleanPlateNumber,
              online: false,
            }
          : {}),
      });

      try {
        localStorage.setItem("nexride-last-place", cleanCity);
      } catch {}

      if (role === "driver") {
        router.push("/driver");
      } else {
        router.push("/rider");
      }
    } catch (err) {
      console.error(err);

      if (err.code === "auth/email-already-in-use") {
        setError("This email is already in use.");
      } else if (err.code === "auth/invalid-email") {
        setError("That email is not valid.");
      } else if (err.code === "auth/weak-password") {
        setError("Use a stronger password.");
      } else {
        setError("Signup failed. Please try again.");
      }
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
          paddingTop: 24,
          paddingBottom: 24,
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
                <div className="nx-soft-text">Create your account</div>
              </div>
            </div>

            <div className="nx-title" style={{ fontSize: 28, marginBottom: 8 }}>
              Sign up
            </div>
            <div className="nx-subtitle">
              Join as a rider or driver and start using the platform.
            </div>
          </div>

          <form onSubmit={handleSignup} className="nx-grid">
            <div className="nx-grid" style={{ gap: 8 }}>
              <label className="nx-soft-text">Full name</label>
              <input
                className="nx-input"
                type="text"
                placeholder="Enter your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            <div className="nx-grid" style={{ gap: 8 }}>
              <label className="nx-soft-text">Phone number</label>
              <input
                className="nx-input"
                type="text"
                placeholder="Enter your phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>

            <div className="nx-grid" style={{ gap: 8 }}>
              <label className="nx-soft-text">City</label>
              <select
                className="nx-input"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              >
                {cityOptions.map((item) => (
                  <option key={item} value={item}>
                    {item.charAt(0).toUpperCase() + item.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="nx-grid" style={{ gap: 8 }}>
              <label className="nx-soft-text">Account type</label>
              <select
                className="nx-input"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="rider">Rider</option>
                <option value="driver">Driver</option>
              </select>
            </div>

            {role === "driver" && (
              <>
                <div className="nx-grid" style={{ gap: 8 }}>
                  <label className="nx-soft-text">Car name</label>
                  <input
                    className="nx-input"
                    type="text"
                    placeholder="Toyota Aqua"
                    value={carName}
                    onChange={(e) => setCarName(e.target.value)}
                  />
                </div>

                <div className="nx-grid" style={{ gap: 8 }}>
                  <label className="nx-soft-text">Plate number</label>
                  <input
                    className="nx-input"
                    type="text"
                    placeholder="ABC 1234"
                    value={plateNumber}
                    onChange={(e) => setPlateNumber(e.target.value)}
                  />
                </div>
              </>
            )}

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
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
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
              {loading ? "Creating account..." : "Create account"}
            </button>

            <Link href="/login">
              <button type="button" className="nx-btn nx-btn-secondary">
                Already have an account? Login
              </button>
            </Link>
          </form>
        </div>
      </div>
    </main>
  );
}
