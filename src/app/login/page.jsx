// File: src/app/signup/page.jsx

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { ref, set, get } from "firebase/database";
import { auth, db } from "../../lib/firebase";
import PremiumButton from "../../components/ui/PremiumButton";

export default function SignupPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  
  // Role state
  const [role, setRole] = useState("rider");
  
  // Form state
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  // Driver-specific state
  const [carPlate, setCarPlate] = useState("");
  const [carName, setCarName] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!email || !password || !fullName || !phone) {
      setError("Please fill in all required fields.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (role === "driver" && (!carPlate || !carName)) {
      setError("Please provide your car details.");
      return;
    }

    try {
      setLoading(true);

      // 1. Create Auth User
      const cred = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      const user = cred.user;
      const uid = user.uid;

      await updateProfile(user, { displayName: fullName });

      // 2. Build user data (matches your rider/driver pages)
      const profileData = {
        uid,
        fullName,
        phone,
        email: email.trim().toLowerCase(),
        role,
        city: "zvishavane", // default city
        createdAt: Date.now(),
      };

      if (role === "driver") {
        profileData.carPlate = carPlate;
        profileData.carName = carName;
        profileData.verified = false;
        profileData.online = false;
      }

      // 3. Save to Database (profiles node, matching our page code)
      await set(ref(db, `profiles/${uid}`), profileData);
      
      // Save to users node as well if your app checks it
      await set(ref(db, `users/${uid}`), { role, email: profileData.email });

      // 4. Redirect
      router.push(role === "driver" ? "/driver" : "/rider");

    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to create account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="nx-auth-shell-v2">
      <div className="nx-auth-bg-v2">
        <div className="nx-auth-glow-1" />
        <div className="nx-auth-glow-2" />
      </div>

      <div className={`nx-auth-brand-area ${mounted ? "mounted" : ""}`}>
        <div className="nx-auth-logo-mark">
          <img src="/nexride-icon.svg" alt="NEXRIDE" />
        </div>
        <h1 className="nx-auth-logo-text">NEXRIDE</h1>
      </div>

      <section className={`nx-auth-sheet ${mounted ? "mounted" : ""}`}>
        <div className="nx-auth-sheet-handle" />
        
        <h2 className="nx-auth-sheet-title">Create account</h2>
        <p className="nx-auth-sheet-subtitle">Join NEXRIDE today.</p>

        {/* Role Toggle */}
        <div className="nx-role-toggle">
          <button
            type="button"
            className={`nx-role-btn ${role === "rider" ? "active" : ""}`}
            onClick={() => setRole("rider")}
          >
            🚘 Rider
          </button>
          <button
            type="button"
            className={`nx-role-btn ${role === "driver" ? "active" : ""}`}
            onClick={() => setRole("driver")}
          >
            🧑‍✈️ Driver
          </button>
        </div>

        <form onSubmit={handleSignup} className="nx-auth-form">
          <label className="nx-auth-input-group">
            <input
              type="text"
              className="nx-auth-input"
              placeholder=" "
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            <span className="nx-auth-label">Full Name</span>
          </label>

          <label className="nx-auth-input-group">
            <input
              type="tel"
              className="nx-auth-input"
              placeholder=" "
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <span className="nx-auth-label">Phone Number</span>
          </label>

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
              type="password"
              className="nx-auth-input"
              placeholder=" "
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <span className="nx-auth-label">Password (min 6 chars)</span>
          </label>

          {/* Driver-only fields */}
          {role === "driver" && (
            <div className="nx-driver-fields" style={{ display: "grid", gap: 16, marginTop: 8 }}>
              <label className="nx-auth-input-group">
                <input
                  type="text"
                  className="nx-auth-input"
                  placeholder=" "
                  value={carName}
                  onChange={(e) => setCarName(e.target.value)}
                />
                <span className="nx-auth-label">Car Model (e.g. Toyota Aqua)</span>
              </label>
              <label className="nx-auth-input-group">
                <input
                  type="text"
                  className="nx-auth-input"
                  placeholder=" "
                  value={carPlate}
                  onChange={(e) => setCarPlate(e.target.value)}
                />
                <span className="nx-auth-label">License Plate</span>
              </label>
            </div>
          )}

          {error ? <div className="nx-alert-error">{error}</div> : null}

          <div className="nx-auth-actions" style={{ marginTop: 16 }}>
            <PremiumButton type="submit" loading={loading} fullWidth>
              Create Account
            </PremiumButton>
          </div>
        </form>

        <div className="nx-auth-divider">
          <span>Already have an account?</span>
        </div>

        <Link href="/login" className="nx-btn nx-btn-secondary nx-btn-block">
          Log In
        </Link>
      </section>
    </main>
  );
}
