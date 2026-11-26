import { createContext, useContext } from 'react'
import { DEFAULT_LANGUAGE } from './config'

export const LanguageContext = createContext({
  language: DEFAULT_LANGUAGE,
  setLanguage: () => {},
  t: (key) => key,
  formatDate: (date) => String(date),
  formatNumber: (num) => String(num),
  formatCurrency: (amount) => String(amount),
  locale: 'en-IN',
  langConfig: null,
})

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider')
  return ctx
}

export default LanguageContext
