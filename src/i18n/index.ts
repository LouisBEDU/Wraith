import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import fr from "./locales/fr.json";

// Détection : d'abord la langue choisie manuellement (sauvegardée en
// localStorage par i18next-browser-languagedetector), sinon la langue du
// navigateur/OS. Fonctionne aussi bien en mode desktop (Tauri) qu'en mode
// web, sans dépendre des paramètres Rust.
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
    },
    fallbackLng: "en",
    supportedLngs: ["en", "fr"],
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "wraith_lang",
    },
  });

export default i18n;
