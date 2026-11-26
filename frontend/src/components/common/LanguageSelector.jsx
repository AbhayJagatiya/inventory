import { useState, useRef, useEffect } from 'react'
import { Globe, Check, ChevronDown } from 'lucide-react'
import { cn } from '../../utils/cn'
import { useLanguage } from '../../i18n'
import { SUPPORTED_LANGUAGES } from '../../i18n/config'

const LANGUAGES = Object.values(SUPPORTED_LANGUAGES)

function LanguageSelector({ compact = false, className }) {
  const { language, setLanguage, t } = useLanguage()
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  const currentLang = SUPPORTED_LANGUAGES[language] || SUPPORTED_LANGUAGES.en

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    const handleEscape = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  const handleSelect = (code) => {
    setLanguage(code)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={t('language.select')}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors border',
          'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200',
          'dark:bg-[#12221E] dark:hover:bg-[#172D28] dark:text-slate-200 dark:border-emerald-500/20',
          open && 'ring-2 ring-emerald-500/30'
        )}
      >
        <Globe size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
        <span className={cn(compact ? 'hidden sm:inline' : 'inline', 'whitespace-nowrap')}>
          {currentLang.nativeName}
        </span>
        <ChevronDown
          size={13}
          className={cn(
            'text-slate-400 transition-transform duration-150 shrink-0',
            open && 'rotate-180'
          )}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={t('language.select')}
          className="absolute right-0 top-full mt-2 w-44 bg-white dark:bg-[#12221E] border border-slate-200 dark:border-emerald-500/20 rounded-xl shadow-xl py-1 z-50"
        >
          {LANGUAGES.map((lang) => {
            const isSelected = lang.code === language
            return (
              <button
                key={lang.code}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(lang.code)}
                className={cn(
                  'w-full flex items-center justify-between px-3.5 py-2 text-xs transition-colors',
                  isSelected
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 font-bold'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 font-medium'
                )}
              >
                <span className="flex flex-col text-left">
                  <span>{lang.nativeName}</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-400 font-normal">
                    {lang.name}
                  </span>
                </span>
                {isSelected && <Check size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default LanguageSelector
