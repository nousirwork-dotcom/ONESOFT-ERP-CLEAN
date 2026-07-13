import { useMemo, useState } from "react";
import { Clock, Search, Star, X } from "lucide-react";
import { useAuth } from "@/core/hooks/useAuth";
import { useLang } from "@/core/contexts/LanguageContext";
import { useTabManager } from "@/core/contexts/TabManagerContext";
import { useUiPrefs } from "@/core/contexts/UiPrefsContext";
import { t } from "@/shared/lib/translations";
import {
  visibleModules, moduleLabel, searchNav, iconForPath,
} from "@/shared/lib/navRegistry";

// ─── الشاشة الرئيسية بنمط "التطبيقات" (شبكة مركزية بأسلوب Odoo) ─────────────

const TILE_COLORS = [
  "from-sky-500/15 to-sky-500/5 text-sky-600 dark:text-sky-400",
  "from-amber-500/15 to-amber-500/5 text-amber-600 dark:text-amber-400",
  "from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400",
  "from-violet-500/15 to-violet-500/5 text-violet-600 dark:text-violet-400",
  "from-rose-500/15 to-rose-500/5 text-rose-600 dark:text-rose-400",
  "from-cyan-500/15 to-cyan-500/5 text-cyan-600 dark:text-cyan-400",
  "from-orange-500/15 to-orange-500/5 text-orange-600 dark:text-orange-400",
  "from-indigo-500/15 to-indigo-500/5 text-indigo-600 dark:text-indigo-400",
];

