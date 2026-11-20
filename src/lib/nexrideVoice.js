// File: src/lib/nexrideVoice.js
/**
 * NEXRIDE voice guidance.
 *
 * Two backends, auto-detected:
 *   1. Native bridge — `window.nexrideSpeak(message)` (Android/iOS wrapper)
 *   2. Web Speech API — `window.speechSynthesis` (browser)
 *
 * All functions are SSR-safe. None throw into the caller.
 */

/* ------------------------------ Constants ----------------------------- */

const VOICE_KEY = "nexride_voice_guidance_enabled";
const LAST_STAGE_KEY = "nexride_last_spoken_stage";

// Chromium requires voices to load before we can pick a preferred one.
// We listen once and cache.
let cachedPreferredVoice = null;
let voicesLoaded = false;

/* ------------------------------- Guards ------------------------------- */

function isBrowser() {
  return typeof window !== "undefined";
}

function hasNativeBridge() {
  return isBrowser() && typeof window.nexrideSpeak === "function";
}

function hasWebSpeech() {
  return (
    isBrowser() &&
    "speechSynthesis" in window &&
    "SpeechSynthesisUtterance" in window
  );
}

/* ------------------------------ Public API ---------------------------- */

export function voiceAvailable() {
  return hasNativeBridge() || hasWebSpeech();
}

export function isNexrideVoiceEnabled() {
  if (!isBrowser()) return false;
  try {
    return window.localStorage.getItem(VOICE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setNexrideVoiceEnabled(enabled = true) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(VOICE_KEY, enabled ? "on" : "off");
  } catch {}
}

/* ------------------------- Voice selection ---------------------------- */

/**
 * Score a voice by name+lang. Higher is better.
 * We prefer natural-sounding English voices.
 */
function scoreVoice(voice) {
  const name = String(voice?.name || "");
  const lang = String(voice?.lang || "");
  const combined = `${name} ${lang}`;

  if (!/english|^en-/i.test(combined)) return -1;

  let score = 1;
  if (/natural/i.test(name)) score += 5;
  if (/google/i.test(name)) score += 4;
  if (/microsoft/i.test(name)) score += 3;
  if (/female/i.test(name)) score += 2;
  // Common premium iOS/macOS names
  if (/samantha|karen|daniel|moira|tessa|serena|alex/i.test(name)) score += 4;
  // Prefer en-US / en-GB
  if (/en-US|en-GB/i.test(lang)) score += 2;
  return score;
}

function pickPreferredVoice() {
  if (!hasWebSpeech()) return null;

  try {
    const voices = window.speechSynthesis.getVoices?.() || [];
    if (!voices.length) return null;

    let best = null;
    let bestScore = -1;
    for (const v of voices) {
      const s = scoreVoice(v);
      if (s > bestScore) {
        bestScore = s;
        best = v;
      }
    }
    return bestScore > 0 ? best : voices[0] || null;
  } catch {
    return null;
  }
}

/**
 * Cache the preferred voice. Chromium loads voices async, so we also
 * subscribe to `voiceschanged` to refresh when they arrive.
 */
function ensureVoicesLoaded() {
  if (!hasWebSpeech() || voicesLoaded) return;

  try {
    window.speechSynthesis.onvoiceschanged = () => {
      cachedPreferredVoice = pickPreferredVoice();
      voicesLoaded = true;
    };

    const initial = window.speechSynthesis.getVoices?.() || [];
    if (initial.length) {
      cachedPreferredVoice = pickPreferredVoice();
      voicesLoaded = true;
    }
  } catch {}
}

/* -------------------------- Core speak -------------------------------- */

/**
 * Speak a message.
 * @param {string} message
 * @param {{ interrupt?: boolean, force?: boolean }} [opts]
 * @returns {boolean} true if a backend accepted the request.
 */
export function speakNexride(message, { interrupt = true, force = false } = {}) {
  if (!message || !voiceAvailable()) return false;
  if (!force && !isNexrideVoiceEnabled()) return false;

  // 1) Native bridge — highest priority.
  if (hasNativeBridge()) {
    try {
      const result = window.nexrideSpeak(message);
      // Support both sync and async native implementations.
      if (result && typeof result.then === "function") {
        result.catch(() => {});
      }
      return true;
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[nexrideVoice] native bridge failed:", error);
      }
      // fall through to Web Speech
    }
  }

  // 2) Web Speech API.
  if (!hasWebSpeech()) return false;

  try {
    if (interrupt) window.speechSynthesis.cancel();

    const utterance = new window.SpeechSynthesisUtterance(String(message));
    utterance.lang = "en-US";
    utterance.rate = 0.94;
    utterance.pitch = 1.02;
    utterance.volume = 1;

    ensureVoicesLoaded();
    const voice = cachedPreferredVoice || pickPreferredVoice();
    if (voice) utterance.voice = voice;

    window.speechSynthesis.speak(utterance);
    return true;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[nexrideVoice] speak failed:", error);
    }
    return false;
  }
}

