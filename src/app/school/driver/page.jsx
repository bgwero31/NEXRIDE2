"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { onValue, push, ref, set, update } from "firebase/database";
import { db } from "../../../lib/firebase";
import { SCHOOL_EVENT_TYPES, queueSchoolEvent, updateVehicleLiveLocation } from "../../../lib/nexrideSchool";
import { getNexrideLocation, watchNexrideLocation } from "../../../lib/nexrideNative";
import { speakNexride } from "../../../lib/nexrideVoice";
import FloatingTopBar from "../../../components/ui/FloatingTopBar";
import LiveGoogleMap from "../../../components/maps/LiveGoogleMap";
import PremiumButton from "../../../components/ui/PremiumButton";

function rows(snap) { const list = []; snap.forEach((child) => list.push({ id: child.key, ...child.val() })); return list; }
function now() { return Date.now(); }

export default function SchoolDriverPage() {
  const [schools, setSchools] = useState([]);
  const [schoolId, setSchoolId] = useState("");
  const [vehicles, setVehicles] = useState([]);
  const [students, setStudents] = useState([]);
  const [vehicleId, setVehicleId] = useState("");
  const [trip, setTrip] = useState(null);
  const [tripType, setTripType] = useState("morning");
  const [live, setLive] = useState(null);
  const [tracking, setTracking] = useState(false);
  const cleanupRef = useRef(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setSchoolId(localStorage.getItem("nexride_school_active_id") || "");
      setVehicleId(localStorage.getItem("nexride_school_vehicle_id") || "");
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
    const offVehicles = onValue(ref(db, `nexrideSchool/vehicles/${schoolId}`), (snap) => {
      const all = rows(snap);
      setVehicles(all);
      if (!vehicleId && all[0]?.id) setVehicleId(all[0].id);
    });
    const offStudents = onValue(ref(db, `nexrideSchool/students/${schoolId}`), (snap) => setStudents(rows(snap)));
    return () => { offVehicles(); offStudents(); };
  }, [schoolId]);

  useEffect(() => { if (typeof window !== "undefined" && vehicleId) localStorage.setItem("nexride_school_vehicle_id", vehicleId); }, [vehicleId]);
  useEffect(() => () => { cleanupRef.current?.(); }, []);

  const school = useMemo(() => schools.find((s) => s.id === schoolId) || null, [schools, schoolId]);
  const vehicle = useMemo(() => vehicles.find((v) => v.id === vehicleId) || null, [vehicles, vehicleId]);
  const assignedKids = useMemo(() => students.filter((kid) => !vehicleId || kid.vehicleId === vehicleId), [students, vehicleId]);

  const startRoute = async () => {
    if (!schoolId || !vehicleId) return;
    const tripRef = push(ref(db, `nexrideSchool/trips/${schoolId}`));
    const initialLoc = await getNexrideLocation({ allowWeak: true });
    const payload = { id: tripRef.key, schoolId, vehicleId, type: tripType, status: "started", startedAt: now(), updatedAt: now(), routeName: tripType === "morning" ? "Morning pickup" : "Afternoon drop-off" };
    await set(tripRef, payload);
    setTrip(payload);
    if (initialLoc) {
      setLive(initialLoc);
      await updateVehicleLiveLocation({ schoolId, vehicleId, location: initialLoc, status: `${tripType}_started`, tripId: tripRef.key });
    }
    await queueSchoolEvent({ type: tripType === "morning" ? SCHOOL_EVENT_TYPES.ROUTE_STARTED : SCHOOL_EVENT_TYPES.AFTERNOON_STARTED, schoolId, vehicleId, city: school?.city, title: "NEXRIDE School route started", message: `${vehicle?.name || "School kombi"} has started the ${tripType} route.`, data: { tripId: tripRef.key }, speak: true });
    speakNexride(`${vehicle?.name || "School kombi"} route started. NEXRIDE school tracking is live.`, { force: true });
    setTracking(true);
    cleanupRef.current?.();
    cleanupRef.current = watchNexrideLocation(async (loc) => {
      setLive(loc);
      await updateVehicleLiveLocation({ schoolId, vehicleId, location: loc, status: "live", tripId: tripRef.key });
    }, () => {}, { maximumAge: 3000 });
  };

  const stopRoute = async (status = "completed") => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    setTracking(false);
    if (trip?.id) await update(ref(db, `nexrideSchool/trips/${schoolId}/${trip.id}`), { status, completedAt: now(), updatedAt: now() });
    if (vehicleId) await update(ref(db, `nexrideSchool/vehicles/${schoolId}/${vehicleId}`), { liveStatus: status, updatedAt: now() });
    await queueSchoolEvent({ type: SCHOOL_EVENT_TYPES.ROUTE_COMPLETED, schoolId, vehicleId, city: school?.city, title: "NEXRIDE School route completed", message: `${vehicle?.name || "School kombi"} route is completed.`, data: { tripId: trip?.id || "" }, speak: true });
    speakNexride("School route completed. Thank you for driving with NEXRIDE School.", { force: true });
  };

  const markKid = async (kid, eventType) => {
    if (!trip?.id) return;
    const eventRef = push(ref(db, `nexrideSchool/tripEvents/${schoolId}/${trip.id}`));
    await set(eventRef, { id: eventRef.key, schoolId, tripId: trip.id, vehicleId, studentId: kid.id, childName: kid.childName, type: eventType, createdAt: now() });
    const type = eventType === "boarded" ? SCHOOL_EVENT_TYPES.CHILD_BOARDED : eventType === "dropped" ? SCHOOL_EVENT_TYPES.CHILD_DROPPED : SCHOOL_EVENT_TYPES.CHILD_ABSENT;
    const verb = eventType === "boarded" ? "boarded the kombi" : eventType === "dropped" ? "was dropped off" : "was marked absent";
    await queueSchoolEvent({ type, schoolId, vehicleId, studentId: kid.id, parentPhone: kid.parentPhone, city: school?.city, title: "NEXRIDE School update", message: `${kid.childName} ${verb}.`, data: { tripId: trip.id }, speak: true });
  };

  return (
    <div className="nx-school-map-shell">
      <LiveGoogleMap city={school?.city || "Zvishavane"} role="driver" origin={live} destination={assignedKids[0]?.pickupPoint || school?.name} driverLocation={live} routePhase="school" cameraFollow followTarget="driver" />
      <FloatingTopBar title="NEXRIDE" subtitle="School driver" role="driver" />
      <main className="nx-school-driver-panel nx-bottom-sheet">
        <div className="nx-sheet-handle" />
        <div className="nx-sheet-head">
          <div><div className="nx-eyebrow">School driver mode</div><h1 className="nx-sheet-title">Live kombi tracking</h1><p className="nx-sheet-copy">Start a route so parents can track the kombi and receive child safety alerts.</p></div>
          <span className="nx-status-pill">{tracking ? "LIVE" : "OFFLINE"}</span>
        </div>
        <div className="nx-field-grid two"><label className="nx-field"><span>School</span><select className="nx-input" value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>{schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label className="nx-field"><span>Kombi</span><select className="nx-input" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.name} • {v.plate}</option>)}</select></label></div>
        <div className="nx-field-grid two"><label className="nx-field"><span>Trip type</span><select className="nx-input" value={tripType} onChange={(e) => setTripType(e.target.value)}><option value="morning">Morning pickup</option><option value="afternoon">Afternoon drop-off</option></select></label><div className="nx-color-preview small" style={{ background: vehicle?.color || "#0066ff" }}><span>{vehicle?.colorName || "NEX blue"}</span><strong>{vehicle?.plate || "No plate"}</strong></div></div>
        <div className="nx-button-grid two"><PremiumButton type="button" onClick={startRoute} disabled={tracking}>Start route</PremiumButton><button className="nx-btn nx-btn-secondary" type="button" onClick={() => stopRoute("completed")} disabled={!tracking}>Complete</button></div>
        <section className="nx-school-kid-list"><div className="nx-eyebrow">Assigned kids</div>{assignedKids.map((kid) => <div key={kid.id} className="nx-school-list-item"><span className="nx-school-badge">🎒</span><div><strong>{kid.childName}</strong><small>{kid.pickupPoint || "Pickup point"} • {kid.parentPhone || "No parent phone"}</small></div><div className="nx-kid-actions"><button onClick={() => markKid(kid, "boarded")}>Boarded</button><button onClick={() => markKid(kid, "dropped")}>Dropped</button><button onClick={() => markKid(kid, "absent")}>Absent</button></div></div>)}</section>
      </main>
    </div>
  );
}
