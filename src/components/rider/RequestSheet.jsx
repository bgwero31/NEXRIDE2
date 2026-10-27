/* =====================================================================
   PREMIUM REQUEST SHEET (v3) - UBER / INDRIVE STYLE
   ===================================================================== */

.nx-rs-v3 {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 2px;
}

/* 1. Route Box (Pickup & Dropoff) */
.nx-rs-v3-route-box {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  padding: 16px;
}

.nx-rs-v3-route-line {
  position: absolute;
  left: 21px;
  top: 44px;
  bottom: 44px;
  width: 2px;
  background: repeating-linear-gradient(
    to bottom,
    rgba(255, 255, 255, 0.2) 0,
    rgba(255, 255, 255, 0.2) 4px,
    transparent 4px,
    transparent 8px
  );
}

.nx-rs-v3-row {
  display: flex;
  align-items: center;
  gap: 12px;
  position: relative;
  z-index: 2;
}

.nx-rs-v3-input {
  flex: 1;
  background: transparent;
  border: none;
  color: #fff;
  font-weight: 600;
  outline: none;
}

.nx-rs-v3-input.pickup {
  font-size: 14px;
  color: var(--soft2);
}

.nx-rs-v3-input.dropoff {
  font-size: 22px;
  font-weight: 1000;
  letter-spacing: -0.04em;
  color: #fff;
}

.nx-rs-v3-input::placeholder {
  color: #7d90a9;
  font-weight: 500;
}

.nx-rs-v3-gps {
  width: 32px; height: 32px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.1);
  display: grid; place-items: center;
  border: none; cursor: pointer;
  transition: background 0.2s;
}
.nx-rs-v3-gps:active { background: rgba(255, 255, 255, 0.2); }

/* 2. Fare Box (inDrive Style) */
.nx-rs-v3-fare-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: linear-gradient(135deg, rgba(0, 102, 255, 0.1), rgba(0, 212, 255, 0.05));
  border: 1px solid rgba(0, 212, 255, 0.2);
  border-radius: 20px;
  padding: 20px;
}

.nx-rs-v3-fare-label {
  font-size: 11px;
  font-weight: 1000;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--cyan);
}

.nx-rs-v3-fare-controls {
  display: flex;
  align-items: center;
  gap: 20px;
}

.nx-rs-v3-step {
  width: 44px; height: 44px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 24px; font-weight: 600;
  cursor: pointer;
  display: grid; place-items: center;
}
.nx-rs-v3-step:active { background: rgba(255, 255, 255, 0.15); }

.nx-rs-v3-fare-display {
  font-size: 40px;
  font-weight: 1000;
  letter-spacing: -0.06em;
  color: #fff;
  min-width: 120px;
  text-align: center;
}

.nx-rs-v3-suggest {
  background: transparent;
  border: none;
  color: var(--cyan);
  font-size: 12px;
  font-weight: 800;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 999px;
}
.nx-rs-v3-suggest:active { background: rgba(0, 212, 255, 0.1); }

/* 3. Chips (Payment & Ride) */
.nx-rs-v3-chips-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nx-rs-v3-chips-scroll {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
  scrollbar-width: none; /* Hide scrollbar Firefox */
}
.nx-rs-v3-chips-scroll::-webkit-scrollbar { display: none; } /* Hide scrollbar Chrome */

.nx-rs-v3-chip {
  flex: 0 0 auto;
  padding: 10px 16px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: var(--soft2);
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  transition: all 0.2s ease;
}

.nx-rs-v3-chip.is-active {
  background: rgba(0, 212, 255, 0.15);
  border-color: rgba(0, 212, 255, 0.3);
  color: #fff;
  box-shadow: 0 4px 12px rgba(0, 212, 255, 0.15);
}

.nx-rs-v3-alert { margin: 0; }
