"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
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
    return "Rückfrage möglich";
  }

  if (slot.status === "capacity_warning") {
    return "Rückfrage möglich";
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

function shortUnavailableReason(reason: string) {
  const normalized = reason.toLowerCase();

  if (normalized.includes("sonntag")) {
    return "Keine Reservierungen möglich";
  }

  if (normalized.includes("montag")) {
    return "Montag geschlossen";
  }

  if (normalized.includes("dienstag")) {
    return "Dienstag geschlossen";
  }

  if (normalized.includes("feiertag")) {
    return "Keine Reservierungen möglich";
  }

  if (normalized.includes("voll")) {
    return "Heute voll";
  }

  if (
    normalized.includes("veranstaltung") ||
    normalized.includes("event") ||
    normalized.includes("musik")
  ) {
    return "Einfach vorbeikommen";
  }

  return "Nicht verfügbar";
}

function unavailableStatusLabel(reason: string) {
  const normalized = reason.toLowerCase();

  if (normalized.includes("sonntag") || normalized.includes("feiertag")) {
    return "Geöffnet";
  }

  return "Gesperrt";
}

function guestUnavailableMessage(reason?: string) {
  const fallback = "Für dieses Datum sind keine Reservierungsanfragen möglich.";

  if (!reason) {
    return fallback;
  }

  const normalized = reason.toLowerCase();

  if (normalized.includes("sonntag")) {
    return "Wir haben sonntags geöffnet, nehmen aber keine Reservierungen an. Kommen Sie gern einfach vorbei.";
  }

  if (normalized.includes("feiertag")) {
    return "Wir sind an Feiertagen geöffnet, nehmen aber keine Reservierungen an. Kommen Sie gern einfach vorbei.";
  }

  if (
    normalized.includes("veranstaltung") ||
    normalized.includes("event") ||
    normalized.includes("musik")
  ) {
    return "An Musik- und Eventabenden nehmen wir keine normalen Reservierungen an. Kommen Sie gern einfach vorbei.";
  }

  return reason;
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
      detail: shortUnavailableReason(reason),
      firstAvailableTime: "",
      isBookable: false,
      isLimited: false,
      reason,
      statusLabel: unavailableStatusLabel(reason),
    };
  }

  return {
    availableCount: selectableSlots.length,
    detail: isLimited ? "Rückfrage" : `ab ${firstAvailableTime}`,
    firstAvailableTime,
    isBookable: true,
    isLimited,
    reason: "",
    statusLabel: isLimited ? "Prüfung" : "Frei",
  };
}

function dayTileTone(summary: ReturnType<typeof daySummary>, isSelected: boolean) {
  if (isSelected) {
    return summary.isBookable
      ? "border-primary/70 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--primary),white_86%),color-mix(in_srgb,var(--success),white_90%))] ring-2 ring-primary/25 shadow-[0_18px_42px_color-mix(in_srgb,var(--primary),transparent_82%)]"
      : "border-danger/45 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--danger),white_88%),rgb(255_255_255_/_54%))] ring-2 ring-danger/15";
  }

  if (summary.isBookable) {
    return summary.isLimited
      ? "border-warning/20 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--warning),white_90%),rgb(255_255_255_/_52%))] hover:border-warning/40"
      : "border-success/15 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--success),white_91%),rgb(255_255_255_/_54%))] hover:border-success/35";
  }

  return "border-danger/10 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--danger),white_94%),rgb(255_255_255_/_58%))] opacity-90 hover:border-danger/25";
}

function statusPillTone(summary: ReturnType<typeof daySummary>, isSelected: boolean) {
  if (summary.isBookable) {
    if (summary.isLimited) {
      return isSelected ? "bg-warning/20 text-warning" : "bg-warning/13 text-warning";
    }

    return isSelected ? "bg-primary/15 text-primary" : "bg-success/13 text-success";
  }

  return isSelected ? "bg-danger/20 text-danger" : "bg-danger/13 text-danger";
}

