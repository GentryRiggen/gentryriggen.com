/**
 * The chat kept on this device, so a reload (or iOS dropping the page in
 * the background) doesn't lose the conversation. One entry per signed-in
 * user, `jim:chat:<uid>`, wiped on sign-out.
 */

export interface ChatMessage {
  id: number;
  from: "me" | "jim";
  text: string;
  /** Files the reply saved, repo-relative. */
  changed?: string[];
  /** Sent, but no clear answer came back: Jim may have acted on it. */
  uncertain?: boolean;
  /** Waiting on Jim right now. Never stored as such. */
  pending?: boolean;
}

export interface ChatHistory {
  session: string;
  messages: ChatMessage[];
}

export const HISTORY_LIMIT = 100;

const PREFIX = "jim:chat:";

export function historyKey(uid: string): string {
  return `${PREFIX}${uid}`;
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isMessage(value: unknown): value is ChatMessage {
  if (typeof value !== "object" || value === null) return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m.id === "number" &&
    (m.from === "me" || m.from === "jim") &&
    typeof m.text === "string" &&
    (m.changed === undefined ||
      (Array.isArray(m.changed) &&
        m.changed.every((f) => typeof f === "string")))
  );
}

/**
 * What gets written: the last HISTORY_LIMIT messages, with nothing left
 * waiting. A message still out comes back as uncertain (the page can't know
 * whether Jim got it); a reply that never started is dropped.
 */
function settled(messages: ChatMessage[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const m of messages) {
    if (!m.pending) {
      out.push(m);
    } else if (m.from === "me" || m.text) {
      const stored: ChatMessage = { ...m, uncertain: true };
      delete stored.pending;
      out.push(stored);
    }
  }
  return out.slice(-HISTORY_LIMIT);
}

export function loadHistory(uid: string): ChatHistory | null {
  let raw: string | null;
  try {
    raw = storage()?.getItem(historyKey(uid)) ?? null;
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (typeof value?.session !== "string" || !value.session) return null;
    const messages = Array.isArray(value.messages)
      ? value.messages.filter(isMessage)
      : [];
    return { session: value.session, messages: settled(messages) };
  } catch {
    return null;
  }
}

export function saveHistory(uid: string, history: ChatHistory): void {
  try {
    storage()?.setItem(
      historyKey(uid),
      JSON.stringify({
        session: history.session,
        messages: settled(history.messages),
      })
    );
  } catch {
    // Full or blocked: the chat still works, it just won't survive a reload.
  }
}

/** Wipes this user's chat, or with no uid every chat kept on the device. */
export function clearHistory(uid?: string): void {
  const store = storage();
  if (!store) return;
  try {
    if (uid !== undefined) {
      store.removeItem(historyKey(uid));
      return;
    }
    const keys: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key?.startsWith(PREFIX)) keys.push(key);
    }
    keys.forEach((key) => store.removeItem(key));
  } catch {
    // Blocked storage holds nothing to wipe.
  }
}
