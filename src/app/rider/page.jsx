// File: src/app/rider/page.jsx

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { get, onValue, ref, remove, set, update, push } from "firebase/database";
import { auth, db } from "../../lib/firebase";
import { googleMapsDirectionsUrl } from "../../lib/googleMaps";
import { nexrideNotificationTypes, queueNexrideEvent } from "../../lib/nexrideNotifications";

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

export default function RiderPage() {
  const router = useRouter();

  const [authReady, setAuthReady] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [appSettings, setAppSettings] = useState({});
  const [city, setCity] = useState("harare");

  const [requestId, setRequestId] = useState("");
  const [requestData, setRequestData] = useState(null);
  const [offers, setOffers] = useState([]);
  const [viewCount, setViewCount] = useState(0);
  const [viewers, setViewers] = useState([]);

  const [nearbyDriversCount, setNearbyDriversCount] = useState(0);
  const [tripId, setTripId] = useState("");
  const [tripData, setTripData] = useState(null);
  const [completedTrip, setCompletedTrip] = useState(null);
  const [liveRouteInfo, setLiveRouteInfo] = useState(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const mode = useMemo(() => getMode({ requestData, offers, tripData, completedTrip }), [requestData, offers, tripData, completedTrip]);

  const requestUnsubRef = useRef(null);
  const offersUnsubRef = useRef(null);
  const viewsUnsubRef = useRef(null);
  const tripUnsubRef = useRef(null);
  const completedTripUnsubRef = useRef(null);

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

        if (profileData.role && profileData.role !== "rider") {
          router.push(profileData.role === "admin" ? "/admin" : "/driver");
          return;
        }

        const savedCity =
          settingsData.city ||
          profileData.city ||
          (typeof window !== "undefined" ? localStorage.getItem("nexride-last-place") : null) ||
          "harare";

        setProfile({ ...profileData, role: profileData.role || "rider" });
        setAppSettings(settingsData);
        setCity(String(savedCity).toLowerCase());

        try {
          localStorage.setItem("nexride-last-place", String(savedCity).toLowerCase());
          if (settingsData.defaultPickup) localStorage.setItem("nexride-default-pickup", settingsData.defaultPickup);
          if (settingsData.defaultDropoff) localStorage.setItem("nexride-default-dropoff", settingsData.defaultDropoff);
          if (settingsData.preferredPayment) localStorage.setItem("nexride-preferred-payment", settingsData.preferredPayment);
          if (settingsData.rideMode) localStorage.setItem("nexride-ride-mode", settingsData.rideMode);
        } catch {}

        const savedRequestId = typeof window !== "undefined" ? localStorage.getItem("nexride-last-request-id") || "" : "";
        const savedTripId = typeof window !== "undefined" ? localStorage.getItem("nexride-active-trip-id") || "" : "";
        if (savedRequestId) setRequestId(savedRequestId);
        if (savedTripId) setTripId(savedTripId);
      } catch (err) {
        console.error(err);
        setError("Failed to load your rider profile.");
      } finally {
        setLoadingProfile(false);
      }
    });

    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (!city || !requestId) return;

    try {
      requestUnsubRef.current?.();
      offersUnsubRef.current?.();
      viewsUnsubRef.current?.();
    } catch {}

    const reqRef = ref(db, `rideRequests/${city}/${requestId}`);
    requestUnsubRef.current = onValue(reqRef, (snap) => {
      const data = snap.val();
      setRequestData(data || null);
      if (data?.matchedTripId) setTripId(data.matchedTripId);
    });

    offersUnsubRef.current = onValue(ref(db, `rideOffers/${requestId}`), (snap) => {
      setOffers(offersList(snap.val()).filter((offer) => offer.status !== "closed"));
    });

    viewsUnsubRef.current = onValue(ref(db, `rideViews/${requestId}`), async (snap) => {
      const data = snap.val() || {};
      const list = Object.entries(data).map(([driverId, value]) => ({ driverId, ...value }));
      setViewers(list);
      setViewCount(list.length);

      try {
        await update(reqRef, { viewCount: list.length, offersCount: offers.length, updatedAt: Date.now() });
      } catch {}
    });

    return () => {
      try {
        requestUnsubRef.current?.();
        offersUnsubRef.current?.();
        viewsUnsubRef.current?.();
      } catch {}
    };
  }, [city, requestId, offers.length]);

  useEffect(() => {
    if (!tripId) return;

    try {
      tripUnsubRef.current?.();
      completedTripUnsubRef.current?.();
    } catch {}

    tripUnsubRef.current = onValue(ref(db, `activeTrips/${tripId}`), (snap) => {
      const data = snap.val();
      if (data) {
        setTripData(data);
        setCompletedTrip(null);
        return;
      }

      setTripData(null);
      completedTripUnsubRef.current = onValue(ref(db, `completedTrips/${tripId}`), (doneSnap) => {
        setCompletedTrip(doneSnap.val() || null);
      });
    });

    return () => {
      try {
        tripUnsubRef.current?.();
        completedTripUnsubRef.current?.();
      } catch {}
    };
  }, [tripId]);

  useEffect(() => {
    if (!user || !tripId || !tripData) return;
    if (!["accepted", "arrived"].includes(tripData.status)) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        try {
          await update(ref(db, `activeTrips/${tripId}/riderLive`), {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            heading: typeof pos.coords.heading === "number" ? pos.coords.heading : null,
            updatedAt: Date.now(),
          });
        } catch {}
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 12000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [tripData, tripId, user]);

  const latestViewer = useMemo(() => {
    if (!viewers.length) return null;
    return [...viewers].sort((a, b) => Number(b.viewedAt || 0) - Number(a.viewedAt || 0))[0];
  }, [viewers]);

  const handleRequestCreated = (request) => {
    setError("");
    setSuccess("Request posted. Drivers can view and negotiate now.");
    setCompletedTrip(null);
    setTripData(null);
    setTripId("");
    setOffers([]);
    setViewers([]);
    setViewCount(0);
    setRequestId(request.id);
    setRequestData(request);
    setCity(request.city || city);

    try {
      localStorage.setItem("nexride-last-request-id", request.id);
      if (request.city) localStorage.setItem("nexride-last-place", request.city);
      localStorage.removeItem("nexride-active-trip-id");
    } catch {}
  };

  const handleAcceptOffer = async (offer) => {
    if (!user || !profile || !requestId || !requestData || !offer?.id) return;

    setError("");
    setSuccess("");

    try {
      const tripRef = push(ref(db, "activeTrips"));
      const newTripId = tripRef.key;
      const now = Date.now();
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const agreedPrice = Number(offer.proposedPrice || requestData.offerPrice || 0);

      const payload = {
        tripId: newTripId,
        requestId,
        offerId: offer.id,
        city,
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
        pickupName: requestData.pickupName || "",
        pickupLat: requestData.pickupLat ?? null,
        pickupLng: requestData.pickupLng ?? null,
        dropoffName: requestData.dropoffName || "",
        dropoffLat: requestData.dropoffLat ?? null,
        dropoffLng: requestData.dropoffLng ?? null,
        distanceText: requestData.distanceText || "",
        distanceMeters: requestData.distanceMeters || null,
        durationText: requestData.durationText || "",
        durationSeconds: requestData.durationSeconds || null,
        routeSource: requestData.routeSource || "manual",
        mapsUrl: requestData.mapsUrl || googleMapsDirectionsUrl({ origin: requestData.pickupName || "", destination: requestData.dropoffName || "", city }),
        agreedPrice,
        people: Number(requestData.people || 1),
        notes: requestData.notes || "",
        preferredPayment: requestData.preferredPayment || "cash",
        rideMode: requestData.rideMode || "standard",
        otp,
        status: "accepted",
        createdAt: now,
        updatedAt: now,
        driverLive: { lat: null, lng: null, heading: null, updatedAt: now },
      };

      await set(tripRef, payload);
      await queueNexrideEvent({
        type: nexrideNotificationTypes.OFFER_ACCEPTED,
        city,
        targetUid: offer.driverId,
        title: "Your offer was accepted",
        message: `${profile.fullName || "The rider"} selected your NEXRIDE offer. Head to pickup.`,
        url: "/driver",
        data: { tripId: newTripId, requestId, offerId: offer.id },
      });
      await update(ref(db, `rideOffers/${requestId}/${offer.id}`), { status: "accepted", acceptedAt: now, acceptedTripId: newTripId });

      await Promise.all(
        offers
          .filter((item) => item.id !== offer.id)
          .map((item) => update(ref(db, `rideOffers/${requestId}/${item.id}`), { status: "closed", closedAt: now }))
      );

      await update(ref(db, `rideRequests/${city}/${requestId}`), {
        status: "matched",
        matchedDriverId: offer.driverId,
        matchedTripId: newTripId,
        matchedAt: now,
        agreedPrice,
        updatedAt: now,
      });

      setTripId(newTripId);
      setTripData(payload);
      setSuccess("Driver selected. Trip is now live.");
      try {
        localStorage.setItem("nexride-active-trip-id", newTripId);
      } catch {}
    } catch (err) {
      console.error(err);
      setError("Failed to accept this driver offer.");
    }
  };

  const handleCancelRequest = async () => {
    if (!requestId || !city) return;

    setError("");
    setSuccess("");

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

      await Promise.all([
        remove(ref(db, `rideRequests/${city}/${requestId}`)),
        remove(ref(db, `rideOffers/${requestId}`)),
        remove(ref(db, `rideViews/${requestId}`)),
      ]);

      setRequestData(null);
      setOffers([]);
      setViewers([]);
      setViewCount(0);
      setRequestId("");
      setSuccess("Ride request cancelled.");
      try {
        localStorage.removeItem("nexride-last-request-id");
      } catch {}
    } catch (err) {
      console.error(err);
      setError("Failed to cancel request.");
    }
  };

  const handleCancelTrip = () => setError("Trip cancellation can be added next: cancel reason, driver alert, and admin log.");

  const handleContactDriver = () => {
    if (!tripData?.driverPhone) {
      setError("Driver phone is not available yet.");
      return;
    }
    window.location.href = `tel:${tripData.driverPhone}`;
  };

  const handleRequestAgain = () => {
    setCompletedTrip(null);
    setTripData(null);
    setTripId("");
    setRequestId("");
    setRequestData(null);
    setOffers([]);
    setViewers([]);
    setViewCount(0);
    setError("");
    setSuccess("");
    try {
      localStorage.removeItem("nexride-active-trip-id");
      localStorage.removeItem("nexride-last-request-id");
    } catch {}
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (err) {
      console.error(err);
      setError("Failed to logout.");
    }
  };

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
        viewCount={viewCount}
        offersCount={offers.length}
        onDriversCountChange={setNearbyDriversCount}
        onRouteInfoChange={setLiveRouteInfo}
      />

      <FloatingTopBar
        title="NEXRIDE"
        subtitle={`${profile?.fullName || "Rider"} • ${cityLabel(city)}`}
        avatarUrl={profile?.photoUrl || profile?.profilePhotoUrl || ""}
        right={<button onClick={handleLogout} className="nx-topbar-btn">Logout</button>}
      />

      {latestViewer && requestData && !tripData ? (
        <div className="nx-view-toast">
          <div className="nx-view-avatar">
            {latestViewer.driverPhotoUrl ? <img src={latestViewer.driverPhotoUrl} alt="" /> : "🚘"}
          </div>
          <div>
            <strong>{latestViewer.driverName || "A driver"}</strong>
            <span>viewed your ride request</span>
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
          <RequestSheet user={user} profile={profile} appSettings={appSettings} initialCity={city} onRequestCreated={handleRequestCreated} />
        )}

        {mode === "waiting" && (
          <WaitingSheet
            requestData={requestData}
            driversNearby={nearbyDriversCount}
            viewCount={viewCount}
            offersCount={offers.length}
            onCancel={handleCancelRequest}
            onOpenOffers={() => (offers.length > 0 ? setSuccess("Offers refreshed.") : setError("No offers yet. Drivers are still viewing your request."))}
          />
        )}

        {mode === "offers" && (
          <OffersSheet requestData={requestData} offers={offers} viewCount={viewCount} onAcceptOffer={handleAcceptOffer} onCancelRequest={handleCancelRequest} />
        )}

        {mode === "trip" && <TripSheet tripData={tripData} liveRouteInfo={liveRouteInfo} onCancelTrip={handleCancelTrip} onContactDriver={handleContactDriver} />}
        {mode === "completed" && <CompletedSheet completedTrip={completedTrip} onRequestAgain={handleRequestAgain} />}
      </BottomSheet>
    </MobileShell>
  );
}
