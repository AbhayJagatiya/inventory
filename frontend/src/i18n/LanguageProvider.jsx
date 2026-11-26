import { useState, useCallback, useEffect } from 'react'
import LanguageContext from './LanguageContext'
import {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  loadSavedLanguage,
  saveLanguage,
  validateLanguageCode,
} from './config'
import en from './translations/en'
import hi from './translations/hi'
import gu from './translations/gu'

const TRANSLATIONS = { en, hi, gu }

const IS_DEV = import.meta.env.DEV

/**
 * Deep get a value from a nested object using a dot-separated key path.
 * e.g. getNestedValue({a: {b: 'hello'}}, 'a.b') => 'hello'
 */
function getNestedValue(obj, keyPath) {
  if (!obj || !keyPath) return undefined
  const parts = keyPath.split('.')
  let current = obj
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined
    }
    current = current[part]
  }
  return typeof current === 'string' || typeof current === 'number' ? current : undefined
}

/**
 * Interpolate template variables in a translation string.
 * e.g. interpolate('Hello {{name}}', { name: 'World' }) => 'Hello World'
 */
function interpolate(template, params) {
  if (!params || typeof template !== 'string') return template
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return params[key] !== undefined ? String(params[key]) : `{{${key}}}`
  })
}

/**
 * Handle pluralization.
 * Translation value can be:
 *   - a string (single form)
 *   - an object: { one: '...', other: '...' }
 */
function pluralize(value, count) {
  if (typeof value === 'string') return value
  if (typeof value === 'object' && value !== null) {
    if (count === 1 && value.one) return value.one
    if (value.other) return value.other
    if (value.one) return value.one
  }
  return String(value)
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => loadSavedLanguage())

  const setLanguage = useCallback((code) => {
    const validated = validateLanguageCode(code)
    saveLanguage(validated)
    setLanguageState(validated)
  }, [])

  const langConfig = SUPPORTED_LANGUAGES[language] || SUPPORTED_LANGUAGES[DEFAULT_LANGUAGE]

  // Sync HTML lang attribute and font family for Unicode Devanagari & Gujarati rendering
  useEffect(() => {
    document.documentElement.lang = langConfig.code
    document.documentElement.style.fontFamily = langConfig.fontFamily
  }, [langConfig])

  /**
   * Core translation function.
   * @param {string} key - Dot-separated translation key (e.g. 'sidebar.inventory')
   * @param {Object} [params] - Interpolation params (e.g. { name: 'Admin' })
   * @param {number} [count] - For pluralization
   * @returns {string}
   */
  const t = useCallback(
    (key, params, count) => {
      const dict = TRANSLATIONS[language] || TRANSLATIONS[DEFAULT_LANGUAGE]
      const fallback = TRANSLATIONS[DEFAULT_LANGUAGE]

      let value = getNestedValue(dict, key)

      // Fallback to English
      if (value === undefined) {
        value = getNestedValue(fallback, key)
        if (IS_DEV && language !== DEFAULT_LANGUAGE && value !== undefined) {
          console.warn(`[i18n] Missing key "${key}" in "${language}", using English fallback.`)
        }
      }

      // Key not found anywhere
      if (value === undefined) {
        if (IS_DEV) {
          console.error(`[i18n] Translation key not found: "${key}"`)
        }
        // Return the last segment of the key as a readable fallback
        return key.split('.').pop() || key
      }

      // Handle pluralization
      if (count !== undefined) {
        value = pluralize(value, count)
      }

      // Handle interpolation
      if (params) {
        value = interpolate(String(value), params)
      }

      return String(value)
    },
    [language]
  )

  /**
   * Format a date using the current locale.
   */
  const formatDate = useCallback(
    (date, options = {}) => {
      if (!date) return ''
      try {
        const d = date instanceof Date ? date : new Date(date)
        if (isNaN(d.getTime())) return String(date)
        const defaultOptions = { day: '2-digit', month: '2-digit', year: 'numeric', ...options }
        return new Intl.DateTimeFormat(langConfig.locale, defaultOptions).format(d)
      } catch {
        return String(date)
      }
    },
    [langConfig]
  )

  /**
   * Format a number using the current locale.
   */
  const formatNumber = useCallback(
    (num, options = {}) => {
      if (num === null || num === undefined) return ''
      try {
        return new Intl.NumberFormat(langConfig.locale, options).format(Number(num))
      } catch {
        return String(num)
      }
    },
    [langConfig]
  )

  /**
   * Format an INR currency amount using the current locale.
   */
  const formatCurrency = useCallback(
    (amount, options = {}) => {
      if (amount === null || amount === undefined) return ''
      try {
        return new Intl.NumberFormat(langConfig.locale, {
          style: 'currency',
          currency: 'INR',
          maximumFractionDigits: 2,
          ...options,
        }).format(Number(amount))
      } catch {
        return `₹${amount}`
      }
    },
    [langConfig]
  )

  const value = {
    language,
    setLanguage,
    t,
    formatDate,
    formatNumber,
    formatCurrency,
    locale: langConfig.locale,
    langConfig,
  }

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export default LanguageProvider
