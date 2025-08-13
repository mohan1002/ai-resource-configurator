'use client'

import React, { useState, useCallback } from 'react';
import { 
  Upload as UploadIcon,
  Download as DownloadIcon,
  FileText as FileTextIcon,
  Settings as SettingsIcon,
  AlertTriangle as AlertTriangleIcon,
  ChartColumn as ChartColumnIcon,
  Grid3x3 as Grid3x3Icon
} from 'lucide-react';
import { AIService } from '@/services/ai';
import { validateClients, validateWorkers, validateTasks } from '@/utils/validation';
import { ClientData, WorkerData, TaskData, ValidationError, Rule } from '@/types';
import { CONFIG } from '@/config';
import * as XLSX from 'xlsx';
import { AnimatedBackground } from '@/components/ui/animated-background';
import { FileUpload } from '@/components/ui/file-upload'
import DarkVeil from '@/components/ui/dark-veil'
import { DataGrid } from '@/components/ui/data-grid'

// Types
interface ClientData {
  ClientID: string
  ClientName: string
  PriorityLevel: number
  RequestedTaskIDs: string
  GroupTag: string
  AttributesJSON: string
}

interface WorkerData {
  WorkerID: string
  WorkerName: string
  Skills: string
  AvailableSlots: string
  MaxLoadPerPhase: number
  WorkerGroup: string
  QualificationLevel: number
}

interface TaskData {
  TaskID: string
  TaskName: string
  Category: string
  Duration: number
  RequiredSkills: string
  PreferredPhases: string
  MaxConcurrent: number
}

interface ValidationError {
  type: string
  message: string
  row: number
  column: string
}

