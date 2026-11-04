import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../../context/ThemeContext'

function AuthLayout({ children }) {
  const { theme, toggleTheme, isDark } = useTheme()

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#075443] via-[#091210] to-[#101C1A] flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-300">
      {/* Government header strip (Saffron, White, Green) */}
      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-orange-500 via-white to-green-600 shadow-sm z-30" />

      {/* Subtle ambient gradient spheres */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-forest-400/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-forest-500/10 blur-3xl pointer-events-none" />

      {/* Theme toggle in corner */}
      <div className="absolute top-4 right-4 z-20">
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white backdrop-blur-md border border-white/10 transition-colors"
          title={`Switch to ${isDark ? 'Light' : 'Dark'} mode`}
          aria-label="Toggle color theme"
        >
          {isDark ? <Sun size={18} className="text-amber-300" /> : <Moon size={18} className="text-forest-200" />}
        </button>
      </div>

      <div className="w-full max-w-md relative z-10">
        {children}
      </div>
    </div>
  )
}

export default AuthLayout
