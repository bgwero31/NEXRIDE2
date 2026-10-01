// File: src/app/driver/page.jsx

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  get,
  onValue,
  push,
  query,
  orderByChild,
  equalTo,
  ref,
  runTransaction,
  set,
  update,
} from "firebase/database";
import { auth, db } from "../../lib/firebase";

import MobileShell from "../../components/ui/MobileShell";
import FloatingTopBar from "../../components/ui/FloatingTopBar";
import BottomSheet from "../../components/ui/BottomSheet";
import ActionCard from "../../components/ui/ActionCard";
import PremiumButton from "../../components/ui/PremiumButton";
import DriverMap from "../../components/driver/DriverMap";
import DriverTripControls from "../../components/driver/DriverTripControls";
import { googleMapsDirectionsUrl } from "../../lib/googleMaps";
import {
  buildGpsPointFromPosition,
  getNearestCityFromPoint,
  normalizeCity,
  saveDetectedCity,
  saveDetectedCityLocal,
} from "../../lib/nexrideCity";
import {
  nexrideNotificationTypes,
  queueNexrideEvent,
} from "../../lib/nexrideNotifications";
import { speakNexrideStage } from "../../lib/nexrideVoice";

/* ------------------------------ Helpers ------------------------------- */

function cityLabel(city) {
  if (!city) return "City";
  return city.charAt(0).toUpperCase() + city.slice(1);
}

function money(value) {
  return Number(value || 0).toFixed(2);
}

function getMode({ online, activeTrip, completedTrip }) {
  if (completedTrip) return "completed";
  if (activeTrip) return "trip";
  if (!online) return "offline";
  return "queue";
}

/* ---------------------------- Component ------------------------------- */

