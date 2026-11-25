"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Product } from "@/lib/billing/contracts";
type Options = {
  key: string;
  name: string;
  currency: string;
  amount: number;
  order_id?: string;
  subscription_id?: string;
  handler: (result: {
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => void;
  modal: { ondismiss: () => void };
};
declare global {
  interface Window {
    Razorpay?: new (options: Options) => { open: () => void };
  }
}
let loading: Promise<void> | undefined;
function loadCheckout() {
  if (window.Razorpay) return Promise.resolve();
  return (loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => {
      loading = undefined;
      script.remove();
      reject(new Error("Checkout could not load."));
    };
    document.head.append(script);
  }));
}
type Props = {
  product: Product;
  configured: boolean;
  amount: number;
  currency: string;
  signedIn: boolean;
  listings?: { id: string; name: string }[];
  dateWindow?: { first: string; last: string };
  brand: string;
};
export default function Checkout({
  product,
  configured,
  amount,
  currency,
  signedIn,
  listings = [],
  dateWindow,
  brand,
}: Props) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [listing, setListing] = useState(listings[0]?.id ?? ""),
    [start, setStart] = useState("");
  const requestKey = useRef("");
  useEffect(() => {
    requestKey.current = crypto.randomUUID();
  }, [product, listing, start]);
  if (!configured)
    return (
      <p className="bill-note">
        Test checkout is awaiting merchant configuration.
      </p>
    );
  if (!signedIn)
    return (
      <Link className="bill-button" href="/login">
        Sign in for test checkout
      </Link>
    );
  if (product !== "pro" && !listings.length)
    return (
      <Link className="bill-button" href="/submit">
        Submit a community for approval
      </Link>
    );
  async function buy(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await loadCheckout();
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          requestId: requestKey.current,
          amount,
          currency,
          product,
          ...(product === "pro" ? {} : { listing, start }),
        }),
      });
      const order = await res.json();
      if (!res.ok) throw new Error(order.error);
      const Popup = window.Razorpay;
      if (!Popup) throw new Error("Checkout could not load.");
      new Popup({
        key: order.key,
        name: brand,
        currency: order.currency,
        amount: order.amount,
        ...(product === "pro"
          ? { subscription_id: order.providerId }
          : { order_id: order.providerId }),
        modal: { ondismiss: () => setBusy(false) },
        handler: async (result) => {
          try {
            const verified = await fetch("/api/billing/verify", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                order: order.order,
                payment: result.razorpay_payment_id,
                signature: result.razorpay_signature,
              }),
            });
            const receipt = await verified.json();
            setMessage(receipt.message ?? receipt.error);
          } catch {
            setMessage("Check your billing history for this payment.");
          } finally {
            setBusy(false);
          }
        },
      }).open();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to open checkout.",
      );
      setBusy(false);
    }
  }
  return (
    <form className="bill-form" onSubmit={buy}>
      {product !== "pro" && (
        <>
          <label>
            Approved community
            <select
              value={listing}
              onChange={(e) => setListing(e.target.value)}
            >
              {listings.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Start date (UTC)
            <input
              required
              type="date"
              min={dateWindow?.first}
              max={dateWindow?.last}
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
        </>
      )}
      <button className="bill-button" disabled={busy}>
        {busy ? "Opening checkout…" : "Open test checkout"}
      </button>
      <div role="status">{message}</div>
    </form>
  );
}
export function CancelRenewal() {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div>
      <button
        className="bill-button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const res = await fetch("/api/billing/cancel", { method: "POST" });
            const body = await res.json();
            setMessage(body.message ?? body.error);
            if (!res.ok) setBusy(false);
          } catch {
            setMessage("Could not confirm cancellation.");
            setBusy(false);
          }
        }}
      >
        Cancel next renewal
      </button>
      <p role="status">{message}</p>
    </div>
  );
}
