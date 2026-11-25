"use client";

import { useEffect, useState } from "react";
import { auth } from "../../lib/firebase";

export default function DriverVerificationBadge({ driverId }) {
  const [verifiedId, setVerifiedId] = useState(null);

  useEffect(() => {
    if (!driverId || !auth.currentUser) return;
    const controller = new AbortController();

    async function checkApproval() {
      const token = await auth.currentUser.getIdToken();
      const params = new URLSearchParams({ driverId });
      const result = await fetch(`/api/driver-verification?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      if (result.ok) {
        const { verified } = await result.json();
        if (!controller.signal.aborted) setVerifiedId(verified ? driverId : null);
      }
    }

    checkApproval().catch(() => {});
    return () => controller.abort();
  }, [driverId]);

  return driverId && verifiedId === driverId
    ? <span className="nx-offer-tag nx-offer-tag-top">Verified driver</span>
    : null;
}
