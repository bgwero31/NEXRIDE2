"use client";

import { useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";
import { db } from "../../../lib/firebase";
import { SCHOOL_EVENT_TYPES, queueSchoolEvent } from "../../../lib/nexrideSchool";
import FloatingTopBar from "../../../components/ui/FloatingTopBar";
import LiveGoogleMap from "../../../components/maps/LiveGoogleMap";
import PremiumButton from "../../../components/ui/PremiumButton";

function rows(snap) { const list = []; snap.forEach((child) => list.push({ id: child.key, ...child.val() })); return list; }
function vehiclePoint(vehicle) { return vehicle?.liveLat && vehicle?.liveLng ? { lat: vehicle.liveLat, lng: vehicle.liveLng, heading: vehicle.heading || 0 } : null; }

export default function SchoolParentPage() {
  const [schools, setSchools] = useState([]);
  const [schoolId, setSchoolId] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicles, setVehicles] = useState([]);
  const [students, setStudents] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setSchoolId(params.get("schoolId") || localStorage.getItem("nexride_school_active_id") || "");
      setPhone(localStorage.getItem("nexride_school_parent_phone") || "");
    }
    return onValue(ref(db, "nexrideSchool/schools"), (snap) => {
      const all = rows(snap);
      setSchools(all);
      if (!schoolId && all[0]?.id) setSchoolId(all[0].id);
    });
  }, []);

  useEffect(() => {
    if (!schoolId) return;
    if (typeof window !== "undefined") localStorage.setItem("nexride_school_active_id", schoolId);
    const offVehicles = onValue(ref(db, `nexrideSchool/vehicles/${schoolId}`), (snap) => setVehicles(rows(snap)));
    const offStudents = onValue(ref(db, `nexrideSchool/students/${schoolId}`), (snap) => setStudents(rows(snap)));
    const offRoutes = onValue(ref(db, `nexrideSchool/routes/${schoolId}`), (snap) => setRoutes(rows(snap)));
    return () => { offVehicles(); offStudents(); offRoutes(); };
  }, [schoolId]);

  useEffect(() => { if (typeof window !== "undefined") localStorage.setItem("nexride_school_parent_phone", phone); }, [phone]);

  const visibleStudents = useMemo(() => {
    const clean = phone.replace(/\D/g, "");
    if (!clean) return students.slice(0, 8);
    return students.filter((kid) => String(kid.parentPhone || "").replace(/\D/g, "").includes(clean.slice(-7)));
  }, [students, phone]);

  const selectedStudent = useMemo(() => visibleStudents.find((kid) => kid.id === selectedStudentId) || visibleStudents[0] || null, [visibleStudents, selectedStudentId]);
  const vehicle = useMemo(() => vehicles.find((v) => v.id === selectedStudent?.vehicleId) || vehicles[0] || null, [vehicles, selectedStudent]);
  const route = useMemo(() => routes.find((r) => r.id === selectedStudent?.routeId) || null, [routes, selectedStudent]);
  const school = useMemo(() => schools.find((s) => s.id === schoolId) || null, [schools, schoolId]);

  const notifyParentTest = async () => {
    await queueSchoolEvent({
      type: SCHOOL_EVENT_TYPES.VEHICLE_LIVE,
      schoolId,
      vehicleId: vehicle?.id || "",
      studentId: selectedStudent?.id || "",
      parentPhone: phone,
      city: school?.city,
      title: "NEXRIDE School tracking",
      message: `${vehicle?.name || "Your school kombi"} is being tracked live for ${selectedStudent?.childName || "your child"}.`,
      speak: true,
    });
  };

  return (
    <div className="nx-school-map-shell">
      <LiveGoogleMap
        city={school?.city || "Zvishavane"}
        role="rider"
        origin={vehiclePoint(vehicle)}
        destination={selectedStudent?.pickupPoint || route?.to || school?.name}
        driverLocation={vehiclePoint(vehicle)}
        riderLocation={null}
        driverPhotoUrl=""
        markers={vehicles.map((v) => { const p = vehiclePoint(v); return p ? { ...p, type: "driver", label: v.name, title: `${v.name} • ${v.plate || "school kombi"}`, heading: v.heading || 0 } : null; }).filter(Boolean)}
        routePhase="school"
        cameraFollow
        followTarget="driver"
      />
      <FloatingTopBar title="NEXRIDE" subtitle="School parent tracking" role="rider" />
      <main className="nx-school-parent-panel nx-bottom-sheet">
        <div className="nx-sheet-handle" />
        <div className="nx-sheet-head">
          <div><div className="nx-eyebrow">Live school transport</div><h1 className="nx-sheet-title">Track your child</h1><p className="nx-sheet-copy">Watch the assigned kombi live during the school route.</p></div>
          <span className="nx-status-pill">{vehicle?.liveStatus || "offline"}</span>
        </div>
        <div className="nx-field-grid two">
          <label className="nx-field"><span>School</span><select className="nx-input" value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>{schools.map((s) => <option value={s.id} key={s.id}>{s.name}</option>)}</select></label>
          <label className="nx-field"><span>Parent phone</span><input className="nx-input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Enter phone" /></label>
        </div>
        <div className="nx-school-kid-tabs">
          {visibleStudents.map((kid) => <button key={kid.id} className={kid.id === selectedStudent?.id ? "active" : ""} onClick={() => setSelectedStudentId(kid.id)}>{kid.childName}</button>)}
        </div>
        {selectedStudent ? <div className="nx-card-pro nx-school-live-card"><div className="nx-color-dot" style={{ background: vehicle?.color || "#0066ff" }} /><div><strong>{selectedStudent.childName}</strong><small>{school?.name} • {selectedStudent.pickupPoint || "Pickup point"}</small><small>{vehicle?.name || "No kombi"} • {vehicle?.plate || "No plate"} • {vehicle?.colorName || "NEX blue"}</small></div></div> : <p className="nx-alert-error">No child found. Ask the school admin to add your child and parent phone.</p>}
        <div className="nx-button-grid two"><a className="nx-btn nx-btn-secondary" href="/school">School home</a><PremiumButton type="button" onClick={notifyParentTest}>Test alert</PremiumButton></div>
      </main>
    </div>
  );
}
