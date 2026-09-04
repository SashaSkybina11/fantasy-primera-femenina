const madrid = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

// Convert wall-clock time using the IANA timezone database (including DST).
export function madridInstant(year: number, month: number, day: number, hour: number, minute = 0, second = 0) {
  const wall = Date.UTC(year, month, day, hour, minute, second);
  let instant = wall;
  for (let pass = 0; pass < 3; pass++) {
    const parts = Object.fromEntries(madrid.formatToParts(new Date(instant)).map(p => [p.type, p.value]));
    const rendered = Date.UTC(+parts.year!, +parts.month! - 1, +parts.day!, +parts.hour!, +parts.minute!, +parts.second!);
    instant += wall - rendered;
  }
  return new Date(instant);
}

export function marketDatesForWeek(date: Date) {
  const parts = Object.fromEntries(madrid.formatToParts(date).map(p => [p.type, p.value]));
  const day = new Date(Date.UTC(+parts.year!, +parts.month! - 1, +parts.day!));
  day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
  const at = (offset: number, hour: number, minute = 0, second = 0) => madridInstant(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() + offset, hour, minute, second);
  return { marketOpenAt: at(1, 10), deadlineAt: at(4, 12), endsAt: at(6, 23, 59, 59) };
}
