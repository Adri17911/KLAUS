import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import NotificationItem, { Notification } from '../Notification'

describe('Notification', () => {
  const mockNotification: Notification = {
    id: 'test-1',
    message: 'Test notification',
    type: 'info',
    duration: 5000,
  }

  const mockOnDismiss = vi.fn()

  it('renders notification message', () => {
    render(<NotificationItem notification={mockNotification} onDismiss={mockOnDismiss} />)
    expect(screen.getByText('Test notification')).toBeInTheDocument()
  })

  it('renders success notification with correct styling', () => {
    const successNotification = { ...mockNotification, type: 'success' as const }
    render(<NotificationItem notification={successNotification} onDismiss={mockOnDismiss} />)
    const notification = screen.getByRole('alert')
    expect(notification).toHaveClass('bg-green-50', 'border-green-200', 'text-green-800')
  })

  it('renders error notification with correct styling', () => {
    const errorNotification = { ...mockNotification, type: 'error' as const }
    render(<NotificationItem notification={errorNotification} onDismiss={mockOnDismiss} />)
    const notification = screen.getByRole('alert')
    expect(notification).toHaveClass('bg-red-50', 'border-red-200', 'text-red-800')
  })

  it('calls onDismiss when dismiss button is clicked', () => {
    render(<NotificationItem notification={mockNotification} onDismiss={mockOnDismiss} />)
    const dismissButton = screen.getByLabelText('Dismiss notification')
    dismissButton.click()
    expect(mockOnDismiss).toHaveBeenCalledWith('test-1')
  })

  it('auto-dismisses after duration', async () => {
    vi.useFakeTimers()
    const shortNotification = { ...mockNotification, duration: 1000 }
    render(<NotificationItem notification={shortNotification} onDismiss={mockOnDismiss} />)
    
    vi.advanceTimersByTime(1000)
    
    expect(mockOnDismiss).toHaveBeenCalledWith('test-1')
    vi.useRealTimers()
  })
})