export function unlockNexrideVoice(role = "rider") {
  setNexrideVoiceEnabled(true);
  return speakNexride(
    role === "driver"
      ? "NEXRIDE driver voice guidance is on. I will announce every trip step."
      : "NEXRIDE voice guidance is on. I will announce your ride updates.",
    { force: true }
  );
}

export function muteNexrideVoice() {
  setNexrideVoiceEnabled(false);
  if (hasWebSpeech()) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }
}

/* ------------------------- Message templates -------------------------- */

export function nexrideStageMessage(status, role = "rider", trip = {}) {
  const driverName = trip?.driverName || "your driver";
  const riderName = trip?.riderName || "your rider";
  const destination = trip?.dropoffName || "your destination";
  const pickup = trip?.pickupName || "the pickup point";

  if (role === "driver") {
    if (status === "accepted")
      return `Ride accepted. Head to ${pickup}. NEXRIDE is following your live route.`;
    if (status === "arrived")
      return `You have arrived. Ask ${riderName} for the pickup OTP.`;
    if (status === "picked")
      return `OTP verified. Trip started. The route will now switch to ${destination}.`;
    if (status === "enroute")
      return `Route started. Drive safely to ${destination}. NEXRIDE is following the destination route.`;
    if (status === "completed")
      return "Trip completed. Thank you for driving with NEXRIDE.";
    if (status === "request_viewed")
      return "Ride request opened. You can accept or send your offer.";
    if (status === "offer_sent")
      return "Offer sent. Waiting for the rider to choose.";
  }

  if (status === "request_created")
    return "Your NEXRIDE request is live. Nearby drivers can now view and send offers.";
  if (status === "request_viewed") return `${driverName} viewed your ride request.`;
  if (status === "offer_received")
    return `${driverName} sent you an offer. Open offers to choose your driver.`;
  if (status === "accepted")
    return `${driverName} accepted your ride. NEXRIDE is tracking the driver to pickup.`;
  if (status === "arrived")
    return `${driverName} has arrived. Please check the car and share your pickup OTP when you enter.`;
  if (status === "picked")
    return "Pickup confirmed. Your NEXRIDE trip has started.";
  if (status === "enroute")
    return `You are on the way to ${destination}. NEXRIDE is following the live route.`;
  if (status === "completed") return "Trip completed. Thank you for using NEXRIDE.";

  return "NEXRIDE trip update received.";
}

/* -------------------- Stage wrapper (with dedupe) --------------------- */

export function speakNexrideStage(status, role = "rider", trip = {}, options = {}) {
  const tripId = trip?.tripId || trip?.id || "trip";
  const key = `${role}:${tripId}:${status}`;

  // Skip if the same stage was already spoken this session, unless forced.
  if (!options.force && isBrowser()) {
    try {
      if (window.sessionStorage.getItem(LAST_STAGE_KEY) === key) return false;
    } catch {}
  }

  const spoke = speakNexride(nexrideStageMessage(status, role, trip), options);

  if (spoke && isBrowser()) {
    try {
      window.sessionStorage.setItem(LAST_STAGE_KEY, key);
    } catch {}
  }
  return spoke;
    }
