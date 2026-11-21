"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import styles from "./operations.module.css";

const tabs = [
  ["overview", "Overview"], ["review", "Driver approvals"], ["drivers", "Drivers"],
  ["riders", "Riders"], ["request", "Pending requests"], ["active", "Active rides"],
  ["completed", "Completed rides"], ["cancelled", "Cancelled rides"],
];
const initialData = { people: [], reviews: [], rides: [] };
const cityName = (value) => value ? value.replaceAll("-", " ") : "—";
const dateFormat = new Intl.DateTimeFormat("en-ZW", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Harare" });
const date = (value) => value && Number.isFinite(new Date(value).getTime()) ? dateFormat.format(new Date(value)) : "—";

export default function AdminPage() {
  const [account, setAccount] = useState(undefined);
  const [data, setData] = useState(initialData);
  const [tab, setTab] = useState("overview");
  const [city, setCity] = useState("");
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [accessError, setAccessError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);

  useEffect(() => onAuthStateChanged(auth, (user) => {
    setData(initialData);
    setLoaded(false);
    setAccessError(false);
    setError("");
    setAccount(user);
  }), []);

  useEffect(() => {
    if (!account) return;
    let disposed = false;
    let running = false;
    async function refresh() {
      if (running) return;
      running = true;
      try {
        const token = await account.getIdToken();
        const response = await fetch("/api/admin", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
        const result = await response.json();
        if (disposed) return;
        if (!response.ok) {
          setAccessError(true);
          setData(initialData);
          setError(result.error);
        } else {
          setData(result);
          setAccessError(false);
          setError("");
        }
      } catch {
        if (!disposed) setError("Could not reach the dashboard. It will retry automatically.");
      } finally {
        running = false;
        if (!disposed) setLoaded(true);
      }
    }
    void refresh();
    const timer = window.setInterval(refresh, 15000);
    return () => { disposed = true; window.clearInterval(timer); };
  }, [account]);

  const cities = useMemo(() => [...new Set([...data.people, ...data.rides, ...data.reviews].map((item) => item.city).filter(Boolean))].sort(), [data]);
  const inCity = (item) => !city || item.city === city;
  const people = data.people.filter(inCity);
  const reviews = data.reviews.filter(inCity);
  const rides = data.rides.filter(inCity);
  const counts = {
    review: reviews.filter((item) => item.status === "pending").length,
    drivers: people.filter((item) => item.role === "driver").length,
    riders: people.filter((item) => item.role === "rider").length,
    request: rides.filter((item) => item.group === "request" && item.status !== "cancelled").length,
    active: rides.filter((item) => item.group === "active").length,
    completed: rides.filter((item) => item.group === "completed").length,
    cancelled: rides.filter((item) => item.group === "cancelled" || (item.group === "request" && item.status === "cancelled")).length,
  };
  const attention = counts.review + counts.request;
  const online = people.filter((item) => item.role === "driver" && item.online).length;
  const search = query.trim().toLowerCase();
  const matches = (item) => !search || Object.values(item).some((value) => typeof value === "string" && value.toLowerCase().includes(search));
  const shownPeople = people.filter((item) => item.role === (tab === "drivers" ? "driver" : "rider") && matches(item));
  const shownRides = rides.filter((item) => (tab === "overview" || (tab === "cancelled"
    ? item.group === "cancelled" || (item.group === "request" && item.status === "cancelled")
    : item.group === tab && item.status !== "cancelled")) && matches(item));
  const shownReviews = reviews.filter(matches);

  function navigate(next) {
    setTab(next);
    setQuery("");
    setMenu(false);
  }

  async function applyAction() {
    setBusy(true);
    setError("");
    try {
      const token = await account.getIdToken();
      const response = await fetch("/api/admin", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(confirm.request),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      const change = confirm.request;
      setData((current) => change.action === "review" ? {
        ...current,
        reviews: current.reviews.map((item) => item.id === change.id ? { ...item, status: change.decision } : item),
        people: current.people.map((item) => item.id === change.id ? { ...item, verification: change.decision } : item),
      } : {
        ...current,
        rides: current.rides.filter((item) => !(item.id === change.id && item.group === change.group && item.city === change.city)),
      });
      setConfirm(null);
    } catch (failure) {
      setError(failure.message || "The change failed.");
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  }

  const available = Boolean(account && loaded && !accessError);
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <a href="/admin" className={styles.brand}><span className={styles.mark}>N</span><span>NEXRIDE<small>Operations</small></span></a>
        {available && <button type="button" className={styles.menuToggle} aria-label="Toggle navigation" aria-expanded={menu} aria-controls="ops-navigation" onClick={() => setMenu(!menu)}>
          <span aria-hidden="true">{menu ? "×" : "☰"}</span>{attention > 0 && <b>{attention}</b>}
        </button>}
      </header>

      {available && <nav id="ops-navigation" aria-label="Operations" className={`${styles.nav} ${menu ? styles.open : ""}`}>
        {tabs.map(([id, label]) => <button key={id} type="button" aria-current={tab === id ? "page" : undefined} onClick={() => navigate(id)}>
          {label}{counts[id] !== undefined && <span>{counts[id]}</span>}
        </button>)}
        <button type="button" onClick={() => signOut(auth).catch(() => setError("Sign-out failed."))}>Sign out</button>
      </nav>}

      <main className={styles.main}>
        <div className={styles.heading}>
          <h1>{tabs.find(([id]) => id === tab)?.[1]}</h1>
          {available && <label className={styles.filter}>City
            <select value={city} onChange={(event) => setCity(event.target.value)}>
              <option value="">All cities</option>
              {cities.map((name) => <option key={name} value={name}>{cityName(name)}</option>)}
            </select>
          </label>}
        </div>

        {error && <p className={styles.error} role="alert">{error}</p>}
        {account === undefined || (account && !loaded) ? <p role="status">Loading dashboard…</p> : null}
        {account === null && <a href="/login" className={styles.primary}>Sign in</a>}
        {account && accessError && <button type="button" onClick={() => signOut(auth).catch(() => setError("Sign-out failed."))}>Switch account</button>}
        {available && <>
          {tab === "overview" ? <>
            <div className={styles.metrics}>
              {tabs.slice(1).map(([id, label]) => <button key={id} onClick={() => navigate(id)}>
                <span>{label}</span><strong>{counts[id]}</strong>
                {id === "drivers" && <small>{online} online</small>}
              </button>)}
            </div>
            <h2>Recent rides</h2>
          </> : <input aria-label="Search records" className={styles.search} placeholder="Search records" value={query} onChange={(event) => setQuery(event.target.value)} />}

          {tab === "review" ? <div className={styles.list}>
            {shownReviews.length === 0 && <p>No driver applications found.</p>}
            {shownReviews.map((item) => <article className={styles.record} key={item.id}>
              <div><h3>{item.name || "Driver"}</h3><p>{[cityName(item.city), item.car, item.plate].filter(Boolean).join(" · ")}</p><p>{item.phone || "—"} · {date(item.time)}</p></div>
              <span className={styles.status}>{item.status}</span>
              <div className={styles.documents}>{item.documents.map(({ name, url }) => <a key={name} href={url} target="_blank" rel="noreferrer">{name}</a>)}</div>
              {item.status === "pending" && <div className={styles.actions}>
                {["approved", "rejected"].map((decision) => <button key={decision} disabled={decision === "approved" && item.documents.length !== 4} onClick={() => setConfirm({
                  request: { action: "review", id: item.id, decision },
                  label: decision === "approved" ? "Approve application" : "Reject application", name: item.name,
                })}>{decision === "approved" ? "Approve" : "Reject"}</button>)}
              </div>}
            </article>)}
          </div> : tab === "drivers" || tab === "riders" ? <div className={styles.list}>
            {shownPeople.length === 0 && <p>No accounts found.</p>}
            {shownPeople.map((item) => <article className={styles.record} key={item.id}>
              <div><h3>{item.name || "Unnamed account"}</h3><p>{[cityName(item.city), item.phone, item.car, item.plate].filter(Boolean).join(" · ")}</p></div>
              {item.role === "driver" && <span className={styles.status}>{item.online ? "Online" : "Offline"} · {item.verification || "No review"}</span>}
            </article>)}
          </div> : <div className={styles.list}>
            {shownRides.length === 0 && <p>No rides found.</p>}
            {(tab === "overview" ? shownRides.slice(0, 6) : shownRides).map((item) => <article className={styles.record} key={`${item.group}-${item.city}-${item.id}`}>
              <div><h3>{item.pickup || "Pickup"} → {item.dropoff || "Drop-off"}</h3>
                <p>{[cityName(item.city), item.rider, item.driver, date(item.time)].filter(Boolean).join(" · ")}</p>
                {item.fare != null && <p>${Number(item.fare).toFixed(2)}</p>}
              </div>
              <span className={styles.status}>{item.status}</span>
              {tab !== "overview" && item.group !== "active" && <div className={styles.actions}><button onClick={() => setConfirm({
                request: { action: "delete", id: item.id, group: item.group, city: item.city },
                label: "Delete ride record", name: [item.pickup, item.dropoff].filter(Boolean).join(" → "),
              })}>Delete</button></div>}
            </article>)}
          </div>}
        </>}

        {confirm && <div className={styles.confirm} role="alertdialog" aria-modal="true" aria-labelledby="confirm-operation">
          <div><h2 id="confirm-operation">{confirm.label}?</h2><p>{confirm.name || "Selected record"}</p>
            {confirm.request.action === "delete" && <p>This permanently removes the record.</p>}
            <div className={styles.actions}>
              <button type="button" disabled={busy} onClick={() => setConfirm(null)}>Cancel</button>
              <button type="button" disabled={busy} className={styles.primary} onClick={applyAction}>{busy ? "Saving…" : "Confirm"}</button>
            </div>
          </div>
        </div>}
      </main>
    </div>
  );
}
