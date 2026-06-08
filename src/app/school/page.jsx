"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { onValue, ref } from "firebase/database";
import { auth, db } from "../../lib/firebase";
import { createSchoolTenant, getActiveSchool } from "../../lib/nexrideSchool";
import FloatingTopBar from "../../components/ui/FloatingTopBar";
import MobileShell from "../../components/ui/MobileShell";
import PremiumButton from "../../components/ui/PremiumButton";

const modes = [
  { href: "/school/parent", icon: "👨‍👩‍👧", title: "Parent tracking", copy: "Track your child’s school kombi live, pickup and drop-off alerts." },
  { href: "/school/driver", icon: "🚐", title: "School driver", copy: "Start morning/afternoon routes, share live GPS and mark kids boarded." },
  { href: "/school/admin", icon: "🏫", title: "School admin", copy: "Register schools, kombies, drivers, kids, routes and monthly subscriptions." },
];

export default function SchoolHomePage() {
  const [user, setUser] = useState(null);
  const [schools, setSchools] = useState([]);
  const [form, setForm] = useState({ name: "", city: "Zvishavane", phone: "", monthlyFee: "30" });
  const [saving, setSaving] = useState(false);
  const activeSchoolId = useMemo(() => getActiveSchool(), []);

  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => {
    return onValue(ref(db, "nexrideSchool/schools"), (snap) => {
      const rows = [];
      snap.forEach((child) => rows.push({ id: child.key, ...child.val() }));
      rows.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
      setSchools(rows);
    });
  }, []);

  const register = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await createSchoolTenant({
        name: form.name.trim(),
        city: form.city.trim() || "Zvishavane",
        phone: form.phone.trim(),
        monthlyFee: form.monthlyFee || "30",
        ownerId: user?.uid || "demo-owner",
        ownerName: user?.displayName || "NEXRIDE school owner",
      });
      setForm({ name: "", city: form.city, phone: "", monthlyFee: form.monthlyFee });
    } finally {
      setSaving(false);
    }
  };

  return (
    <MobileShell>
      <FloatingTopBar title="NEXRIDE" subtitle="School transport" role="rider" />
      <main className="nx-page-pad nx-school-page">
        <section className="nx-school-hero nx-glass-panel">
          <div className="nx-eyebrow">NEXRIDE School</div>
          <h1>Safety for your child. Peace of mind for parents.</h1>
          <p>Register a school or kombi business, add drivers, children and fixed routes, then track school transport live with monthly subscriptions.</p>
          <div className="nx-school-hero-actions">
            <a className="nx-btn nx-btn-primary" href="/school/admin">Register school</a>
            <a className="nx-btn nx-btn-secondary" href="/school/parent">Track child</a>
          </div>
        </section>

        <section className="nx-school-mode-grid">
          {modes.map((mode) => (
            <a href={mode.href} className="nx-school-mode-card nx-card-pro" key={mode.href}>
              <span className="nx-school-icon">{mode.icon}</span>
              <strong>{mode.title}</strong>
              <small>{mode.copy}</small>
            </a>
          ))}
        </section>

        <form onSubmit={register} className="nx-school-form nx-card-pro">
          <div className="nx-sheet-head">
            <div>
              <div className="nx-eyebrow">Quick school registration</div>
              <h2 className="nx-sheet-title">Create a school partner</h2>
              <p className="nx-sheet-copy">Start with one school/kombi. You can add vehicles, kids, colors and routes after.</p>
            </div>
          </div>
          <label className="nx-field"><span>School / kombi company</span><input className="nx-input" value={form.name} onChange={(e) => setForm((x) => ({ ...x, name: e.target.value }))} placeholder="e.g. Little Bess School Transport" /></label>
          <div className="nx-field-grid two">
            <label className="nx-field"><span>City</span><input className="nx-input" value={form.city} onChange={(e) => setForm((x) => ({ ...x, city: e.target.value }))} /></label>
            <label className="nx-field"><span>Monthly fee / vehicle</span><input className="nx-input" value={form.monthlyFee} onChange={(e) => setForm((x) => ({ ...x, monthlyFee: e.target.value }))} /></label>
          </div>
          <label className="nx-field"><span>Contact phone</span><input className="nx-input" value={form.phone} onChange={(e) => setForm((x) => ({ ...x, phone: e.target.value }))} placeholder="School owner / transport phone" /></label>
          <PremiumButton type="submit" disabled={saving}>{saving ? "Creating..." : "Create school partner"}</PremiumButton>
        </form>

        <section className="nx-card-pro nx-stack">
          <div className="nx-sheet-head compact">
            <div>
              <div className="nx-eyebrow">Active schools</div>
              <h2 className="nx-section-title">Registered partners</h2>
            </div>
            <span className="nx-status-pill">{schools.length}</span>
          </div>
          {schools.length ? schools.slice(0, 8).map((school) => (
            <a className="nx-school-list-item" href={`/school/admin?schoolId=${school.id}`} key={school.id}>
              <span className="nx-school-badge">🏫</span>
              <div><strong>{school.name}</strong><small>{school.city} • {school.status || "active"}{school.id === activeSchoolId ? " • selected" : ""}</small></div>
              <span>›</span>
            </a>
          )) : <p className="nx-sheet-copy">No schools yet. Register your first school transport partner.</p>}
        </section>
      </main>
    </MobileShell>
  );
}
