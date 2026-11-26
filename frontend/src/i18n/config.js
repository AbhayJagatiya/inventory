// Centralized i18n configuration for DSIMS
// Supports: English (en), Hindi (hi), Gujarati (gu)

export const SUPPORTED_LANGUAGES = {
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    locale: 'en-IN',
    dir: 'ltr',
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  hi: {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    locale: 'hi-IN',
    dir: 'ltr',
    fontFamily: "'Noto Sans Devanagari', 'Inter', system-ui, sans-serif",
  },
  gu: {
    code: 'gu',
    name: 'Gujarati',
    nativeName: 'ગુજરાતી',
    locale: 'gu-IN',
    dir: 'ltr',
    fontFamily: "'Noto Sans Gujarati', 'Inter', system-ui, sans-serif",
  },
}

export const DEFAULT_LANGUAGE = 'en'
export const LANGUAGE_STORAGE_KEY = 'dsims_language'
export const SUPPORTED_LANGUAGE_CODES = Object.keys(SUPPORTED_LANGUAGES)

/**
 * Validate and return a supported language code.
 * Falls back to DEFAULT_LANGUAGE if the code is unsupported.
 */
export function validateLanguageCode(code) {
  if (code && SUPPORTED_LANGUAGE_CODES.includes(code)) return code
  return DEFAULT_LANGUAGE
}

/**
 * Load the saved language from localStorage with validation.
 */
export function loadSavedLanguage() {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY)
    return validateLanguageCode(saved)
  } catch {
    return DEFAULT_LANGUAGE
  }
}

/**
 * Persist the language selection to localStorage.
 */
export function saveLanguage(code) {
  try {
    const validated = validateLanguageCode(code)
    localStorage.setItem(LANGUAGE_STORAGE_KEY, validated)
    return validated
  } catch {
    return DEFAULT_LANGUAGE
  }
}
