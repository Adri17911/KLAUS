import { useState, useEffect } from 'react'
import * as api from './services/api'
import type { SavedProject, User } from './services/api'
import { useAuth } from './contexts/AuthContext'
import Login from './components/Login'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'

type Currency = 'CZK' | 'EUR'
type View = 'calculator' | 'list' | 'overview' | 'users' | 'settings'

function App() {
  const { user, loading: authLoading, logout, canManageUsers, canManageProvision } = useAuth()
  const [view, setView] = useState<View>('calculator')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Provision percentages state
  const [provisionPercentages, setProvisionPercentages] = useState<number[]>([10, 15])
  
  // Calculator form state
  const [projectName, setProjectName] = useState('')
  const [invoicedTotal, setInvoicedTotal] = useState('')
  const [numberOfMDs, setNumberOfMDs] = useState('')
  const [mdRate, setMdRate] = useState('')
  const [currency, setCurrency] = useState<Currency>('CZK')
  const [exchangeRate, setExchangeRate] = useState('')
  const [costPerMD, setCostPerMD] = useState('5000')
  const [provisionPercent, setProvisionPercent] = useState<number | null>(null)

  // Saved projects state
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([])
  const [teamMembers, setTeamMembers] = useState<User[]>([])
  const [selectedTeamMemberFilter, setSelectedTeamMemberFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateRangeStart, setDateRangeStart] = useState('')
  const [dateRangeEnd, setDateRangeEnd] = useState('')
  const [showArchived, setShowArchived] = useState(false)

  // Load initial data from API
  useEffect(() => {
    if (!user) return
    
    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Load cost per MD setting
        const costPerMDValue = await api.getCostPerMD()
        setCostPerMD(costPerMDValue)
        
        // Load provision percentages
        const percentages = await api.getProvisionPercentages()
        setProvisionPercentages(percentages)
        
        // Load projects
        const projects = await api.getProjects()
        setSavedProjects(projects)
        
        // Load team members if user is team leader
        if (user.role === 'teamleader' || user.role === 'admin') {
          try {
            const members = await api.getUsers()
            setTeamMembers(members)
          } catch (err) {
            console.error('Error loading team members:', err)
          }
        }
      } catch (err) {
        setError('Failed to load data. Please check if the server is running.')
        console.error('Error loading data:', err)
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [user])

  // Save costPerMD to API when it changes
  useEffect(() => {
    if (costPerMD && !loading) {
      api.updateCostPerMD(costPerMD).catch(err => {
        console.error('Error saving cost per MD:', err)
        setError('Failed to save cost per MD setting')
      })
    }
  }, [costPerMD, loading])

  // Track if invoicedTotal was manually edited
  const [invoicedTotalManuallyEdited, setInvoicedTotalManuallyEdited] = useState(false)

  // Auto-calculate Invoiced Total when MDs and MD Rate are entered
  useEffect(() => {
    const mds = parseFloat(numberOfMDs) || 0
    const rate = parseFloat(mdRate) || 0
    
    if (mds > 0 && rate > 0) {
      const calculatedTotal = (mds * rate).toFixed(2)
      const currentTotal = parseFloat(invoicedTotal) || 0
      
      // Auto-fill if:
      // 1. invoicedTotal is empty/zero, OR
      // 2. It matches the calculated value (was previously auto-calculated), OR
      // 3. It hasn't been manually edited
      if (!invoicedTotal || invoicedTotal === '' || currentTotal === 0 || 
          Math.abs(currentTotal - parseFloat(calculatedTotal)) < 0.01 || 
          !invoicedTotalManuallyEdited) {
        setInvoicedTotal(calculatedTotal)
        setInvoicedTotalManuallyEdited(false)
      }
    }
  }, [numberOfMDs, mdRate])

  // Calculate cost
  const calculateCost = (): number => {
    const mds = parseFloat(numberOfMDs) || 0
    const cost = parseFloat(costPerMD) || 0
    return mds * cost
  }

  // Convert invoiced total to CZK if needed
  const getInvoicedTotalInCZK = (): number => {
    const total = parseFloat(invoicedTotal) || 0
    if (currency === 'EUR') {
      const rate = parseFloat(exchangeRate) || 1
      return total * rate
    }
    return total
  }

  // Calculate provision: (Invoiced amount - cost amount) * percentage
  const calculateProvision = (): number => {
    if (provisionPercent === null) return 0
    const invoicedCZK = getInvoicedTotalInCZK()
    const cost = calculateCost()
    return (invoicedCZK - cost) * (provisionPercent / 100)
  }

  const cost = calculateCost()
  const invoicedTotalCZK = getInvoicedTotalInCZK()
  const provision = calculateProvision()

  // Save project
  const handleSaveProject = async () => {
    if (!projectName || provisionPercent === null) {
      alert('Please fill in project name and select provision percentage')
      return
    }

    try {
      setError(null)
      const newProject = await api.createProject({
        projectName,
        invoicedTotal,
        numberOfMDs,
        mdRate,
        currency,
        exchangeRate,
        costPerMD,
        provisionPercent,
        cost,
        provision,
        invoicedTotalCZK,
        paymentReceivedDate: '',
        invoiceDueDate: '',
      })

      setSavedProjects([...savedProjects, newProject])
      resetForm()
      setView('list')
    } catch (err) {
      setError('Failed to save project')
      console.error('Error saving project:', err)
      alert('Failed to save project. Please try again.')
    }
  }

  // Reset form
  const resetForm = () => {
    setProjectName('')
    setInvoicedTotal('')
    setNumberOfMDs('')
    setMdRate('')
    setCurrency('CZK')
    setExchangeRate('')
    setProvisionPercent(null)
    setInvoicedTotalManuallyEdited(false)
  }

  // Load project for editing
  const handleEdit = (project: SavedProject) => {
    setEditingId(project.id)
    setProjectName(project.projectName)
    setInvoicedTotal(project.invoicedTotal)
    setNumberOfMDs(project.numberOfMDs)
    setMdRate(project.mdRate)
    setCurrency(project.currency)
    setExchangeRate(project.exchangeRate)
    setCostPerMD(project.costPerMD)
    setProvisionPercent(project.provisionPercent)
    setInvoicedTotalManuallyEdited(true) // Don't auto-calculate when editing
    setView('calculator')
  }

  // Update project
  const handleUpdateProject = async () => {
    if (!editingId || !projectName || provisionPercent === null) {
      alert('Please fill in project name and select provision percentage')
      return
    }

    try {
      setError(null)
      const existingProject = savedProjects.find(p => p.id === editingId)
      if (!existingProject) {
        throw new Error('Project not found')
      }

      const updatedProject = await api.updateProject(editingId, {
        projectName,
        invoicedTotal,
        numberOfMDs,
        mdRate,
        currency,
        exchangeRate,
        costPerMD,
        provisionPercent,
        cost,
        provision,
        invoicedTotalCZK,
        paymentReceivedDate: existingProject.paymentReceivedDate,
        invoiceDueDate: existingProject.invoiceDueDate,
      })

      setSavedProjects(savedProjects.map(p => p.id === editingId ? updatedProject : p))
      setEditingId(null)
      resetForm()
      setView('list')
    } catch (err) {
      setError('Failed to update project')
      console.error('Error updating project:', err)
      alert('Failed to update project. Please try again.')
    }
  }

  // Update payment/invoice dates
  const handleUpdateDates = async (id: string, field: 'paymentReceivedDate' | 'invoiceDueDate', value: string) => {
    try {
      const project = savedProjects.find(p => p.id === id)
      if (!project) return

      const updatedProject = await api.updateProject(id, {
        [field]: value,
      })

      setSavedProjects(savedProjects.map(p => p.id === id ? updatedProject : p))
    } catch (err) {
      console.error('Error updating dates:', err)
      setError('Failed to update date')
    }
  }

  // Archive project
  const handleArchive = async (id: string) => {
    try {
      setError(null)
      const updatedProject = await api.archiveProject(id)
      setSavedProjects(savedProjects.map(p => p.id === id ? updatedProject : p))
    } catch (err) {
      setError('Failed to archive project')
      console.error('Error archiving project:', err)
      alert('Failed to archive project. Please try again.')
    }
  }

  // Unarchive project
  const handleUnarchive = async (id: string) => {
    try {
      setError(null)
      const updatedProject = await api.unarchiveProject(id)
      setSavedProjects(savedProjects.map(p => p.id === id ? updatedProject : p))
    } catch (err) {
      setError('Failed to unarchive project')
      console.error('Error unarchiving project:', err)
      alert('Failed to unarchive project. Please try again.')
    }
  }

  // Delete project (permanent)
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this project? This action cannot be undone.')) {
      return
    }

    try {
      setError(null)
      await api.deleteProject(id)
      setSavedProjects(savedProjects.filter(p => p.id !== id))
    } catch (err) {
      setError('Failed to delete project')
      console.error('Error deleting project:', err)
      alert('Failed to delete project. Please try again.')
    }
  }

  // Show login if not authenticated
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Error message */}
        {error && (
          <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
            {error}
            <button
              onClick={() => setError(null)}
              className="float-right font-bold"
            >
              ×
            </button>
          </div>
        )}

        {/* Navigation */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <div></div>
            <UserProfileMenu user={user} logout={logout} canManageUsers={canManageUsers()} canManageProvision={canManageProvision()} onNavigate={setView} />
          </div>
          <div className="flex gap-4 justify-center flex-wrap">
            <button
              onClick={() => {
                setView('calculator')
                if (!editingId) resetForm()
                setEditingId(null)
              }}
              className={`px-6 py-2 rounded-lg font-medium transition-all duration-300 hover:scale-105 active:scale-95 ${
                view === 'calculator'
                  ? 'bg-indigo-600 text-white shadow-lg'
                  : 'bg-white text-gray-700 hover:bg-gray-50 shadow-md hover:shadow-lg'
              }`}
            >
              Calculator
            </button>
            <button
              onClick={() => setView('list')}
              className={`px-6 py-2 rounded-lg font-medium transition-all duration-300 hover:scale-105 active:scale-95 ${
                view === 'list'
                  ? 'bg-indigo-600 text-white shadow-lg'
                  : 'bg-white text-gray-700 hover:bg-gray-50 shadow-md hover:shadow-lg'
              }`}
            >
              Payable Commissions ({savedProjects.filter(p => !p.archived).length})
            </button>
            <button
              onClick={() => setView('overview')}
              className={`px-6 py-2 rounded-lg font-medium transition-all duration-300 hover:scale-105 active:scale-95 ${
                view === 'overview'
                  ? 'bg-indigo-600 text-white shadow-lg'
                  : 'bg-white text-gray-700 hover:bg-gray-50 shadow-md hover:shadow-lg'
              }`}
            >
              Overview
            </button>
            {canManageProvision() && (
              <button
                onClick={() => setView('settings')}
                className={`px-6 py-2 rounded-lg font-medium transition-all duration-300 hover:scale-105 active:scale-95 ${
                  view === 'settings'
                    ? 'bg-indigo-600 text-white shadow-lg'
                    : 'bg-white text-gray-700 hover:bg-gray-50 shadow-md hover:shadow-lg'
                }`}
              >
                Settings
              </button>
            )}
          </div>
        </div>

        {view === 'calculator' ? (
          <div className="bg-white rounded-lg shadow-xl p-6 md:p-8 animate-fadeIn">
            <h1 className="text-3xl font-bold text-gray-800 mb-2 animate-slideDown">KLAUS</h1>
            <p className="text-gray-600 mb-6 animate-slideUp">
              {editingId ? 'Edit Project' : 'Project Cost & Provision Calculator'}
            </p>

            <div className="space-y-6">
              {/* Project Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Name
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Enter project name"
                />
              </div>

              {/* Currency Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Currency
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="CZK"
                      checked={currency === 'CZK'}
                      onChange={(e) => setCurrency(e.target.value as Currency)}
                      className="mr-2"
                    />
                    <span className="text-gray-700">CZK</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value="EUR"
                      checked={currency === 'EUR'}
                      onChange={(e) => setCurrency(e.target.value as Currency)}
                      className="mr-2"
                    />
                    <span className="text-gray-700">EUR</span>
                  </label>
                </div>
              </div>

              {/* Invoiced Total */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Invoiced Total ({currency})
                  {numberOfMDs && mdRate && parseFloat(numberOfMDs) > 0 && parseFloat(mdRate) > 0 && (
                    <span className="text-xs text-gray-500 ml-2">(auto-calculated from MDs × Rate)</span>
                  )}
                </label>
                <input
                  type="number"
                  value={invoicedTotal}
                  onChange={(e) => {
                    setInvoicedTotal(e.target.value)
                    setInvoicedTotalManuallyEdited(true)
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="0"
                  step="0.01"
                />
              </div>

              {/* Exchange Rate (only shown for EUR) */}
              {currency === 'EUR' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Exchange Rate (EUR to CZK)
                  </label>
                  <input
                    type="number"
                    value={exchangeRate}
                    onChange={(e) => setExchangeRate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="25.0"
                    step="0.01"
                  />
                </div>
              )}

              {/* Number of MDs */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Number of MDs (Man-Days)
                </label>
                <input
                  type="number"
                  value={numberOfMDs}
                  onChange={(e) => setNumberOfMDs(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="0"
                  step="0.1"
                />
              </div>

              {/* MD Rate */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  MD Rate ({currency})
                </label>
                <input
                  type="number"
                  value={mdRate}
                  onChange={(e) => setMdRate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="0"
                  step="0.01"
                />
              </div>

              {/* Cost per MD (System Setting) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Cost per MD (CZK) - System Setting
                </label>
                <input
                  type="number"
                  value={costPerMD}
                  onChange={(e) => setCostPerMD(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-gray-50"
                  placeholder="5000"
                  step="0.01"
                />
                <p className="text-xs text-gray-500 mt-1">
                  This value is saved on the server
                </p>
              </div>

              {/* Provision Percentage */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Provision Percentage
                </label>
                <div className="flex gap-4 flex-wrap">
                  {provisionPercentages.map((percent) => (
                    <label key={percent} className="flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="provision"
                        checked={provisionPercent === percent}
                        onChange={() => setProvisionPercent(percent)}
                        className="mr-2 w-5 h-5 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-gray-700 text-lg font-medium">{percent}%</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Results Section */}
              <div className="mt-8 pt-6 border-t border-gray-200">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">
                  Calculations
                </h2>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-700">Total Cost (CZK):</span>
                    <span className="text-lg font-semibold text-gray-900">
                      {cost.toLocaleString('cs-CZ', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>

                  {currency === 'EUR' && (
                    <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                      <span className="text-gray-700">Invoiced Total (CZK):</span>
                      <span className="text-lg font-semibold text-blue-900">
                        {invoicedTotalCZK.toLocaleString('cs-CZ', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between items-center p-4 bg-indigo-50 rounded-lg border-2 border-indigo-200">
                    <span className="text-gray-700 font-medium">Provision (CZK):</span>
                    <span className="text-2xl font-bold text-indigo-900">
                      {provision.toLocaleString('cs-CZ', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Save/Update Button */}
              <div className="mt-6">
                {editingId ? (
                  <button
                    onClick={handleUpdateProject}
                    className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-indigo-700 transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
                  >
                    Update Project
                  </button>
                ) : (
                  <button
                    onClick={handleSaveProject}
                    className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-indigo-700 transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
                  >
                    Save to Payable Commissions
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : view === 'list' ? (
          <div className="bg-white rounded-lg shadow-xl p-6 md:p-8 animate-fadeIn">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-800 mb-2 animate-slideDown">Payable Commissions</h1>
                <p className="text-gray-600">Manage your saved projects</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {(user.role === 'teamleader' || user.role === 'admin') && teamMembers.length > 0 && (
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700">Team:</label>
                    <select
                      value={selectedTeamMemberFilter}
                      onChange={(e) => setSelectedTeamMemberFilter(e.target.value)}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm transition-all hover:border-indigo-500 focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="all">All Members</option>
                      {teamMembers.map(member => (
                        <option key={member.id} value={member.id}>{member.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">Show:</label>
                  <button
                    onClick={() => setShowArchived(!showArchived)}
                    className={`px-4 py-2 rounded-lg text-sm transition-all ${
                      showArchived 
                        ? 'bg-indigo-600 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {showArchived ? 'Active' : 'Archived'}
                  </button>
                </div>
              </div>
            </div>

            {/* Search and Date Range */}
            <div className="mb-6 space-y-4 animate-slideUp">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="Search projects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-2 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                  <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <div className="flex gap-2">
                  <input
                    type="date"
                    placeholder="Start date"
                    value={dateRangeStart}
                    onChange={(e) => setDateRangeStart(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                  <input
                    type="date"
                    placeholder="End date"
                    value={dateRangeEnd}
                    onChange={(e) => setDateRangeEnd(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                  {(dateRangeStart || dateRangeEnd) && (
                    <button
                      onClick={() => {
                        setDateRangeStart('')
                        setDateRangeEnd('')
                      }}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            {(() => {
              let filteredProjects = selectedTeamMemberFilter === 'all' 
                ? savedProjects 
                : savedProjects.filter(p => p.createdBy === selectedTeamMemberFilter)
              
              // Filter by archive status
              filteredProjects = filteredProjects.filter(p => showArchived ? p.archived : !p.archived)
              
              // Filter by search query
              if (searchQuery) {
                filteredProjects = filteredProjects.filter(p => 
                  p.projectName.toLowerCase().includes(searchQuery.toLowerCase())
                )
              }
              
              // Filter by date range
              if (dateRangeStart || dateRangeEnd) {
                filteredProjects = filteredProjects.filter(p => {
                  if (!p.createdAt) return false
                  const projectDate = new Date(p.createdAt)
                  if (dateRangeStart && projectDate < new Date(dateRangeStart)) return false
                  if (dateRangeEnd && projectDate > new Date(dateRangeEnd)) return false
                  return true
                })
              }
              
              return filteredProjects.length === 0 ? (
              <div className="text-center py-12 text-gray-500 animate-fadeIn">
                <p>No projects found.</p>
                <p className="mt-2">
                  {searchQuery || dateRangeStart || dateRangeEnd 
                    ? 'Try adjusting your filters.' 
                    : 'Use the calculator to create and save projects.'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredProjects.map((project, index) => {
                  const projectOwner = teamMembers.find(m => m.id === project.createdBy)
                  return (
                  <div
                    key={project.id}
                    className={`border rounded-lg p-6 transition-all duration-300 hover:shadow-lg hover:scale-[1.01] ${
                      project.archived 
                        ? 'border-gray-300 bg-gray-50 opacity-75' 
                        : 'border-gray-200 bg-white'
                    } animate-slideIn`}
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl font-semibold text-gray-800">
                            {project.projectName}
                          </h3>
                          {project.archived && (
                            <span className="px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded-full animate-pulse">
                              Archived
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          Created: {new Date(project.createdAt).toLocaleDateString()}
                        </p>
                        {projectOwner && (user.role === 'teamleader' || user.role === 'admin') && (
                          <p className="text-xs text-indigo-600 mt-1">
                            Owner: {projectOwner.name}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(project)}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all hover:scale-105 active:scale-95 text-sm shadow-md hover:shadow-lg"
                        >
                          Edit
                        </button>
                        {project.archived ? (
                          <button
                            onClick={() => handleUnarchive(project.id)}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all hover:scale-105 active:scale-95 text-sm shadow-md hover:shadow-lg"
                          >
                            Unarchive
                          </button>
                        ) : (
                          <button
                            onClick={() => handleArchive(project.id)}
                            className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-all hover:scale-105 active:scale-95 text-sm shadow-md hover:shadow-lg"
                          >
                            Archive
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(project.id)}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all hover:scale-105 active:scale-95 text-sm shadow-md hover:shadow-lg"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-xs text-gray-500">Invoiced Total</p>
                        <p className="font-semibold text-gray-800">
                          {project.invoicedTotal} {project.currency}
                          {project.currency === 'EUR' && (
                            <span className="text-sm text-gray-600 ml-2">
                              ({project.invoicedTotalCZK.toLocaleString('cs-CZ', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })} CZK)
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-xs text-gray-500">MDs</p>
                        <p className="font-semibold text-gray-800">{project.numberOfMDs}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-xs text-gray-500">Cost (CZK)</p>
                        <p className="font-semibold text-gray-800">
                          {project.cost.toLocaleString('cs-CZ', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </p>
                      </div>
                      <div className="bg-indigo-50 p-3 rounded-lg border-2 border-indigo-200">
                        <p className="text-xs text-gray-500">Provision ({project.provisionPercent}%)</p>
                        <p className="font-bold text-indigo-900 text-lg">
                          {project.provision.toLocaleString('cs-CZ', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })} CZK
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Payment Received Date
                        </label>
                        <input
                          type="date"
                          value={project.paymentReceivedDate}
                          onChange={(e) => handleUpdateDates(project.id, 'paymentReceivedDate', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Invoice Due Date
                        </label>
                        <input
                          type="date"
                          value={project.invoiceDueDate}
                          onChange={(e) => handleUpdateDates(project.id, 'invoiceDueDate', e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
              </div>
            )
            })()}
          </div>
        ) : view === 'overview' ? (
          <div className="bg-white rounded-lg shadow-xl p-6 md:p-8 animate-fadeIn">
            <h1 className="text-3xl font-bold text-gray-800 mb-2 animate-slideDown">Overview</h1>
            <p className="text-gray-600 mb-6 animate-slideUp">Month-over-month performance and invoicing</p>

            {/* Team Statistics (for Team Leaders and Admins) */}
            {(() => {
              // Filter out archived projects for overview
              const activeProjects = savedProjects.filter((p: SavedProject) => !p.archived)
              
              return (user.role === 'teamleader' || user.role === 'admin') && teamMembers.length > 0 ? (
              <div className="mb-8 p-6 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-lg border border-indigo-200">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Team Statistics</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-white p-4 rounded-lg shadow-sm transition-all hover:scale-105 hover:shadow-md">
                    <p className="text-sm text-gray-600 mb-1">Team Members</p>
                    <p className="text-2xl font-bold text-indigo-900">{teamMembers.length}</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm transition-all hover:scale-105 hover:shadow-md">
                    <p className="text-sm text-gray-600 mb-1">Team Projects</p>
                    <p className="text-2xl font-bold text-indigo-900">{activeProjects.length}</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg shadow-sm transition-all hover:scale-105 hover:shadow-md">
                    <p className="text-sm text-gray-600 mb-1">Team Total Provision</p>
                    <p className="text-2xl font-bold text-indigo-900">
                      {activeProjects.reduce((sum: number, p: SavedProject) => sum + p.provision, 0).toLocaleString('cs-CZ', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })} CZK
                    </p>
                  </div>
                </div>
                
                {/* Team Member Performance */}
                <div className="mt-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">Team Member Performance</h3>
                  <div className="space-y-3">
                    {teamMembers.map(member => {
                      const memberProjects = activeProjects.filter((p: SavedProject) => p.createdBy === member.id)
                      const memberTotalProvision = memberProjects.reduce((sum: number, p: SavedProject) => sum + p.provision, 0)
                      const memberTotalInvoiced = memberProjects.reduce((sum: number, p: SavedProject) => sum + p.invoicedTotalCZK, 0)
                      
                      return (
                        <div key={member.id} className="bg-white p-4 rounded-lg shadow-sm transition-all hover:scale-[1.02] hover:shadow-md">
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-semibold text-gray-800">{member.name}</p>
                              <p className="text-xs text-gray-500">{member.email}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-gray-600">Projects: <span className="font-semibold">{memberProjects.length}</span></p>
                              <p className="text-sm text-gray-600">Provision: <span className="font-semibold text-indigo-900">
                                {memberTotalProvision.toLocaleString('cs-CZ', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })} CZK
                              </span></p>
                              <p className="text-xs text-gray-500">Invoiced: {memberTotalInvoiced.toLocaleString('cs-CZ', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })} CZK</p>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
              ) : null
            })()}

            {(() => {
              // Filter out archived projects for overview
              const activeProjects = savedProjects.filter((p: SavedProject) => !p.archived)
              
              // Group projects by month based on invoice due date
              const monthlyData: Record<string, {
                month: string
                year: number
                monthIndex: number
                totalProvision: number
                totalToInvoice: number
                projectCount: number
                projects: SavedProject[]
              }> = {}

              activeProjects.forEach((project: SavedProject) => {
                if (project.invoiceDueDate) {
                  const date = new Date(project.invoiceDueDate)
                  const year = date.getFullYear()
                  const month = date.toLocaleString('en-US', { month: 'long' })
                  const monthKey = `${year}-${String(date.getMonth() + 1).padStart(2, '0')}`
                  
                  if (!monthlyData[monthKey]) {
                    monthlyData[monthKey] = {
                      month,
                      year,
                      monthIndex: date.getMonth(),
                      totalProvision: 0,
                      totalToInvoice: 0,
                      projectCount: 0,
                      projects: []
                    }
                  }
                  
                  monthlyData[monthKey].totalProvision += project.provision
                  monthlyData[monthKey].totalToInvoice += project.provision
                  monthlyData[monthKey].projectCount += 1
                  monthlyData[monthKey].projects.push(project)
                }
              })

              // Sort by year and month (newest first)
              const sortedMonths = Object.values(monthlyData).sort((a, b) => {
                if (a.year !== b.year) return b.year - a.year
                return b.monthIndex - a.monthIndex
              })

              // Calculate totals (excluding archived)
              const totalProvision = activeProjects.reduce((sum: number, p: SavedProject) => sum + p.provision, 0)
              const totalToInvoice = activeProjects
                .filter((p: SavedProject) => p.invoiceDueDate)
                .reduce((sum: number, p: SavedProject) => sum + p.provision, 0)

              return (
                <div className="space-y-6">
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-indigo-50 p-4 rounded-lg border-2 border-indigo-200">
                      <p className="text-sm text-gray-600 mb-1">Total Provision</p>
                      <p className="text-2xl font-bold text-indigo-900">
                        {totalProvision.toLocaleString('cs-CZ', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })} CZK
                      </p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg border-2 border-blue-200">
                      <p className="text-sm text-gray-600 mb-1">Total to Invoice</p>
                      <p className="text-2xl font-bold text-blue-900">
                        {totalToInvoice.toLocaleString('cs-CZ', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })} CZK
                      </p>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg border-2 border-green-200">
                      <p className="text-sm text-gray-600 mb-1">Total Projects</p>
                      <p className="text-2xl font-bold text-green-900">
                        {activeProjects.length}
                      </p>
                    </div>
                  </div>

                  {/* Charts Section */}
                  {sortedMonths.length > 0 && (
                    <div className="space-y-6">
                      {/* Monthly Provision Trend */}
                      <div>
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">
                          Monthly Provision Trend
                        </h2>
                        <div className="bg-white p-4 rounded-lg border border-gray-200">
                          <ResponsiveContainer width="100%" height={300}>
                            <LineChart
                              data={[...sortedMonths].reverse().map(m => ({
                                month: `${m.month.substring(0, 3)} ${m.year}`,
                                provision: m.totalProvision,
                                toInvoice: m.totalToInvoice
                              }))}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="month" />
                              <YAxis />
                              <Tooltip
                                formatter={(value: number) => [
                                  `${value.toLocaleString('cs-CZ', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })} CZK`,
                                  ''
                                ]}
                              />
                              <Legend />
                              <Line
                                type="monotone"
                                dataKey="provision"
                                stroke="#6366f1"
                                strokeWidth={2}
                                name="Total Provision"
                              />
                              <Line
                                type="monotone"
                                dataKey="toInvoice"
                                stroke="#3b82f6"
                                strokeWidth={2}
                                name="To Invoice"
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Monthly Invoicing Bar Chart */}
                      <div>
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">
                          Monthly Invoicing Amounts
                        </h2>
                        <div className="bg-white p-4 rounded-lg border border-gray-200">
                          <ResponsiveContainer width="100%" height={300}>
                            <BarChart
                              data={[...sortedMonths].reverse().map(m => ({
                                month: `${m.month.substring(0, 3)} ${m.year}`,
                                amount: m.totalToInvoice,
                                projects: m.projectCount
                              }))}
                            >
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="month" />
                              <YAxis />
                              <Tooltip
                                formatter={(value: number, name: string) => {
                                  if (name === 'amount') {
                                    return [
                                      `${value.toLocaleString('cs-CZ', {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })} CZK`,
                                      'Amount'
                                    ]
                                  }
                                  return [value, 'Projects']
                                }}
                              />
                              <Legend />
                              <Bar dataKey="amount" fill="#6366f1" name="Amount (CZK)" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Provision Percentage Breakdown */}
                      <div>
                        <h2 className="text-xl font-semibold text-gray-800 mb-4">
                          Provision Percentage Distribution
                        </h2>
                        <div className="bg-white p-4 rounded-lg border border-gray-200">
                          <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                              <Pie
                                data={provisionPercentages.map(percent => ({
                                  name: `${percent}% Provision`,
                                  value: savedProjects
                                    .filter(p => p.provisionPercent === percent)
                                    .reduce((sum, p) => sum + p.provision, 0)
                                })).filter(item => item.value > 0)}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) =>
                                  `${name}: ${((percent || 0) * 100).toFixed(0)}%`
                                }
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                              >
                                {provisionPercentages.map((_, index) => {
                                  const colors = ['#10b981', '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b']
                                  return <Cell key={index} fill={colors[index % colors.length]} />
                                })}
                              </Pie>
                              <Tooltip
                                formatter={(value: number) =>
                                  `${value.toLocaleString('cs-CZ', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })} CZK`
                                }
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Historical Comparison - Year over Year */}
                      {(() => {
                        const yearlyData: Record<number, number> = {}
                        activeProjects.forEach((project: SavedProject) => {
                          if (project.invoiceDueDate) {
                            const year = new Date(project.invoiceDueDate).getFullYear()
                            yearlyData[year] = (yearlyData[year] || 0) + project.provision
                          }
                        })
                        const years = Object.keys(yearlyData)
                          .map(Number)
                          .sort((a, b) => a - b)

                        if (years.length > 1) {
                          return (
                            <div>
                              <h2 className="text-xl font-semibold text-gray-800 mb-4">
                                Year-over-Year Comparison
                              </h2>
                              <div className="bg-white p-4 rounded-lg border border-gray-200">
                                <ResponsiveContainer width="100%" height={300}>
                                  <BarChart
                                    data={years.map(year => ({
                                      year: year.toString(),
                                      provision: yearlyData[year]
                                    }))}
                                  >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="year" />
                                    <YAxis />
                                    <Tooltip
                                      formatter={(value: number) => [
                                        `${value.toLocaleString('cs-CZ', {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })} CZK`,
                                        'Provision'
                                      ]}
                                    />
                                    <Legend />
                                    <Bar dataKey="provision" fill="#8b5cf6" name="Total Provision (CZK)" />
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            </div>
                          )
                        }
                        return null
                      })()}

                      {/* Month-over-Month Growth */}
                      {sortedMonths.length > 1 && (
                        <div>
                          <h2 className="text-xl font-semibold text-gray-800 mb-4">
                            Month-over-Month Growth
                          </h2>
                          <div className="bg-white p-4 rounded-lg border border-gray-200">
                            <ResponsiveContainer width="100%" height={300}>
                              <LineChart
                                data={[...sortedMonths]
                                  .reverse()
                                  .map((m, index, arr) => {
                                    const prevMonth = arr[index - 1]
                                    const growth =
                                      prevMonth
                                        ? ((m.totalProvision - prevMonth.totalProvision) /
                                            prevMonth.totalProvision) *
                                          100
                                        : 0
                                    return {
                                      month: `${m.month.substring(0, 3)} ${m.year}`,
                                      provision: m.totalProvision,
                                      growth: growth.toFixed(1)
                                    }
                                  })}
                              >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="month" />
                                <YAxis yAxisId="left" />
                                <YAxis yAxisId="right" orientation="right" />
                                <Tooltip
                                  formatter={(value: number, name: string) => {
                                    if (name === 'provision') {
                                      return [
                                        `${value.toLocaleString('cs-CZ', {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })} CZK`,
                                        'Provision'
                                      ]
                                    }
                                    return [`${value}%`, 'Growth']
                                  }}
                                />
                                <Legend />
                                <Line
                                  yAxisId="left"
                                  type="monotone"
                                  dataKey="provision"
                                  stroke="#6366f1"
                                  strokeWidth={2}
                                  name="Provision (CZK)"
                                />
                                <Line
                                  yAxisId="right"
                                  type="monotone"
                                  dataKey="growth"
                                  stroke="#10b981"
                                  strokeWidth={2}
                                  name="Growth %"
                                  strokeDasharray="5 5"
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Monthly Breakdown */}
                  <div>
                    <h2 className="text-xl font-semibold text-gray-800 mb-4">
                      Monthly Breakdown (Invoice Due Date)
                    </h2>
                    
                    {sortedMonths.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <p>No projects with invoice due dates yet.</p>
                        <p className="mt-2 text-sm">Add invoice due dates to projects to see monthly breakdown.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {sortedMonths.map((monthData) => {
                          const invoiceDate = new Date(monthData.year, monthData.monthIndex, 12)
                          const isPast = invoiceDate < new Date()
                          
                          return (
                            <div
                              key={`${monthData.year}-${monthData.monthIndex}`}
                              className={`border rounded-lg p-4 ${
                                isPast
                                  ? 'border-gray-200 bg-gray-50'
                                  : 'border-indigo-200 bg-indigo-50'
                              }`}
                            >
                              <div className="flex justify-between items-start mb-3">
                                <div>
                                  <h3 className="text-lg font-semibold text-gray-800">
                                    {monthData.month} {monthData.year}
                                  </h3>
                                  <p className="text-sm text-gray-600">
                                    Invoice payable on: {invoiceDate.toLocaleDateString('en-US', {
                                      day: 'numeric',
                                      month: 'long',
                                      year: 'numeric'
                                    })}
                                  </p>
                                  <p className="text-xs text-gray-500 mt-1">
                                    {monthData.projectCount} project{monthData.projectCount !== 1 ? 's' : ''}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-gray-500 mb-1">Total to Invoice</p>
                                  <p className="text-xl font-bold text-indigo-900">
                                    {monthData.totalToInvoice.toLocaleString('cs-CZ', {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })} CZK
                                  </p>
                                </div>
                              </div>
                              
                              {/* Project list for this month */}
                              <div className="mt-3 pt-3 border-t border-gray-200">
                                <details className="cursor-pointer">
                                  <summary className="text-sm text-gray-600 hover:text-gray-800">
                                    View projects ({monthData.projectCount})
                                  </summary>
                                  <div className="mt-2 space-y-2">
                                    {monthData.projects.map((project) => (
                                      <div
                                        key={project.id}
                                        className="bg-white p-3 rounded border border-gray-200"
                                      >
                                        <div className="flex justify-between items-center">
                                          <span className="font-medium text-gray-800">
                                            {project.projectName}
                                          </span>
                                          <span className="text-sm font-semibold text-indigo-700">
                                            {project.provision.toLocaleString('cs-CZ', {
                                              minimumFractionDigits: 2,
                                              maximumFractionDigits: 2,
                                            })} CZK
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </details>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}
          </div>
        ) : view === 'users' ? (
          <UserManagementView />
        ) : view === 'settings' ? (
          <SettingsView
            provisionPercentages={provisionPercentages}
            setProvisionPercentages={setProvisionPercentages}
          />
        ) : null}
      </div>
    </div>
  )
}

// User Management Component (Admin and Team Leader)
function UserManagementView() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'user' as 'admin' | 'teamleader' | 'user'
  })

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const usersData = await api.getUsers()
      setUsers(usersData)
    } catch (err: any) {
      setError(err.message || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      if (editingUser) {
        await api.updateUser(editingUser.id, formData)
      } else {
        await api.createUser(formData)
      }
      setShowAddForm(false)
      setEditingUser(null)
      setFormData({ email: '', password: '', name: '', role: 'user' })
      loadUsers()
    } catch (err: any) {
      setError(err.message || 'Failed to save user')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return
    try {
      await api.deleteUser(id)
      loadUsers()
    } catch (err: any) {
      setError(err.message || 'Failed to delete user')
    }
  }

  const handleEdit = (user: User) => {
    setEditingUser(user)
    setFormData({
      email: user.email,
      password: '',
      name: user.name,
      role: user.role
    })
    setShowAddForm(true)
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-xl p-6 md:p-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading users...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-xl p-6 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">User Management</h1>
        <button
          onClick={() => {
            setShowAddForm(!showAddForm)
            setEditingUser(null)
            setFormData({ email: '', password: '', name: '', role: 'user' })
          }}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          {showAddForm ? 'Cancel' : 'Add User'}
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {showAddForm && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">
            {editingUser ? 'Edit User' : 'Add New User'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password {editingUser && '(leave empty to keep current)'}
              </label>
              <input
                type="password"
                required={!editingUser}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                disabled={currentUser?.role === 'teamleader'} // Team leaders can only create users
              >
                <option value="user">User</option>
                {currentUser?.role === 'admin' && (
                  <>
                    <option value="teamleader">Team Leader</option>
                    <option value="admin">Admin</option>
                  </>
                )}
              </select>
              {currentUser?.role === 'teamleader' && (
                <p className="text-xs text-gray-500 mt-1">Team leaders can only create regular users</p>
              )}
            </div>
          </div>
          <button
            type="submit"
            className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            {editingUser ? 'Update User' : 'Create User'}
          </button>
        </form>
      )}

      <div className="space-y-4">
        {users.map((user) => (
          <div key={user.id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-semibold text-gray-800">{user.name}</h3>
                <p className="text-sm text-gray-600">{user.email}</p>
                <div className="flex gap-2 mt-1 flex-wrap">
                  <span className="text-xs px-2 py-1 bg-indigo-100 text-indigo-800 rounded capitalize">
                    {user.role}
                  </span>
                  {user.teamLeaderName && (
                    <span className="text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                      Team member of {user.teamLeaderName}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(user)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(user.id)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Settings Component (Team Leader and Admin)
function SettingsView({
  provisionPercentages,
  setProvisionPercentages
}: {
  provisionPercentages: number[]
  setProvisionPercentages: (percentages: number[]) => void
}) {
  const [localPercentages, setLocalPercentages] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    setLocalPercentages(provisionPercentages.join(', '))
  }, [provisionPercentages])

  const handleSave = async () => {
    setError('')
    setSuccess('')
    const percentages = localPercentages
      .split(',')
      .map(p => parseFloat(p.trim()))
      .filter(p => !isNaN(p) && p > 0 && p <= 100)

    if (percentages.length === 0) {
      setError('Please enter at least one valid percentage')
      return
    }

    try {
      setLoading(true)
      const updated = await api.updateProvisionPercentages(percentages)
      setProvisionPercentages(updated)
      setSuccess('Provision percentages updated successfully!')
    } catch (err: any) {
      setError(err.message || 'Failed to update provision percentages')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-xl p-6 md:p-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-2">Settings</h1>
      <p className="text-gray-600 mb-6">Manage provision percentages</p>

      {error && (
        <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Provision Percentages (comma-separated, e.g., 10, 15, 20)
          </label>
          <input
            type="text"
            value={localPercentages}
            onChange={(e) => setLocalPercentages(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            placeholder="10, 15"
          />
          <p className="text-xs text-gray-500 mt-1">
            Current values: {provisionPercentages.join(', ')}%
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={loading}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save Provision Percentages'}
        </button>
      </div>
    </div>
  )
}

// User Profile Menu Component
function UserProfileMenu({
  user,
  logout,
  canManageUsers,
  canManageProvision,
  onNavigate
}: {
  user: User
  logout: () => Promise<void>
  canManageUsers: boolean
  canManageProvision: boolean
  onNavigate: (view: View) => void
}) {
  const [isOpen, setIsOpen] = useState(false)

  // Get user initials for avatar
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2)
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('.user-profile-menu')) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  return (
    <div className="relative user-profile-menu">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/50 transition-colors"
      >
        <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-semibold text-sm shadow-md">
          {getInitials(user.name)}
        </div>
        <div className="text-left hidden md:block">
          <div className="text-sm font-semibold text-gray-800">{user.name}</div>
          <div className="text-xs text-gray-500 capitalize">{user.role}</div>
        </div>
        <svg
          className={`w-4 h-4 text-gray-600 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50">
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="text-sm font-semibold text-gray-800">{user.name}</div>
            <div className="text-xs text-gray-500">{user.email}</div>
            <div className="text-xs px-2 py-1 bg-indigo-100 text-indigo-800 rounded mt-2 inline-block capitalize">
              {user.role}
            </div>
          </div>
          
          <div className="py-1">
            {canManageProvision && (
              <button
                onClick={() => {
                  onNavigate('settings')
                  setIsOpen(false)
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Settings
                </div>
              </button>
            )}
            
            {canManageUsers && (
              <button
                onClick={() => {
                  onNavigate('users')
                  setIsOpen(false)
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  User Management
                </div>
              </button>
            )}
          </div>

          <div className="border-t border-gray-200 pt-1">
            <button
              onClick={() => {
                logout()
                setIsOpen(false)
              }}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Logout
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
