import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as api from '../api'

// Mock fetch globally
global.fetch = vi.fn()

describe('API Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  describe('login', () => {
    it('should login successfully with valid credentials', async () => {
      const mockResponse = {
        token: 'test-token',
        user: { id: '1', email: 'test@test.com', name: 'Test User', role: 'user' }
      }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const result = await api.login('test@test.com', 'password123')
      expect(result).toEqual(mockResponse)
      expect(localStorage.getItem('klaus_token')).toBe('test-token')
    })

    it('should throw error on invalid credentials', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'Invalid credentials' }),
      })

      await expect(api.login('test@test.com', 'wrong')).rejects.toThrow('Invalid credentials')
    })
  })

  describe('getProjects', () => {
    it('should fetch projects with auth token', async () => {
      localStorage.setItem('klaus_token', 'test-token')
      const mockProjects = [
        { id: '1', projectName: 'Test Project', invoicedTotal: '1000' }
      ]

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockProjects,
      })

      const result = await api.getProjects()
      expect(result).toEqual(mockProjects)
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/projects'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token'
          })
        })
      )
    })
  })

  describe('createProject', () => {
    it('should create a new project', async () => {
      localStorage.setItem('klaus_token', 'test-token')
      const newProject = {
        projectName: 'New Project',
        invoicedTotal: '5000',
        currency: 'CZK' as const,
        numberOfMDs: '10',
        mdRate: '1000',
        exchangeRate: '25',
        costPerMD: '5000',
        provisionPercent: 10,
        cost: 50000,
        provision: 0,
        invoicedTotalCZK: 5000,
        status: 'todo' as const,
        paymentReceivedDate: '',
        invoiceDueDate: '',
      }

      const mockCreatedProject = { ...newProject, id: 'new-id', createdAt: '2025-01-01' }

      ;(global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockCreatedProject,
      })

      const result = await api.createProject(newProject)
      expect(result).toEqual(mockCreatedProject)
    })
  })
})




