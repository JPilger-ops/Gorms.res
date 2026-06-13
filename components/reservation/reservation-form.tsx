"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  createReservationRequestAction,
  type ReservationFormState,
} from "@/app/reservieren/actions";
import { FieldError, FormFeedback } from "@/components/ui/form-feedback";

const initialState: ReservationFormState = {};
const visibleDayCount = 14;

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

type SlotRangeResponse = {
  days: SlotResponse[];
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

function localIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDays(date: string, days: number) {
  const next = new Date(`${date}T00:00:00`);
  next.setDate(next.getDate() + days);
  return localIsoDate(next);
}

function formatDayParts(date: string) {
  const parsed = new Date(`${date}T00:00:00`);

  return {
    day: new Intl.DateTimeFormat("de-DE", { day: "2-digit" }).format(parsed),
    month: new Intl.DateTimeFormat("de-DE", { month: "short" }).format(parsed).replace(".", ""),
    weekday: new Intl.DateTimeFormat("de-DE", { weekday: "short" }).format(parsed).replace(".", ""),
  };
}

function daySummary(day?: SlotResponse) {
  if (!day) {
    return {
      availableCount: 0,
      detail: "Wird geprüft",
      firstAvailableTime: "",
      isBookable: false,
      isLimited: false,
      reason: "",
      statusLabel: "Prüfung",
    };
  }

  const selectableSlots = day.slots.filter((slot) => !slot.hardBlocked);
  const firstAvailableTime = selectableSlots[0]?.time ?? "";
  const isLimited = selectableSlots.some((slot) => slot.status !== "bookable");
  const reason =
    day.slots.find((slot) => slot.hardBlocked && slot.reasons.length > 0)?.reasons[0] ??
    "Keine Zeiten verfügbar";

  if (selectableSlots.length === 0) {
    return {
      availableCount: 0,
      detail: reason,
      firstAvailableTime: "",
      isBookable: false,
      isLimited: false,
      reason,
      statusLabel: "Gesperrt",
    };
  }

  return {
    availableCount: selectableSlots.length,
    detail: isLimited
      ? "Zeiten mit Prüfung"
      : `${selectableSlots.length} Zeiten frei${firstAvailableTime ? `, ab ${firstAvailableTime}` : ""}`,
    firstAvailableTime,
    isBookable: true,
    isLimited,
    reason: "",
    statusLabel: isLimited ? "Prüfung" : "Frei",
  };
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
  const today = useMemo(() => localIsoDate(new Date()), []);
  const [rangeStart, setRangeStart] = useState(today);
  const [date, setDate] = useState(today);
  const [guestCount, setGuestCount] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [slotDays, setSlotDays] = useState<SlotResponse[]>([]);
  const [slotError, setSlotError] = useState("");
  const [slotLoading, setSlotLoading] = useState(true);

  const dayMap = useMemo(() => new Map(slotDays.map((day) => [day.date, day])), [slotDays]);
  const visibleDates = useMemo(
    () => Array.from({ length: visibleDayCount }, (_, index) => addDays(rangeStart, index)),
    [rangeStart],
  );
  const selectedDay = dayMap.get(date);
  const slots = useMemo(() => selectedDay?.slots ?? [], [selectedDay]);
  const selectedSlot = useMemo(
    () => slots.find((slot) => slot.time === selectedTime),
    [selectedTime, slots],
  );
  const selectedDaySummary = daySummary(selectedDay);
  const nearestPreviousDate = useMemo(
    () =>
      [...slotDays]
        .filter((day) => day.date < date && daySummary(day).isBookable)
        .sort((first, second) => second.date.localeCompare(first.date))[0],
    [date, slotDays],
  );
  const nearestNextDate = useMemo(
    () =>
      [...slotDays]
        .filter((day) => day.date > date && daySummary(day).isBookable)
        .sort((first, second) => first.date.localeCompare(second.date))[0],
    [date, slotDays],
  );

  useEffect(() => {
    const abortController = new AbortController();
    const safeGuestCount = Math.max(1, Number.parseInt(guestCount, 10) || 1);
    const query = new URLSearchParams({
      date: rangeStart,
      days: String(visibleDayCount),
      guestCount: String(safeGuestCount),
    });

    fetch(`/api/reservation-slots?${query.toString()}`, {
      signal: abortController.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Slots unavailable");
        }

        return (await response.json()) as SlotRangeResponse;
      })
      .then((data) => {
        setSlotDays(data.days);
        setSelectedTime("");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setSlotDays([]);
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
  }, [guestCount, rangeStart]);

  const selectableSlots = slots.filter((slot) => !slot.hardBlocked);
  const blockedDateReason = slots.find((slot) => slot.hardBlocked && slot.reasons.length > 0)
    ?.reasons[0];

  function selectDate(nextDate: string) {
    setDate(nextDate);
    setSelectedTime("");
    setSlotError("");

    if (!visibleDates.includes(nextDate)) {
      setSlotLoading(true);
      setRangeStart(nextDate);
    }
  }

  function moveRange(days: number) {
    const nextStart = addDays(rangeStart, days) < today ? today : addDays(rangeStart, days);

    setSlotLoading(true);
    setSlotError("");
    setSelectedTime("");
    setDate(nextStart);
    setRangeStart(nextStart);
  }

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

      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <span className="text-sm font-semibold">Wunschtag</span>
            <p className="text-sm leading-6 text-muted">
              Freie Tage sind hell markiert. Gesperrte Tage zeigen direkt den Grund.
            </p>
          </div>
          <label className="block space-y-1 sm:w-48">
            <span className="text-xs font-bold uppercase text-muted">Direktdatum</span>
            <input
              className="glass-control min-h-11 w-full px-4 outline-none"
              name="date"
              value={date}
              onChange={(event) => selectDate(event.target.value)}
              min={today}
              type="date"
              required
            />
          </label>
        </div>

        <div className="flex gap-2">
          <button
            className="secondary-action min-h-10 px-4 text-sm"
            disabled={rangeStart <= today}
            type="button"
            onClick={() => moveRange(-7)}
          >
            Zurück
          </button>
          <button
            className="secondary-action min-h-10 px-4 text-sm"
            type="button"
            onClick={() => moveRange(7)}
          >
            Weitere Tage
          </button>
        </div>

        <div
          className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7"
          aria-label="Tagauswahl"
        >
          {visibleDates.map((visibleDate) => {
            const parts = formatDayParts(visibleDate);
            const summary = daySummary(dayMap.get(visibleDate));
            const isSelected = visibleDate === date;

            return (
              <button
                key={visibleDate}
                type="button"
                onClick={() => selectDate(visibleDate)}
                className={[
                  "glass-tile min-h-[132px] p-3 text-left transition duration-200",
                  "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_16px_34px_rgb(42_52_38_/_12%)]",
                  isSelected ? "border-primary/60 ring-2 ring-primary/20" : "",
                  summary.isBookable
                    ? "bg-[color-mix(in_srgb,var(--success),white_88%)]"
                    : "bg-[color-mix(in_srgb,var(--danger),white_92%)] opacity-85",
                ].join(" ")}
                aria-pressed={isSelected}
              >
                <span className="relative z-10 flex h-full flex-col justify-between gap-3">
                  <span>
                    <span className="block text-xs font-bold uppercase text-muted">
                      {parts.weekday}
                    </span>
                    <span className="mt-1 block text-2xl font-semibold leading-none">
                      {parts.day}
                    </span>
                    <span className="mt-1 block text-sm font-semibold text-muted">
                      {parts.month}
                    </span>
                  </span>
                  <span>
                    <span
                      className={[
                        "inline-flex rounded-full px-2.5 py-1 text-xs font-bold",
                        summary.isBookable
                          ? summary.isLimited
                            ? "bg-warning/15 text-warning"
                            : "bg-success/15 text-success"
                          : "bg-danger/15 text-danger",
                      ].join(" ")}
                    >
                      {slotLoading && !dayMap.get(visibleDate) ? "Prüfung" : summary.statusLabel}
                    </span>
                    <span className="mt-2 block text-xs font-semibold leading-5 text-muted">
                      {slotLoading && !dayMap.get(visibleDate)
                        ? "Verfügbarkeit wird geladen"
                        : summary.detail}
                    </span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <FieldError messages={state.fieldErrors?.date} />

        {!slotError && !slotLoading && selectedDay && !selectedDaySummary.isBookable ? (
          <div className="form-feedback form-feedback-error">
            <span className="form-feedback-dot" aria-hidden="true" />
            <div>
              <span className="form-feedback-label">Tag nicht verfügbar</span>
              <p>{blockedDateReason ?? selectedDaySummary.reason}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {nearestPreviousDate ? (
                  <button
                    className="secondary-action min-h-10 px-4 text-sm"
                    type="button"
                    onClick={() => selectDate(nearestPreviousDate.date)}
                  >
                    Vorher frei: {formatDayParts(nearestPreviousDate.date).weekday}.{" "}
                    {formatDayParts(nearestPreviousDate.date).day}.{" "}
                    {formatDayParts(nearestPreviousDate.date).month}
                  </button>
                ) : null}
                {nearestNextDate ? (
                  <button
                    className="secondary-action min-h-10 px-4 text-sm"
                    type="button"
                    onClick={() => selectDate(nearestNextDate.date)}
                  >
                    Danach frei: {formatDayParts(nearestNextDate.date).weekday}.{" "}
                    {formatDayParts(nearestNextDate.date).day}.{" "}
                    {formatDayParts(nearestNextDate.date).month}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(160px,0.6fr)]">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <span className="text-sm font-semibold">Uhrzeit</span>
              <p className="mt-1 text-sm leading-6 text-muted">
                Wählen Sie eine verfügbare Zeit für den markierten Tag.
              </p>
            </div>
            {selectedDaySummary.isBookable ? (
              <span className="rounded-full bg-success/15 px-3 py-1 text-xs font-bold text-success">
                {selectedDaySummary.availableCount} frei
              </span>
            ) : null}
          </div>

          {selectedTime ? <input name="time" type="hidden" value={selectedTime} /> : null}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {selectableSlots.map((slot) => {
              const isSelected = selectedTime === slot.time;

              return (
                <button
                  key={slot.time}
                  type="button"
                  onClick={() => setSelectedTime(slot.time)}
                  className={[
                    "glass-tile min-h-[78px] p-3 text-left transition duration-200",
                    "hover:-translate-y-0.5 hover:border-primary/40",
                    isSelected ? "border-primary/60 ring-2 ring-primary/20" : "",
                    slot.status === "bookable"
                      ? "bg-[color-mix(in_srgb,var(--success),white_90%)]"
                      : "bg-[color-mix(in_srgb,var(--warning),white_88%)]",
                  ].join(" ")}
                  aria-pressed={isSelected}
                >
                  <span className="relative z-10 block">
                    <span className="block text-xl font-semibold leading-none">{slot.label}</span>
                    <span className="mt-2 block text-xs font-bold text-muted">
                      {slotHint(slot)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <noscript>
            <div className="grid gap-3">
              <input
                className="glass-control min-h-12 w-full px-4 outline-none"
                name="time"
                type="time"
                min={earliestReservationTime}
                max={latestReservationTime}
                step="900"
                required
              />
            </div>
          </noscript>

          <FieldError messages={state.fieldErrors?.time} />
          {slotError ? <p className="text-sm leading-6 text-danger">{slotError}</p> : null}
          {!slotError && date && !slotLoading && selectedDay && selectableSlots.length === 0 ? (
            <p className="text-sm leading-6 text-danger">
              {blockedDateReason ?? "Für dieses Datum sind keine Reservierungsanfragen möglich."}
            </p>
          ) : null}
          {selectedSlot && selectedSlot.status !== "bookable" ? (
            <p className="text-sm leading-6 text-muted">
              Diese Zeit wird angenommen, aber intern besonders geprüft.
            </p>
          ) : null}
        </div>

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