function slotTileTone(slot: Slot, isSelected: boolean) {
  if (isSelected) {
    return "border-primary/70 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--primary),white_84%),color-mix(in_srgb,var(--success),white_91%))] ring-2 ring-primary/25 shadow-[0_16px_34px_color-mix(in_srgb,var(--primary),transparent_82%)]";
  }

  if (slot.status === "bookable") {
    return "border-success/15 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--success),white_93%),rgb(255_255_255_/_58%))] hover:border-success/35";
  }

  return "border-warning/20 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--warning),white_91%),rgb(255_255_255_/_54%))] hover:border-warning/40";
}

function SlotLoadingIndicator() {
  return (
    <div className="slot-loading-card" role="status" aria-live="polite">
      <span className="slot-loading-ring" aria-hidden="true" />
      <span>Uhrzeiten werden geprüft...</span>
    </div>
  );
}

export function ReservationForm({
  earliestReservationTime,
  imprintUrl,
  latestReservationTime,
  manualReviewGuestThreshold,
  maxGuestsPerRequest,
  privacyNoticeText,
  privacyPolicyUrl,
}: {
  earliestReservationTime: string;
  imprintUrl?: string;
  latestReservationTime: string;
  manualReviewGuestThreshold: number;
  maxGuestsPerRequest: number;
  privacyNoticeText: string;
  privacyPolicyUrl?: string;
}) {
  const [state, formAction, pending] = useActionState(createReservationRequestAction, initialState);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const today = useMemo(() => localIsoDate(new Date()), []);
  const [rangeStart, setRangeStart] = useState(today);
  const [date, setDate] = useState(today);
  const [guestCount, setGuestCount] = useState(() => String(Math.min(2, maxGuestsPerRequest)));
  const [selectedTime, setSelectedTime] = useState("");
  const [slotDays, setSlotDays] = useState<SlotResponse[]>([]);
  const [slotError, setSlotError] = useState("");
  const [slotLoading, setSlotLoading] = useState(true);
  const feedbackRef = useRef<HTMLDivElement>(null);

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
  const selectedDateParts = useMemo(() => formatDayParts(date), [date]);
  const guestCountNumber = Math.min(
    maxGuestsPerRequest,
    Math.max(1, Number.parseInt(guestCount, 10) || 1),
  );
  const depositApplies = guestCountNumber >= manualReviewGuestThreshold;
  const canSubmitReservation =
    Boolean(selectedTime) && selectedDaySummary.isBookable && !slotLoading && !slotError;
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

  useEffect(() => {
    if (!state.message) {
      return;
    }

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    feedbackRef.current?.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });
    feedbackRef.current?.focus({ preventScroll: true });
  }, [state.message]);

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

  function updateGuestCount(nextCount: number) {
    const clampedCount = Math.min(maxGuestsPerRequest, Math.max(1, nextCount));

    setGuestCount(String(clampedCount));
    setSlotError("");

    if (date) {
      setSlotLoading(true);
    }
  }

  function openDatePicker() {
    const input = dateInputRef.current;

    if (!input) {
      return;
    }

    input.focus();

    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }

    input.click();
  }

  return (
    <form action={formAction} className="glass-panel space-y-6 p-4 sm:p-8 xl:p-9">
      <div className="space-y-2">
        <p className="eyebrow">Reservierungsanfrage</p>
        <h2 className="text-2xl font-semibold leading-tight sm:text-3xl">Wunschzeit wählen</h2>
        <p className="text-sm leading-6 text-muted">
          Wählen Sie Datum, Uhrzeit und Personenzahl. Wir melden uns anschließend persönlich bei
          Ihnen.
        </p>
      </div>

      {state.message ? (
        <div ref={feedbackRef} tabIndex={-1} className="scroll-mt-6 outline-none">
          <FormFeedback state={state} />
        </div>
      ) : null}

      <input
        className="hidden"
        name="website"
        type="text"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />

      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <span className="text-sm font-semibold">Datum wählen</span>
            <p className="text-sm leading-6 text-muted">
              Wählen Sie einen grün markierten Tag. Gesperrte Tage können nicht angefragt werden.
            </p>
          </div>
          <div className="min-w-0">
            <button
              className="glass-tile flex min-h-16 min-w-[230px] items-center gap-3 px-3.5 py-3 text-left transition duration-200 hover:-translate-y-0.5 hover:border-primary/40 sm:min-w-[260px]"
              type="button"
              onClick={openDatePicker}
              aria-label={`Datum öffnen. Ausgewählt ist ${selectedDateParts.weekday}. ${selectedDateParts.day}. ${selectedDateParts.month}.`}
            >
              <span
                className="relative z-10 flex size-10 shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-white/65 text-center shadow-[inset_0_1px_0_rgb(255_255_255_/_72%)]"
                aria-hidden="true"
              >
                <span className="h-2.5 bg-primary/75" />
                <span className="flex flex-1 items-center justify-center text-base font-bold leading-none">
                  {selectedDateParts.day}
                </span>
              </span>
              <span className="relative z-10 min-w-0">
                <span className="block text-sm font-bold text-foreground">Datum öffnen</span>
                <span className="mt-0.5 block text-xs font-semibold text-muted">
                  {selectedDateParts.weekday}. {selectedDateParts.day}. {selectedDateParts.month}{" "}
                  auswählen
                </span>
              </span>
            </button>
            <input
              ref={dateInputRef}
              className="sr-only"
              value={date}
              onChange={(event) => selectDate(event.target.value)}
              min={today}
              type="date"
              aria-label="Datum im Kalender öffnen"
            />
            <input name="date" type="hidden" value={date} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className="secondary-action min-h-10 px-4 text-sm"
            disabled={rangeStart <= today}
            type="button"
            onClick={() => moveRange(-7)}
          >
            Frühere Tage
          </button>
          <button
            className="secondary-action min-h-10 px-4 text-sm"
            type="button"
            onClick={() => moveRange(7)}
          >
            Nächste Tage
          </button>
        </div>

        <div
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4"
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
                  "glass-tile group min-h-[154px] p-4 text-left transition duration-200",
                  "hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgb(42_52_38_/_12%)]",
                  dayTileTone(summary, isSelected),
                ].join(" ")}
                aria-pressed={isSelected}
              >
                <span className="relative z-10 flex h-full flex-col justify-between gap-3">
                  <span>
                    <span className="block text-xs font-bold uppercase text-muted">
                      {parts.weekday}
                    </span>
                    <span className="mt-1 block text-3xl font-semibold leading-none">
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
                        statusPillTone(summary, isSelected),
                      ].join(" ")}
                    >
                      {slotLoading && !dayMap.get(visibleDate) ? "Prüfung" : summary.statusLabel}
                    </span>
                    <span className="mt-3 block text-sm font-semibold leading-5 text-muted">
                      {slotLoading && !dayMap.get(visibleDate) ? "Wird geladen" : summary.detail}
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
            <span aria-hidden="true" className="form-feedback-icon">
              !
            </span>
            <div className="form-feedback-content">
              <span className="form-feedback-label">Tag nicht verfügbar</span>
              <span className="form-feedback-message">
                {guestUnavailableMessage(blockedDateReason ?? selectedDaySummary.reason)}
              </span>
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

      <div className="space-y-2">
        <span className="text-sm font-semibold">Personenzahl wählen</span>
        <div className="glass-tile grid min-h-[104px] gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
          <div className="relative z-10 min-w-0">
            <span className="block text-xs font-bold uppercase text-muted">Gäste</span>
            <span className="mt-1 block text-sm font-semibold text-muted">
              1 bis {maxGuestsPerRequest} Personen
            </span>
            <span
              className={[
                "mt-3 block rounded-2xl border px-3 py-2 text-sm font-bold leading-5",
                depositApplies
                  ? "border-warning/35 bg-warning/15 text-warning"
                  : "border-border bg-white/42 text-muted",
              ].join(" ")}
            >
              Ab {manualReviewGuestThreshold} Personen ist eine Anzahlung von 100 € notwendig.
            </span>
          </div>
          <div className="relative z-10 grid w-full grid-cols-[48px_minmax(72px,1fr)_48px] items-center gap-1 rounded-full border border-border bg-white/55 p-1.5 shadow-[inset_0_1px_0_rgb(255_255_255_/_72%)] sm:w-60">
            <button
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-transparent bg-white/60 text-2xl font-semibold leading-none text-foreground shadow-[0_6px_14px_rgb(42_52_38_/_7%),inset_0_1px_0_rgb(255_255_255_/_72%)] transition hover:-translate-y-0.5 hover:border-primary/30 hover:bg-[color-mix(in_srgb,var(--primary),white_84%)] disabled:cursor-not-allowed disabled:opacity-38 disabled:hover:translate-y-0"
              type="button"
              onClick={() => updateGuestCount(guestCountNumber - 1)}
              disabled={guestCountNumber <= 1}
              aria-label="Eine Person weniger"
            >
              -
            </button>
            <output
              className="flex h-12 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--primary),white_90%)] px-4 text-3xl font-semibold text-foreground shadow-[inset_0_1px_0_rgb(255_255_255_/_70%)]"
              aria-live="polite"
            >
              {guestCountNumber}
            </output>
            <button
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-transparent bg-white/60 text-2xl font-semibold leading-none text-foreground shadow-[0_6px_14px_rgb(42_52_38_/_7%),inset_0_1px_0_rgb(255_255_255_/_72%)] transition hover:-translate-y-0.5 hover:border-primary/30 hover:bg-[color-mix(in_srgb,var(--primary),white_84%)] disabled:cursor-not-allowed disabled:opacity-38 disabled:hover:translate-y-0"
              type="button"
              onClick={() => updateGuestCount(guestCountNumber + 1)}
              disabled={guestCountNumber >= maxGuestsPerRequest}
              aria-label="Eine Person mehr"
            >
              +
            </button>
          </div>
        </div>
        <input name="guestCount" type="hidden" value={guestCountNumber} />
        <FieldError messages={state.fieldErrors?.guestCount} />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="text-sm font-semibold">Uhrzeit wählen</span>
            <p className="mt-1 text-sm leading-6 text-muted">
              Wählen Sie eine verfügbare Uhrzeit für den markierten Tag.
            </p>
          </div>
          {selectedDaySummary.isBookable ? (
            <span className="rounded-full bg-success/15 px-3 py-1 text-xs font-bold text-success">
              {selectedDaySummary.availableCount} verfügbar
            </span>
          ) : null}
        </div>

        {selectedTime ? <input name="time" type="hidden" value={selectedTime} /> : null}

        {slotLoading ? <SlotLoadingIndicator /> : null}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {selectableSlots.map((slot) => {
            const isSelected = selectedTime === slot.time;

            return (
              <button
                key={slot.time}
                type="button"
                onClick={() => setSelectedTime(slot.time)}
                className={[
                  "glass-tile min-h-[92px] p-4 text-left transition duration-200",
                  "hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-55 disabled:hover:translate-y-0",
                  slotTileTone(slot, isSelected),
                ].join(" ")}
                aria-pressed={isSelected}
                disabled={slotLoading}
              >
                <span className="relative z-10 block">
                  <span className="block text-xl font-semibold leading-none">{slot.label}</span>
                  <span className="mt-2 block text-xs font-bold text-muted">{slotHint(slot)}</span>
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
            {guestUnavailableMessage(blockedDateReason ?? selectedDaySummary.reason)}
          </p>
        ) : null}
        {selectedSlot && selectedSlot.status !== "bookable" ? (
          <p className="text-sm leading-6 text-muted">
            Diese Uhrzeit nehmen wir als Anfrage an und prüfen sie intern besonders sorgfältig.
          </p>
        ) : null}
      </div>

      <div className="glass-tile space-y-4 p-4 sm:p-5">
        <div className="relative z-10 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <span className="text-sm font-semibold">Kontaktdaten</span>
            <p className="text-sm leading-6 text-muted">
              Diese Angaben brauchen wir, um Ihre Anfrage zu bearbeiten und Sie zu erreichen.
            </p>
          </div>
          <span className="w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
            Erforderlich
          </span>
        </div>

        <div className="relative z-10 grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-semibold">Name</span>
            <input
              className="field-input"
              name="guestName"
              type="text"
              autoComplete="name"
              placeholder="Vor- und Nachname"
              required
            />
            <FieldError messages={state.fieldErrors?.guestName} />
          </label>

          <label className="block space-y-2">
            <span className="text-sm font-semibold">E-Mail</span>
            <input
              className="field-input"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="name@example.de"
              required
            />
            <FieldError messages={state.fieldErrors?.email} />
          </label>
        </div>

        <label className="relative z-10 block space-y-2">
          <span className="text-sm font-semibold">Telefonnummer</span>
          <input
            className="field-input"
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder="Für Rückfragen"
            required
          />
          <FieldError messages={state.fieldErrors?.phone} />
        </label>

        <label className="relative z-10 block space-y-2">
          <span className="text-sm font-semibold">Nachricht optional</span>
          <textarea
            className="field-input min-h-32 resize-y py-3"
            name="message"
            maxLength={1000}
            placeholder="Besondere Wünsche oder Hinweise"
          />
          <FieldError messages={state.fieldErrors?.message} />
        </label>
      </div>

      <div className="space-y-3">
        <span className="text-sm font-semibold">Datenschutz</span>
        <label className="glass-tile group grid min-w-0 cursor-pointer gap-3 p-4 transition hover:-translate-y-0.5 hover:border-primary/35 sm:grid-cols-[auto_minmax(0,1fr)]">
          <input
            className="peer absolute inset-0 z-20 h-full w-full cursor-pointer opacity-0"
            name="privacyAccepted"
            type="checkbox"
            value="true"
            required
          />
          <span
            className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-white/65 text-sm font-bold text-transparent shadow-[inset_0_1px_0_rgb(255_255_255_/_72%)] transition peer-focus-visible:ring-4 peer-focus-visible:ring-focus/20 peer-checked:border-primary/40 peer-checked:bg-primary peer-checked:text-primary-foreground"
            aria-hidden="true"
          >
            ✓
          </span>
          <span className="relative z-10 min-w-0 text-sm leading-6">
            <span className="block font-bold text-foreground">
              Ich habe die Datenschutzhinweise gelesen und nehme die Verarbeitung meiner Angaben zur
              Bearbeitung der Anfrage zur Kenntnis.
            </span>
            <span className="mt-1 block text-muted">{privacyNoticeText}</span>
          </span>
        </label>
        {privacyPolicyUrl || imprintUrl ? (
          <p className="px-1 text-xs font-semibold leading-5 text-muted">
            {privacyPolicyUrl ? (
              <a className="underline underline-offset-4" href={privacyPolicyUrl}>
                Datenschutz
              </a>
            ) : null}
            {privacyPolicyUrl && imprintUrl ? <span aria-hidden="true"> · </span> : null}
            {imprintUrl ? (
              <a className="underline underline-offset-4" href={imprintUrl}>
                Impressum
              </a>
            ) : null}
          </p>
        ) : null}
        <FieldError messages={state.fieldErrors?.privacyAccepted} />
      </div>

      <div className="glass-tile space-y-4 p-4 sm:p-5">
        <div className="relative z-10 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <span className="text-sm font-semibold">Anfrage abschicken</span>
            <p className="text-sm leading-6 text-muted">
              Mit dem Absenden schicken Sie uns Ihre Anfrage. Eine Reservierung entsteht erst nach
              unserer persönlichen Zusage.
            </p>
          </div>
          <span className="w-fit shrink-0 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold leading-none text-primary">
            Anfrage
          </span>
        </div>

        <button
          className="primary-action relative z-10 w-full"
          disabled={pending || !canSubmitReservation}
          aria-busy={pending}
          type="submit"
        >
          {pending
            ? "Anfrage wird gesendet..."
            : canSubmitReservation
              ? "Anfrage absenden"
              : "Datum und Uhrzeit wählen"}
        </button>

        <p className="relative z-10 text-center text-xs font-semibold leading-5 text-muted">
          Verbindlich wird die Reservierung erst durch unsere persönliche Zusage.
        </p>
      </div>
    </form>
  );
}
