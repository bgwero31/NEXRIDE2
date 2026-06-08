// File: src/lib/nexrideVoice.js

"use client";

const VOICE_KEY = "nexride_voice_guidance_enabled";
const LAST_STAGE_KEY = "nexride_last_spoken_stage";

function isBrowser() {
  return typeof window !== "undefined";
}

export function voiceAvailable() {
  if (!isBrowser()) return false;
  return typeof window.nexrideSpeak === "function" || ("speechSynthesis" in window && "SpeechSynthesisUtterance" in window);
}

export function isNexrideVoiceEnabled() {
  if (!isBrowser()) return false;
  return window.localStorage.getItem(VOICE_KEY) !== "off";
}

export function setNexrideVoiceEnabled(enabled = true) {
  if (!isBrowser()) return;
  window.localStorage.setItem(VOICE_KEY, enabled ? "on" : "off");
}

function preferredVoice() {
  if (!voiceAvailable()) return null;
  const voices = window.speechSynthesis.getVoices?.() || [];
  return (
    voices.find((voice) => /english|en-/i.test(`${voice.name} ${voice.lang}`) && /female|google|microsoft|natural/i.test(voice.name)) ||
    voices.find((voice) => /english|en-/i.test(`${voice.name} ${voice.lang}`)) ||
    voices[0] ||
    null
  );
}

export function speakNexride(message, { interrupt = true, force = false } = {}) {
  if (!message || !voiceAvailable()) return false;
  if (!force && !isNexrideVoiceEnabled()) return false;

  try {
    if (typeof window.nexrideSpeak === "function") {
      window.nexrideSpeak(message);
      return true;
    }
  } catch (error) {
    console.warn("NEXRIDE native voice helper failed", error);
  }

  try {
    if (interrupt) window.speechSynthesis.cancel();
    const utterance = new window.SpeechSynthesisUtterance(message);
    utterance.lang = "en-US";
    utterance.rate = 0.92;
    utterance.pitch = 1.02;
    utterance.volume = 1;
    const voice = preferredVoice();
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
    return true;
  } catch (error) {
    console.warn("NEXRIDE voice failed", error);
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
  if (voiceAvailable()) window.speechSynthesis.cancel();
}

export function nexrideStageMessage(status, role = "rider", trip = {}) {
  const driverName = trip?.driverName || "your driver";
  const riderName = trip?.riderName || "your rider";
  const destination = trip?.dropoffName || "your destination";
  const pickup = trip?.pickupName || "the pickup point";

  if (role === "driver") {
    if (status === "accepted") return `Ride accepted. Head to ${pickup}. NEXRIDE is following your live route.`;
    if (status === "arrived") return `You have arrived. Ask ${riderName} for the pickup OTP.`;
    if (status === "picked") return `OTP verified. Trip started. The route will now switch to ${destination}.`;
    if (status === "enroute") return `Route started. Drive safely to ${destination}. NEXRIDE is following the destination route.`;
    if (status === "completed") return "Trip completed. Thank you for driving with NEXRIDE.";
    if (status === "request_viewed") return "Ride request opened. You can accept or send your offer.";
    if (status === "offer_sent") return "Offer sent. Waiting for the rider to choose.";
  }

  if (status === "request_created") return "Your NEXRIDE request is live. Nearby drivers can now view and send offers.";
  if (status === "request_viewed") return `${driverName} viewed your ride request.`;
  if (status === "offer_received") return `${driverName} sent you an offer. Open offers to choose your driver.`;
  if (status === "accepted") return `${driverName} accepted your ride. NEXRIDE is tracking the driver to pickup.`;
  if (status === "arrived") return `${driverName} has arrived. Please check the car and share your pickup OTP when you enter.`;
  if (status === "picked") return "Pickup confirmed. Your NEXRIDE trip has started.";
  if (status === "enroute") return `You are on the way to ${destination}. NEXRIDE is following the live route.`;
  if (status === "completed") return "Trip completed. Thank you for using NEXRIDE.";

  return "NEXRIDE trip update received.";
}

export function speakNexrideStage(status, role = "rider", trip = {}, options = {}) {
  const tripId = trip?.tripId || trip?.id || "trip";
  const key = `${role}:${tripId}:${status}`;
  if (!options.force && isBrowser() && window.sessionStorage.getItem(LAST_STAGE_KEY) === key) return false;
  const spoke = speakNexride(nexrideStageMessage(status, role, trip), options);
  if (spoke && isBrowser()) window.sessionStorage.setItem(LAST_STAGE_KEY, key);
  return spoke;
}
