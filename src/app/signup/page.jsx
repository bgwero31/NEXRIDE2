// File: src/app/signup/page.jsx

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { ref, set } from "firebase/database";
import { auth, db } from "../../lib/firebase";
import NexrideBrand from "../../components/ui/NexrideBrand";
import PremiumButton from "../../components/ui/PremiumButton";

const cityOptions = ["harare", "bulawayo", "gweru", "mutare", "masvingo", "zvishavane", "kwekwe", "kadoma"];

function cityLabel(city) {
  return city.charAt(0).toUpperCase() + city.slice(1);
}

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
    const cleanPlate = plateNumber.trim().toUpperCase();

    if (!cleanName || !cleanPhone || !cleanEmail || !cleanPassword || !cleanCity) {
      setError("Fill in all required fields.");
      return;
    }
    if (cleanPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (role === "driver" && (!cleanCarName || !cleanPlate)) {
      setError("Drivers must add car name and plate number.");
      return;
    }

    try {
      setLoading(true);
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, cleanPassword);
      const uid = cred.user.uid;
      const now = Date.now();

      await set(ref(db, `users/${uid}`), { role, email: cleanEmail, createdAt: now });
      await set(ref(db, `profiles/${uid}`), {
        fullName: cleanName,
        phone: cleanPhone,
        city: cleanCity,
        role,
        rating: 5,
        tripsCount: 0,
        createdAt: now,
        ...(role === "driver" ? { vehicleType: "car", carName: cleanCarName, plateNumber: cleanPlate, online: false } : {}),
      });
      await set(ref(db, `appSettings/${uid}`), {
        city: cleanCity,
        preferredPayment: "cash",
        rideMode: "standard",
        notificationsEnabled: true,
        createdAt: now,
      });

      try {
        localStorage.setItem("nexride-last-place", cleanCity);
      } catch {}

      router.push(role === "driver" ? "/driver" : "/rider");
    } catch (err) {
      console.error(err);
      setError(err.code === "auth/email-already-in-use" ? "This email is already registered." : "Signup failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="nx-auth-shell">
      <div className="nx-auth-bg" />
      <section className="nx-auth-card wide mounted">
        <NexrideBrand subtitle="Create your ride account" />
        <h1 className="nx-auth-title">Join NEXRIDE</h1>
        <p className="nx-auth-copy">Choose rider or driver, then the app opens the correct map-first flow.</p>

        <form onSubmit={handleSignup} className="nx-stack">
          <div className="nx-field-grid two">
            <label className="nx-field"><span>Full name</span><input className="nx-input" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" /></label>
            <label className="nx-field"><span>Phone</span><input className="nx-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+263..." /></label>
          </div>
          <div className="nx-field-grid two">
            <label className="nx-field"><span>City</span><select className="nx-input" value={city} onChange={(e) => setCity(e.target.value)}>{cityOptions.map((item) => <option key={item} value={item}>{cityLabel(item)}</option>)}</select></label>
            <label className="nx-field"><span>Account type</span><select className="nx-input" value={role} onChange={(e) => setRole(e.target.value)}><option value="rider">Rider</option><option value="driver">Driver</option></select></label>
          </div>

          {role === "driver" ? (
            <div className="nx-field-grid two">
              <label className="nx-field"><span>Car name</span><input className="nx-input" value={carName} onChange={(e) => setCarName(e.target.value)} placeholder="Toyota Aqua" /></label>
              <label className="nx-field"><span>Plate number</span><input className="nx-input" value={plateNumber} onChange={(e) => setPlateNumber(e.target.value)} placeholder="ABC 1234" /></label>
            </div>
          ) : null}

          <label className="nx-field"><span>Email</span><input className="nx-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" /></label>
          <label className="nx-field"><span>Password</span><input className="nx-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" /></label>

          {error ? <div className="nx-alert-error">{error}</div> : null}

          <PremiumButton type="submit" disabled={loading}>{loading ? "Creating account..." : "Create account"}</PremiumButton>
          <Link href="/login" className="nx-btn nx-btn-secondary">Already have an account? Login</Link>
        </form>
      </section>
    </main>
  );
}