export default function AIResourceConfigurator() {
  const [clientsData, setClientsData] = useState<ClientData[]>([])
  const [workersData, setWorkersData] = useState<WorkerData[]>([])
  const [tasksData, setTasksData] = useState<TaskData[]>([])
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([])
  const [activeTab, setActiveTab] = useState<'clients' | 'workers' | 'tasks' | 'rules'>('clients')
  const [rules, setRules] = useState<any[]>([])
  const [priorities, setPriorities] = useState({
    priorityLevel: 50,
    fairness: 30,
    efficiency: 70,
    workload: 40
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [filteredData, setFilteredData] = useState<any[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [ruleInput, setRuleInput] = useState('')
  const [aiValidationResults, setAiValidationResults] = useState<any>(null)
  const [searchResults, setSearchResults] = useState<any>(null)
  const [customRules, setCustomRules] = useState<any[]>([])
  const [isProcessing, setIsProcessing] = useState(false)

  // File upload handler
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>, type: 'clients' | 'workers' | 'tasks') => {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.name.endsWith('.xlsx')) {
      // Handle Excel files
      const reader = new FileReader()
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet)
        
        // Set data and run validations
        if (type === 'clients') {
          setClientsData(jsonData)
          validateClients(jsonData)
        } else if (type === 'workers') {
          setWorkersData(jsonData)
          validateWorkers(jsonData)
        } else if (type === 'tasks') {
          setTasksData(jsonData)
          validateTasks(jsonData)
        }

        // Add AI validation
        await performAIValidation(jsonData, type)
      }
      reader.readAsArrayBuffer(file)
    } else {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const text = e.target?.result as string
        const lines = text.split('\n')
        const headers = lines[0].split(',').map(h => h.trim())
        
        const data = lines.slice(1).filter(line => line.trim()).map((line, index) => {
          const values = line.split(',').map(v => v.trim())
          const obj: any = {}
          headers.forEach((header, i) => {
            obj[header] = values[i] || ''
          })
          return obj
        })

        // Set data and run validations
        if (type === 'clients') {
          setClientsData(data)
          validateClients(data)
        } else if (type === 'workers') {
          setWorkersData(data)
          validateWorkers(data)
        } else if (type === 'tasks') {
          setTasksData(data)
          validateTasks(data)
        }

        // Add AI validation
        await performAIValidation(data, type)
      }
      reader.readAsText(file)
    }
  }, [])

  // Basic validations
  const validateClients = (data: ClientData[]) => {
    const errors: ValidationError[] = []
    const ids = new Set()
    
    data.forEach((client, index) => {
      // Check for duplicate IDs
      if (ids.has(client.ClientID)) {
        errors.push({
          type: 'duplicate_id',
          message: `Duplicate ClientID: ${client.ClientID}`,
          row: index + 1,
          column: 'ClientID'
        })
      }
      ids.add(client.ClientID)

      // Check priority level range
      if (client.PriorityLevel < 1 || client.PriorityLevel > 5) {
        errors.push({
          type: 'out_of_range',
          message: `PriorityLevel must be 1-5, got: ${client.PriorityLevel}`,
          row: index + 1,
          column: 'PriorityLevel'
        })
      }

      // Check required fields
      if (!client.ClientID || !client.ClientName) {
        errors.push({
          type: 'missing_required',
          message: 'Missing required ClientID or ClientName',
          row: index + 1,
          column: 'ClientID/ClientName'
        })
      }
    })
    
    setValidationErrors(prev => [...prev.filter(e => e.type.indexOf('client') === -1), ...errors])
  }

  const validateWorkers = (data: WorkerData[]) => {
    const errors: ValidationError[] = []
    const ids = new Set()
    
    data.forEach((worker, index) => {
      if (ids.has(worker.WorkerID)) {
        errors.push({
          type: 'duplicate_id',
          message: `Duplicate WorkerID: ${worker.WorkerID}`,
          row: index + 1,
          column: 'WorkerID'
        })
      }
      ids.add(worker.WorkerID)

      if (!worker.WorkerID || !worker.WorkerName) {
        errors.push({
          type: 'missing_required',
          message: 'Missing required WorkerID or WorkerName',
          row: index + 1,
          column: 'WorkerID/WorkerName'
        })
      }

      if (worker.MaxLoadPerPhase < 1) {
        errors.push({
          type: 'out_of_range',
          message: 'MaxLoadPerPhase must be >= 1',
          row: index + 1,
          column: 'MaxLoadPerPhase'
        })
      }
    })
    
    setValidationErrors(prev => [...prev.filter(e => e.type.indexOf('worker') === -1), ...errors])
  }

  const validateTasks = (data: TaskData[]) => {
    const errors: ValidationError[] = []
    const ids = new Set()
    
    data.forEach((task, index) => {
      if (ids.has(task.TaskID)) {
        errors.push({
          type: 'duplicate_id',
          message: `Duplicate TaskID: ${task.TaskID}`,
          row: index + 1,
          column: 'TaskID'
        })
      }
      ids.add(task.TaskID)

      if (task.Duration < 1) {
        errors.push({
          type: 'out_of_range',
          message: 'Duration must be >= 1',
          row: index + 1,
          column: 'Duration'
        })
      }

      if (!task.TaskID || !task.TaskName) {
        errors.push({
          type: 'missing_required',
          message: 'Missing required TaskID or TaskName',
          row: index + 1,
          column: 'TaskID/TaskName'
        })
      }
    })
    
    setValidationErrors(prev => [...prev.filter(e => e.type.indexOf('task') === -1), ...errors])
  }

  // AI validation
  const performAIValidation = async (data: any, type: 'clients' | 'workers' | 'tasks') => {
    try {
      const aiValidation = await AIService.validateWithAI(data, type)
      
      if (!aiValidation.isValid) {
        setValidationErrors(prev => [
          ...prev,
          ...aiValidation.errors.map(error => ({
            type: `ai_${error.type}`,
            message: error.message,
            row: -1, // AI validation might not always map to specific rows
            column: 'AI Validation',
            suggestion: error.suggestion
          }))
        ])
      }
    } catch (error) {
      console.error('AI Validation failed:', error)
    }
  }

  // Natural language search
  const handleNaturalLanguageSearch = async (query: string) => {
    setIsProcessing(true)
    try {
      const results = await AIService.processNaturalLanguageQuery(query, 
        activeTab === 'clients' ? clientsData :
        activeTab === 'workers' ? workersData :
        tasksData
      )
      setSearchResults(results)
    } finally {
      setIsProcessing(false)
    }
  }

  // Add rule functionality
  const addRule = (type: string, data: any) => {
    const newRule = { id: Date.now(), type, ...data }
    setRules(prev => [...prev, newRule])
  }

  // Export functionality
  const exportData = () => {
    const exportPackage = {
      clients: clientsData,
      workers: workersData,
      tasks: tasksData,
      rules: rules,
      priorities: priorities
    }
    
    const blob = new Blob([JSON.stringify(exportPackage, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'resource-configuration.json'
    a.click()
  }

  const handleAIOperation = async (action: string, data: any) => {
    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, data }),
      });

      if (!response.ok) {
        throw new Error('AI operation failed');
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('AI operation error:', error);
      throw error;
    }
  };

  // Update your existing AI handlers to use handleAIOperation
  const handleSearch = async (query: string) => {
    setIsProcessing(true);
    try {
      const result = await handleAIOperation('search', {
        query,
        content: activeTab === 'clients' ? clientsData : 
                 activeTab === 'workers' ? workersData : tasksData
      });
      setSearchResults(result.result);
    } finally {
      setIsProcessing(false);
    }
  };

  const columns = {
    clients: [
      { field: 'ClientID', header: 'Client ID', sortable: true },
      { field: 'ClientName', header: 'Client Name', sortable: true },
      { field: 'PriorityLevel', header: 'Priority Level', sortable: true },
      { field: 'GroupTag', header: 'Group Tag', sortable: true }
    ],
    workers: [
      { field: 'WorkerID', header: 'Worker ID', sortable: true },
      { field: 'WorkerName', header: 'Worker Name', sortable: true },
      { field: 'Skills', header: 'Skills', sortable: true },
      { field: 'WorkerGroup', header: 'Group', sortable: true }
    ],
    tasks: [
      { field: 'TaskID', header: 'Task ID', sortable: true },
      { field: 'TaskName', header: 'Task Name', sortable: true },
      { field: 'Category', header: 'Category', sortable: true },
      { field: 'Duration', header: 'Duration', sortable: true },
      { field: 'RequiredSkills', header: 'Required Skills', sortable: true }
    ]
  }

  const tabs = [
    { id: 'upload', icon: <UploadIcon className="w-4 h-4" />, label: 'Upload' },
    { id: 'grid', icon: <Grid3x3Icon className="w-4 h-4" />, label: 'Data Grid' },
    { id: 'validation', icon: <AlertTriangleIcon className="w-4 h-4" />, label: 'Validation' },
    { id: 'rules', icon: <SettingsIcon className="w-4 h-4" />, label: 'Rules' },
    { id: 'priority', icon: <ChartColumnIcon className="w-4 h-4" />, label: 'Priority' },
    { id: 'export', icon: <DownloadIcon className="w-4 h-4" />, label: 'Export' }
  ]

  return (
    <>
      <AnimatedBackground />
      <DarkVeil />
      <main className="relative min-h-screen z-10">
        <div className="container mx-auto p-6 space-y-6">
          {/* Header Section */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold">Data Validation & Processing App</h1>
            <p className="text-muted-foreground">Upload, validate, and process your CSV/XLSX data with custom rules</p>
          </div>

          {/* File Upload Section */}
          <div className="bg-white rounded-lg border shadow-sm">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">File Upload & Parser</h2>
              <p className="text-sm text-muted-foreground">Upload your CSV or XLSX files for clients, workers, and tasks</p>
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { title: 'Clients Data', type: 'clients' },
                { title: 'Workers Data', type: 'workers' },
                { title: 'Tasks Data', type: 'tasks' }
              ].map(({ title, type }) => (
                <div key={type} className="bg-white rounded-lg border">
                  <div className="p-4 border-b">
                    <div className="flex items-center gap-2">
                      <FileTextIcon className="w-5 h-5" />
                      <h3 className="font-semibold">{title}</h3>
                    </div>
                  </div>
                  <div className="p-4">
                    <FileUpload
                      type={type as 'clients' | 'workers' | 'tasks'}
                      onUpload={(file) => handleUpload(file, type as 'clients' | 'workers' | 'tasks')}
                      accept=".csv,.xlsx"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tabs with correct spacing */}
          <div className="max-w-7xl mx-auto mb-6">
            <div dir="ltr" data-orientation="horizontal" className="w-full">
              <div role="tablist" className="h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground grid w-full grid-cols-6">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm flex items-center gap-2 ${
                      activeTab === tab.id ? 'data-[state=active]' : ''
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* AI Data Modifier with correct spacing */}
          <div className="max-w-7xl mx-auto data-modifier">
            <div className="flex items-center gap-2 mb-4">
              <span>✨</span>
              <h3 className="text-lg font-semibold">AI Data Modifier</h3>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g., Set PriorityLevel to 5 for clients in the 'Premium' group"
                className="flex-1 p-2 border rounded-lg"
                onKeyDown={(e) => e.key === 'Enter' && handleNaturalLanguageSearch(e.currentTarget.value)}
              />
              <button className="px-4 py-2 bg-black text-white rounded-lg">
                Generate Fix
              </button>
            </div>
            {isProcessing && <div className="text-blue-500">Processing...</div>}
            {searchResults && (
              <div className="mt-4 p-4 bg-gray-50 rounded">
                <pre>{JSON.stringify(searchResults, null, 2)}</pre>
              </div>
            )}
          </div>

          {/* Data Table with proper spacing */}
          <div className="max-w-7xl mx-auto overflow-x-auto bg-white rounded-lg border border-gray-200">
            {activeTab === 'grid' && (
              <div className="space-y-6">
                <DataGrid
                  data={
                    activeTab === 'clients' ? clientsData :
                    activeTab === 'workers' ? workersData :
                    tasksData
                  }
                  columns={columns[activeTab as keyof typeof columns]}
                  pageSize={10}
                />
              </div>
            )}
          </div>

          {/* Export section with correct spacing */}
          <div className="max-w-7xl mx-auto mt-8">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold mb-2">Export Configuration</h3>
              <p className="text-gray-600 mb-4">Download your cleaned data and rules</p>
              <button className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50">
                <DownloadIcon className="w-4 h-4" />
                Export All
              </button>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}