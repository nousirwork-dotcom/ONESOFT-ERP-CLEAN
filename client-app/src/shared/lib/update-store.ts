/**
 * update-store.ts — حالة التحديث المشتركة بين UpdateDialog و UpdatesPage
 *
 * لماذا module-level وليس Zustand/Context؟
 * لأن UpdateDialog مُركَّب دائماً في App.tsx ويستقبل IPC events.
 * UpdatesPage مُركَّب فقط عند فتح الإعدادات.
 * كلاهما يحتاجان لرؤية نفس الحالة بدون re-subscribe لـ IPC.
 */

import { useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface PendingManifest {
  latestVersion:       string;
  minSupportedVersion: string;
  mandatory:           boolean;
  messageAr:           string;
  messageEn:           string;
  releaseNotes:        string[];
  downloadUrl:         string;
  fileSizeBytes?:      number;
  sha512?:             string;
  publishedAt?:        string;
}

export interface UpdateState {
  /** التحديث المتاح — يبقى بعد "لاحقاً" حتى يتم التحديث */
  pendingManifest:   PendingManifest | null;
  updateType:        "optional" | "mandatory" | null;
  currentVersion:    string;
  /** true = تحديث إجباري → يُمنع الدخول لأي مسار */
  mandatoryBlocked:  boolean;
  lastChecked:       Date | null;
  lastError:         string | null;
}

// ─── Module-level state ───────────────────────────────────────────────────────
let _state: UpdateState = {
  pendingManifest:  null,
  updateType:       null,
  currentVersion:   "",
  mandatoryBlocked: false,
  lastChecked:      null,
  lastError:        null,
};

const _listeners = new Set<() => void>();

function _notify(): void {
  _listeners.forEach((fn) => fn());
}

// ─── Store API ────────────────────────────────────────────────────────────────
export const updateStore = {
  getState: (): Readonly<UpdateState> => _state,

  setOptional(manifest: PendingManifest, currentVersion: string): void {
    _state = {
      ..._state,
      pendingManifest:  manifest,
      updateType:       "optional",
      currentVersion,
      mandatoryBlocked: false,
      lastChecked:      new Date(),
      lastError:        null,
    };
    _notify();
  },

  setMandatory(manifest: PendingManifest, currentVersion: string): void {
    _state = {
      ..._state,
      pendingManifest:  manifest,
      updateType:       "mandatory",
      currentVersion,
      mandatoryBlocked: true,
      lastChecked:      new Date(),
      lastError:        null,
    };
    _notify();
  },

  setNoUpdate(currentVersion: string): void {
    _state = {
      ..._state,
      pendingManifest:  null,
      updateType:       null,
      currentVersion,
      mandatoryBlocked: false,
      lastChecked:      new Date(),
      lastError:        null,
    };
    _notify();
  },

  setError(error: string): void {
    _state = { ..._state, lastError: error, lastChecked: new Date() };
    _notify();
  },

  clearPending(): void {
    _state = {
      ..._state,
      pendingManifest:  null,
      updateType:       null,
      mandatoryBlocked: false,
    };
    _notify();
  },

  subscribe(fn: () => void): () => void {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  },
};

// ─── React hooks ──────────────────────────────────────────────────────────────
/** Hook عام — يُعيد حالة التحديث الكاملة مع إعادة الرسم عند التغيير */
export function useUpdateState(): UpdateState {
  const [s, setS] = useState<UpdateState>(_state);
  useEffect(() => {
    setS(_state); // sync on mount (قد تغيّرت قبل mount هذا المكوّن)
    return updateStore.subscribe(() => setS({ ..._state }));
  }, []);
  return s;
}

/** Hook مُبسَّط — هل التحديث الإجباري مفعَّل؟ (يُستخدم في App.tsx) */
export function useIsMandatoryBlocked(): boolean {
  const [blocked, setBlocked] = useState(_state.mandatoryBlocked);
  useEffect(() => {
    setBlocked(_state.mandatoryBlocked);
    return updateStore.subscribe(() => setBlocked(_state.mandatoryBlocked));
  }, []);
  return blocked;
}
