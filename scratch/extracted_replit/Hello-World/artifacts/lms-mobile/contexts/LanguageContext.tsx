import React, { createContext, useContext, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

type Lang = "ar" | "en";

interface LanguageContextType {
  language: Lang;
  isRTL: boolean;
  setLanguage: (lang: Lang) => void;
  t: (ar: string, en: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: "ar",
  isRTL: true,
  setLanguage: () => {},
  t: (ar) => ar,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLang] = useState<Lang>("ar");

  // Load saved language on mount
  React.useEffect(() => {
    AsyncStorage.getItem("app-language").then((saved) => {
      if (saved === "en" || saved === "ar") setLang(saved);
    });
  }, []);

  const setLanguage = useCallback((lang: Lang) => {
    setLang(lang);
    AsyncStorage.setItem("app-language", lang);
  }, []);

  const t = useCallback(
    (ar: string, en: string) => (language === "ar" ? ar : en),
    [language]
  );

  return (
    <LanguageContext.Provider
      value={{ language, isRTL: language === "ar", setLanguage, t }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
