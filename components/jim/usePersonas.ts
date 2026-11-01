"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { JimMenuItem } from "@/components/jim/JimHeader";
import { JimError } from "@/lib/jim/api";
import {
  activeFirst,
  fetchPersonas,
  loadPersonaName,
  PERSONA_MESSAGES,
  savePersonaName,
  switchPersona,
  type PersonaList,
} from "@/lib/jim/personas";

type GetToken = (force?: boolean) => Promise<string | null>;

/** The list is kept for the visit; older than this, opening fetches again. */
export const PERSONAS_FRESH_MS = 5 * 60_000;

export interface Personas {
  open: boolean;
  list: PersonaList | null;
  loading: boolean;
  loadError: string | null;
  /** The persona being switched to, if any. */
  pending: string | null;
  /** Why a switch failed, by persona. */
  rowErrors: Record<string, string>;
  /** The active persona's name, if known (for the menu, the lock screen). */
  activeName: string | null;
  /** Said once a switch lands, for screen readers. */
  announcement: string;
  choose: (id: string) => void;
  reload: () => void;
  close: () => void;
  menuItem: JimMenuItem;
}

/**
 * The persona switcher's state: the list (fetched only when the sheet
 * opens, kept for the visit, fetched again when older than 5 minutes),
 * the switch with its pending row and errors, and the "Persona: Vega" menu
 * entry. The last active name is remembered on this device so the menu
 * can say it before anything loads.
 */
export default function usePersonas(getToken: GetToken, api: string): Personas {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<PersonaList | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [activeName, setActiveName] = useState(loadPersonaName);
  const [announcement, setAnnouncement] = useState("");
  const fetchedAt = useRef(0);
  /** Bumped by every load: an older one landing late is dropped. */
  const loadRun = useRef(0);
  const mounted = useRef(true);
  /** The list as last set, for a switch that lands later. */
  const listRef = useRef<PersonaList | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const remember = useCallback((next: PersonaList) => {
    const name = next.personas.find((p) => p.id === next.active)?.name;
    if (name) {
      setActiveName(name);
      savePersonaName(name);
    }
  }, []);

  const load = useCallback(() => {
    const run = ++loadRun.current;
    setLoading(true);
    setLoadError(null);
    fetchPersonas(getToken, api)
      .then((fresh) => {
        if (!mounted.current || run !== loadRun.current) return;
        fetchedAt.current = Date.now();
        listRef.current = fresh;
        setList(fresh);
        remember(fresh);
      })
      .catch((err: unknown) => {
        if (!mounted.current || run !== loadRun.current) return;
        setLoadError(
          err instanceof JimError && err.kind === "denied"
            ? PERSONA_MESSAGES.denied
            : PERSONA_MESSAGES.load
        );
      })
      .finally(() => {
        if (mounted.current && run === loadRun.current) setLoading(false);
      });
  }, [getToken, api, remember]);

  const show = useCallback(() => {
    setOpen(true);
    setAnnouncement("");
    setRowErrors({});
    // The active one first again (a switch while open kept the order).
    const current = listRef.current;
    if (current) {
      listRef.current = activeFirst(current);
      setList(listRef.current);
    }
    if (!current || Date.now() - fetchedAt.current > PERSONAS_FRESH_MS) load();
  }, [load]);

  const choose = useCallback(
    (id: string) => {
      if (pending !== null) return;
      setPending(id);
      setAnnouncement("");
      setRowErrors((errors) => {
        const rest = { ...errors };
        delete rest[id];
        return rest;
      });
      void switchPersona(id, getToken, api).then((result) => {
        if (!mounted.current) return;
        setPending(null);
        if (!result.ok) {
          setRowErrors((errors) => ({ ...errors, [id]: result.message }));
          return;
        }
        const current = listRef.current;
        if (!current) return;
        const next = { ...current, active: result.active };
        listRef.current = next;
        setList(next);
        remember(next);
        const name = next.personas.find((p) => p.id === result.active)?.name;
        if (name) setAnnouncement(`Now using ${name}.`);
      });
    },
    [pending, getToken, api, remember]
  );

  const close = useCallback(() => setOpen(false), []);

  return {
    open,
    list,
    loading,
    loadError,
    pending,
    rowErrors,
    activeName,
    announcement,
    choose,
    reload: load,
    close,
    menuItem: {
      label: activeName ? `Persona: ${activeName}` : "Persona",
      onSelect: show,
    },
  };
}
