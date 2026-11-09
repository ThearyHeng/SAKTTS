"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Locale, t as translate } from "@/lib/i18n";
import { BUILTIN_VOICES, VoiceProfile } from "@/lib/voices";
import type { HistoryItem } from "@/lib/store";
import type { CreditPolicy, PublicUser } from "@/lib/user-types";

export type ThemePreference = "system" | "light" | "dark";

interface ThemeContextValue {
  preference: ThemePreference;
  resolvedTheme: "light" | "dark";
  systemTheme: "light" | "dark";
  setPreference: (pref: ThemePreference) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  preference: "system",
  resolvedTheme: "light",
  systemTheme: "light",
  setPreference: () => {},
  toggleTheme: () => {},
});

interface LanguageContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  locale: "en",
  setLocale: () => {},
  t: (k) => k,
});

interface StudioContextValue {
  voices: VoiceProfile[];
  customVoices: VoiceProfile[];
  history: HistoryItem[];
  creditsBalance: number;
  creditsLimit: number;
  plan: string;
  activeUser: PublicUser | null;
  creditPolicy: CreditPolicy;
  loading: boolean;
  refreshStore: () => Promise<void>;
}

const DEFAULT_POLICY: CreditPolicy = {
  enforceBalance: true,
  defaultSignupCredits: 2000,
  lowBalanceThreshold: 500,
};

const StudioContext = createContext<StudioContextValue>({
  voices: BUILTIN_VOICES,
  customVoices: [],
  history: [],
  creditsBalance: 2000,
  creditsLimit: 2000,
  plan: "free",
  activeUser: null,
  creditPolicy: DEFAULT_POLICY,
  loading: false,
  refreshStore: async () => {},
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [systemTheme, setSystemTheme] = useState<"light" | "dark">("light");
  const [locale, setLocaleState] = useState<Locale>("en");

  const [customVoices, setCustomVoices] = useState<VoiceProfile[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [creditsBalance, setCreditsBalance] = useState<number>(2000);
  const [creditsLimit, setCreditsLimit] = useState<number>(2000);
  const [plan, setPlan] = useState<string>("free");
  const [activeUser, setActiveUser] = useState<PublicUser | null>(null);
  const [creditPolicy, setCreditPolicy] = useState<CreditPolicy>(DEFAULT_POLICY);
  const [loading, setLoading] = useState<boolean>(true);

  const applyThemeDom = useCallback((pref: ThemePreference, sys: "light" | "dark") => {
    const meta = document.querySelector('meta[name="color-scheme"]');
    if (meta) {
      meta.setAttribute("content", pref === "system" ? "light dark" : pref);
    }
    const resolved = pref === "system" ? sys : pref;
    document.documentElement.classList.toggle("dark", resolved === "dark");
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const sys: "light" | "dark" = mq.matches ? "dark" : "light";
    setSystemTheme(sys);

    let stored: ThemePreference = "system";
    try {
      const raw = localStorage.getItem("color-scheme");
      if (raw === "light" || raw === "dark") stored = raw;
    } catch {
      // ignore
    }
    setPreferenceState(stored);
    applyThemeDom(stored, sys);

    // Sync locale from URL ?locale=km or localStorage
    try {
      const urlLocale = new URLSearchParams(window.location.search).get("locale");
      const savedLocale = localStorage.getItem("saktts-locale");
      if (urlLocale === "km" || urlLocale === "en") {
        setLocaleState(urlLocale);
        localStorage.setItem("saktts-locale", urlLocale);
      } else if (savedLocale === "km" || savedLocale === "en") {
        setLocaleState(savedLocale);
      }
    } catch {
      // ignore
    }

    const onMediaChange = (e: MediaQueryListEvent) => {
      const nextSys: "light" | "dark" = e.matches ? "dark" : "light";
      setSystemTheme(nextSys);
      // Do NOT clear stored preference when system matches it; only re-apply DOM
      setPreferenceState((cur) => {
        applyThemeDom(cur, nextSys);
        return cur;
      });
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === "color-scheme") {
        const nextPref: ThemePreference =
          e.newValue === "light" || e.newValue === "dark" ? e.newValue : "system";
        setPreferenceState(nextPref);
        applyThemeDom(nextPref, mq.matches ? "dark" : "light");
      }
    };

    mq.addEventListener("change", onMediaChange);
    window.addEventListener("storage", onStorage);
    return () => {
      mq.removeEventListener("change", onMediaChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [applyThemeDom]);

  const setPreference = useCallback(
    (pref: ThemePreference) => {
      setPreferenceState(pref);
      try {
        if (pref === "system") {
          localStorage.removeItem("color-scheme");
        } else {
          localStorage.setItem("color-scheme", pref);
        }
      } catch {
        // ignore
      }
      applyThemeDom(pref, systemTheme);
    },
    [applyThemeDom, systemTheme]
  );

  const toggleTheme = useCallback(() => {
    const rendered = preference === "system" ? systemTheme : preference;
    const target: "light" | "dark" = rendered === "dark" ? "light" : "dark";
    if (target === systemTheme) {
      setPreference("system");
    } else {
      setPreference(target);
    }
  }, [preference, systemTheme, setPreference]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem("saktts-locale", l);
    } catch {
      // ignore
    }
  }, []);

  const refreshStore = useCallback(async () => {
    try {
      const res = await fetch("/api/history", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setCustomVoices(data.customVoices ?? []);
        setHistory(data.history ?? []);
        setCreditsBalance(data.creditsBalance ?? 2000);
        setCreditsLimit(data.creditsLimit ?? 2000);
        setPlan(data.plan ?? "free");
        setActiveUser(data.activeUser ?? null);
        if (data.creditPolicy) setCreditPolicy(data.creditPolicy);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshStore();
  }, [refreshStore]);

  const resolvedTheme: "light" | "dark" = preference === "system" ? systemTheme : preference;

  return (
    <ThemeContext.Provider
      value={{ preference, resolvedTheme, systemTheme, setPreference, toggleTheme }}
    >
      <LanguageContext.Provider
        value={{
          locale,
          setLocale,
          t: (key: string) => translate(locale, key),
        }}
      >
        <StudioContext.Provider
          value={{
            voices: [...customVoices, ...BUILTIN_VOICES],
            customVoices,
            history,
            creditsBalance,
            creditsLimit,
            plan,
            activeUser,
            creditPolicy,
            loading,
            refreshStore,
          }}
        >
          {children}
        </StudioContext.Provider>
      </LanguageContext.Provider>
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
export const useLanguage = () => useContext(LanguageContext);
export const useStudio = () => useContext(StudioContext);
