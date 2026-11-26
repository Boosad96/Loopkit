"use client";
import { useEffect, useState } from "react";

// Time-dependent status labels for the billing history page, which is a
// server component: calling Date.now() during its render is impure, so each
// label reads the clock in an effect (the same tick pattern as the countdown
// Timer) and shows the stored status until the first tick lands.
export function OrderStatus({
  status,
  createdAt,
}: {
  status: string;
  createdAt: string;
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
  }, []);
  return (
    <>
      {status === "pending" &&
      now !== null &&
      Date.parse(createdAt) + 900000 < now
        ? "Checkout closed"
        : status}
    </>
  );
}
export function SponsorshipStatus({
  status,
  holdUntil,
  endsAt,
}: {
  status: string;
  holdUntil: string;
  endsAt: string;
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
  }, []);
  return (
    <>
      {(status === "held" && now !== null && Date.parse(holdUntil) < now) ||
      (status === "confirmed" && now !== null && Date.parse(endsAt) <= now)
        ? "Expired"
        : status}
    </>
  );
}
