// File: src/app/rider/page.jsx

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { get, onValue, ref, remove, set, update, push } from "firebase/database";
import { auth, db } from "../../lib/firebase";
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

import MobileShell from "../../components/ui/MobileShell";
import FloatingTopBar from "../../components/ui/FloatingTopBar";
import BottomSheet from "../../components/ui/BottomSheet";
import ActionCard from "../../components/ui/ActionCard";
import RiderMap from "../../components/rider/RiderMap";
import RequestSheet from "../../components/rider/RequestSheet";
import WaitingSheet from "../../components/rider/WaitingSheet";
import OffersSheet from "../../components/rider/OffersSheet";
import TripSheet from "../../components/rider/TripSheet";
import CompletedSheet from "../../components/rider/CompletedSheet";

/* ------------------------------ Helpers ------------------------------- */

function cityLabel(city) {
  if (!city) return "City";
  return city.charAt(0).toUpperCase() + city.slice(1);
}

function getMode({ requestData, offers, tripData, completedTrip }) {
  if (completedTrip) return "completed";
  if (tripData) return "trip";
  if (requestData && offers.length > 0) return "offers";
  if (requestData) return "waiting";
  return "request";
}

function offersList(data) {
  return Object.entries(data || {}).map(([id, value]) => ({ id, ...value }));
}

/** Clear rider-scoped localStorage keys (does NOT clear user preferences). */
function clearRiderSessionStorage() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem("nexride-last-request-id");
    localStorage.removeItem("nexride-active-trip-id");
  } catch {}
}

/* ------------------------------- Page --------------------------------- */