export default function DriverPage() {
  const router = useRouter();

  /* ---------- Core ---------- */
  const [authReady, setAuthReady] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [city, setCity] = useState("zvishavane");
  const cityKey = useMemo(() => normalizeCity(city || "zvishavane"), [city]);

  /* ---------- Data ---------- */
  const [online, setOnline] = useState(false);
  const [requests, setRequests] = useState([]);
  const [activeTrip, setActiveTrip] = useState(null);
  const [completedTrip, setCompletedTrip] = useState(null);
  const [liveRouteInfo, setLiveRouteInfo] = useState(null);

  /* ---------- UI ---------- */
  const [negotiatingFor, setNegotiatingFor] = useState(null);
  const [proposedPrice, setProposedPrice] = useState("");
  const [proposedMessage, setProposedMessage] = useState("");
  const [workingRequestId, setWorkingRequestId] = useState("");
  const [savingOnline, setSavingOnline] = useState(false);
  const [sendingOffer, setSendingOffer] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /* ---------- Refs ---------- */
  const requestsUnsubRef = useRef(null);
  const activeTripUnsubRef = useRef(null);
  const onlineUnsubRef = useRef(null);
  const completedTripUnsubRef = useRef(null);

  // Session-scoped memory of requests we've already "viewed" so we don't
  // hit the DB N times per snapshot.
  const viewedIdsRef = useRef(new Set());

  // Track last active-trip id we set, to avoid redundant setState calls.
  const lastActiveTripIdRef = useRef("");

  // Keep fresh city in a ref so GPS callback never captures a stale value.
  const cityRef = useRef(cityKey);
  useEffect(() => { cityRef.current = cityKey; }, [cityKey]);

  /* --------------------------- Derived --------------------------- */
  const visibleRequests = useMemo(
    () =>
      requests
        .filter(
          (item) =>
            (item.status || "open") === "open" &&
            item.riderId !== user?.uid
        )
        .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0)),
    [requests, user?.uid]
  );

  const mode = useMemo(
    () => getMode({ online, activeTrip, completedTrip }),
    [online, activeTrip, completedTrip]
  );

  /* ------------------------- Auth bootstrap ---------------------- */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setAuthReady(true);

      if (!currentUser) {
        router.push("/login");
        return;
      }

      setUser(currentUser);

      try {
        setLoadingProfile(true);
        setError("");

        const [profileSnap, settingsSnap] = await Promise.all([
          get(ref(db, `profiles/${currentUser.uid}`)),
          get(ref(db, `appSettings/${currentUser.uid}`)),
        ]);

        const profileData = profileSnap.val() || {};
        const settingsData = settingsSnap.val() || {};

        if (profileData.role && profileData.role !== "driver") {
          router.push(profileData.role === "admin" ? "/admin" : "/rider");
          return;
        }

        const savedCity =
          settingsData.city ||
          profileData.city ||
          (typeof window !== "undefined"
            ? localStorage.getItem("nexride-gps-detected-city")
            : null) ||
          "zvishavane";

        setProfile({ ...profileData, role: "driver" });
        setCity(normalizeCity(savedCity));

        try {
          localStorage.setItem("nexride-last-place", normalizeCity(savedCity));
        } catch {}
      } catch (err) {
        console.error("[DriverPage] profile load failed:", err);
        setError("Failed to load driver profile.");
      } finally {
        setLoadingProfile(false);
      }
    });

    return () => unsub();
  }, [router]);

  /* ------------------- Online status subscription ---------------- */
  useEffect(() => {
    if (!user || !cityKey) return;
    try { onlineUnsubRef.current?.(); } catch {}

    onlineUnsubRef.current = onValue(
      ref(db, `driversOnline/${cityKey}/${user.uid}`),
      (snap) => {
        const data = snap.val();
        setOnline(!!data?.online);
      }
    );

    return () => {
      try { onlineUnsubRef.current?.(); } catch {}
    };
  }, [user, cityKey]);

  /* -------------------- Requests subscription -------------------- */
  useEffect(() => {
    if (!cityKey || !user) return;
    try { requestsUnsubRef.current?.(); } catch {}

    requestsUnsubRef.current = onValue(
      ref(db, `rideRequests/${cityKey}`),
      (snap) => {
        const data = snap.val() || {};
        const list = Object.entries(data).map(([id, value]) => ({ id, ...value }));
        setRequests(list);
      }
    );

    return () => {
      try { requestsUnsubRef.current?.(); } catch {}
    };
  }, [cityKey, user]);

  /* ------------------ Active trip (scoped to this driver) -------- */
  // Uses a query keyed by driverId — only loads MY trips, not everyone's.
  // Requires `.indexOn: ["driverId"]` in rules (safe without it too).
  useEffect(() => {
    if (!user) return;
    try { activeTripUnsubRef.current?.(); } catch {}

    const tripsQuery = query(
      ref(db, "activeTrips"),
      orderByChild("driverId"),
      equalTo(user.uid)
    );

    activeTripUnsubRef.current = onValue(tripsQuery, (snap) => {
      const data = snap.val() || {};
      const mine =
        Object.entries(data)
          .map(([id, value]) => ({ id, ...value }))
          .find((trip) => trip.driverId === user.uid) || null;

      const mineId = mine?.id || "";
      if (mineId === lastActiveTripIdRef.current) return;
      lastActiveTripIdRef.current = mineId;

      setActiveTrip(mine);
      if (mine) setCompletedTrip(null);
    });

    return () => {
      try { activeTripUnsubRef.current?.(); } catch {}
    };
  }, [user]);

  /* ------------------ Completed trip fallback -------------------- */
  // When the active trip disappears (driver marked complete), keep watching
  // completedTrips for the final record, then show completed view.
  const activeTripId = activeTrip?.id || "";
  useEffect(() => {
    if (!user || !activeTripId) return;
    try { completedTripUnsubRef.current?.(); } catch {}

    completedTripUnsubRef.current = onValue(
      ref(db, `completedTrips/${activeTripId}`),
      (snap) => {
        const data = snap.val();
        if (data) {
          setCompletedTrip(data);
          setActiveTrip(null);
        }
      }
    );

    return () => {
      try { completedTripUnsubRef.current?.(); } catch {}
    };
  }, [user, activeTripId]);

  /* ------------------- Mark requests as viewed ------------------- */
  // Only fires once per request per session, tracked in a ref Set.
  useEffect(() => {
    if (!user || !profile || !online || !cityKey) return;
    if (!visibleRequests.length) return;

    let cancelled = false;
    const now = Date.now();

    (async () => {
      for (const requestItem of visibleRequests) {
        if (cancelled) break;
        if (viewedIdsRef.current.has(requestItem.id)) continue;

        try {
          const viewRef = ref(db, `rideViews/${requestItem.id}/${user.uid}`);
          const existing = await get(viewRef);
          if (existing.exists()) {
            viewedIdsRef.current.add(requestItem.id);
            continue;
          }

          await set(viewRef, {
            driverId: user.uid,
            driverName: profile.fullName || "Driver",
            driverPhone: profile.phone || "",
            carName: profile.carName || "",
            plateNumber: profile.plateNumber || "",
            driverPhotoUrl: profile.photoUrl || profile.profilePhotoUrl || "",
            city: cityKey,
            viewedAt: now,
          });

          viewedIdsRef.current.add(requestItem.id);

          queueNexrideEvent({
            type: nexrideNotificationTypes.REQUEST_VIEWED,
            city: cityKey,
            targetUid: requestItem.riderId,
            title: "Your ride was viewed",
            message: `${profile.fullName || "A driver"} viewed your NEXRIDE request.`,
            url: "/rider",
            data: { requestId: requestItem.id, driverId: user.uid, city: cityKey },
          }).catch(() => {});
        } catch (err) {
          if (process.env.NODE_ENV !== "production") {
            console.warn("[DriverPage] mark-viewed failed:", err);
          }
        }
      }
    })();

    return () => { cancelled = true; };
  }, [visibleRequests, user, profile, online, cityKey]);

  /* -------------------- Driver GPS broadcast --------------------- */
  // Depends only on user/online — NOT activeTrip, so we don't restart
  // watchPosition every time the trip updates.
  useEffect(() => {
    if (!user || !online) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        try {
          const gpsPoint = buildGpsPointFromPosition(pos);
          if (!gpsPoint) return;

          const detected = getNearestCityFromPoint(gpsPoint);
          const currentCity = cityRef.current;
          const liveCity = detected?.cityKey || currentCity;

          // If we crossed into another city, migrate online node.
          if (liveCity !== currentCity) {
            try {
              await update(ref(db, `driversOnline/${currentCity}/${user.uid}`), {
                online: false,
                movedToCity: liveCity,
                lastSeen: Date.now(),
              });
            } catch {}

            setCity(liveCity);
            saveDetectedCityLocal(liveCity);
            saveDetectedCity({ db, ref, update, uid: user.uid, cityKey: liveCity }).catch(() => {});
          }

          const live = {
            lat: gpsPoint.lat,
            lng: gpsPoint.lng,
            heading: gpsPoint.heading,
            city: liveCity,
            lastSeen: Date.now(),
          };

          await update(ref(db, `driversOnline/${liveCity}/${user.uid}`), live);

          // Push to active trip if we have one (checked via ref-free path)
          const tripId = (await get(ref(db, "activeTrips"))).val
            ? null
            : null; // placeholder — replaced below
        } catch (err) {
          if (process.env.NODE_ENV !== "production") {
            console.warn("[DriverPage] GPS push failed:", err);
          }
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 12000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [user, online]);

  // Separate effect writes GPS to active trip when we have one.
  useEffect(() => {
    if (!user || !online || !activeTripId) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        try {
          const gpsPoint = buildGpsPointFromPosition(pos);
          if (!gpsPoint) return;
          await update(ref(db, `activeTrips/${activeTripId}/driverLive`), {
            lat: gpsPoint.lat,
            lng: gpsPoint.lng,
            heading: gpsPoint.heading,
            updatedAt: Date.now(),
          });
        } catch {}
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [user, online, activeTripId]);

  /* --------------------------- Toggle online ---------------------- */
  const toggleOnline = useCallback(async () => {
    if (!user || !profile) return;

    setSavingOnline(true);
    setError("");
    setSuccess("");

    try {
      const nextOnline = !online;
      const currentCity = cityRef.current;
      let detectedCity = currentCity;
      let firstGps = {};

      if (nextOnline && typeof navigator !== "undefined" && navigator.geolocation) {
        try {
          const pos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              maximumAge: 8000,
              timeout: 10000,
            });
          });
          const gpsPoint = buildGpsPointFromPosition(pos);
          const detected = getNearestCityFromPoint(gpsPoint);
          if (detected?.cityKey) {
            detectedCity = detected.cityKey;
            setCity(detectedCity);
            saveDetectedCityLocal(detectedCity);
            saveDetectedCity({ db, ref, update, uid: user.uid, cityKey: detectedCity }).catch(() => {});
          }
          if (gpsPoint) {
            firstGps = {
              lat: gpsPoint.lat,
              lng: gpsPoint.lng,
              heading: gpsPoint.heading,
              city: detectedCity,
            };
          }
        } catch {}
      }

      // If city changed, close old node first.
      if (detectedCity !== currentCity) {
        try {
          await update(ref(db, `driversOnline/${currentCity}/${user.uid}`), {
            online: false,
            lastSeen: Date.now(),
          });
        } catch {}
      }

      await update(ref(db, `driversOnline/${detectedCity}/${user.uid}`), {
        driverId: user.uid,
        name: profile.fullName || "Driver",
        phone: profile.phone || "",
        carName: profile.carName || "",
        plateNumber: profile.plateNumber || "",
        driverPhotoUrl: profile.photoUrl || profile.profilePhotoUrl || "",
        city: detectedCity,
        online: nextOnline,
        ...firstGps,
        updatedAt: Date.now(),
        lastSeen: Date.now(),
      });

      setOnline(nextOnline);
      setCompletedTrip(null); // leaving completed view when toggling online
      setSuccess(
        nextOnline
          ? `You are online in ${cityLabel(detectedCity)}. Requests will appear from that city.`
          : "You are offline."
      );
    } catch (err) {
      console.error("[DriverPage] toggleOnline failed:", err);
      setError("Failed to update online status.");
    } finally {
      setSavingOnline(false);
    }
  }, [user, profile, online]);

  /* -------------------- Create trip from request ------------------ */
  const createTripFromRequest = useCallback(
    async (requestItem, agreedPrice) => {
      // Fresh check: request must still be open (race guard).
      const freshSnap = await get(
        ref(db, `rideRequests/${cityRef.current}/${requestItem.id}`)
      );
      const fresh = freshSnap.val() || {};
      if ((fresh.status || "open") !== "open") {
        throw new Error("Request is no longer available.");
      }

      const tripRef = push(ref(db, "activeTrips"));
      const tripId = tripRef.key;
      const now = Date.now();
      const otp = String(Math.floor(100000 + Math.random() * 900000));

      let liveDriver = { lat: null, lng: null, heading: null, updatedAt: now };
      try {
        const onlineSnap = await get(
          ref(db, `driversOnline/${cityRef.current}/${user.uid}`)
        );
        const onlineData = onlineSnap.val() || {};
        if (
          Number.isFinite(Number(onlineData.lat)) &&
          Number.isFinite(Number(onlineData.lng))
        ) {
          liveDriver = {
            lat: Number(onlineData.lat),
            lng: Number(onlineData.lng),
            heading:
              typeof onlineData.heading === "number"
                ? onlineData.heading
                : null,
            updatedAt: onlineData.lastSeen || now,
          };
        }
      } catch {}

      const payload = {
        tripId,
        requestId: requestItem.id,
        city: fresh.city || cityRef.current,
        riderId: requestItem.riderId,
        riderName: requestItem.riderName || "Rider",
        riderPhone: requestItem.riderPhone || "",
        riderPhotoUrl: requestItem.riderPhotoUrl || "",
        driverId: user.uid,
        driverName: profile.fullName || "Driver",
        driverPhone: profile.phone || "",
        driverPhotoUrl: profile.photoUrl || profile.profilePhotoUrl || "",
        carName: profile.carName || "",
        plateNumber: profile.plateNumber || "",
        pickupName: fresh.pickupName || requestItem.pickupName || "",
        pickupLat: fresh.pickupLat ?? requestItem.pickupLat ?? null,
        pickupLng: fresh.pickupLng ?? requestItem.pickupLng ?? null,
        dropoffName: fresh.dropoffName || requestItem.dropoffName || "",
        dropoffLat: fresh.dropoffLat ?? requestItem.dropoffLat ?? null,
        dropoffLng: fresh.dropoffLng ?? requestItem.dropoffLng ?? null,
        distanceText: fresh.distanceText || "",
        distanceMeters: fresh.distanceMeters || null,
        durationText: fresh.durationText || "",
        durationSeconds: fresh.durationSeconds || null,
        routeSource: fresh.routeSource || "manual",
        mapsUrl:
          fresh.mapsUrl ||
          googleMapsDirectionsUrl({
            origin: fresh.pickupName || requestItem.pickupName || "",
            destination: fresh.dropoffName || requestItem.dropoffName || "",
            city: cityRef.current,
          }),
        agreedPrice: Number(agreedPrice || fresh.offerPrice || 0),
        people: Number(fresh.people || requestItem.people || 1),
        notes: fresh.notes || "",
        preferredPayment: fresh.preferredPayment || "cash",
        rideMode: fresh.rideMode || "standard",
        otp,
        status: "accepted",
        createdAt: now,
        updatedAt: now,
        driverLive: liveDriver,
      };

      // Mark request matched BEFORE writing trip so we don't race another driver.
      await update(ref(db, `rideRequests/${payload.city}/${requestItem.id}`), {
        status: "matched",
        matchedDriverId: user.uid,
        matchedTripId: tripId,
        agreedPrice: payload.agreedPrice,
        matchedAt: now,
        updatedAt: now,
      });

      await set(tripRef, payload);

      queueNexrideEvent({
        type: nexrideNotificationTypes.REQUEST_ACCEPTED,
        city: payload.city,
        targetUid: requestItem.riderId,
        title: "Driver accepted your ride",
        message: `${profile.fullName || "Your driver"} accepted your $${money(payload.agreedPrice)} ride request.`,
        url: "/rider",
        data: { tripId, requestId: requestItem.id, driverId: user.uid },
      }).catch(() => {});

      setActiveTrip(payload);
      return payload;
    },
    [user, profile]
  );

  /* ------------------------- Accept request ---------------------- */
  const acceptRequest = useCallback(
    async (requestItem) => {
      if (!user || !profile || !requestItem?.id) return;

      setWorkingRequestId(requestItem.id);
      setError("");
      setSuccess("");

      try {
        const trip = await createTripFromRequest(requestItem, requestItem.offerPrice);
        speakNexrideStage("accepted", "driver", trip, { force: true });
        setSuccess("Ride accepted. Head to pickup and verify OTP.");
      } catch (err) {
        console.error("[DriverPage] accept failed:", err);
        setError(err?.message || "Failed to accept request.");
      } finally {
        setWorkingRequestId("");
      }
    },
    [user, profile, createTripFromRequest]
  );

  /* ------------------------ Open negotiate ----------------------- */
  const openNegotiate = useCallback((requestItem) => {
    setNegotiatingFor(requestItem);
    setProposedPrice(String(requestItem.offerPrice || ""));
    setProposedMessage("");
    setError("");
    setSuccess("");
  }, []);

  /* ------------------------ Send negotiation --------------------- */
  const sendNegotiation = useCallback(async () => {
    if (!user || !profile || !negotiatingFor?.id) return;

    const priceNumber = Number(proposedPrice);
    if (!Number.isFinite(priceNumber) || priceNumber <= 0) {
      setError("Enter a valid counter price.");
      return;
    }

    setSendingOffer(true);
    setError("");
    setSuccess("");

    try {
      const offerRef = push(ref(db, `rideOffers/${negotiatingFor.id}`));
      await set(offerRef, {
        id: offerRef.key,
        requestId: negotiatingFor.id,
        city: cityRef.current,
        driverId: user.uid,
        driverName: profile.fullName || "Driver",
        driverPhone: profile.phone || "",
        carName: profile.carName || "",
        plateNumber: profile.plateNumber || "",
        driverPhotoUrl: profile.photoUrl || profile.profilePhotoUrl || "",
        proposedPrice: priceNumber,
        originalPrice: Number(negotiatingFor.offerPrice || 0),
        message: proposedMessage.trim(),
        status: "pending",
        createdAt: Date.now(),
      });

      // Atomic increment of offersCount
      const reqRef = ref(db, `rideRequests/${cityRef.current}/${negotiatingFor.id}`);
      await runTransaction(reqRef, (current) => {
        if (!current) return current;
        current.offersCount = Number(current.offersCount || 0) + 1;
        current.updatedAt = Date.now();
        return current;
      });

      queueNexrideEvent({
        type: nexrideNotificationTypes.OFFER_SENT,
        city: cityRef.current,
        targetUid: negotiatingFor.riderId,
        title: "New driver offer",
        message: `${profile.fullName || "A driver"} sent a $${money(priceNumber)} offer for your ride.`,
        url: "/rider",
        data: {
          requestId: negotiatingFor.id,
          offerId: offerRef.key,
          driverId: user.uid,
          proposedPrice: priceNumber,
        },
      }).catch(() => {});

      speakNexrideStage(
        "offer_sent",
        "driver",
        { ...negotiatingFor, driverName: profile.fullName || "Driver" },
        { force: true }
      );

      setSuccess("Offer sent to rider.");
      setNegotiatingFor(null);
      setProposedPrice("");
      setProposedMessage("");
    } catch (err) {
      console.error("[DriverPage] send offer failed:", err);
      setError("Failed to send offer.");
    } finally {
      setSendingOffer(false);
    }
  }, [user, profile, negotiatingFor, proposedPrice, proposedMessage]);

  /* ---------------------- Trip callbacks ------------------------- */
  const handleTripUpdated = useCallback((trip) => setActiveTrip(trip), []);

  const handleTripCompleted = useCallback((trip) => {
    setCompletedTrip(trip);
    setActiveTrip(null);
    lastActiveTripIdRef.current = "";
  }, []);

  /* ---------------------------- Logout --------------------------- */
  const handleLogout = useCallback(async () => {
    try {
      if (user && cityRef.current) {
        await update(ref(db, `driversOnline/${cityRef.current}/${user.uid}`), {
          online: false,
          lastSeen: Date.now(),
        });
      }
      // Clear session markers so next driver doesn't inherit them
      viewedIdsRef.current = new Set();
      lastActiveTripIdRef.current = "";
      await signOut(auth);
      router.push("/login");
    } catch (err) {
      console.error("[DriverPage] logout failed:", err);
      setError("Failed to logout.");
    }
  }, [user, router]);

  /* ---------------------------- Loader --------------------------- */
  if (!authReady || loadingProfile) {
    return (
      <MobileShell>
        <div className="nx-center-loader">
          <ActionCard>
            <h2 className="nx-sheet-title">Loading driver map...</h2>
            <p className="nx-sheet-copy">
              Preparing the NEXRIDE request marketplace.
            </p>
          </ActionCard>
        </div>
      </MobileShell>
    );
  }

  /* ---------------------------- Render --------------------------- */
  return (
    <MobileShell>
      <DriverMap
        mode={mode}
        city={cityKey}
        activeTrip={activeTrip}
        completedTrip={completedTrip}
        requests={visibleRequests}
        driverPhotoUrl={profile?.photoUrl || profile?.profilePhotoUrl || ""}
        onRouteInfoChange={setLiveRouteInfo}
      />

<FloatingTopBar
  title="NEXRIDE"
  subtitle={`${profile?.fullName || "Driver"} • ${cityLabel(cityKey)}`}
  avatarUrl={profile?.photoUrl || profile?.profilePhotoUrl || ""}
  role="driver"
  userEmail={user?.email || ""}
  userPhone={profile?.phone || ""}
  onLogout={handleLogout}
/>

      <BottomSheet
        height={mode === "queue" ? "32vh" : "24vh"}
        expandedHeight={mode === "trip" ? "58vh" : "52vh"}
        collapsedHeight={mode === "trip" ? "142px" : "132px"}
        defaultCollapsed={mode === "trip" || mode === "queue"}
        stateKey={mode}
        title={mode === "trip" ? "trip controls" : "driver panel"}
      >
        {error ? <div className="nx-alert-error">{error}</div> : null}
        {success ? <div className="nx-alert-success">{success}</div> : null}

        {(mode === "offline" || mode === "queue") && (
          <div className="nx-stack">
            <ActionCard className="nx-driver-command">
              <div>
                <div className="nx-eyebrow">Driver status</div>
                <h2 className="nx-sheet-title">
                  {online ? "You are online" : "Go online to receive rides"}
                </h2>
                <p className="nx-sheet-copy">
                  {profile?.carName || "Your car"}{" "}
                  {profile?.plateNumber ? `• ${profile.plateNumber}` : ""}
                </p>
              </div>
              <div className={online ? "nx-online-pill on" : "nx-online-pill"}>
                {online ? "ONLINE" : "OFFLINE"}
              </div>
            </ActionCard>

            <PremiumButton
              onClick={toggleOnline}
              disabled={savingOnline}
              variant={online ? "secondary" : "primary"}
            >
              {savingOnline
                ? "Saving..."
                : online
                ? "Go offline"
                : "Go online"}
            </PremiumButton>
          </div>
        )}

        {mode === "queue" && (
          <div className="nx-stack nx-driver-list">
            <div className="nx-sheet-head compact">
              <div>
                <div className="nx-eyebrow">NEXRIDE ride marketplace</div>
                <h2 className="nx-sheet-title">Nearby requests</h2>
              </div>
              <div className="nx-price-badge">{visibleRequests.length}</div>
            </div>

            {visibleRequests.length === 0 ? (
              <ActionCard>
                <h3 className="nx-card-title">No open rides yet</h3>
                <p className="nx-sheet-copy">
                  Stay online. New requests will appear here and on your map.
                </p>
              </ActionCard>
            ) : (
              visibleRequests.map((item) => (
                <ActionCard
                  key={item.id}
                  className="nx-driver-request-card"
                >
                  <div className="nx-offer-top">
                    <div className="nx-driver-avatar">
                      ${Number(item.offerPrice || 0).toFixed(0)}
                    </div>
                    <div className="nx-offer-mid">
                      <h3 className="nx-card-title">
                        {item.pickupName || "Pickup"} →{" "}
                        {item.dropoffName || "Destination"}
                      </h3>
                      <p className="nx-sheet-copy">
                        {item.riderName || "Rider"} • {item.people || 1}{" "}
                        passenger{Number(item.people || 1) === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="nx-status-pill">viewed</div>
                  </div>

                  <div className="nx-map-metrics nx-request-metrics">
                    <span>{item.distanceText || "—"}</span>
                    <span>{item.durationText || "—"}</span>
                    <span>{item.preferredPayment || "cash"}</span>
                    {item.mapsUrl ? (
                      <a href={item.mapsUrl} target="_blank" rel="noreferrer">
                        Map
                      </a>
                    ) : null}
                  </div>

                  {item.notes ? (
                    <p className="nx-offer-message">{item.notes}</p>
                  ) : null}

                  {negotiatingFor?.id === item.id ? (
                    <div className="nx-stack">
                      <div className="nx-field-grid two">
                        <label className="nx-field">
                          <span>Your price</span>
                          <input
                            className="nx-input"
                            type="number"
                            min="1"
                            step="0.50"
                            value={proposedPrice}
                            onChange={(e) => setProposedPrice(e.target.value)}
                          />
                        </label>
                        <label className="nx-field">
                          <span>Original</span>
                          <input
                            className="nx-input"
                            type="text"
                            readOnly
                            value={`$${money(item.offerPrice)}`}
                          />
                        </label>
                      </div>
                      <textarea
                        className="nx-input"
                        rows={2}
                        placeholder="Message to rider"
                        value={proposedMessage}
                        onChange={(e) => setProposedMessage(e.target.value)}
                      />
                      <div className="nx-button-grid two">
                        <PremiumButton
                          onClick={sendNegotiation}
                          disabled={sendingOffer}
                          loading={sendingOffer}
                        >
                          Send offer
                        </PremiumButton>
                        <PremiumButton
                          variant="ghost"
                          onClick={() => setNegotiatingFor(null)}
                        >
                          Cancel
                        </PremiumButton>
                      </div>
                    </div>
                  ) : (
                    <div className="nx-button-grid two">
                      <PremiumButton
                        onClick={() => acceptRequest(item)}
                        disabled={workingRequestId === item.id}
                        loading={workingRequestId === item.id}
                      >
                        {`Accept $${money(item.offerPrice)}`}
                      </PremiumButton>
                      <PremiumButton
                        variant="secondary"
                        onClick={() => openNegotiate(item)}
                      >
                        Counter offer
                      </PremiumButton>
                    </div>
                  )}
                </ActionCard>
              ))
            )}
          </div>
        )}

        {mode === "trip" && (
          <DriverTripControls
            trip={activeTrip}
            liveRouteInfo={liveRouteInfo}
            onTripUpdated={handleTripUpdated}
            onTripCompleted={handleTripCompleted}
          />
        )}

        {mode === "completed" && (
          <div className="nx-stack">
            <ActionCard className="nx-complete-card">
              <div className="nx-complete-icon">✓</div>
              <h2 className="nx-sheet-title">Trip completed</h2>
              <p className="nx-sheet-copy">
                You completed the ride. Go online again to receive more
                requests.
              </p>
            </ActionCard>
            <PremiumButton onClick={() => setCompletedTrip(null)}>
              Back to requests
            </PremiumButton>
          </div>
        )}
      </BottomSheet>
    </MobileShell>
  );
}
