"use client";

import { useEffect, useState } from "react";

const storageKey = "heidekoenig_privacy_notice_acknowledged";

export function PrivacyNoticeBanner({ privacyUrl = "/datenschutz" }: { privacyUrl?: string }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setIsVisible(window.localStorage.getItem(storageKey) !== "true");
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  function acknowledge() {
    window.localStorage.setItem(storageKey, "true");
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
            Wir verwenden keine Analytics- oder Tracking-Cookies. Auf der öffentlichen Seite
            speichern wir nur diese Hinweis-Bestätigung lokal in Ihrem Browser.
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
