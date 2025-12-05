import { useState, useEffect } from 'react'
import * as api from './services/api'
import type { SavedProject } from './services/api'

type Currency = 'CZK' | 'EUR'
type View = 'calculator' | 'list'

function App() {
  const [view, setView] = useState<View>('calculator')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Calculator form state
  const [projectName, setProjectName] = useState('')
  const [invoicedTotal, setInvoicedTotal] = useState('')
  const [numberOfMDs, setNumberOfMDs] = useState('')
  const [mdRate, setMdRate] = useState('')
  const [currency, setCurrency] = useState<Currency>('CZK')
  const [exchangeRate, setExchangeRate] = useState('')
  const [costPerMD, setCostPerMD] = useState('5000')
  const [provisionPercent, setProvisionPercent] = useState<10 | 15 | null>(null)

  // Saved projects state
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([])

  // Load initial data from API
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Load cost per MD setting
        const costPerMDValue = await api.getCostPerMD()
        setCostPerMD(costPerMDValue)
        
        // Load projects
        const projects = await api.getProjects()
        setSavedProjects(projects)
      } catch (err) {
        setError('Failed to load data. Please check if the server is running.')
        console.error('Error loading data:', err)
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [])

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

  // Delete project
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project?')) {
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
        <div className="mb-6 flex gap-4 justify-center">
          <button
            onClick={() => {
              setView('calculator')
              if (!editingId) resetForm()
              setEditingId(null)
            }}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              view === 'calculator'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Calculator
          </button>
          <button
            onClick={() => setView('list')}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              view === 'list'
                ? 'bg-indigo-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            Payable Commissions ({savedProjects.length})
          </button>
        </div>

        {view === 'calculator' ? (
          <div className="bg-white rounded-lg shadow-xl p-6 md:p-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">KLAUS</h1>
            <p className="text-gray-600 mb-6">
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
                  onChange={(e) => setInvoicedTotal(e.target.value)}
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
                <div className="flex gap-4">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="provision"
                      checked={provisionPercent === 10}
                      onChange={() => setProvisionPercent(10)}
                      className="mr-2 w-5 h-5 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-gray-700 text-lg font-medium">10%</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="provision"
                      checked={provisionPercent === 15}
                      onChange={() => setProvisionPercent(15)}
                      className="mr-2 w-5 h-5 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-gray-700 text-lg font-medium">15%</span>
                  </label>
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
                    className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                  >
                    Update Project
                  </button>
                ) : (
                  <button
                    onClick={handleSaveProject}
                    className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
                  >
                    Save to Payable Commissions
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-xl p-6 md:p-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Payable Commissions</h1>
            <p className="text-gray-600 mb-6">Manage your saved projects</p>

            {savedProjects.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>No projects saved yet.</p>
                <p className="mt-2">Use the calculator to create and save projects.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {savedProjects.map((project) => (
                  <div
                    key={project.id}
                    className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-semibold text-gray-800">
                          {project.projectName}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          Created: {new Date(project.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEdit(project)}
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(project.id)}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
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
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default App
