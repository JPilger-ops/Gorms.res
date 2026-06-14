"use client";

import { useEffect, useState } from "react";

const storageKey = "heidekoenig_privacy_notice_acknowledged";
const acknowledgementTtlMs = 180 * 24 * 60 * 60 * 1000;

function isAcknowledgementValid(value: string | null) {
  if (!value) {
    return false;
  }

  if (value === "true") {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ acknowledgedAt: new Date().toISOString() }),
    );
    return true;
  }

  try {
    const parsed = JSON.parse(value) as { acknowledgedAt?: string };
    const acknowledgedAt = parsed.acknowledgedAt ? Date.parse(parsed.acknowledgedAt) : Number.NaN;
    const isFresh =
      Number.isFinite(acknowledgedAt) && Date.now() - acknowledgedAt < acknowledgementTtlMs;

    if (!isFresh) {
      window.localStorage.removeItem(storageKey);
    }

    return isFresh;
  } catch {
    window.localStorage.removeItem(storageKey);
    return false;
  }
}

export function PrivacyNoticeBanner({ privacyUrl = "/datenschutz" }: { privacyUrl?: string }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setIsVisible(!isAcknowledgementValid(window.localStorage.getItem(storageKey)));
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  function acknowledge() {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ acknowledgedAt: new Date().toISOString() }),
    );
    setIsVisible(false);
  }

  if (!isVisible) {
    return null;
  }

  return (
    <aside className="privacy-banner" aria-label="Datenschutz und Cookies">
      <div className="privacy-banner-content">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-bold text-foreground">Datenschutz & Cookies</p>
          <p className="text-sm leading-6 text-muted">
            Keine Analytics, kein Tracking. Wir speichern nur diese Bestätigung lokal in Ihrem
            Browser und fragen sie nach 180 Tagen erneut ab.
          </p>
          <a
            className="text-sm font-bold text-primary underline underline-offset-4"
            href={privacyUrl}
          >
            Datenschutz ansehen
          </a>
        </div>
        <button
          className="primary-action shrink-0 px-5 py-3 text-sm"
          type="button"
          onClick={acknowledge}
        >
          Verstanden
        </button>
      </div>
    </aside>
  );
}
