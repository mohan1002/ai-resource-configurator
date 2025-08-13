'use client'

import { useState, useCallback } from 'react'
import { Upload, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function AIResourceConfigurator() {
  const [activeTab, setActiveTab] = useState('clients')
  const [searchQuery, setSearchQuery] = useState('')
  const [clientFile, setClientFile] = useState<File | null>(null)
  const [workerFile, setWorkerFile] = useState<File | null>(null)
  const [taskFile, setTaskFile] = useState<File | null>(null)

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>, type: 'clients' | 'workers' | 'tasks') => {
    const file = e.target.files?.[0]
    if (file) {
      switch (type) {
        case 'clients':
          setClientFile(file)
          break
        case 'workers':
          setWorkerFile(file)
          break
        case 'tasks':
          setTaskFile(file)
          break
      }
    }
  }, [])

  const handleSearch = () => {
    // Implement search logic
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span role="img" aria-label="rocket" className="text-2xl">🚀</span>
            <h1 className="text-2xl font-bold">AI Resource Configurator</h1>
          </div>
          <p className="text-gray-600">Upload, validate, and configure your resource allocation data</p>
        </div>

        {/* Upload Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {['Clients', 'Workers', 'Tasks'].map((type, index) => (
            <div key={type} className="bg-white p-6 rounded-lg shadow-sm border">
              <h2 className="text-lg font-semibold mb-4">{index + 1}. Upload {type}</h2>
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center">
                <input
                  type="file"
                  id={`upload-${type.toLowerCase()}`}
                  className="hidden"
                  onChange={(e) => handleFileUpload(e, type.toLowerCase() as any)}
                  accept=".csv,.xlsx"
                />
                <label htmlFor={`upload-${type.toLowerCase()}`} className="cursor-pointer">
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-6 h-6 text-gray-400" />
                    <span className="text-sm text-gray-500">Choose file {type.toLowerCase()}.xlsx</span>
                  </div>
                </label>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
          <div className="flex gap-4 border-b mb-6">
            {['Clients', 'Workers', 'Tasks', 'Rules'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab.toLowerCase() as any)}
                className={`px-4 py-2 -mb-px ${
                  activeTab === tab.toLowerCase()
                    ? 'border-b-2 border-black font-medium'
                    : 'text-gray-500'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Natural Language Search */}
          <div className="mb-6">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search using natural language... (e.g., workers with JavaScript skills)"
                className="flex-1 px-4 py-2 border rounded-lg"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Button onClick={() => handleSearch()}>
                Search
              </Button>
            </div>
          </div>

          {/* AI Data Modifier */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <span role="img" aria-label="sparkles" className="text-xl">✨</span>
              <h3 className="text-lg font-semibold">AI Data Modifier</h3>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g., Set PriorityLevel to 5 for clients in the 'Premium' group"
                className="flex-1 px-4 py-2 border rounded-lg"
              />
              <Button variant="default">
                Generate Fix
              </Button>
            </div>
          </div>

          {/* Data Tables */}
          {/* ... existing table code ... */}
        </div>

        {/* Export Section */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">Export Configuration</h3>
              <p className="text-gray-600">Download your cleaned data and rules</p>
            </div>
            <Button variant="outline" className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              Export All
            </Button>
          </div>
        </div>
      </div>
    </main>
  )
}