export default function AppsHome() {
  const { user } = useAuth();
  const { lang, dir } = useLang();
  const { openTab } = useTabManager();
  const { favorites, isFavorite, toggleFavorite, recents } = useUiPrefs();
  const [query, setQuery] = useState("");

  const modules = useMemo(() => visibleModules(user?.role), [user?.role]);
  const results = useMemo(
    () => searchNav(query, lang, user?.role),
    [query, lang, user?.role],
  );

  const open = (path: string, label: string) => {
    openTab(path, label, iconForPath(path));
  };

  const searching = query.trim().length > 0;

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-b from-background to-muted/40" dir={dir}>
      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* ── شريط البحث ── */}
        <div className="max-w-xl mx-auto mb-10 relative">
          <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground ${dir === "rtl" ? "right-3.5" : "left-3.5"}`} />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={lang === "ar" ? "ابحث عن وحدة أو شاشة أو تقرير..." : "Search modules, screens, reports..."}
            className={`w-full h-11 rounded-xl border border-border bg-card shadow-sm text-sm outline-none focus:ring-2 focus:ring-primary/30 transition-shadow ${dir === "rtl" ? "pr-10 pl-9" : "pl-10 pr-9"}`}
            data-testid="input-apps-search"
          />
          {searching && (
            <button
              onClick={() => setQuery("")}
              className={`absolute top-1/2 -translate-y-1/2 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent ${dir === "rtl" ? "left-2.5" : "right-2.5"}`}
              data-testid="button-clear-search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* ── نتائج البحث ── */}
        {searching ? (
          <div className="max-w-xl mx-auto">
            {results.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">
                {lang === "ar" ? "لا توجد نتائج مطابقة" : "No matching results"}
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {results.map((r, i) => {
                  const path = r.kind === "module" ? r.module.path : r.screen.path;
                  const label = r.kind === "module" ? r.label : r.screen.label;
                  const Icon = r.kind === "module" ? r.module.icon : r.screen.icon;
                  const sub = r.kind === "screen"
                    ? t(lang, r.screen.moduleLabelKey as any)
                    : (lang === "ar" ? "وحدة رئيسية" : "Main module");
                  return (
                    <button
                      key={`${path}-${i}`}
                      onClick={() => open(path, label)}
                      className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl border border-border bg-card hover:bg-accent hover:border-primary/30 transition-colors text-start"
                      data-testid={`search-result-${path.replace(/\//g, "_")}`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{label}</p>
                        <p className="text-[11px] text-muted-foreground">{sub}</p>
                      </div>
                      <FavStar path={path} label={label} />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* ── المفضلة ── */}
            {favorites.length > 0 && (
              <section className="mb-8">
                <SectionTitle icon={Star} text={lang === "ar" ? "المفضلة" : "Favorites"} />
                <div className="flex flex-wrap gap-2">
                  {favorites.map(f => {
                    const Icon = iconForPath(f.path);
                    return (
                      <button
                        key={f.path}
                        onClick={() => open(f.path, f.label)}
                        className="group flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-card hover:bg-accent hover:border-primary/30 transition-colors"
                        data-testid={`favorite-${f.path.replace(/\//g, "_")}`}
                      >
                        <Icon className="w-4 h-4 text-primary" />
                        <span className="text-sm text-foreground">{f.label}</span>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={e => { e.stopPropagation(); toggleFavorite(f.path, f.label); }}
                          onKeyDown={e => { if (e.key === "Enter") { e.stopPropagation(); toggleFavorite(f.path, f.label); } }}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                          title={lang === "ar" ? "إزالة من المفضلة" : "Remove from favorites"}
                        >
                          <X className="w-3 h-3" />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── آخر الشاشات استخداماً ── */}
            {recents.length > 0 && (
              <section className="mb-8">
                <SectionTitle icon={Clock} text={lang === "ar" ? "آخر الشاشات استخداماً" : "Recently used"} />
                <div className="flex flex-wrap gap-2">
                  {recents.slice(0, 8).map(r => {
                    const Icon = iconForPath(r.path);
                    return (
                      <button
                        key={r.path}
                        onClick={() => open(r.path, r.label)}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-card hover:bg-accent hover:border-primary/30 transition-colors"
                        data-testid={`recent-${r.path.replace(/\//g, "_")}`}
                      >
                        <Icon className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-foreground">{r.label}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── التطبيقات الرئيسية ── */}
            <section>
              <SectionTitle text={lang === "ar" ? "التطبيقات الرئيسية" : "Applications"} />
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {modules.map((m, i) => {
                  const label = moduleLabel(lang, m);
                  const color = TILE_COLORS[i % TILE_COLORS.length];
                  return (
                    <div
                      key={m.path}
                      className="group relative rounded-2xl border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all cursor-pointer"
                      onClick={() => open(m.path, label)}
                      data-testid={`app-tile-${m.path.replace(/\//g, "_")}`}
                    >
                      <div className="flex flex-col items-center gap-3 py-7 px-3">
                        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center`}>
                          <m.icon className="w-7 h-7" />
                        </div>
                        <span className="text-sm font-semibold text-foreground text-center leading-tight">
                          {label}
                        </span>
                      </div>
                      <div className={`absolute top-2 ${dir === "rtl" ? "left-2" : "right-2"} opacity-0 group-hover:opacity-100 transition-opacity`}>
                        <FavStar path={m.path} label={label} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, text }: { icon?: React.ElementType; text: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-3">
      {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground" />}
      <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{text}</h2>
    </div>
  );
}

function FavStar({ path, label }: { path: string; label: string }) {
  const { isFavorite, toggleFavorite } = useUiPrefs();
  const fav = isFavorite(path);
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={e => { e.stopPropagation(); toggleFavorite(path, label); }}
      onKeyDown={e => { if (e.key === "Enter") { e.stopPropagation(); toggleFavorite(path, label); } }}
      className={`p-1 rounded-md transition-colors ${fav ? "text-amber-500" : "text-muted-foreground/50 hover:text-amber-500"}`}
      title={fav ? "إزالة من المفضلة" : "إضافة إلى المفضلة"}
      data-testid={`fav-star-${path.replace(/\//g, "_")}`}
    >
      <Star className={`w-4 h-4 ${fav ? "fill-current" : ""}`} />
    </span>
  );
}
