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
  projectType?: 'regular' | 'custom'
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
  customProfit?: number
  customCost?: number
  status?: 'todo' | 'in-progress' | 'done' | 'pending-review' | 'archived'
  paymentReceivedDate: string
  invoiceDueDate: string
  createdAt: string
  createdBy?: string
  archived?: boolean
  archivedAt?: string
  crmDealId?: string
  crmSyncedAt?: string
  client?: string
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

// Archive a project
export const archiveProject = async (id: string): Promise<SavedProject> => {
  const response = await fetch(`${API_BASE_URL}/projects/${id}/archive`, {
    method: 'POST',
    headers: getAuthHeaders(),
  })
  if (!response.ok) throw new Error('Failed to archive project')
  return await response.json()
}

// Unarchive a project
export const unarchiveProject = async (id: string): Promise<SavedProject> => {
  const response = await fetch(`${API_BASE_URL}/projects/${id}/unarchive`, {
    method: 'POST',
    headers: getAuthHeaders(),
  })
  if (!response.ok) throw new Error('Failed to unarchive project')
  return await response.json()
}

// CRM Integration API (READ-ONLY - only reads from CRM, never writes)
export interface CrmConfig {
  configured: boolean
  crmType?: string
  apiUrl?: string
  hasApiKey?: boolean
  authMethod?: 'apiKey' | 'oauth' | 'manual'
  hasOauthToken?: boolean
}

export interface CrmSyncResult {
  success: boolean
  imported: number
  skipped: number
  details: {
    new: string[]
    skipped: Array<{ name: string; reason: string }>
  }
}

// Get CRM configuration
export const getCrmConfig = async (): Promise<CrmConfig> => {
  const response = await fetch(`${API_BASE_URL}/crm/config`, {
    headers: getAuthHeaders(),
  })
  if (!response.ok) throw new Error('Failed to fetch CRM configuration')
  return await response.json()
}

// Update CRM configuration
export const updateCrmConfig = async (config: {
  crmType: string
  apiUrl?: string
  apiKey?: string
  authMethod?: 'apiKey' | 'oauth' | 'manual'
  oauthToken?: string
}): Promise<{ success: boolean; configured: boolean }> => {
  const response = await fetch(`${API_BASE_URL}/crm/config`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(config),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update CRM configuration')
  }
  return await response.json()
}

// Manual import from JSON data
export const importCrmData = async (deals: any[]): Promise<CrmSyncResult> => {
  const response = await fetch(`${API_BASE_URL}/crm/import`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ deals }),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to import CRM data')
  }
  return await response.json()
}

// Sync with CRM (READ-ONLY: Only reads from CRM, creates projects in KLAUS with "pending-review" status)
export const syncCrm = async (): Promise<CrmSyncResult> => {
  const response = await fetch(`${API_BASE_URL}/crm/sync`, {
    method: 'POST',
    headers: getAuthHeaders(),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || error.message || 'Failed to sync with CRM')
  }
  return await response.json()
}

// Test CRM connection (READ-ONLY)
export const testCrmConnection = async (): Promise<{ success: boolean; message: string }> => {
  const response = await fetch(`${API_BASE_URL}/crm/test`, {
    method: 'POST',
    headers: getAuthHeaders(),
  })
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Failed to test CRM connection')
  }
  return await response.json()
}

// Invoice upload and extraction
export interface ExtractedInvoiceData {
  projectName: string
  invoicedTotal: string
  currency: 'CZK' | 'EUR'
  exchangeRate: string
  invoiceDate: string
  invoiceDueDate: string
  invoiceNumber: string
  numberOfMDs?: string  // Počet MJ
  mdRate?: string       // Cena MJ
  client?: string       // Odběratel / Client
}

export interface InvoiceUploadResponse {
  success: boolean
  extractedData: ExtractedInvoiceData
  rawText?: string
  extractionId?: string
}

export interface InvoiceFeedback {
  extractionId: string
  rawText: string
  extractedData: ExtractedInvoiceData
  correctedData: ExtractedInvoiceData
}

export const uploadInvoice = async (file: File): Promise<InvoiceUploadResponse> => {
  const formData = new FormData()
  formData.append('invoice', file)

  const token = getAuthToken()
  const headers: HeadersInit = {}
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${API_BASE_URL}/invoices/upload`, {
    method: 'POST',
    headers,
    body: formData,
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to upload and extract invoice')
  }
  
  return await response.json()
}

// Submit feedback for ML learning
export const submitInvoiceFeedback = async (feedback: InvoiceFeedback): Promise<{ success: boolean; message: string }> => {
  const response = await fetch(`${API_BASE_URL}/invoices/feedback`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(feedback),
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to submit feedback')
  }
  
  return await response.json()
}
