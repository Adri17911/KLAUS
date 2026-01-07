import { useState, useEffect } from 'react'

interface MobileNavigationProps {
  currentView: string
  onNavigate: (view: string) => void
  projectCount: number
  canManageUsers: boolean
  canManageProvision: boolean
  onSyncCrm?: () => void
  syncingCrm?: boolean
}

export default function MobileNavigation({
  currentView,
  onNavigate,
  projectCount,
  canManageUsers,
  canManageProvision,
  onSyncCrm,
  syncingCrm = false,
}: MobileNavigationProps) {
  const [isOpen, setIsOpen] = useState(false)

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (isOpen && !target.closest('.mobile-nav')) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      // Prevent body scroll when menu is open
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const menuItems = [
    { id: 'calculator', label: 'Calculator', icon: '📊' },
    { id: 'list', label: `Commissions (${projectCount})`, icon: '📋' },
    { id: 'kanban', label: 'Kanban', icon: '📌' },
    { id: 'overview', label: 'Overview', icon: '📈' },
  ]

  if (canManageProvision) {
    menuItems.push({ id: 'settings', label: 'Settings', icon: '⚙️' })
  }

  const handleNavClick = (view: string) => {
    onNavigate(view)
    setIsOpen(false)
  }

  return (
    <div className="mobile-nav md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-lg">
      {/* Bottom Navigation Bar */}
      <div className="flex justify-around items-center h-16">
        {menuItems.slice(0, 4).map((item) => (
          <button
            key={item.id}
            onClick={() => handleNavClick(item.id)}
            className={`flex flex-col items-center justify-center flex-1 h-full transition-colors ${
              currentView === item.id
                ? 'text-indigo-600 bg-indigo-50'
                : 'text-gray-600 hover:text-indigo-600 hover:bg-gray-50'
            }`}
          >
            <span className="text-xl mb-1">{item.icon}</span>
            <span className="text-xs font-medium">{item.label.split(' ')[0]}</span>
          </button>
        ))}
        <button
          onClick={() => setIsOpen(true)}
          className="flex flex-col items-center justify-center flex-1 h-full text-gray-600 hover:text-indigo-600 hover:bg-gray-50 transition-colors"
        >
          <span className="text-xl mb-1">☰</span>
          <span className="text-xs font-medium">More</span>
        </button>
      </div>

      {/* Full Menu Overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50" onClick={() => setIsOpen(false)}>
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-800">Menu</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-600 hover:text-gray-800 text-2xl"
                aria-label="Close menu"
              >
                ×
              </button>
            </div>

            <div className="px-4 py-2">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg mb-2 flex items-center gap-3 transition-colors ${
                    currentView === item.id
                      ? 'bg-indigo-50 text-indigo-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-2xl">{item.icon}</span>
                  <span className="font-medium">{item.label}</span>
                </button>
              ))}

              {onSyncCrm && (
                <button
                  onClick={() => {
                    onSyncCrm()
                    setIsOpen(false)
                  }}
                  disabled={syncingCrm}
                  className={`w-full text-left px-4 py-3 rounded-lg mb-2 flex items-center gap-3 transition-colors ${
                    syncingCrm
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'text-green-700 hover:bg-green-50'
                  }`}
                >
                  <span className="text-2xl">🔄</span>
                  <span className="font-medium">{syncingCrm ? 'Syncing...' : 'Sync CRM'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}



