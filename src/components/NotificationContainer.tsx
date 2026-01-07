import { Notification } from './Notification'
import NotificationItem from './Notification'

interface NotificationContainerProps {
  notifications: Notification[]
  onDismiss: (id: string) => void
}

export default function NotificationContainer({ notifications, onDismiss }: NotificationContainerProps) {
  if (notifications.length === 0) return null

  return (
    <div
      className="fixed top-4 right-2 md:right-4 z-50 flex flex-col items-end max-w-[calc(100vw-1rem)] md:max-w-md"
      role="region"
      aria-label="Notifications"
    >
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  )
}


