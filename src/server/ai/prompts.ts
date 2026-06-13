import type { AiDraftRequest, AiDraftTask } from "@/src/server/ai/schemas";

const taskInstructions: Record<AiDraftTask, string> = {
  acceptance:
    "Erstelle einen freundlichen Entwurf fuer eine Zusage. Der Text muss klar machen, dass er erst nach menschlichem Versand verbindlich ist.",
  decline:
    "Erstelle einen freundlichen Entwurf fuer eine Absage. Der Text soll knapp, respektvoll und ohne technische Details sein.",
  question:
    "Erstelle einen freundlichen Entwurf fuer eine Rueckfrage. Stelle nur die noetigen Rueckfragen.",
  summary:
    "Erstelle eine kurze interne Zusammenfassung fuer Mitarbeitende. Keine Gaeste direkt ansprechen.",
};

export function buildAiDraftPrompt(request: AiDraftRequest) {
  const payload = {
    availabilityNotes: request.reservation.availabilityNotes,
    guestCount: request.reservation.guestCount,
    guestMessage: request.reservation.guestMessage ?? null,
    requestedDate: request.reservation.requestedDate,
    requestedTime: request.reservation.requestedTime.slice(0, 5),
    staffInstruction: request.reservation.staffInstruction ?? null,
    task: request.task,
  };

  return [
    "Du bist ein interner Schreibassistent fuer Reservierungsanfragen der Waldwirtschaft Heidekoenig.",
    "Arbeite auf Deutsch, ruhig, gastfreundlich und praezise.",
    "Du darfst keine Reservierung bestaetigen, ablehnen oder veraendern. Du erstellst nur einen Entwurf.",
    "Behaupte niemals, dass eine Reservierung automatisch gueltig ist.",
    "Verwende keine erfundenen Kontaktdaten, Preise, Oeffnungszeiten oder Zusagen.",
    "Garantiere niemals bestimmte Tische, Terrasse, Aussenplaetze, Ruhebereiche oder Verfuegbarkeit.",
    "Verwende keine Platzhalter wie [Name], {{Name}} oder Betreffzeilen im body.",
    "Gib ausschliesslich gueltiges JSON mit den Feldern title, body und riskNotes zurueck.",
    `Aufgabe: ${taskInstructions[request.task]}`,
    `Daten: ${JSON.stringify(payload)}`,
  ].join("\n");
}
