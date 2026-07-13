import {
  Boxes, Calculator, Factory, LayoutDashboard, LifeBuoy, Settings,
  ShoppingBag, TrendingUp, UserCheck, Wrench,
} from "lucide-react";
import { t } from "@/shared/lib/translations";
import { canViewHelpServices, canViewHsScreen, HS_PATH_PERM } from "@/shared/lib/hsPermissions";

import { menuSections as salesMenu } from "@/modules/sales/pages/SalesModule";
import { menuSections as purchasesMenu } from "@/modules/purchases/pages/PurchasesModule";
import { menuSections as inventoryMenu } from "@/modules/inventory/pages/InventoryModule";
import { menuSections as manufacturingMenu } from "@/modules/manufacturing/pages/ManufacturingModule";
import { menuSections as accountingMenu } from "@/modules/accounting/pages/AccountingModule";
import { menuSections as hrMenu } from "@/modules/hr/pages/HRModule";
import { menuSections as assetsMenu } from "@/modules/assets/pages/AssetsModule";
import { menuSections as settingsMenu } from "@/modules/settings/pages/SettingsModule";
import { menuSections as helpServicesMenu } from "@/modules/helpservices/pages/HelpServicesModule";

export type AppModule = {
  path: string;
  labelKey: string;
  icon: React.ElementType;
  roles?: string[];
};

export type AppScreen = {
  path: string;
  label: string;
  icon: React.ElementType;
  modulePath: string;
  moduleLabelKey: string;
};

// ─── الوحدات الرئيسية ────────────────────────────────────────────────────────
export const APP_MODULES: AppModule[] = [
  { path: "/sales-module",         labelKey: "salesMgmt",         icon: TrendingUp },
  { path: "/purchases-module",     labelKey: "purchasesMgmt",     icon: ShoppingBag },
  { path: "/inventory-module",     labelKey: "inventoryMgmt",     icon: Boxes },
  { path: "/manufacturing-module", labelKey: "manufacturingMgmt", icon: Factory },
  { path: "/accounting-module",    labelKey: "accounting",        icon: Calculator },
  { path: "/hr-module",            labelKey: "hr",                icon: UserCheck },
  { path: "/assets-module",        labelKey: "fixedAssets",       icon: Wrench },
  { path: "/help-services-module", labelKey: "helpServices",      icon: LifeBuoy },
  { path: "/settings",             labelKey: "settings",          icon: Settings },
];

export function moduleLabel(lang: "ar" | "en", m: AppModule): string {
  return t(lang, m.labelKey as any);
}

export function visibleModules(
  userRole?: string,
  extraPerms?: Record<string, boolean> | null,
): AppModule[] {
  return APP_MODULES.filter(m => {
    if (m.roles && !(userRole && m.roles.includes(userRole))) return false;
    if (m.path === "/help-services-module") {
      return canViewHelpServices({ role: userRole, extraPermissions: extraPerms });
    }
    return true;
  });
}

// ─── فهرس الشاشات (من قوائم الوحدات نفسها) ──────────────────────────────────
type RawSection = {
  label?: string;
  path?: string;
  icon?: React.ElementType;
  children?: Array<{ label: string; path?: string; icon?: React.ElementType }>;
};

function flatten(
  sections: RawSection[],
  modulePath: string,
  moduleLabelKey: string,
  moduleIcon: React.ElementType,
): AppScreen[] {
  const out: AppScreen[] = [];
  for (const sec of sections ?? []) {
    if (sec.path && sec.label) {
      out.push({ path: sec.path, label: sec.label, icon: sec.icon ?? moduleIcon, modulePath, moduleLabelKey });
    }
    for (const child of sec.children ?? []) {
      if (child.path && child.label) {
        out.push({ path: child.path, label: child.label, icon: child.icon ?? sec.icon ?? moduleIcon, modulePath, moduleLabelKey });
      }
    }
  }
  return out;
}

let screensCache: AppScreen[] | null = null;

export function getAllScreens(): AppScreen[] {
  if (screensCache) return screensCache;
  screensCache = [
    ...flatten(salesMenu as RawSection[],         "/sales-module",         "salesMgmt",         TrendingUp),
    ...flatten(purchasesMenu as RawSection[],     "/purchases-module",     "purchasesMgmt",     ShoppingBag),
    ...flatten(inventoryMenu as RawSection[],     "/inventory-module",     "inventoryMgmt",     Boxes),
    ...flatten(manufacturingMenu as RawSection[], "/manufacturing-module", "manufacturingMgmt", Factory),
    ...flatten(accountingMenu as RawSection[],    "/accounting-module",    "accounting",        Calculator),
    ...flatten(hrMenu as RawSection[],            "/hr-module",            "hr",                UserCheck),
    ...flatten(assetsMenu as RawSection[],        "/assets-module",        "fixedAssets",       Wrench),
    ...flatten(helpServicesMenu as RawSection[],  "/help-services-module", "helpServices",      LifeBuoy),
    ...flatten(settingsMenu as RawSection[],      "/settings",             "settings",          Settings),
  ];
  return screensCache;
}

export function iconForPath(path: string): React.ElementType {
  const mod = APP_MODULES.find(m => m.path === path);
  if (mod) return mod.icon;
  const screen = getAllScreens().find(s => s.path === path);
  if (screen) return screen.icon;
  if (path === "/") return LayoutDashboard;
  return LayoutDashboard;
}

export function labelForPath(path: string, lang: "ar" | "en"): string | null {
  const mod = APP_MODULES.find(m => m.path === path);
  if (mod) return moduleLabel(lang, mod);
  const screen = getAllScreens().find(s => s.path === path);
  if (screen) return screen.label;
  return null;
}

// ─── البحث في الوحدات والشاشات ──────────────────────────────────────────────
export type SearchResult =
  | { kind: "module"; module: AppModule; label: string }
  | { kind: "screen"; screen: AppScreen };

export function searchNav(
  query: string,
  lang: "ar" | "en",
  userRole?: string,
  extraPerms?: Record<string, boolean> | null,
): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const results: SearchResult[] = [];
  const allowedModules = visibleModules(userRole, extraPerms);
  const allowedPaths = new Set(allowedModules.map(m => m.path));

  for (const m of allowedModules) {
    const label = moduleLabel(lang, m);
    if (label.toLowerCase().includes(q)) results.push({ kind: "module", module: m, label });
  }
  for (const s of getAllScreens()) {
    if (!allowedPaths.has(s.modulePath)) continue;
    // شاشات «المساعدة والخدمات» تتطلب صلاحية الشاشة نفسها
    const hsPerm = HS_PATH_PERM[s.path];
    if (hsPerm && !canViewHsScreen({ role: userRole, extraPermissions: extraPerms }, hsPerm)) continue;
    if (s.label.toLowerCase().includes(q)) results.push({ kind: "screen", screen: s });
    if (results.length >= 30) break;
  }
  return results;
}
