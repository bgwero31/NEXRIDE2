"use client";

import { useEffect, useMemo, useState } from "react";
import { onValue, push, ref, set, update } from "firebase/database";
import { db } from "../../../lib/firebase";
import { SCHOOL_COLORS, getActiveSchool, saveActiveSchool, queueSchoolEvent, SCHOOL_EVENT_TYPES } from "../../../lib/nexrideSchool";
import FloatingTopBar from "../../../components/ui/FloatingTopBar";
import MobileShell from "../../../components/ui/MobileShell";
import PremiumButton from "../../../components/ui/PremiumButton";

function now() { return Date.now(); }
function listFromSnap(snap) { const rows = []; snap.forEach((child) => rows.push({ id: child.key, ...child.val() })); return rows; }

export default function SchoolAdminPage() {
  const [schools, setSchools] = useState([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState("");
  const [vehicles, setVehicles] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [students, setStudents] = useState([]);
  const [vehicle, setVehicle] = useState({ name: "School Kombi 01", plate: "", driverName: "", driverPhone: "", color: SCHOOL_COLORS[0].value, colorName: SCHOOL_COLORS[0].name });
  const [route, setRoute] = useState({ name: "Morning Route A", from: "Home pickups", to: "School", pickupPoints: "" });
  const [student, setStudent] = useState({ childName: "", parentName: "", parentPhone: "", pickupPoint: "", vehicleId: "", routeId: "", monthlyStatus: "unpaid" });

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setSelectedSchoolId(params.get("schoolId") || getActiveSchool());
    }
    return onValue(ref(db, "nexrideSchool/schools"), (snap) => {
      const rows = listFromSnap(snap).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
      setSchools(rows);
      if (!selectedSchoolId && rows[0]?.id) setSelectedSchoolId(rows[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedSchoolId) return;
    saveActiveSchool(selectedSchoolId);
    const offVehicles = onValue(ref(db, `nexrideSchool/vehicles/${selectedSchoolId}`), (snap) => setVehicles(listFromSnap(snap)));
    const offRoutes = onValue(ref(db, `nexrideSchool/routes/${selectedSchoolId}`), (snap) => setRoutes(listFromSnap(snap)));
    const offStudents = onValue(ref(db, `nexrideSchool/students/${selectedSchoolId}`), (snap) => setStudents(listFromSnap(snap)));
    return () => { offVehicles(); offRoutes(); offStudents(); };
  }, [selectedSchoolId]);

  const school = useMemo(() => schools.find((s) => s.id === selectedSchoolId) || null, [schools, selectedSchoolId]);

  const addVehicle = async (e) => {
    e.preventDefault();
    if (!selectedSchoolId) return;
    const vehicleRef = push(ref(db, `nexrideSchool/vehicles/${selectedSchoolId}`));
    const payload = { id: vehicleRef.key, ...vehicle, schoolId: selectedSchoolId, status: "ready", liveStatus: "offline", createdAt: now(), updatedAt: now() };
    await set(vehicleRef, payload);
    await queueSchoolEvent({ type: SCHOOL_EVENT_TYPES.VEHICLE_LIVE, schoolId: selectedSchoolId, vehicleId: vehicleRef.key, city: school?.city, title: "School kombi added", message: `${vehicle.name} is ready for ${school?.name || "school"}.` });
    setVehicle((x) => ({ ...x, name: `School Kombi ${String(vehicles.length + 2).padStart(2, "0")}`, plate: "", driverName: "", driverPhone: "" }));
  };

  const addRoute = async (e) => {
    e.preventDefault();
    if (!selectedSchoolId) return;
    const routeRef = push(ref(db, `nexrideSchool/routes/${selectedSchoolId}`));
    await set(routeRef, { id: routeRef.key, ...route, schoolId: selectedSchoolId, active: true, createdAt: now(), updatedAt: now() });
    setRoute({ name: "Morning Route A", from: "Home pickups", to: "School", pickupPoints: "" });
  };

  const addStudent = async (e) => {
    e.preventDefault();
    if (!selectedSchoolId || !student.childName.trim()) return;
    const studentRef = push(ref(db, `nexrideSchool/students/${selectedSchoolId}`));
    const payload = { id: studentRef.key, ...student, schoolId: selectedSchoolId, active: true, createdAt: now(), updatedAt: now() };
    await set(studentRef, payload);
    await queueSchoolEvent({ type: "school_student_added", schoolId: selectedSchoolId, studentId: studentRef.key, parentPhone: student.parentPhone, city: school?.city, title: "Child added to NEXRIDE School", message: `${student.childName} was added to ${school?.name || "school transport"}.`, data: { parentPhone: student.parentPhone } });
    setStudent((x) => ({ ...x, childName: "", parentName: "", parentPhone: "", pickupPoint: "" }));
  };

  const markPaid = async (studentId, monthlyStatus) => {
    await update(ref(db, `nexrideSchool/students/${selectedSchoolId}/${studentId}`), { monthlyStatus, updatedAt: now() });
  };

  return (
    <MobileShell>
      <FloatingTopBar title="NEXRIDE" subtitle="School admin" role="driver" />
      <main className="nx-page-pad nx-school-page">
        <section className="nx-school-hero nx-glass-panel compact">
          <div className="nx-eyebrow">School command center</div>
          <h1>{school?.name || "Manage school transport"}</h1>
          <p>Add kombies, colors, drivers, kids, routes and monthly subscription status.</p>
          <label className="nx-field"><span>Selected school</span><select className="nx-input" value={selectedSchoolId} onChange={(e) => setSelectedSchoolId(e.target.value)}>{schools.map((s) => <option value={s.id} key={s.id}>{s.name} • {s.city}</option>)}</select></label>
        </section>

        <section className="nx-stat-row">
          <div className="nx-stat-card"><span>Kombies</span><strong>{vehicles.length}</strong><small>tracked vehicles</small></div>
          <div className="nx-stat-card"><span>Kids</span><strong>{students.length}</strong><small>registered</small></div>
          <div className="nx-stat-card"><span>Routes</span><strong>{routes.length}</strong><small>fixed routes</small></div>
        </section>

        <form onSubmit={addVehicle} className="nx-card-pro nx-stack">
          <div><div className="nx-eyebrow">Vehicles</div><h2 className="nx-section-title">Add kombi and driver</h2></div>
          <div className="nx-field-grid two"><label className="nx-field"><span>Kombi name</span><input className="nx-input" value={vehicle.name} onChange={(e) => setVehicle((x) => ({ ...x, name: e.target.value }))} /></label><label className="nx-field"><span>Plate number</span><input className="nx-input" value={vehicle.plate} onChange={(e) => setVehicle((x) => ({ ...x, plate: e.target.value }))} placeholder="ABC 1234" /></label></div>
          <div className="nx-field-grid two"><label className="nx-field"><span>Driver name</span><input className="nx-input" value={vehicle.driverName} onChange={(e) => setVehicle((x) => ({ ...x, driverName: e.target.value }))} /></label><label className="nx-field"><span>Driver phone</span><input className="nx-input" value={vehicle.driverPhone} onChange={(e) => setVehicle((x) => ({ ...x, driverPhone: e.target.value }))} /></label></div>
          <label className="nx-field"><span>Kombi color identity</span><select className="nx-input" value={vehicle.color} onChange={(e) => { const found = SCHOOL_COLORS.find((c) => c.value === e.target.value); setVehicle((x) => ({ ...x, color: e.target.value, colorName: found?.name || "Custom" })); }}>{SCHOOL_COLORS.map((c) => <option key={c.value} value={c.value}>{c.name}</option>)}</select></label>
          <div className="nx-color-preview" style={{ background: vehicle.color }}><span>{vehicle.colorName}</span><strong>{vehicle.name}</strong></div>
          <PremiumButton type="submit">Save kombi</PremiumButton>
        </form>

        <form onSubmit={addRoute} className="nx-card-pro nx-stack">
          <div><div className="nx-eyebrow">Routes</div><h2 className="nx-section-title">Add fixed route</h2></div>
          <label className="nx-field"><span>Route name</span><input className="nx-input" value={route.name} onChange={(e) => setRoute((x) => ({ ...x, name: e.target.value }))} /></label>
          <div className="nx-field-grid two"><label className="nx-field"><span>From</span><input className="nx-input" value={route.from} onChange={(e) => setRoute((x) => ({ ...x, from: e.target.value }))} /></label><label className="nx-field"><span>To</span><input className="nx-input" value={route.to} onChange={(e) => setRoute((x) => ({ ...x, to: e.target.value }))} /></label></div>
          <label className="nx-field"><span>Pickup points</span><textarea className="nx-input" rows="3" value={route.pickupPoints} onChange={(e) => setRoute((x) => ({ ...x, pickupPoints: e.target.value }))} placeholder="Highlands, Makwasha, Mandava..." /></label>
          <PremiumButton type="submit">Save route</PremiumButton>
        </form>

        <form onSubmit={addStudent} className="nx-card-pro nx-stack">
          <div><div className="nx-eyebrow">Children</div><h2 className="nx-section-title">Add child and parent</h2></div>
          <div className="nx-field-grid two"><label className="nx-field"><span>Child name</span><input className="nx-input" value={student.childName} onChange={(e) => setStudent((x) => ({ ...x, childName: e.target.value }))} /></label><label className="nx-field"><span>Parent name</span><input className="nx-input" value={student.parentName} onChange={(e) => setStudent((x) => ({ ...x, parentName: e.target.value }))} /></label></div>
          <div className="nx-field-grid two"><label className="nx-field"><span>Parent phone</span><input className="nx-input" value={student.parentPhone} onChange={(e) => setStudent((x) => ({ ...x, parentPhone: e.target.value }))} /></label><label className="nx-field"><span>Pickup point</span><input className="nx-input" value={student.pickupPoint} onChange={(e) => setStudent((x) => ({ ...x, pickupPoint: e.target.value }))} /></label></div>
          <div className="nx-field-grid two"><label className="nx-field"><span>Assigned kombi</span><select className="nx-input" value={student.vehicleId} onChange={(e) => setStudent((x) => ({ ...x, vehicleId: e.target.value }))}><option value="">Select kombi</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.name} • {v.plate}</option>)}</select></label><label className="nx-field"><span>Route</span><select className="nx-input" value={student.routeId} onChange={(e) => setStudent((x) => ({ ...x, routeId: e.target.value }))}><option value="">Select route</option>{routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label></div>
          <PremiumButton type="submit">Add child</PremiumButton>
        </form>

        <section className="nx-card-pro nx-stack">
          <div className="nx-sheet-head compact"><div><div className="nx-eyebrow">Monthly control</div><h2 className="nx-section-title">Kids and payment status</h2></div><span className="nx-status-pill">{students.length}</span></div>
          {students.map((kid) => <div className="nx-school-list-item" key={kid.id}><span className="nx-school-badge">🎒</span><div><strong>{kid.childName}</strong><small>{kid.parentName} • {kid.pickupPoint} • {kid.monthlyStatus || "unpaid"}</small></div><button className="nx-mini-btn" onClick={() => markPaid(kid.id, kid.monthlyStatus === "paid" ? "unpaid" : "paid")}>{kid.monthlyStatus === "paid" ? "Paid" : "Mark paid"}</button></div>)}
        </section>
      </main>
    </MobileShell>
  );
}
