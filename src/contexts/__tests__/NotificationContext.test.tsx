import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { NotificationProvider, useNotifications } from '../NotificationContext'

// Test component that uses the notification context
function TestComponent() {
  const { showSuccess, showError, showWarning, showInfo, notifications, dismissNotification } = useNotifications()

  return (
    <div>
      <button onClick={() => showSuccess('Success message')}>Show Success</button>
      <button onClick={() => showError('Error message')}>Show Error</button>
      <button onClick={() => showWarning('Warning message')}>Show Warning</button>
      <button onClick={() => showInfo('Info message')}>Show Info</button>
      <div data-testid="notifications-count">{notifications.length}</div>
      {notifications.map((n) => (
        <div key={n.id} data-testid={`notification-${n.id}`}>
          {n.message}
          <button onClick={() => dismissNotification(n.id)}>Dismiss</button>
        </div>
      ))}
    </div>
  )
}

describe('NotificationContext', () => {
  it('provides notification functions', () => {
    render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    )

    expect(screen.getByText('Show Success')).toBeInTheDocument()
    expect(screen.getByText('Show Error')).toBeInTheDocument()
    expect(screen.getByText('Show Warning')).toBeInTheDocument()
    expect(screen.getByText('Show Info')).toBeInTheDocument()
  })

  it('shows success notification', async () => {
    render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    )

    const button = screen.getByText('Show Success')
    button.click()

    await waitFor(() => {
      expect(screen.getByText('Success message')).toBeInTheDocument()
    })
  })

  it('dismisses notification when button is clicked', async () => {
    render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    )

    const showButton = screen.getByText('Show Success')
    showButton.click()

    await waitFor(() => {
      expect(screen.getByText('Success message')).toBeInTheDocument()
    })

    const dismissButton = screen.getByText('Dismiss')
    dismissButton.click()

    await waitFor(() => {
      expect(screen.queryByText('Success message')).not.toBeInTheDocument()
    })
  })
})




