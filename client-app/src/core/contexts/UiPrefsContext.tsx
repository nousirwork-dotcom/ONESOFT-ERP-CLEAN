import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from "react";
import { trpc } from "@/shared/lib/trpc";
import { useTabManager } from "@/core/contexts/TabManagerContext";

// ─── تفضيلات واجهة المستخدم: طريقة العرض + المفضلة + آخر الشاشات ─────────────
// المخزن المحلي مفصول لكل مستخدم (مفاتيح مُلحقة بمعرّف المستخدم) والخادم هو
// المرجع النهائي عند التحميل. مفتاح الجهاز القديم يُستخدم فقط لعرض فوري بلا وميض.

export type LayoutMode = "vertical" | "horizontal" | "apps";

export type FavoriteItem = { path: string; label: string };
export type RecentItem = { path: string; label: string; ts: number };

const DEVICE_MODE_KEY = "erp-layout-mode";           // مفتاح جهاز قديم — عرض فوري فقط
const MODE_KEY = "erp-layout-mode";
const FAVORITES_KEY = "erp-ui-favorites";
const RECENTS_KEY = "erp-ui-recents";

const VALID_MODES: LayoutMode[] = ["vertical", "horizontal", "apps"];
const MAX_RECENTS = 12;
const MAX_FAVORITES = 30;

const scoped = (base: string, userId: number) => `${base}.u${userId}`;

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch { return fallback; }
}

function loadMode(key: string): LayoutMode | null {
  const raw = localStorage.getItem(key) as LayoutMode | null;
  return raw && VALID_MODES.includes(raw) ? raw : null;
}

type UiPrefsContextType = {
  layoutMode: LayoutMode;
  setLayoutMode: (m: LayoutMode) => void;
  favorites: FavoriteItem[];
  isFavorite: (path: string) => boolean;
  toggleFavorite: (path: string, label: string) => void;
  recents: RecentItem[];
  orgDefaultLayoutMode: LayoutMode | null;
  setOrgDefaultLayoutMode: (m: LayoutMode) => void;
  modalAlertSound: boolean;
  setModalAlertSound: (v: boolean) => void;
};

const UiPrefsContext = createContext<UiPrefsContextType | null>(null);

export function useUiPrefs() {
  const ctx = useContext(UiPrefsContext);
  if (!ctx) throw new Error("useUiPrefs must be used inside UiPrefsProvider");
  return ctx;
}

