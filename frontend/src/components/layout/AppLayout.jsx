import { useState } from 'react'
import Sidebar from './Sidebar'
import Navbar from './Navbar'

function AppLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--bg-app)] text-[var(--text-primary)] transition-colors duration-200">
      {/* Sidebar (Desktop + Mobile Drawer) */}
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* Main content canvas */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden relative">
        <Navbar
          onToggleSidebar={() => setCollapsed((c) => !c)}
          onOpenMobile={() => setMobileOpen(true)}
          sidebarCollapsed={collapsed}
        />
        <main className="flex-1 overflow-y-auto scrollbar-thin p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}

export default AppLayout
