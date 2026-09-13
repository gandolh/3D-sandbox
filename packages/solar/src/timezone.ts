/**
 * Resolving a local wall-clock time in an IANA zone to a UTC instant.
 *
 * A scene document stores what an architect would write — "21 June 2026, 17:42,
 * Europe/Bucharest" — not an instant. Turning that into a sun position needs the
 * zone's offset *at that moment*, which changes across a DST boundary, so the
 * offset cannot be looked up once and reused.
 */

/** The zone's offset from UTC at a given instant, in milliseconds. */
export function zoneOffsetMs(instant: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts: Record<string, string> = {};
  for (const part of formatter.formatToParts(instant)) {
    if (part.type !== "literal") parts[part.type] = part.value;
  }

  const asIfUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour) % 24,
    Number(parts.minute),
    Number(parts.second),
  );
  return asIfUtc - instant.getTime();
}

/**
 * `2026-06-21` + `17:42` + `Europe/Bucharest` → the UTC instant.
 *
 * Two passes: guess the offset by reading the naive time as if it were UTC, then
 * re-read it at the corrected instant. The second pass is what makes a time that
 * sits near a DST transition resolve correctly rather than an hour out.
 */
export function localToUtc(date: string, time: string, timeZone: string): Date {
  const naive = new Date(`${date}T${time}:00Z`);
  if (Number.isNaN(naive.getTime())) {
    throw new Error(`Invalid date/time: "${date}T${time}"`);
  }

  const firstGuess = new Date(naive.getTime() - zoneOffsetMs(naive, timeZone));
  const corrected = new Date(naive.getTime() - zoneOffsetMs(firstGuess, timeZone));
  return corrected;
}

/** An instant back to its wall-clock `HH:MM` in a zone — for timeline labels. */
export function utcToLocalClock(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).format(instant);
}
