// File: src/lib/nexrideSchool.js

import { push, ref, set, update } from "firebase/database";
import { db } from "./firebase";
import { queueNexrideEvent } from "./nexrideNotifications";
import { speakNexride } from "./nexrideVoice";

export const SCHOOL_COLORS = [
  { name: "NEX blue", value: "#0066ff" },
  { name: "Sky cyan", value: "#00d4ff" },
  { name: "Safety green", value: "#20e28a" },
  { name: "Sunset amber", value: "#ffb020" },
  { name: "Royal purple", value: "#7c3cff" },
  { name: "Crimson red", value: "#ff385c" },
  { name: "Kombi white", value: "#f7fbff" },
  { name: "Midnight black", value: "#06152b" },
];

export const SCHOOL_EVENT_TYPES = {
  SCHOOL_REGISTERED: "school_registered",
  ROUTE_STARTED: "school_route_started",
  VEHICLE_LIVE: "school_vehicle_live",
  CHILD_BOARDED: "school_child_boarded",
  CHILD_ABSENT: "school_child_absent",
  ARRIVED_SCHOOL: "school_arrived_school",
  AFTERNOON_STARTED: "school_afternoon_started",
  CHILD_DROPPED: "school_child_dropped",
  ROUTE_COMPLETED: "school_route_completed",
  EMERGENCY: "school_emergency",
};

export function schoolLocal(key, fallback = "") {
  if (typeof window === "undefined") return fallback;
  return window.localStorage.getItem(key) || fallback;
}

export function saveActiveSchool(schoolId = "") {
  if (typeof window !== "undefined" && schoolId) window.localStorage.setItem("nexride_school_active_id", schoolId);
}

export function getActiveSchool() {
  return schoolLocal("nexride_school_active_id", "");
}

export function formatSchoolColor(vehicle = {}) {
  return vehicle.colorName || SCHOOL_COLORS.find((item) => item.value === vehicle.color)?.name || "NEX blue";
}

export async function createSchoolTenant({ name, city, phone, ownerId, ownerName, plan = "monthly", monthlyFee = "30" }) {
  const now = Date.now();
  const schoolRef = push(ref(db, "nexrideSchool/schools"));
  const school = {
    id: schoolRef.key,
    name: name || "NEXRIDE School Partner",
    city: city || "Zvishavane",
    phone: phone || "",
    ownerId: ownerId || "",
    ownerName: ownerName || "",
    plan,
    monthlyFee,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
  await set(schoolRef, school);
  if (ownerId) await set(ref(db, `nexrideSchool/memberships/${ownerId}/${schoolRef.key}`), { role: "school_admin", schoolId: schoolRef.key, createdAt: now });
  saveActiveSchool(schoolRef.key);
  await queueSchoolEvent({
    type: SCHOOL_EVENT_TYPES.SCHOOL_REGISTERED,
    schoolId: schoolRef.key,
    title: "NEXRIDE School registered",
    message: `${school.name} is ready for school transport tracking.`,
    city: school.city,
    targetRole: "school_admin",
  });
  return school;
}

export async function queueSchoolEvent({
  type,
  schoolId = "",
  vehicleId = "",
  studentId = "",
  parentUid = "",
  parentPhone = "",
  city = "",
  title = "NEXRIDE School",
  message = "School transport update",
  data = {},
  speak = false,
} = {}) {
  const payload = await queueNexrideEvent({
    type,
    title,
    message,
    city,
    targetRole: parentUid ? "school_parent" : "school",
    targetUid: parentUid,
    url: schoolId ? `/school/parent?schoolId=${schoolId}` : "/school",
    data: {
      module: "nexride_school",
      schoolId,
      vehicleId,
      studentId,
      parentPhone,
      ...data,
    },
  });

  if (speak && typeof window !== "undefined") {
    speakNexride(message, { force: true });
  }

  return payload;
}

export async function updateVehicleLiveLocation({ schoolId, vehicleId, location, status = "live", tripId = "" }) {
  if (!schoolId || !vehicleId || !location?.lat || !location?.lng) return false;
  const now = Date.now();
  await update(ref(db, `nexrideSchool/vehicles/${schoolId}/${vehicleId}`), {
    liveLat: location.lat,
    liveLng: location.lng,
    heading: location.heading || 0,
    speed: location.speed || 0,
    accuracy: location.accuracy || null,
    liveStatus: status,
    tripId,
    lastSeen: now,
    updatedAt: now,
  });
  return true;
}
