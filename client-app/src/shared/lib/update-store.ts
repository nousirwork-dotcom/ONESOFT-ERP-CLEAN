/**
 * update-store.ts — حالة التحديث المشتركة بين UpdateDialog، UpdateProgressBadge و UpdatesPage
 */

import { useEffect, useState } from "react";

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
  pendingManifest:        PendingManifest | null;
  updateType:             "optional" | "mandatory" | null;
  currentVersion:         string;
  mandatoryBlocked:       boolean;
  lastChecked:            Date | null;
  lastError:              string | null;
  /** التحميل جارٍ في الخلفية */
  backgroundDownloading:  boolean;
  /** نسبة التحميل 0-100 */
  downloadPercent:        number;
  /** التحميل اكتمل وجاهز للتثبيت */
  downloadReady:          boolean;
  /** عرض نافذة التحديث الكاملة */
  dialogVisible:          boolean;
}

let _state: UpdateState = {
  pendingManifest:       null,
  updateType:            null,
  currentVersion:        "",
  mandatoryBlocked:      false,
  lastChecked:           null,
  lastError:             null,
  backgroundDownloading: false,
  downloadPercent:       0,
  downloadReady:         false,
  dialogVisible:         false,
};

const _listeners = new Set<() => void>();
function _notify(): void { _listeners.forEach((fn) => fn()); }

export const updateStore = {
  getState: (): Readonly<UpdateState> => _state,

  setOptional(manifest: PendingManifest, currentVersion: string): void {
    _state = {
      ..._state,
      pendingManifest:       manifest,
      updateType:            "optional",
      currentVersion,
      mandatoryBlocked:      false,
      lastChecked:           new Date(),
      lastError:             null,
      dialogVisible:         true,
      backgroundDownloading: false,
      downloadReady:         false,
    };
    _notify();
  },

  setMandatory(manifest: PendingManifest, currentVersion: string): void {
    _state = {
      ..._state,
      pendingManifest:       manifest,
      updateType:            "mandatory",
      currentVersion,
      mandatoryBlocked:      true,
      lastChecked:           new Date(),
      lastError:             null,
      dialogVisible:         true,
      backgroundDownloading: false,
      downloadReady:         false,
    };
    _notify();
  },

  setNoUpdate(currentVersion: string): void {
    _state = {
      ..._state,
      pendingManifest:       null,
      updateType:            null,
      currentVersion,
      mandatoryBlocked:      false,
      lastChecked:           new Date(),
      lastError:             null,
      backgroundDownloading: false,
      downloadReady:         false,
      dialogVisible:         false,
    };
    _notify();
  },

  setError(error: string): void {
    _state = {
      ..._state,
      lastError:             error,
      lastChecked:           new Date(),
      backgroundDownloading: false,
    };
    _notify();
  },

  setDownloading(percent: number): void {
    _state = { ..._state, backgroundDownloading: true, downloadPercent: percent };
    _notify();
  },

  setDownloadDone(): void {
    _state = {
      ..._state,
      backgroundDownloading: false,
      downloadPercent:       100,
      downloadReady:         true,
      dialogVisible:         true,
    };
    _notify();
  },

  setDownloadCancelled(): void {
    _state = {
      ..._state,
      backgroundDownloading: false,
      downloadPercent:       0,
      downloadReady:         false,
    };
    _notify();
  },

  showDialog(): void {
    _state = { ..._state, dialogVisible: true };
    _notify();
  },

  hideDialog(): void {
    _state = { ..._state, dialogVisible: false };
    _notify();
  },

  clearPending(): void {
    _state = {
      ..._state,
      pendingManifest:       null,
      updateType:            null,
      mandatoryBlocked:      false,
      backgroundDownloading: false,
      downloadReady:         false,
      dialogVisible:         false,
    };
    _notify();
  },

  subscribe(fn: () => void): () => void {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  },
};

export function useUpdateState(): UpdateState {
  const [s, setS] = useState<UpdateState>(_state);
  useEffect(() => {
    setS(_state);
    return updateStore.subscribe(() => setS({ ..._state }));
  }, []);
  return s;
}

export function useIsMandatoryBlocked(): boolean {
  const [blocked, setBlocked] = useState(_state.mandatoryBlocked);
  useEffect(() => {
    setBlocked(_state.mandatoryBlocked);
    return updateStore.subscribe(() => setBlocked(_state.mandatoryBlocked));
  }, []);
  return blocked;
}