export default function RiderPage() {
  const router = useRouter();

  /* ---------- Core state ---------- */
  const [authReady, setAuthReady] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [appSettings, setAppSettings] = useState({});
  const [city, setCity] = useState("zvishavane");

  /* ---------- Request / offer state ---------- */
  const [requestId, setRequestId] = useState("");
  const [requestData, setRequestData] = useState(null);
  const [offers, setOffers] = useState([]);
  const [viewCount, setViewCount] = useState(0);
  const [viewers, setViewers] = useState([]);

  /* ---------- Trip state ---------- */
  const [nearbyDriversCount, setNearbyDriversCount] = useState(0);
  const [tripId, setTripId] = useState("");
  const [tripData, setTripData] = useState(null);
  const [completedTrip, setCompletedTrip] = useState(null);

  /* ---------- UI state ---------- */
  const [liveRouteInfo, setLiveRouteInfo] = useState(null);
  const [draftRoute, setDraftRoute] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  /* ---------- Refs ---------- */
  const requestUnsubRef = useRef(null);
  const offersUnsubRef = useRef(null);
  const viewsUnsubRef = useRef(null);
  const tripUnsubRef = useRef(null);
  const completedTripUnsubRef = useRef(null);
  const lastViewAnnouncedRef = useRef(0);
  const lastOfferAnnouncedRef = useRef(0);
  const cityRef = useRef(city);
  const requestIdRef = useRef(requestId);

  // Keep refs in sync with state for use inside stable callbacks / listeners
  useEffect(() => {
    cityRef.current = city;
  }, [city]);
  useEffect(() => {
    requestIdRef.current = requestId;
  }, [requestId]);

  /* --------------------------- Derived mode --------------------------- */
  const mode = useMemo(
    () => getMode({ requestData, offers, tripData, completedTrip }),
    [requestData, offers, tripData, completedTrip]
  );

  /* ----------------------- City detection handler --------------------- */
  // Stable — no dependency on `city` (uses ref) so GPS/watch effects don't re-run.
  const handleDetectedCity = useCallback(
    async (detectedCity) => {
      const currentCity = cityRef.current;
      const nextCity = normalizeCity(detectedCity || currentCity);
      if (!nextCity) return;

      if (nextCity !== currentCity) {
        setCity(nextCity);
        setRequestData(null);
        setOffers([]);
        setViewers([]);
        setViewCount(0);
      }

      saveDetectedCityLocal(nextCity);
      await saveDetectedCity({
        db,
        ref,
        update,
        uid: user?.uid,
        cityKey: nextCity,
      });
    },
    [user?.uid]
  );

  /* --------------------------- Auth bootstrap ------------------------- */
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

        // Role guard — redirect drivers/admins away
        if (profileData.role && profileData.role !== "rider") {
          router.push(profileData.role === "admin" ? "/admin" : "/driver");
          return;
        }

        const savedCity =
          settingsData.city ||
          profileData.city ||
          (typeof window !== "undefined"
            ? localStorage.getItem("nexride-last-place")
            : null) ||
          "zvishavane";

        setProfile({ ...profileData, role: profileData.role || "rider" });
        setAppSettings(settingsData);
        setCity(normalizeCity(savedCity));

        // Seed localStorage prefs
        try {
          localStorage.setItem("nexride-last-place", normalizeCity(savedCity));
          if (settingsData.defaultPickup)
            localStorage.setItem("nexride-default-pickup", settingsData.defaultPickup);
          if (settingsData.defaultDropoff)
            localStorage.setItem("nexride-default-dropoff", settingsData.defaultDropoff);
          if (settingsData.preferredPayment)
            localStorage.setItem("nexride-preferred-payment", settingsData.preferredPayment);
          if (settingsData.rideMode)
            localStorage.setItem("nexride-ride-mode", settingsData.rideMode);
        } catch {}

        // Restore in-flight session
        const savedRequestId =
          typeof window !== "undefined"
            ? localStorage.getItem("nexride-last-request-id") || ""
            : "";
        const savedTripId =
          typeof window !== "undefined"
            ? localStorage.getItem("nexride-active-trip-id") || ""
            : "";
        if (savedRequestId) setRequestId(savedRequestId);
        if (savedTripId) setTripId(savedTripId);
      } catch (err) {
        console.error("[RiderPage] profile load failed:", err);
        setError("Failed to load your rider profile.");
      } finally {
        setLoadingProfile(false);
      }
    });

    return () => unsub();
  }, [router]);

  /* ------------------ Request + offers + views listeners -------------- */
  // NOTE: offers.length is intentionally NOT in deps — it would tear down
  // subscriptions on every new offer. Counts sync via a separate effect.
  useEffect(() => {
    if (!city || !requestId) return;

    // Safe cleanup of any existing listeners
    const teardown = () => {
      try {
        requestUnsubRef.current?.();
        offersUnsubRef.current?.();
        viewsUnsubRef.current?.();
      } catch {}
      requestUnsubRef.current = null;
      offersUnsubRef.current = null;
      viewsUnsubRef.current = null;
    };

    teardown();

    const reqRef = ref(db, `rideRequests/${city}/${requestId}`);

    requestUnsubRef.current = onValue(reqRef, (snap) => {
      const data = snap.val();
      setRequestData(data || null);
      if (data?.matchedTripId) setTripId(data.matchedTripId);
    });

    offersUnsubRef.current = onValue(ref(db, `rideOffers/${requestId}`), (snap) => {
      setOffers(
        offersList(snap.val()).filter((offer) => offer.status !== "closed")
      );
    });

    viewsUnsubRef.current = onValue(ref(db, `rideViews/${requestId}`), (snap) => {
      const data = snap.val() || {};
      const list = Object.entries(data).map(([driverId, value]) => ({
        driverId,
        ...value,
      }));
      setViewers(list);
      setViewCount(list.length);
    });

    return teardown;
  }, [city, requestId]);

  /* --------------- Debounced count sync to request record ------------- */
  // Keeps viewCount/offersCount fresh without hammering the DB on every
  // viewer arrival or offer. 500ms debounce.
  useEffect(() => {
    if (!city || !requestId) return;
    const t = setTimeout(() => {
      update(ref(db, `rideRequests/${city}/${requestId}`), {
        viewCount,
        offersCount: offers.length,
        updatedAt: Date.now(),
      }).catch(() => {});
    }, 500);
    return () => clearTimeout(t);
  }, [city, requestId, viewCount, offers.length]);

  /* --------------------------- Trip listeners ------------------------- */
  useEffect(() => {
    if (!tripId) return;

    const teardown = () => {
      try {
        tripUnsubRef.current?.();
        completedTripUnsubRef.current?.();
      } catch {}
      tripUnsubRef.current = null;
      completedTripUnsubRef.current = null;
    };

    teardown();

    tripUnsubRef.current = onValue(ref(db, `activeTrips/${tripId}`), (snap) => {
      const data = snap.val();
      if (data) {
        setTripData(data);
        setCompletedTrip(null);
        return;
      }

      // Active trip gone → check completed
      setTripData(null);
      completedTripUnsubRef.current = onValue(
        ref(db, `completedTrips/${tripId}`),
        (doneSnap) => {
          setCompletedTrip(doneSnap.val() || null);
        }
      );
    });

    return teardown;
  }, [tripId]);

  /* ------------- Rider live GPS broadcast during active trip ---------- */
  // Deps include `handleDetectedCity` (stable via useCallback) so
  // the effect never captures a stale handler.
  useEffect(() => {
    if (!user || !tripId || !tripData) return;
    if (!["accepted", "arrived"].includes(tripData.status)) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        try {
          const gpsPoint = buildGpsPointFromPosition(pos);
          if (!gpsPoint) return;

          const detected = getNearestCityFromPoint(gpsPoint);
          const liveCity = detected?.cityKey || cityRef.current;
          if (detected?.cityKey) await handleDetectedCity(detected.cityKey);

          await update(ref(db, `activeTrips/${tripId}/riderLive`), {
            lat: gpsPoint.lat,
            lng: gpsPoint.lng,
            heading: gpsPoint.heading,
            city: liveCity,
            updatedAt: Date.now(),
          });
        } catch (err) {
          if (process.env.NODE_ENV !== "production") {
            console.warn("[RiderPage] rider GPS broadcast failed:", err);
          }
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 12000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [tripData, tripId, user, handleDetectedCity]);

  /* ----------------------- Derived toast actors ----------------------- */
  const latestViewer = useMemo(() => {
    if (!viewers.length) return null;
    return [...viewers].sort(
      (a, b) => Number(b.viewedAt || 0) - Number(a.viewedAt || 0)
    )[0];
  }, [viewers]);

  const latestOffer = useMemo(() => {
    if (!offers.length) return null;
    return [...offers].sort(
      (a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0)
    )[0];
  }, [offers]);

  /* ----------------------- Voice announcements ------------------------ */
  useEffect(() => {
    if (!latestViewer?.viewedAt || !requestData) return;
    const viewedAt = Number(latestViewer.viewedAt || 0);
    if (viewedAt <= lastViewAnnouncedRef.current) return;
    lastViewAnnouncedRef.current = viewedAt;
    speakNexrideStage(
      "request_viewed",
      "rider",
      {
        ...requestData,
        driverName:
          latestViewer.driverName || latestViewer.name || "A driver",
      },
      { force: true }
    );
  }, [latestViewer, requestData]);

  useEffect(() => {
    if (!latestOffer?.createdAt || !requestData) return;
    const createdAt = Number(latestOffer.createdAt || 0);
    if (createdAt <= lastOfferAnnouncedRef.current) return;
    lastOfferAnnouncedRef.current = createdAt;
    speakNexrideStage(
      "offer_received",
      "rider",
      {
        ...requestData,
        driverName: latestOffer.driverName || "A driver",
      },
      { force: true }
    );
  }, [latestOffer, requestData]);

  /* --------------------------- Handlers ------------------------------- */

  const handleRequestCreated = useCallback((request) => {
    speakNexrideStage("request_created", "rider", request, { force: true });
    setError("");
    setSuccess("Request posted. Drivers can view and negotiate now.");
    setCompletedTrip(null);
    setTripData(null);
    setTripId("");
    setOffers([]);
    setViewers([]);
    setViewCount(0);
    setDraftRoute(null);    // clear old draft so map isn't stale
    setLiveRouteInfo(null); // clear any old route overlay
    setRequestId(request.id);
    setRequestData(request);
    setCity(request.city || cityRef.current);

    try {
      localStorage.setItem("nexride-last-request-id", request.id);
      if (request.city) localStorage.setItem("nexride-last-place", request.city);
      localStorage.removeItem("nexride-active-trip-id");
    } catch {}
  }, []);

  const handleAcceptOffer = useCallback(
    async (offer) => {
      if (!user || !profile || !requestId || !offer?.id) return;

      setError("");
      setSuccess("");

      try {
        const cityKey = cityRef.current;
        const reqId = requestIdRef.current || requestId;

        // Fresh read to avoid stale pickup/dropoff if a new offer raced in
        let freshRequest = requestData;
        try {
          const snap = await get(ref(db, `rideRequests/${cityKey}/${reqId}`));
          if (snap.exists()) freshRequest = { ...(requestData || {}), ...snap.val() };
        } catch {}

        if (!freshRequest) {
          setError("This ride request is no longer available.");
          return;
        }

        const tripRef = push(ref(db, "activeTrips"));
        const newTripId = tripRef.key;
        const now = Date.now();
        const otp = String(Math.floor(100000 + Math.random() * 900000));
        const agreedPrice = Number(
          offer.proposedPrice || freshRequest.offerPrice || 0
        );

        // Best-effort live driver snapshot
        let liveDriver = { lat: null, lng: null, heading: null, updatedAt: now };
        try {
          const onlineSnap = await get(
            ref(db, `driversOnline/${cityKey}/${offer.driverId}`)
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
          tripId: newTripId,
          requestId: reqId,
          offerId: offer.id,
          city: cityKey,
          riderId: user.uid,
          riderName: profile.fullName || "Rider",
          riderPhone: profile.phone || "",
          riderPhotoUrl: profile.photoUrl || profile.profilePhotoUrl || "",
          driverId: offer.driverId,
          driverName: offer.driverName || "Driver",
          driverPhone: offer.driverPhone || "",
          driverPhotoUrl: offer.driverPhotoUrl || offer.profilePhotoUrl || "",
          carName: offer.carName || "",
          plateNumber: offer.plateNumber || "",
          pickupName: freshRequest.pickupName || "",
          pickupLat: freshRequest.pickupLat ?? null,
          pickupLng: freshRequest.pickupLng ?? null,
          dropoffName: freshRequest.dropoffName || "",
          dropoffLat: freshRequest.dropoffLat ?? null,
          dropoffLng: freshRequest.dropoffLng ?? null,
          distanceText: freshRequest.distanceText || "",
          distanceMeters: freshRequest.distanceMeters || null,
          durationText: freshRequest.durationText || "",
          durationSeconds: freshRequest.durationSeconds || null,
          routeSource: freshRequest.routeSource || "manual",
          mapsUrl:
            freshRequest.mapsUrl ||
            googleMapsDirectionsUrl({
              origin: freshRequest.pickupName || "",
              destination: freshRequest.dropoffName || "",
              city: cityKey,
            }),
          agreedPrice,
          people: Number(freshRequest.people || 1),
          notes: freshRequest.notes || "",
          preferredPayment: freshRequest.preferredPayment || "cash",
          rideMode: freshRequest.rideMode || "standard",
          otp,
          status: "accepted",
          createdAt: now,
          updatedAt: now,
          driverLive: liveDriver,
        };

        // 1. Create the trip
        await set(tripRef, payload);

        // 2. Notify the driver (non-blocking on failure)
        try {
          await queueNexrideEvent({
            type: nexrideNotificationTypes.OFFER_ACCEPTED,
            city: cityKey,
            targetUid: offer.driverId,
            title: "Your offer was accepted",
            message: `${
              profile.fullName || "The rider"
            } selected your NEXRIDE offer. Head to pickup.`,
            url: "/driver",
            data: { tripId: newTripId, requestId: reqId, offerId: offer.id },
          });
        } catch {}

        // 3. Mark the winning offer accepted
        try {
          await update(ref(db, `rideOffers/${reqId}/${offer.id}`), {
            status: "accepted",
            acceptedAt: now,
            acceptedTripId: newTripId,
          });
        } catch {}

        // 4. Close losing offers — never let one failure kill the flow
        await Promise.allSettled(
          offers
            .filter((item) => item.id !== offer.id)
            .map((item) =>
              update(ref(db, `rideOffers/${reqId}/${item.id}`), {
                status: "closed",
                closedAt: now,
              })
            )
        );

        // 5. Mark request as matched
        try {
          await update(ref(db, `rideRequests/${cityKey}/${reqId}`), {
            status: "matched",
            matchedDriverId: offer.driverId,
            matchedTripId: newTripId,
            matchedAt: now,
            agreedPrice,
            updatedAt: now,
          });
        } catch {}

        // 6. Cleanup: drivers should no longer see this request as "viewable"
        try {
          await remove(ref(db, `rideViews/${reqId}`));
        } catch {}

        speakNexrideStage("accepted", "rider", payload, { force: true });
        setTripId(newTripId);
        setTripData(payload);
        setSuccess("Driver selected. Trip is now live.");

        try {
          localStorage.setItem("nexride-active-trip-id", newTripId);
        } catch {}
      } catch (err) {
        console.error("[RiderPage] accept offer failed:", err);
        setError("Failed to accept this driver offer.");
      }
    },
    // NOTE: `requestData` is intentionally NOT in deps — we read the
    // freshest copy from Firebase inside the handler. Including it would
    // rebuild this callback on every snapshot update.
    [user, profile, requestId, offers]
  );

  const handleCancelRequest = useCallback(async () => {
    if (!requestId || !city) return;

    setError("");
    setSuccess("");

    try {
      try {
        await queueNexrideEvent({
          type: nexrideNotificationTypes.REQUEST_CANCELLED,
          city,
          targetRole: "driver",
          title: "Ride request cancelled",
          message: `${profile?.fullName || "A rider"} cancelled a NEXRIDE request.`,
          url: "/driver",
          data: { requestId, city },
        });
      } catch {}

      await Promise.allSettled([
        remove(ref(db, `rideRequests/${city}/${requestId}`)),
        remove(ref(db, `rideOffers/${requestId}`)),
        remove(ref(db, `rideViews/${requestId}`)),
      ]);

      setRequestData(null);
      setOffers([]);
      setViewers([]);
      setViewCount(0);
      setRequestId("");
      setDraftRoute(null);
      setSuccess("Ride request cancelled.");
      try {
        localStorage.removeItem("nexride-last-request-id");
      } catch {}
    } catch (err) {
      console.error("[RiderPage] cancel request failed:", err);
      setError("Failed to cancel request.");
    }
  }, [requestId, city, profile?.fullName]);

  const handleCancelTrip = useCallback(async () => {
    if (!tripId || !tripData) {
      setError("No active trip to cancel.");
      return;
    }

    setError("");
    setSuccess("");

    try {
      const now = Date.now();
      await set(ref(db, `cancelledTrips/${tripId}`), {
        ...tripData,
        tripId,
        status: "cancelled",
        cancelledBy: "rider",
        cancelledAt: now,
        updatedAt: now,
      });
      await remove(ref(db, `activeTrips/${tripId}`));

      try {
        await queueNexrideEvent({
          type: nexrideNotificationTypes.TRIP_CANCELLED,
          city: tripData.city || city,
          targetUid: tripData.driverId,
          title: "Trip cancelled",
          message: `${profile?.fullName || "The rider"} cancelled the NEXRIDE trip.`,
          url: "/driver",
          data: {
            tripId,
            requestId: tripData.requestId || requestId,
            city: tripData.city || city,
          },
        });
      } catch {}

      setTripData(null);
      setTripId("");
      setRequestData(null);
      setRequestId("");
      setOffers([]);
      setViewers([]);
      setViewCount(0);
      setSuccess("Trip cancelled.");

      try {
        localStorage.removeItem("nexride-active-trip-id");
        localStorage.removeItem("nexride-last-request-id");
      } catch {}
    } catch (err) {
      console.error("[RiderPage] cancel trip failed:", err);
      setError("Failed to cancel trip.");
    }
  }, [tripId, tripData, city, requestId, profile?.fullName]);

  /* --------------------------- Fare boost ----------------------------- */
  // inDrive-style: nudge the fare up to attract drivers faster.
  const handleBoostFare = useCallback(
    async (bump) => {
      const cityKey = cityRef.current;
      const reqId = requestIdRef.current || requestId;
      if (!reqId || !cityKey) return;

      const current = Number(requestData?.offerPrice || 0);
      const delta = Number(bump);
      if (!Number.isFinite(delta) || delta <= 0) return;

      const next = Math.round((current + delta) * 100) / 100;

      setError("");
      setSuccess("");

      try {
        await update(ref(db, `rideRequests/${cityKey}/${reqId}`), {
          offerPrice: next,
          boostedAt: Date.now(),
          updatedAt: Date.now(),
        });
        setSuccess(`Fare boosted to $${next.toFixed(2)}.`);
      } catch (err) {
        console.error("[RiderPage] boost fare failed:", err);
        setError("Could not boost fare.");
      }
    },
    [requestId, requestData?.offerPrice]
  );

  const handleContactDriver = useCallback(() => {
    if (!tripData?.driverPhone) {
      setError("Driver phone is not available yet.");
      return;
    }
    window.location.href = `tel:${tripData.driverPhone}`;
  }, [tripData?.driverPhone]);

  const handleRequestAgain = useCallback(() => {
    setCompletedTrip(null);
    setTripData(null);
    setTripId("");
    setRequestId("");
    setRequestData(null);
    setOffers([]);
    setViewers([]);
    setViewCount(0);
    setDraftRoute(null);
    setLiveRouteInfo(null);
    setError("");
    setSuccess("");
    clearRiderSessionStorage();
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      // Clear rider session keys so next user on this device starts clean
      clearRiderSessionStorage();
      await signOut(auth);
      router.push("/login");
    } catch (err) {
      console.error("[RiderPage] logout failed:", err);
      setError("Failed to logout.");
    }
  }, [router]);

  /* ---------------------------- Rendering ----------------------------- */

  if (!authReady || loadingProfile) {
    return (
      <MobileShell>
        <div className="nx-center-loader">
          <ActionCard>
            <h2 className="nx-sheet-title">Loading NEXRIDE...</h2>
            <p className="nx-sheet-copy">Preparing your map-first rider flow.</p>
          </ActionCard>
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell>
      <RiderMap
        mode={mode}
        city={city}
        requestData={requestData}
        tripData={tripData}
        completedTrip={completedTrip}
        draftRoute={draftRoute}
        viewCount={viewCount}
        offersCount={offers.length}
        boundsBottomPadding={mode === "request" ? 220 : 160}
        onDriversCountChange={setNearbyDriversCount}
        onRouteInfoChange={setLiveRouteInfo}
        onCityDetected={handleDetectedCity}
      />

      <FloatingTopBar
        title="NEXRIDE"
        subtitle={`${profile?.fullName || "Rider"} • ${cityLabel(city)}`}
        avatarUrl={profile?.photoUrl || profile?.profilePhotoUrl || ""}
        role="rider"
        userEmail={user?.email || ""}
        userPhone={profile?.phone || ""}
        onLogout={handleLogout}
      />

      {latestViewer && requestData && !tripData ? (
        <div className="nx-view-toast">
          <div className="nx-view-avatar">
            {latestViewer.driverPhotoUrl ? (
              <img src={latestViewer.driverPhotoUrl} alt="" />
            ) : (
              "🚘"
            )}
          </div>
          <div>
            <strong>{latestViewer.driverName || "A driver"}</strong>
            <span>viewed your ride request</span>
          </div>
        </div>
      ) : null}

      {latestOffer && requestData && !tripData ? (
        <div className="nx-view-toast nx-offer-toast">
          <div className="nx-view-avatar">
            {latestOffer.driverPhotoUrl ? (
              <img src={latestOffer.driverPhotoUrl} alt="" />
            ) : (
              "$"
            )}
          </div>
          <div>
            <strong>
              {latestOffer.driverName || "A driver"} offered $
              {Number(latestOffer.proposedPrice || 0).toFixed(2)}
            </strong>
            <span>Tap ride details to choose your driver</span>
          </div>
        </div>
      ) : null}

      <BottomSheet
        height={mode === "request" ? "38vh" : "24vh"}
        expandedHeight={mode === "request" ? "50vh" : "58vh"}
        collapsedHeight={mode === "request" ? "178px" : "142px"}
        defaultCollapsed={mode !== "request"}
        stateKey={mode}
        title={mode === "request" ? "request form" : "ride details"}
      >
        {error ? <div className="nx-alert-error">{error}</div> : null}
        {success ? <div className="nx-alert-success">{success}</div> : null}

        {mode === "request" && (
          <RequestSheet
            user={user}
            profile={profile}
            appSettings={appSettings}
            initialCity={city}
            onRequestCreated={handleRequestCreated}
            onDraftRouteChange={setDraftRoute}
          />
        )}

        {mode === "waiting" && (
          <WaitingSheet
            requestData={requestData}
            driversNearby={nearbyDriversCount}
            viewCount={viewCount}
            viewers={viewers}
            offersCount={offers.length}
            onCancel={handleCancelRequest}
            onOpenOffers={() =>
              offers.length > 0
                ? setSuccess("Offers refreshed.")
                : setError(
                    "No offers yet. Drivers are still viewing your request."
                  )
            }
          />
        )}

        {mode === "offers" && (
          <OffersSheet
            requestData={requestData}
            offers={offers}
            viewCount={viewCount}
            onAcceptOffer={handleAcceptOffer}
            onCancelRequest={handleCancelRequest}
            onBoostFare={handleBoostFare}
          />
        )}

        {mode === "trip" && (
          <TripSheet
            tripData={tripData}
            liveRouteInfo={liveRouteInfo}
            onCancelTrip={handleCancelTrip}
            onContactDriver={handleContactDriver}
          />
        )}

        {mode === "completed" && (
          <CompletedSheet
            completedTrip={completedTrip}
            onRequestAgain={handleRequestAgain}
          />
        )}
      </BottomSheet>
    </MobileShell>
  );
}
