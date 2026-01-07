interface DesktopNavigationProps {
  currentView: string
  onNavigate: (view: string) => void
  projectCount: number
  canManageUsers: boolean
  canManageProvision: boolean
  onSyncCrm?: () => void
  syncingCrm?: boolean
  onResetForm?: () => void
  editingId?: string | null
}

export default function DesktopNavigation({
  currentView,
  onNavigate,
  projectCount,
  canManageProvision,
  onSyncCrm,
  syncingCrm = false,
  onResetForm,
  editingId,
}: DesktopNavigationProps) {
  return (
    <div className="hidden md:flex gap-4 justify-center flex-wrap">
      <button
        onClick={() => {
          onNavigate('calculator')
          if (!editingId && onResetForm) onResetForm()
        }}
        className={`px-6 py-2 rounded-lg font-medium transition-all duration-300 hover:scale-105 active:scale-95 ${
          currentView === 'calculator'
            ? 'bg-indigo-600 text-white shadow-lg'
            : 'bg-white text-gray-700 hover:bg-gray-50 shadow-md hover:shadow-lg'
        }`}
      >
        Calculator
      </button>
      <button
        onClick={() => onNavigate('list')}
        className={`px-6 py-2 rounded-lg font-medium transition-all duration-300 hover:scale-105 active:scale-95 ${
          currentView === 'list'
            ? 'bg-indigo-600 text-white shadow-lg'
            : 'bg-white text-gray-700 hover:bg-gray-50 shadow-md hover:shadow-lg'
        }`}
      >
        Payable Commissions ({projectCount})
      </button>
      <button
        onClick={() => onNavigate('kanban')}
        className={`px-6 py-2 rounded-lg font-medium transition-all duration-300 hover:scale-105 active:scale-95 ${
          currentView === 'kanban'
            ? 'bg-indigo-600 text-white shadow-lg'
            : 'bg-white text-gray-700 hover:bg-gray-50 shadow-md hover:shadow-lg'
        }`}
      >
        Kanban Board
      </button>
      {onSyncCrm && (
        <button
          onClick={onSyncCrm}
          disabled={syncingCrm}
          className={`px-6 py-2 rounded-lg font-medium transition-all duration-300 hover:scale-105 active:scale-95 ${
            syncingCrm
              ? 'bg-gray-400 text-white cursor-not-allowed'
              : 'bg-green-600 text-white shadow-md hover:shadow-lg hover:bg-green-700'
          }`}
        >
          {syncingCrm ? 'Syncing...' : '🔄 Sync CRM'}
        </button>
      )}
      <button
        onClick={() => onNavigate('overview')}
        className={`px-6 py-2 rounded-lg font-medium transition-all duration-300 hover:scale-105 active:scale-95 ${
          currentView === 'overview'
            ? 'bg-indigo-600 text-white shadow-lg'
            : 'bg-white text-gray-700 hover:bg-gray-50 shadow-md hover:shadow-lg'
        }`}
      >
        Overview
      </button>
      {canManageProvision && (
        <button
          onClick={() => onNavigate('settings')}
          className={`px-6 py-2 rounded-lg font-medium transition-all duration-300 hover:scale-105 active:scale-95 ${
            currentView === 'settings'
              ? 'bg-indigo-600 text-white shadow-lg'
              : 'bg-white text-gray-700 hover:bg-gray-50 shadow-md hover:shadow-lg'
          }`}
        >
          Settings
        </button>
      )}
    </div>
  )
}



