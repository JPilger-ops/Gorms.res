"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  createReservationRequestAction,
  type ReservationFormState,
} from "@/app/reservieren/actions";
import { FieldError, FormFeedback } from "@/components/ui/form-feedback";

const initialState: ReservationFormState = {};

type Slot = {
  hardBlocked: boolean;
  label: string;
  manualReviewReasons: string[];
  reasons: string[];
  status: "bookable" | "manual_review" | "capacity_warning" | "blocked";
  time: string;
  warnings: string[];
};

type SlotResponse = {
  date: string;
  latestReservationTime: string;
  season: "summer" | "winter";
  slots: Slot[];
};

function slotHint(slot: Slot) {
  if (slot.hardBlocked) {
    return slot.reasons[0] ?? "Nicht verfügbar";
  }

  if (slot.status === "manual_review") {
    return "Manuelle Prüfung";
  }

  if (slot.status === "capacity_warning") {
    return "Prüfung erforderlich";
  }

  return "Verfügbar";
}

export function ReservationForm({
  earliestReservationTime,
  imprintUrl,
  latestReservationTime,
  maxGuestsPerRequest,
  privacyNoticeText,
  privacyPolicyUrl,
}: {
  earliestReservationTime: string;
  imprintUrl?: string;
  latestReservationTime: string;
  maxGuestsPerRequest: number;
  privacyNoticeText: string;
  privacyPolicyUrl?: string;
}) {
  const [state, formAction, pending] = useActionState(createReservationRequestAction, initialState);
  const [date, setDate] = useState("");
  const [guestCount, setGuestCount] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotError, setSlotError] = useState("");
  const [slotLoading, setSlotLoading] = useState(false);

  const selectedSlot = useMemo(
    () => slots.find((slot) => slot.time === selectedTime),
    [selectedTime, slots],
  );

  useEffect(() => {
    if (!date) {
      return;
    }

    const abortController = new AbortController();
    const safeGuestCount = Math.max(1, Number.parseInt(guestCount, 10) || 1);
    const query = new URLSearchParams({
      date,
      guestCount: String(safeGuestCount),
    });

    fetch(`/api/reservation-slots?${query.toString()}`, {
      signal: abortController.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Slots unavailable");
        }

        return (await response.json()) as SlotResponse;
      })
      .then((data) => {
        setSlots(data.slots);
        setSelectedTime((currentTime) =>
          data.slots.some((slot) => slot.time === currentTime && !slot.hardBlocked)
            ? currentTime
            : "",
        );
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setSlots([]);
        setSelectedTime("");
        setSlotError("Zeiten konnten nicht geladen werden. Bitte versuchen Sie es erneut.");
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setSlotLoading(false);
        }
      });

    return () => {
      abortController.abort();
    };
  }, [date, guestCount]);

  const selectableSlots = slots.filter((slot) => !slot.hardBlocked);
  const blockedDateReason = slots.find((slot) => slot.hardBlocked && slot.reasons.length > 0)
    ?.reasons[0];

  return (
    <form action={formAction} className="glass-panel space-y-5 p-4 sm:p-7">
      <div className="space-y-2">
        <p className="eyebrow">Reservierungsanfrage</p>
        <h2 className="text-2xl font-semibold leading-tight sm:text-3xl">
          Außengastronomie anfragen
        </h2>
        <p className="text-sm leading-6 text-muted">
          Bitte beachten: Dies ist noch keine Reservierungsbestätigung.
        </p>
      </div>

      <FormFeedback state={state} />

      <input
        className="hidden"
        name="website"
        type="text"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block space-y-2">
          <span className="text-sm font-semibold">Datum</span>
          <input
            className="glass-control min-h-12 w-full px-4 outline-none"
            name="date"
            onChange={(event) => {
              const nextDate = event.target.value;

              setDate(nextDate);
              setSelectedTime("");
              setSlots([]);
              setSlotError("");
              setSlotLoading(Boolean(nextDate));
            }}
            type="date"
            required
          />
          <FieldError messages={state.fieldErrors?.date} />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold">Uhrzeit</span>
          <select
            className="glass-control min-h-12 w-full px-4 outline-none"
            name="time"
            value={selectedTime}
            onChange={(event) => setSelectedTime(event.target.value)}
            disabled={!date || slotLoading || Boolean(slotError) || selectableSlots.length === 0}
            required
          >
            <option value="">
              {!date
                ? "Erst Datum wählen"
                : slotLoading
                  ? "Zeiten werden geladen..."
                  : selectableSlots.length === 0
                    ? "Keine Zeiten verfügbar"
                    : "Uhrzeit wählen"}
            </option>
            {selectableSlots.map((slot) => (
              <option key={slot.time} value={slot.time}>
                {slot.label} · {slotHint(slot)}
              </option>
            ))}
          </select>
          <noscript>
            <input
              className="glass-control mt-3 min-h-12 w-full px-4 outline-none"
              name="time"
              type="time"
              min={earliestReservationTime}
              max={latestReservationTime}
              step="900"
              required
            />
          </noscript>
          <FieldError messages={state.fieldErrors?.time} />
          {slotError ? <p className="text-sm leading-6 text-danger">{slotError}</p> : null}
          {!slotError &&
          date &&
          !slotLoading &&
          slots.length > 0 &&
          selectableSlots.length === 0 ? (
            <p className="text-sm leading-6 text-danger">
              {blockedDateReason ?? "Für dieses Datum sind keine Reservierungsanfragen möglich."}
            </p>
          ) : null}
          {selectedSlot && selectedSlot.status !== "bookable" ? (
            <p className="text-sm leading-6 text-muted">
              Diese Zeit wird angenommen, aber intern besonders geprüft.
            </p>
          ) : null}
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold">Personen</span>
          <input
            className="glass-control min-h-12 w-full px-4 outline-none"
            name="guestCount"
            type="number"
            min="1"
            max={maxGuestsPerRequest}
            inputMode="numeric"
            onChange={(event) => {
              setGuestCount(event.target.value);
              setSlotError("");

              if (date) {
                setSlotLoading(true);
              }
            }}
            required
          />
          <FieldError messages={state.fieldErrors?.guestCount} />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm font-semibold">Name</span>
          <input
            className="glass-control min-h-12 w-full px-4 outline-none"
            name="guestName"
            type="text"
            autoComplete="name"
            required
          />
          <FieldError messages={state.fieldErrors?.guestName} />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-semibold">E-Mail</span>
          <input
            className="glass-control min-h-12 w-full px-4 outline-none"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
          <FieldError messages={state.fieldErrors?.email} />
        </label>
      </div>

      <label className="block space-y-2">
        <span className="text-sm font-semibold">Telefonnummer</span>
        <input
          className="glass-control min-h-12 w-full px-4 outline-none"
          name="phone"
          type="tel"
          autoComplete="tel"
          required
        />
        <FieldError messages={state.fieldErrors?.phone} />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-semibold">Nachricht optional</span>
        <textarea
          className="glass-control min-h-28 w-full resize-y px-4 py-3 outline-none"
          name="message"
          maxLength={1000}
        />
        <FieldError messages={state.fieldErrors?.message} />
      </label>

      <label className="glass-tile flex min-w-0 items-start gap-3 p-4">
        <input
          className="mt-1 size-4 shrink-0 accent-primary"
          name="privacyAccepted"
          type="checkbox"
          value="true"
          required
        />
        <span className="min-w-0 text-sm leading-6">
          Ich habe den Datenschutzhinweis zur Verarbeitung meiner Angaben für die Bearbeitung der
          Reservierungsanfrage zur Kenntnis genommen. {privacyNoticeText}
          {privacyPolicyUrl ? (
            <>
              {" "}
              <a className="font-semibold underline underline-offset-4" href={privacyPolicyUrl}>
                Datenschutz
              </a>
            </>
          ) : null}
          {imprintUrl ? (
            <>
              {" "}
              <a className="font-semibold underline underline-offset-4" href={imprintUrl}>
                Impressum
              </a>
            </>
          ) : null}
        </span>
      </label>
      <FieldError messages={state.fieldErrors?.privacyAccepted} />

      <button
        className="primary-action w-full"
        disabled={pending}
        aria-busy={pending}
        type="submit"
      >
        {pending ? "Anfrage wird geprüft..." : "Anfrage senden"}
      </button>
    </form>
  );
}
