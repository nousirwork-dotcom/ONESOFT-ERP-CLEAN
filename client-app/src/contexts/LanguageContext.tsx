import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type Lang = "ar" | "en";

type LanguageContextType = {
  lang: Lang;
  dir: "rtl" | "ltr";
  toggleLang: () => void;
  setLang: (l: Lang) => void;
  isAr: boolean;
};

const LanguageContext = createContext<LanguageContextType | null>(null);

const STORAGE_KEY = "erp-lang";

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    return (localStorage.getItem(STORAGE_KEY) as Lang) ?? "ar";
  });

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem(STORAGE_KEY, l);
    document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = l;
  }, []);

  const toggleLang = useCallback(() => {
    setLang(lang === "ar" ? "en" : "ar");
  }, [lang, setLang]);

  return (
    <LanguageContext.Provider value={{
      lang,
      dir: lang === "ar" ? "rtl" : "ltr",
      toggleLang,
      setLang,
      isAr: lang === "ar",
    }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be inside LanguageProvider");
  return ctx;
}
