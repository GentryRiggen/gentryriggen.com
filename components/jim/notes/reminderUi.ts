import { JimError } from "@/lib/jim/api";

const pad = (n: number) => String(n).padStart(2, "0");

/** A datetime-local value ("YYYY-MM-DDTHH:MM") from a device-local Date. */
export function toLocalInput(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** An hour from now, rounded up to the next quarter hour. */
export function defaultAt(now: Date = new Date()): string {
  const d = new Date(now.getTime() + 60 * 60 * 1000);
  d.setSeconds(0, 0);
  const rest = d.getMinutes() % 15;
  if (rest) d.setMinutes(d.getMinutes() + 15 - rest);
  return toLocalInput(d);
}

/** What to tell the person when a reminders call fails. */
export function reminderError(err: unknown, fallback: string): string {
  if (err instanceof JimError) {
    return err.kind === "server"
      ? "Jim can't reach your reminders right now. Try again in a minute."
      : fallback;
  }
  return err instanceof Error && err.message ? err.message : fallback;
}