export function UiPrefsProvider({ children }: { children: ReactNode }) {
  // عرض فوري من مفتاح الجهاز — يُستبدل بقيمة المستخدم/الخادم فور توفرها
  const [layoutMode, setLayoutModeState] = useState<LayoutMode>(() => loadMode(DEVICE_MODE_KEY) ?? "apps");
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [recents, setRecents] = useState<RecentItem[]>([]);
  const [orgDefault, setOrgDefault] = useState<LayoutMode | null>(null);
  const [modalAlertSound, setModalAlertSoundState] = useState<boolean>(true);

  const { tabs } = useTabManager();
  const meQuery = trpc.auth.me.useQuery(undefined, { retry: false });
  const userId: number | null = meQuery.data?.id ?? null;

  const localApplied = useRef(false);
  const serverApplied = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSave = useRef<Partial<{
    layoutMode: LayoutMode; favorites: FavoriteItem[]; recents: RecentItem[];
    modalAlertSound: boolean;
  }> | null>(null);
  const knownTabIds = useRef<Set<string>>(new Set());

  const utils = trpc.useUtils();
  const prefsQuery = trpc.uiPrefs.get.useQuery(undefined, {
    enabled: !!userId,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });
  const saveMutation = trpc.uiPrefs.save.useMutation();
  const orgDefaultMutation = trpc.uiPrefs.setOrgDefault.useMutation({
    onSuccess: () => utils.uiPrefs.get.invalidate(),
  });
  const saveMutate = useRef(saveMutation.mutate);
  saveMutate.current = saveMutation.mutate;

  // ── (1) تحميل التفضيلات المحلية المفصولة لكل مستخدم فور معرفة هويته ───────
  useEffect(() => {
    if (!userId || localApplied.current) return;
    localApplied.current = true;
    const m = loadMode(scoped(MODE_KEY, userId));
    if (m) setLayoutModeState(m);
    setFavorites(loadJson<FavoriteItem[]>(scoped(FAVORITES_KEY, userId), []));
    setRecents(loadJson<RecentItem[]>(scoped(RECENTS_KEY, userId), []));
  }, [userId]);

  // ── (2) الخادم هو المرجع عند أول تحميل ───────────────────────────────────
  useEffect(() => {
    if (serverApplied.current || !prefsQuery.data || !userId) return;
    serverApplied.current = true;
    const { prefs, orgDefaultLayoutMode } = prefsQuery.data;
    setOrgDefault(orgDefaultLayoutMode ?? null);

    // طريقة العرض: تفضيل المستخدم ← وإلا افتراضي المنشأة ← وإلا القيمة المحلية المفصولة ← وإلا مركزية
    const resolved: LayoutMode =
      (prefs.layoutMode && VALID_MODES.includes(prefs.layoutMode) ? prefs.layoutMode : null)
      ?? orgDefaultLayoutMode
      ?? loadMode(scoped(MODE_KEY, userId))
      ?? "apps";
    setLayoutModeState(resolved);
    localStorage.setItem(scoped(MODE_KEY, userId), resolved);
    localStorage.setItem(DEVICE_MODE_KEY, resolved);

    if (prefs.favorites) {
      setFavorites(prefs.favorites);
      localStorage.setItem(scoped(FAVORITES_KEY, userId), JSON.stringify(prefs.favorites));
    }
    if (prefs.recents) {
      setRecents(prev => {
        const merged = [...(prefs.recents ?? []), ...prev];
        const seen = new Set<string>();
        const out: RecentItem[] = [];
        for (const r of merged.sort((a, b) => b.ts - a.ts)) {
          if (seen.has(r.path)) continue;
          seen.add(r.path);
          out.push(r);
          if (out.length >= MAX_RECENTS) break;
        }
        localStorage.setItem(scoped(RECENTS_KEY, userId), JSON.stringify(out));
        return out;
      });
    }
    if (prefs.modalAlertSound !== undefined) {
      setModalAlertSoundState(prefs.modalAlertSound);
    }
  }, [prefsQuery.data, userId]);

  // ── حفظ مؤجَّل إلى الخادم ────────────────────────────────────────────────
  const scheduleSave = useCallback((payload: Partial<{
    layoutMode: LayoutMode; favorites: FavoriteItem[]; recents: RecentItem[];
    modalAlertSound: boolean;
  }>) => {
    pendingSave.current = { ...(pendingSave.current ?? {}), ...payload };
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const toSave = pendingSave.current;
      pendingSave.current = null;
      if (toSave) saveMutate.current(toSave);
    }, 1200);
  }, []);

  const setLayoutMode = useCallback((m: LayoutMode) => {
    setLayoutModeState(m);
    localStorage.setItem(DEVICE_MODE_KEY, m);
    if (userId) localStorage.setItem(scoped(MODE_KEY, userId), m);
    scheduleSave({ layoutMode: m });
  }, [scheduleSave, userId]);

  const isFavorite = useCallback(
    (path: string) => favorites.some(f => f.path === path),
    [favorites],
  );

  const toggleFavorite = useCallback((path: string, label: string) => {
    setFavorites(prev => {
      const exists = prev.some(f => f.path === path);
      const next = exists
        ? prev.filter(f => f.path !== path)
        : [...prev, { path, label }].slice(-MAX_FAVORITES);
      if (userId) localStorage.setItem(scoped(FAVORITES_KEY, userId), JSON.stringify(next));
      scheduleSave({ favorites: next });
      return next;
    });
  }, [scheduleSave, userId]);

  // ── تسجيل آخر الشاشات المفتوحة تلقائياً من التبويبات ─────────────────────
  useEffect(() => {
    const newTabs = tabs.filter(t => !knownTabIds.current.has(t.id));
    if (!newTabs.length) return;
    for (const t of tabs) knownTabIds.current.add(t.id);
    setRecents(prev => {
      let next = prev;
      for (const t of newTabs) {
        if (t.path === "/") continue;
        next = [{ path: t.path, label: t.label, ts: Date.now() },
                ...next.filter(r => r.path !== t.path)].slice(0, MAX_RECENTS);
      }
      if (next !== prev) {
        if (userId) localStorage.setItem(scoped(RECENTS_KEY, userId), JSON.stringify(next));
        scheduleSave({ recents: next });
      }
      return next;
    });
  }, [tabs, scheduleSave, userId]);

  const setOrgDefaultLayoutMode = useCallback((m: LayoutMode) => {
    setOrgDefault(m);
    orgDefaultMutation.mutate({ layoutMode: m });
  }, [orgDefaultMutation]);

  const setModalAlertSound = useCallback((v: boolean) => {
    setModalAlertSoundState(v);
    scheduleSave({ modalAlertSound: v });
  }, [scheduleSave]);

  return (
    <UiPrefsContext.Provider value={{
      layoutMode, setLayoutMode,
      favorites, isFavorite, toggleFavorite,
      recents,
      orgDefaultLayoutMode: orgDefault,
      setOrgDefaultLayoutMode,
      modalAlertSound,
      setModalAlertSound,
    }}>
      {children}
    </UiPrefsContext.Provider>
  );
}
