import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { Notification, NotificationType } from '../components/Notification'

interface NotificationContextType {
  notifications: Notification[]
  showNotification: (message: string, type?: NotificationType, duration?: number) => void
  showSuccess: (message: string, duration?: number) => void
  showError: (message: string, duration?: number) => void
  showWarning: (message: string, duration?: number) => void
  showInfo: (message: string, duration?: number) => void
  dismissNotification: (id: string) => void
  dismissAll: () => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([])

  const showNotification = useCallback(
    (message: string, type: NotificationType = 'info', duration: number = 5000) => {
      const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const notification: Notification = {
        id,
        message,
        type,
        duration,
      }
      setNotifications((prev) => [...prev, notification])
      return id
    },
    []
  )

  const showSuccess = useCallback(
    (message: string, duration?: number) => {
      return showNotification(message, 'success', duration)
    },
    [showNotification]
  )

  const showError = useCallback(
    (message: string, duration?: number) => {
      return showNotification(message, 'error', duration || 7000) // Errors stay longer
    },
    [showNotification]
  )

  const showWarning = useCallback(
    (message: string, duration?: number) => {
      return showNotification(message, 'warning', duration)
    },
    [showNotification]
  )

  const showInfo = useCallback(
    (message: string, duration?: number) => {
      return showNotification(message, 'info', duration)
    },
    [showNotification]
  )

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }, [])

  const dismissAll = useCallback(() => {
    setNotifications([])
  }, [])

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        showNotification,
        showSuccess,
        showError,
        showWarning,
        showInfo,
        dismissNotification,
        dismissAll,
      }}
    >
      {children}
    </NotificationContext.Provider>
  )
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}




