// File: src/lib/nexrideNative.js
/**
 * NEXRIDE native bridge + browser fallback.
 *
 * Provides:
 *   - getNexrideLocation(opts)     → one-shot location (native or browser)
 *   - watchNexrideLocation(cb,err) → live location stream, returns stop()
 *   - nexrideDeviceNotify(t,b,d)   → local notification (native → Web API)
 *
 * All functions are SSR-safe. None throw into the caller.
 */

/* ------------------------------ Helpers ------------------------------- */

const isBrowser = typeof window !== "undefined";

/** Max acceptable accuracy (meters) for "strong" GPS. */
const STRONG_ACCURACY_M = 1000;

/**
 * Validate a GPS point shape.
 * Note: (0,0) is technically valid coords — but not in Zimbabwe.
 * We accept it if the caller explicitly allows weak points.
 */
function isValidPoint(p) {
  if (!p) return false;
  const lat = Number(p.lat);
  const lng = Number(p.lng);
  return Number.isFinite(lat) && Number.isFinite(lng);
}

function isStrongPoint(p) {
  return isValidPoint(p) && Number(p.accuracy ?? 9999) <= STRONG_ACCURACY_M;
}

/**
 * Normalize a browser GeolocationPosition into our point shape.
 */
function pointFromPosition(pos, source = "browser") {
  const c = pos?.coords;
  if (!c) return null;
  const point = {
    lat: Number(c.latitude),
    lng: Number(c.longitude),
    accuracy: Number(c.accuracy ?? 9999),
    heading: typeof c.heading === "number" ? c.heading : null,
    speed: typeof c.speed === "number" ? c.speed : null,
    source,
    updatedAt: Date.now(),
  };
  return isValidPoint(point) ? point : null;
}

/**
 * Wrap a promise with a hard timeout. Returns null on timeout.
 */
function withTimeout(promise, ms, onTimeout) {
  return new Promise((resolve) => {
    let done = false;
    const t = setTimeout(() => {
      if (done) return;
      done = true;
      onTimeout?.();
      resolve(null);
    }, ms);
    Promise.resolve(promise)
      .then((v) => {
        if (done) return;
        done = true;
        clearTimeout(t);
        resolve(v);
      })
      .catch(() => {
        if (done) return;
        done = true;
        clearTimeout(t);
        resolve(null);
      });
  });
}

/* --------------------------- Browser location ------------------------- */

function browserLocationOnce(options = {}) {
  return new Promise((resolve) => {
    if (!isBrowser || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pointFromPosition(pos, "browser")),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000, ...options }
    );
  });
}

/* ------------------------------- Public API --------------------------- */

/**
 * Get a one-shot location, preferring native if available.
 * @param {{ allowWeak?: boolean, timeoutMs?: number }} [opts]
 * @returns {Promise<null | { lat:number, lng:number, accuracy:number, source:string, updatedAt:number }>}
 */
export async function getNexrideLocation({ allowWeak = true, timeoutMs = 8000 } = {}) {
  // 1) Native bridge
  if (isBrowser && typeof window.nexrideGetLocation === "function") {
    const native = await withTimeout(
      Promise.resolve().then(() => window.nexrideGetLocation()),
      timeoutMs,
      () => {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[nexrideNative] native location timed out");
        }
      }
    );
    if (isValidPoint(native) && (allowWeak || isStrongPoint(native))) return native;
  }

  // 2) Browser fallback
  const fallback = await browserLocationOnce();
  if (isValidPoint(fallback) && (allowWeak || isStrongPoint(fallback))) return fallback;

  return null;
}

/**
 * Watch location, preferring native if available.
 * @param {(point:object)=>void} callback
 * @param {(err:any)=>void} [onError]
 * @param {PositionOptions} [options]
 * @returns {() => void} stop function (always safe to call)
 */
export function watchNexrideLocation(callback, onError, options = {}) {
  let stopped = false;
  let cleanup = null;

  async function start() {
    if (stopped) return;

    // 1) Native bridge
    if (isBrowser && typeof window.nexrideWatchLocation === "function") {
      try {
        const maybeCleanup = await window.nexrideWatchLocation(
          (point) => {
            if (stopped) return;
            if (isValidPoint(point)) callback?.(point);
          },
          (err) => !stopped && onError?.(err)
        );
        if (typeof maybeCleanup === "function") {
          cleanup = maybeCleanup;
          return;
        }
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[nexrideNative] native watch failed, using browser:", err?.message || err);
        }
      }
    }

    // 2) Browser fallback
    if (isBrowser && navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (stopped) return;
          const point = pointFromPosition(pos, "browser");
          if (point) callback?.(point);
        },
        (err) => !stopped && onError?.(err),
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000, ...options }
      );
      cleanup = () => navigator.geolocation.clearWatch(watchId);
    }
  }

  start();

  return () => {
    stopped = true;
    try {
      if (typeof cleanup === "function") cleanup();
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[nexrideNative] cleanup failed:", err?.message || err);
      }
    }
  };
}

/**
 * Trigger a local device notification.
 * Falls back to the Web Notifications API if native bridge is absent.
 * @returns {Promise<boolean>} true if delivered via any channel.
 */
export async function nexrideDeviceNotify(title, body, data = {}) {
  // 1) Native bridge
  if (isBrowser && typeof window.nexrideLocalNotify === "function") {
    try {
      const ok = await window.nexrideLocalNotify({ title, body, data });
      if (ok) return true;
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[nexrideNative] native notify failed:", err?.message || err);
      }
    }
  }

  // 2) Web Notifications fallback
  if (isBrowser && "Notification" in window) {
    try {
      if (Notification.permission === "granted") {
        new Notification(title, { body, data });
        return true;
      }
      if (Notification.permission !== "denied") {
        const perm = await Notification.requestPermission();
        if (perm === "granted") {
          new Notification(title, { body, data });
          return true;
        }
      }
    } catch {
      // ignore
    }
  }

  return false;
}
