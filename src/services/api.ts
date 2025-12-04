// Use relative path in production (nginx will proxy), absolute URL in development
const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:3001/api')

export interface SavedProject {
  id: string
  projectName: string
  invoicedTotal: string
  numberOfMDs: string
  mdRate: string
  currency: 'CZK' | 'EUR'
  exchangeRate: string
  costPerMD: string
  provisionPercent: 10 | 15
  cost: number
  provision: number
  invoicedTotalCZK: number
  paymentReceivedDate: string
  invoiceDueDate: string
  createdAt: string
}

// Get cost per MD setting
export const getCostPerMD = async (): Promise<string> => {
  const response = await fetch(`${API_BASE_URL}/settings/cost-per-md`)
  if (!response.ok) throw new Error('Failed to fetch cost per MD')
  const data = await response.json()
  return data.costPerMD || '5000'
}

// Update cost per MD setting
export const updateCostPerMD = async (costPerMD: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/settings/cost-per-md`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ costPerMD }),
  })
  if (!response.ok) throw new Error('Failed to update cost per MD')
}

// Get all projects
export const getProjects = async (): Promise<SavedProject[]> => {
  const response = await fetch(`${API_BASE_URL}/projects`)
  if (!response.ok) throw new Error('Failed to fetch projects')
  return await response.json()
}

// Get a single project
export const getProject = async (id: string): Promise<SavedProject> => {
  const response = await fetch(`${API_BASE_URL}/projects/${id}`)
  if (!response.ok) throw new Error('Failed to fetch project')
  return await response.json()
}

// Create a new project
export const createProject = async (project: Omit<SavedProject, 'id' | 'createdAt'>): Promise<SavedProject> => {
  const response = await fetch(`${API_BASE_URL}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(project),
  })
  if (!response.ok) throw new Error('Failed to create project')
  return await response.json()
}

// Update a project
export const updateProject = async (id: string, project: Partial<SavedProject>): Promise<SavedProject> => {
  const response = await fetch(`${API_BASE_URL}/projects/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(project),
  })
  if (!response.ok) throw new Error('Failed to update project')
  return await response.json()
}

// Delete a project
export const deleteProject = async (id: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/projects/${id}`, {
    method: 'DELETE',
  })
  if (!response.ok) throw new Error('Failed to delete project')
}

