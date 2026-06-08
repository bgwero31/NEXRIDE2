// File: src/app/driver/page.jsx

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { get, onValue, push, ref, set, update } from "firebase/database";
import { auth, db } from "../../lib/firebase";

import MobileShell from "../../components/ui/MobileShell";
import FloatingTopBar from "../../components/ui/FloatingTopBar";
import BottomSheet from "../../components/ui/BottomSheet";
import ActionCard from "../../components/ui/ActionCard";
import PremiumButton from "../../components/ui/PremiumButton";
import DriverMap from "../../components/driver/DriverMap";
import DriverTripControls from "../../components/driver/DriverTripControls";
import { googleMapsDirectionsUrl } from "../../lib/googleMaps";
import { nexrideNotificationTypes, queueNexrideEvent } from "../../lib/nexrideNotifications";

function cityLabel(city) {
  if (!city) return "City";
  return city.charAt(0).toUpperCase() + city.slice(1);
}

function getMode({ online, activeTrip, completedTrip }) {
  if (completedTrip) return "completed";
  if (activeTrip) return "trip";
  if (!online) return "offline";
  return "queue";
}

function money(value) {
  return Number(value || 0).toFixed(2);
}

export default function DriverPage() {
  const router = useRouter();

  const [authReady, setAuthReady] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [city, setCity] = useState("harare");
  const cityKey = useMemo(() => String(city || "harare").trim().toLowerCase(), [city]);

  const [online, setOnline] = useState(false);
  const [requests, setRequests] = useState([]);
  const [activeTrip, setActiveTrip] = useState(null);
  const [completedTrip, setCompletedTrip] = useState(null);

  const [negotiatingFor, setNegotiatingFor] = useState(null);
  const [proposedPrice, setProposedPrice] = useState("");
  const [proposedMessage, setProposedMessage] = useState("");
  const [workingRequestId, setWorkingRequestId] = useState("");
  const [savingOnline, setSavingOnline] = useState(false);
  const [sendingOffer, setSendingOffer] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const requestsUnsubRef = useRef(null);
  const activeTripUnsubRef = useRef(null);
  const onlineUnsubRef = useRef(null);

  const visibleRequests = useMemo(
    () => requests.filter((item) => (item.status || "open") === "open" && item.riderId !== user?.uid).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0)),
    [requests, user?.uid]
  );

  const mode = useMemo(() => getMode({ online, activeTrip, completedTrip }), [online, activeTrip, completedTrip]);

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

        const savedCity = settingsData.city || profileData.city || "harare";
        setProfile({ ...profileData, role: "driver" });
        setCity(String(savedCity).toLowerCase());

        try {
          localStorage.setItem("nexride-last-place", String(savedCity).toLowerCase());
        } catch {}
      } catch (err) {
        console.error(err);
        setError("Failed to load driver profile.");
      } finally {
        setLoadingProfile(false);
      }
    });

    return () => unsub();
  }, [router]);

  useEffect(() => {
    if (!user || !cityKey) return;

    try {
      onlineUnsubRef.current?.();
    } catch {}

    onlineUnsubRef.current = onValue(ref(db, `driversOnline/${cityKey}/${user.uid}`), (snap) => {
      const data = snap.val();
      setOnline(!!data?.online);
    });

    return () => {
      try {
        onlineUnsubRef.current?.();
      } catch {}
    };
  }, [user, cityKey]);

  useEffect(() => {
    if (!cityKey || !user) return;

    try {
      requestsUnsubRef.current?.();
    } catch {}

    requestsUnsubRef.current = onValue(ref(db, `rideRequests/${cityKey}`), (snap) => {
      const data = snap.val() || {};
      const list = Object.entries(data).map(([id, value]) => ({ id, ...value }));
      setRequests(list);
    });

    return () => {
      try {
        requestsUnsubRef.current?.();
      } catch {}
    };
  }, [cityKey, user]);

  useEffect(() => {
    if (!user) return;

    try {
      activeTripUnsubRef.current?.();
    } catch {}

    activeTripUnsubRef.current = onValue(ref(db, "activeTrips"), (snap) => {
      const data = snap.val() || {};
      const mine = Object.entries(data)
        .map(([id, value]) => ({ id, ...value }))
        .find((trip) => trip.driverId === user.uid) || null;

      setActiveTrip(mine);
      if (mine) setCompletedTrip(null);
    });

    return () => {
      try {
        activeTripUnsubRef.current?.();
      } catch {}
    };
  }, [user]);

  useEffect(() => {
    if (!user || !profile || !online || !cityKey) return;
    if (visibleRequests.length === 0) return;

    const now = Date.now();
    visibleRequests.forEach(async (requestItem) => {
      try {
        const viewRef = ref(db, `rideViews/${requestItem.id}/${user.uid}`);
        const alreadyViewed = await get(viewRef);
        if (alreadyViewed.exists()) return;

        await set(viewRef, {
          driverId: user.uid,
          driverName: profile.fullName || "Driver",
          driverPhone: profile.phone || "",
          carName: profile.carName || "",
          plateNumber: profile.plateNumber || "",
          city: cityKey,
          viewedAt: now,
        });

        await queueNexrideEvent({
          type: nexrideNotificationTypes.REQUEST_VIEWED,
          city: cityKey,
          targetUid: requestItem.riderId,
          title: "Your ride was viewed",
          message: `${profile.fullName || "A driver"} viewed your NEXRIDE request.`,
          url: "/rider",
          data: { requestId: requestItem.id, driverId: user.uid, city: cityKey },
        });
      } catch {}
    });
  }, [visibleRequests, user, profile, online, cityKey]);

  useEffect(() => {
    if (!user || !cityKey || !online) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    const onlineRef = ref(db, `driversOnline/${cityKey}/${user.uid}`);

    const pushLocation = async (pos) => {
      const live = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        heading: typeof pos.coords.heading === "number" ? pos.coords.heading : null,
        lastSeen: Date.now(),
      };

      try {
        await update(onlineRef, live);
        if (activeTrip?.tripId) {
          await update(ref(db, `activeTrips/${activeTrip.tripId}/driverLive`), {
            lat: live.lat,
            lng: live.lng,
            heading: live.heading,
            updatedAt: live.lastSeen,
          });
        }
      } catch {}
    };

    const watchId = navigator.geolocation.watchPosition(pushLocation, () => {}, {
      enableHighAccuracy: true,
      maximumAge: 15000,
      timeout: 12000,
    });

    return () => navigator.geolocation.clearWatch(watchId);
  }, [user, cityKey, online, activeTrip?.tripId]);

  const toggleOnline = async () => {
    if (!user || !profile || !cityKey) return;

    setSavingOnline(true);
    setError("");
    setSuccess("");

    try {
      const nextOnline = !online;
      await update(ref(db, `driversOnline/${cityKey}/${user.uid}`), {
        driverId: user.uid,
        name: profile.fullName || "Driver",
        phone: profile.phone || "",
        carName: profile.carName || "",
        plateNumber: profile.plateNumber || "",
        city: cityKey,
        online: nextOnline,
        updatedAt: Date.now(),
        lastSeen: Date.now(),
      });
      setOnline(nextOnline);
      setSuccess(nextOnline ? "You are online. Requests will appear on your map." : "You are offline.");
    } catch (err) {
      console.error(err);
      setError("Failed to update online status.");
    } finally {
      setSavingOnline(false);
    }
  };

  const createTripFromRequest = async (requestItem, agreedPrice) => {
    const tripRef = push(ref(db, "activeTrips"));
    const tripId = tripRef.key;
    const now = Date.now();
    const otp = String(Math.floor(100000 + Math.random() * 900000));

    const payload = {
      tripId,
      requestId: requestItem.id,
      city: cityKey,
      riderId: requestItem.riderId,
      riderName: requestItem.riderName || "Rider",
      riderPhone: requestItem.riderPhone || "",
      driverId: user.uid,
      driverName: profile.fullName || "Driver",
      driverPhone: profile.phone || "",
      carName: profile.carName || "",
      plateNumber: profile.plateNumber || "",
      pickupName: requestItem.pickupName || "",
      pickupLat: requestItem.pickupLat ?? null,
      pickupLng: requestItem.pickupLng ?? null,
      dropoffName: requestItem.dropoffName || "",
      dropoffLat: requestItem.dropoffLat ?? null,
      dropoffLng: requestItem.dropoffLng ?? null,
      distanceText: requestItem.distanceText || "",
      distanceMeters: requestItem.distanceMeters || null,
      durationText: requestItem.durationText || "",
      durationSeconds: requestItem.durationSeconds || null,
      routeSource: requestItem.routeSource || "manual",
      mapsUrl: requestItem.mapsUrl || googleMapsDirectionsUrl({ origin: requestItem.pickupName || "", destination: requestItem.dropoffName || "", city: cityKey }),
      agreedPrice: Number(agreedPrice || requestItem.offerPrice || 0),
      people: Number(requestItem.people || 1),
      notes: requestItem.notes || "",
      preferredPayment: requestItem.preferredPayment || "cash",
      rideMode: requestItem.rideMode || "standard",
      otp,
      status: "accepted",
      createdAt: now,
      updatedAt: now,
      driverLive: { lat: null, lng: null, heading: null, updatedAt: now },
    };

    await set(tripRef, payload);
    await queueNexrideEvent({
      type: nexrideNotificationTypes.REQUEST_ACCEPTED,
      city: cityKey,
      targetUid: requestItem.riderId,
      title: "Driver accepted your ride",
      message: `${profile.fullName || "Your driver"} accepted your $${money(agreedPrice || requestItem.offerPrice)} ride request.`,
      url: "/rider",
      data: { tripId, requestId: requestItem.id, driverId: user.uid },
    });
    await update(ref(db, `rideRequests/${cityKey}/${requestItem.id}`), {
      status: "matched",
      matchedDriverId: user.uid,
      matchedTripId: tripId,
      agreedPrice: Number(agreedPrice || requestItem.offerPrice || 0),
      matchedAt: now,
      updatedAt: now,
    });

    setActiveTrip(payload);
    return payload;
  };

  const acceptRequest = async (requestItem) => {
    if (!user || !profile || !requestItem?.id) return;

    setWorkingRequestId(requestItem.id);
    setError("");
    setSuccess("");

    try {
      await createTripFromRequest(requestItem, requestItem.offerPrice);
      setSuccess("Ride accepted. Head to pickup and verify OTP.");
    } catch (err) {
      console.error(err);
      setError("Failed to accept request.");
    } finally {
      setWorkingRequestId("");
    }
  };

  const openNegotiate = (requestItem) => {
    setNegotiatingFor(requestItem);
    setProposedPrice(String(requestItem.offerPrice || ""));
    setProposedMessage("");
    setError("");
    setSuccess("");
  };

  const sendNegotiation = async () => {
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
        city: cityKey,
        driverId: user.uid,
        driverName: profile.fullName || "Driver",
        driverPhone: profile.phone || "",
        carName: profile.carName || "",
        plateNumber: profile.plateNumber || "",
        proposedPrice: priceNumber,
        originalPrice: Number(negotiatingFor.offerPrice || 0),
        message: proposedMessage.trim(),
        status: "pending",
        createdAt: Date.now(),
      });
      await queueNexrideEvent({
        type: nexrideNotificationTypes.OFFER_SENT,
        city: cityKey,
        targetUid: negotiatingFor.riderId,
        title: "New driver offer",
        message: `${profile.fullName || "A driver"} sent a $${money(priceNumber)} offer for your ride.`,
        url: "/rider",
        data: { requestId: negotiatingFor.id, offerId: offerRef.key, driverId: user.uid, proposedPrice: priceNumber },
      });
      await update(ref(db, `rideRequests/${cityKey}/${negotiatingFor.id}`), {
        offersCount: Number(negotiatingFor.offersCount || 0) + 1,
        updatedAt: Date.now(),
      });
      setSuccess("Offer sent to rider.");
      setNegotiatingFor(null);
      setProposedPrice("");
      setProposedMessage("");
    } catch (err) {
      console.error(err);
      setError("Failed to send offer.");
    } finally {
      setSendingOffer(false);
    }
  };

  const handleTripUpdated = (trip) => setActiveTrip(trip);
  const handleTripCompleted = (trip) => {
    setCompletedTrip(trip);
    setActiveTrip(null);
  };

  const handleLogout = async () => {
    try {
      if (user && cityKey) {
        await update(ref(db, `driversOnline/${cityKey}/${user.uid}`), { online: false, lastSeen: Date.now() });
      }
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
            <h2 className="nx-sheet-title">Loading driver map...</h2>
            <p className="nx-sheet-copy">Preparing the NEXRIDE request marketplace.</p>
          </ActionCard>
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell>
      <DriverMap mode={mode} city={cityKey} activeTrip={activeTrip} requests={visibleRequests} />

      <FloatingTopBar
        title="NEXRIDE DRIVER"
        subtitle={`${profile?.fullName || "Driver"} • ${cityLabel(cityKey)}`}
        right={<button onClick={handleLogout} className="nx-topbar-btn">Logout</button>}
      />

      <BottomSheet height={mode === "queue" ? "28vh" : "18vh"}>
        {error ? <div className="nx-alert-error">{error}</div> : null}
        {success ? <div className="nx-alert-success">{success}</div> : null}

        {(mode === "offline" || mode === "queue") && (
          <div className="nx-stack">
            <ActionCard className="nx-driver-command">
              <div>
                <div className="nx-eyebrow">Driver status</div>
                <h2 className="nx-sheet-title">{online ? "You are online" : "Go online to receive rides"}</h2>
                <p className="nx-sheet-copy">{profile?.carName || "Your car"} {profile?.plateNumber ? `• ${profile.plateNumber}` : ""}</p>
              </div>
              <div className={online ? "nx-online-pill on" : "nx-online-pill"}>{online ? "ONLINE" : "OFFLINE"}</div>
            </ActionCard>

            <PremiumButton onClick={toggleOnline} disabled={savingOnline} variant={online ? "secondary" : "primary"}>
              {savingOnline ? "Saving..." : online ? "Go offline" : "Go online"}
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
                <p className="nx-sheet-copy">Stay online. New requests will appear here and on your map.</p>
              </ActionCard>
            ) : (
              visibleRequests.map((item) => (
                <ActionCard key={item.id} className="nx-driver-request-card">
                  <div className="nx-offer-top">
                    <div className="nx-driver-avatar">${Number(item.offerPrice || 0).toFixed(0)}</div>
                    <div>
                      <h3 className="nx-card-title">{item.pickupName || "Pickup"} → {item.dropoffName || "Destination"}</h3>
                      <p className="nx-sheet-copy">{item.riderName || "Rider"} • {item.people || 1} passenger{Number(item.people || 1) === 1 ? "" : "s"}</p>
                    </div>
                    <div className="nx-status-pill">viewed</div>
                  </div>
                  <div className="nx-map-metrics nx-request-metrics">
                    <span>{item.distanceText || "Distance pending"}</span>
                    <span>{item.durationText || "ETA pending"}</span>
                    <span>{item.preferredPayment || "cash"}</span>
                    {item.mapsUrl ? (
                      <a href={item.mapsUrl} target="_blank" rel="noreferrer">Map</a>
                    ) : null}
                  </div>
                  {item.notes ? <p className="nx-offer-message">{item.notes}</p> : null}

                  {negotiatingFor?.id === item.id ? (
                    <div className="nx-stack">
                      <div className="nx-field-grid two">
                        <label className="nx-field">
                          <span>Your price</span>
                          <input className="nx-input" type="number" min="1" step="0.50" value={proposedPrice} onChange={(e) => setProposedPrice(e.target.value)} />
                        </label>
                        <label className="nx-field">
                          <span>Original</span>
                          <input className="nx-input" type="text" readOnly value={`$${money(item.offerPrice)}`} />
                        </label>
                      </div>
                      <textarea className="nx-input" rows={2} placeholder="Message to rider" value={proposedMessage} onChange={(e) => setProposedMessage(e.target.value)} />
                      <div className="nx-button-grid two">
                        <PremiumButton onClick={sendNegotiation} disabled={sendingOffer}>{sendingOffer ? "Sending..." : "Send offer"}</PremiumButton>
                        <PremiumButton variant="secondary" onClick={() => setNegotiatingFor(null)}>Cancel</PremiumButton>
                      </div>
                    </div>
                  ) : (
                    <div className="nx-button-grid two">
                      <PremiumButton onClick={() => acceptRequest(item)} disabled={workingRequestId === item.id}>{workingRequestId === item.id ? "Accepting..." : `Accept $${money(item.offerPrice)}`}</PremiumButton>
                      <PremiumButton variant="secondary" onClick={() => openNegotiate(item)}>Counter offer</PremiumButton>
                    </div>
                  )}
                </ActionCard>
              ))
            )}
          </div>
        )}

        {mode === "trip" && <DriverTripControls trip={activeTrip} onTripUpdated={handleTripUpdated} onTripCompleted={handleTripCompleted} />}

        {mode === "completed" && (
          <div className="nx-stack">
            <ActionCard className="nx-complete-card">
              <div className="nx-complete-icon">✓</div>
              <h2 className="nx-sheet-title">Trip completed</h2>
              <p className="nx-sheet-copy">You completed the ride. Go online again to receive more requests.</p>
            </ActionCard>
            <PremiumButton onClick={() => setCompletedTrip(null)}>Back to requests</PremiumButton>
          </div>
        )}
      </BottomSheet>
    </MobileShell>
  );
}
