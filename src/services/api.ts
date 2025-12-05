// Use relative path in production (nginx will proxy), absolute URL in development
const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api')

// Get auth token from localStorage
const getAuthToken = (): string | null => {
  return localStorage.getItem('klaus_token')
}

// Create headers with auth token
const getAuthHeaders = (): HeadersInit => {
  const token = getAuthToken()
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

export interface SavedProject {
  id: string
  projectName: string
  invoicedTotal: string
  numberOfMDs: string
  mdRate: string
  currency: 'CZK' | 'EUR'
  exchangeRate: string
  costPerMD: string
  provisionPercent: number
  cost: number
  provision: number
  invoicedTotalCZK: number
  paymentReceivedDate: string
  invoiceDueDate: string
  createdAt: string
  createdBy?: string
}

export interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'teamleader' | 'user'
  createdAt?: string
  createdBy?: string
  teamLeaderName?: string
}

// Auth API
export const login = async (email: string, password: string) => {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Login failed')
  }
  return await response.json()
}

export const logout = async () => {
  const response = await fetch(`${API_BASE_URL}/auth/logout`, {
    method: 'POST',
    headers: getAuthHeaders(),
  })
  if (!response.ok) throw new Error('Failed to logout')
}

export const getCurrentUser = async (): Promise<User> => {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: getAuthHeaders(),
  })
  if (!response.ok) throw new Error('Failed to fetch user')
  return await response.json()
}

// User management API (Admin only)
export const getUsers = async (): Promise<User[]> => {
  const response = await fetch(`${API_BASE_URL}/users`, {
    headers: getAuthHeaders(),
  })
  if (!response.ok) throw new Error('Failed to fetch users')
  return await response.json()
}

export const createUser = async (user: Omit<User, 'id' | 'createdAt'> & { password: string }): Promise<User> => {
  const response = await fetch(`${API_BASE_URL}/users`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(user),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create user')
  }
  return await response.json()
}

export const updateUser = async (id: string, user: Partial<User> & { password?: string }): Promise<User> => {
  const response = await fetch(`${API_BASE_URL}/users/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(user),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update user')
  }
  return await response.json()
}

export const deleteUser = async (id: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/users/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  })
  if (!response.ok) throw new Error('Failed to delete user')
}

// Provision percentage management (Team Leader and Admin)
export const getProvisionPercentages = async (): Promise<number[]> => {
  const response = await fetch(`${API_BASE_URL}/settings/provision-percentages`, {
    headers: getAuthHeaders(),
  })
  if (!response.ok) throw new Error('Failed to fetch provision percentages')
  const data = await response.json()
  return data.percentages || [10, 15]
}

export const updateProvisionPercentages = async (percentages: number[]): Promise<number[]> => {
  const response = await fetch(`${API_BASE_URL}/settings/provision-percentages`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ percentages }),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update provision percentages')
  }
  const data = await response.json()
  return data.percentages
}

// Get cost per MD setting
export const getCostPerMD = async (): Promise<string> => {
  const response = await fetch(`${API_BASE_URL}/settings/cost-per-md`, {
    headers: getAuthHeaders(),
  })
  if (!response.ok) throw new Error('Failed to fetch cost per MD')
  const data = await response.json()
  return data.costPerMD || '5000'
}

// Update cost per MD setting
export const updateCostPerMD = async (costPerMD: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/settings/cost-per-md`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ costPerMD }),
  })
  if (!response.ok) throw new Error('Failed to update cost per MD')
}

// Get all projects
export const getProjects = async (): Promise<SavedProject[]> => {
  const response = await fetch(`${API_BASE_URL}/projects`, {
    headers: getAuthHeaders(),
  })
  if (!response.ok) throw new Error('Failed to fetch projects')
  return await response.json()
}

// Get a single project
export const getProject = async (id: string): Promise<SavedProject> => {
  const response = await fetch(`${API_BASE_URL}/projects/${id}`, {
    headers: getAuthHeaders(),
  })
  if (!response.ok) throw new Error('Failed to fetch project')
  return await response.json()
}

// Create a new project
export const createProject = async (project: Omit<SavedProject, 'id' | 'createdAt'>): Promise<SavedProject> => {
  const response = await fetch(`${API_BASE_URL}/projects`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(project),
  })
  if (!response.ok) throw new Error('Failed to create project')
  return await response.json()
}

// Update a project
export const updateProject = async (id: string, project: Partial<SavedProject>): Promise<SavedProject> => {
  const response = await fetch(`${API_BASE_URL}/projects/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(project),
  })
  if (!response.ok) throw new Error('Failed to update project')
  return await response.json()
}

// Delete a project
export const deleteProject = async (id: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/projects/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  })
  if (!response.ok) throw new Error('Failed to delete project')
}
