"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import MobileShell from "@/components/ui/MobileShell";
import NexrideBrand from "@/components/ui/NexrideBrand";
import PremiumButton from "@/components/ui/PremiumButton";

export default function DeleteAccountPage() {
  const [user, setUser] = useState(undefined);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  useEffect(() => onAuthStateChanged(auth, (account) => {
    setUser(account);
    setConfirmed(false);
    setSent(false);
    setMessage("");
  }), []);

  async function submit(event) {
    event.preventDefault();
    if (!user || !confirmed || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/account-deletion", {
        method: "POST",
        headers: { Authorization: `Bearer ${await user.getIdToken()}` },
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setSent(true);
      setMessage("Request received. NEXRIDE support will review it and contact you at your account email.");
    } catch (error) {
      setMessage(error.message || "The request could not be saved. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return <MobileShell decorators={false}>
    <main className="nx-page-pad nx-school-page">
      <NexrideBrand size="small" />
      <section className="nx-school-hero nx-glass-panel compact">
        <h1>Delete your NEXRIDE account</h1>
        <p>Request deletion of your account and associated personal data. Support reviews the request before deletion. Complete any active ride before submitting.</p>
      </section>
      {user === undefined && <p role="status">Checking sign-in…</p>}
      {user === null && <p>To make a request, <a href="/login?next=/delete-account">sign in to NEXRIDE</a> with the account you want deleted.</p>}
      {user && !sent && <form className="nx-card-pro nx-stack" onSubmit={submit}>
        <p>Requesting deletion for {user.email || "your signed-in account"}.</p>
        <label><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> I want to delete this account and its associated data.</label>
        <PremiumButton type="submit" disabled={!confirmed || busy} loading={busy}>Submit deletion request</PremiumButton>
      </form>}
      {message && <p role="status">{message}</p>}
    </main>
  </MobileShell>;
}
