"use client";

import { useState } from "react";
import PremiumButton from "../ui/PremiumButton";

export default function PickupEditor({ onSave, point, onClearPoint, onEditingChange }) {
  const [editing, setEditing] = useState(false);
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (!editing) {
    return <PremiumButton variant="ghost" onClick={() => { setEditing(true); onEditingChange(true); }}>Edit pickup</PremiumButton>;
  }

  async function submit(event) {
    event.preventDefault();
    const pickup = point || address.trim();
    if (saving || !pickup) return;
    setSaving(true);
    setError("");
    try {
      await onSave(pickup);
      onEditingChange(false);
      setEditing(false);
      setAddress("");
    } catch (err) {
      setError(err.message || "Could not update pickup.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="nx-stack" onSubmit={submit}>
      <label className="nx-sheet-copy">
        New pickup address or tap the map
        <input className="nx-rs-input" value={point ? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}` : address} maxLength={180}
          onChange={(event) => { onClearPoint(); setAddress(event.target.value); }} disabled={saving} />
      </label>
      <p className="nx-sheet-copy">Drivers will need to send new offers for the updated pickup.</p>
      {error && <p role="alert">{error}</p>}
      <div className="nx-button-grid two">
        <PremiumButton type="button" variant="ghost" disabled={saving} onClick={() => { setEditing(false); onEditingChange(false); }}>Back</PremiumButton>
        <PremiumButton type="submit" disabled={saving || (!point && !address.trim())}>{saving ? "Updating…" : "Update pickup"}</PremiumButton>
      </div>
    </form>
  );
}
