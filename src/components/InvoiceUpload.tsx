import { useState, useRef } from 'react'
import * as api from '../services/api'
import type { ExtractedInvoiceData, InvoiceUploadResponse } from '../services/api'

interface InvoiceUploadProps {
  onExtracted: (data: ExtractedInvoiceData) => void
  onCancel: () => void
}

export default function InvoiceUpload({ onExtracted, onCancel }: InvoiceUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [extractedData, setExtractedData] = useState<ExtractedInvoiceData | null>(null)
  const [rawText, setRawText] = useState<string>('')
  const [extractionId, setExtractionId] = useState<string>('')
  const [fullRawText, setFullRawText] = useState<string>('')
  const [showReview, setShowReview] = useState(false)
  const [reviewData, setReviewData] = useState<ExtractedInvoiceData | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (selectedFile: File) => {
    if (selectedFile.type !== 'application/pdf') {
      setError('Please select a PDF file')
      return
    }
    setFile(selectedFile)
    setError(null)
    setPreview(selectedFile.name)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      handleFileSelect(droppedFile)
    }
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      handleFileSelect(selectedFile)
    }
  }

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a PDF file')
      return
    }

    setUploading(true)
    setError(null)

    try {
      const result: InvoiceUploadResponse = await api.uploadInvoice(file)
      setExtractedData(result.extractedData)
      setRawText(result.rawText || '')
      setFullRawText(result.rawText || '') // Store full text for feedback
      setExtractionId(result.extractionId || Date.now().toString())
      setReviewData({ ...result.extractedData }) // Create editable copy
      setShowReview(true)
    } catch (err: any) {
      setError(err.message || 'Failed to process invoice')
    } finally {
      setUploading(false)
    }
  }

  const handleConfirm = async () => {
    if (reviewData && extractedData && extractionId) {
      // Check if user made corrections
      const hasCorrections = 
        reviewData.projectName !== extractedData.projectName ||
        reviewData.invoicedTotal !== extractedData.invoicedTotal ||
        reviewData.currency !== extractedData.currency ||
        reviewData.exchangeRate !== extractedData.exchangeRate ||
        reviewData.invoiceNumber !== extractedData.invoiceNumber ||
        reviewData.invoiceDate !== extractedData.invoiceDate ||
        reviewData.invoiceDueDate !== extractedData.invoiceDueDate;
      
      // Save feedback for ML learning if corrections were made
      if (hasCorrections) {
        try {
          await api.submitInvoiceFeedback({
            extractionId,
            rawText: fullRawText,
            extractedData,
            correctedData: reviewData,
          });
          // Silently save feedback - don't interrupt user flow
        } catch (err) {
          console.error('Failed to save feedback:', err);
          // Don't show error to user, just log it
        }
      }
      
      // Populate the form
      onExtracted(reviewData)
    }
  }

  const handleBackToUpload = () => {
    setShowReview(false)
    setReviewData(null)
    setExtractedData(null)
    setRawText('')
  }

  // Review/Edit step
  if (showReview && reviewData) {
    return (
      <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Review Extracted Data</h2>
        <p className="text-gray-600 mb-6">
          Review and edit the extracted information. Check the PDF text below if you need to verify values.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Editable Fields */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Project Name
              </label>
              <input
                type="text"
                value={reviewData.projectName || ''}
                onChange={(e) => setReviewData({ ...reviewData, projectName: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Enter project name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Invoice Number
              </label>
              <input
                type="text"
                value={reviewData.invoiceNumber || ''}
                onChange={(e) => setReviewData({ ...reviewData, invoiceNumber: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Invoice number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Currency
              </label>
              <select
                value={reviewData.currency || 'CZK'}
                onChange={(e) => setReviewData({ ...reviewData, currency: e.target.value as 'CZK' | 'EUR' })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="CZK">CZK</option>
                <option value="EUR">EUR</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Invoiced Total ({reviewData.currency || 'CZK'})
              </label>
              <input
                type="text"
                value={reviewData.invoicedTotal || ''}
                onChange={(e) => setReviewData({ ...reviewData, invoicedTotal: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="0.00"
              />
            </div>

            {reviewData.currency === 'EUR' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Exchange Rate (EUR to CZK)
                </label>
                <input
                  type="text"
                  value={reviewData.exchangeRate || ''}
                  onChange={(e) => setReviewData({ ...reviewData, exchangeRate: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="25.0"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Invoice Date
              </label>
              <input
                type="text"
                value={reviewData.invoiceDate || ''}
                onChange={(e) => setReviewData({ ...reviewData, invoiceDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="DD/MM/YYYY"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Due Date
              </label>
              <input
                type="text"
                value={reviewData.invoiceDueDate || ''}
                onChange={(e) => setReviewData({ ...reviewData, invoiceDueDate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="DD/MM/YYYY"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Number of MDs (Počet MJ)
              </label>
              <input
                type="text"
                value={reviewData.numberOfMDs || ''}
                onChange={(e) => setReviewData({ ...reviewData, numberOfMDs: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                MD Rate (Cena MJ)
              </label>
              <input
                type="text"
                value={reviewData.mdRate || ''}
                onChange={(e) => setReviewData({ ...reviewData, mdRate: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Client (Odběratel)
              </label>
              <input
                type="text"
                value={reviewData.client || ''}
                onChange={(e) => setReviewData({ ...reviewData, client: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Client company name"
              />
            </div>
          </div>

          {/* PDF Text Preview */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              PDF Text (for reference)
            </label>
            <div className="border border-gray-300 rounded-lg p-4 bg-gray-50 max-h-96 overflow-y-auto">
              <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
                {rawText || 'No text extracted'}
              </pre>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Use this text to find and verify values if the extraction missed something.
            </p>
          </div>
        </div>

        <div className="flex justify-end space-x-4 mt-6">
          <button
            onClick={handleBackToUpload}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Back
          </button>
          <button
            onClick={handleConfirm}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Use This Data
          </button>
        </div>
      </div>
    )
  }

  // Upload step
  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Upload Invoice PDF</h2>
      <p className="text-gray-600 mb-6">
        Upload a PDF invoice to automatically extract project information. You can review and edit the extracted data before creating the project.
      </p>

      {error && (
        <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-indigo-400 transition-colors cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleFileInputChange}
          className="hidden"
        />
        {preview ? (
          <div>
            <svg
              className="mx-auto h-12 w-12 text-indigo-500 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
            <p className="text-lg font-medium text-gray-900">{preview}</p>
            <p className="text-sm text-gray-500 mt-2">Click to select a different file</p>
          </div>
        ) : (
          <div>
            <svg
              className="mx-auto h-12 w-12 text-gray-400 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-lg font-medium text-gray-900 mb-2">
              Drop your PDF invoice here, or click to browse
            </p>
            <p className="text-sm text-gray-500">PDF files only (max 10MB)</p>
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-end space-x-4">
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Cancel
        </button>
        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? 'Processing...' : 'Extract Data'}
        </button>
      </div>
    </div>
  )
}

