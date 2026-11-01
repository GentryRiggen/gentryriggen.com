"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchView, getCachedView } from "@/lib/jim/view";
import { onOpenIntent } from "@/lib/jim/openUrl";

/** The device's date as YYYY-MM-DD. */
function deviceToday(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

type GetToken = (force?: boolean) => Promise<string | null>;

export interface Reflection {
  /** Tonight's question while reflecting (a local bubble, never saved), else null. */
  question: string | null;
  /** What the next send carries: the question and the answer together. */
  wrap: (answer: string) => string;
  /** Back to an ordinary chat. */
  end: () => void;
  /** Reflect mode again with this question (a send that never ran). */
  resume: (question: string) => void;
}

/**
 * The evening reflection: `?reflect=1` shows tonight's question as a local
 * Jim bubble and the composer asks for "Your answer…". The next send goes
 * out as one message with the question in it, then reflect mode ends. With
 * no question to be had, nothing happens.
 */
export default function useReflection(
  getToken: GetToken,
  api: string
): Reflection {
  const [question, setQuestion] = useState<string | null>(null);
  const run = useRef(0);

  useEffect(() => {
    return onOpenIntent((intent) => {
      if (!intent.reflect) return;
      const mine = ++run.current;
      // Only a view from today may supply the question; yesterday's is fetched past.
      const view = getCachedView()?.data;
      const cached =
        view && view.today === deviceToday() ? view.reflection?.question : null;
      if (cached) {
        setQuestion(cached);
        return;
      }
      fetchView(getToken, undefined, api)
        .then((data) => {
          const asked = data.reflection?.question;
          if (asked && mine === run.current) setQuestion(asked);
        })
        .catch(() => {});
    });
  }, [getToken, api]);

  const wrap = useCallback(
    (answer: string) =>
      `Evening reflection. Q: ${question ?? ""}\nA: ${answer}`,
    [question]
  );
  const end = useCallback(() => {
    run.current += 1;
    setQuestion(null);
  }, []);
  const resume = useCallback((asked: string) => setQuestion(asked), []);

  return { question, wrap, end, resume };
}
