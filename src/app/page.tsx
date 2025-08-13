"use client";

import { useMemo, useState } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { FileUpload } from "@/components/ui/file-upload";
import { DataGrid } from "@/components/ui/data-grid";
import { Sparkles, AlertTriangle, SlidersHorizontal } from "lucide-react";

// Types
type DatasetType = "clients" | "workers" | "tasks";

type GenericRow = Record<string, any>;

// Sample data to match the screenshot until files are uploaded
const sampleTasks: GenericRow[] = [
    {
        TaskID: "T001",
        TaskName: "Install Sink",
        Category: "Plumbing",
        DurationPhases: 2,
        RequiredSkills: "carpentry",
        PreferredPhases: "[1,2]",
        MaxConcurrent: 1,
    },
    {
        TaskID: "T002",
        TaskName: "Fix Light",
        Category: "Electrical",
        DurationPhases: 1,
        RequiredSkills: "carpentry",
        PreferredPhases: "1-3",
        MaxConcurrent: 1,
    },
    {
        TaskID: "T003",
        TaskName: "Paint Wall",
        Category: "Painting",
        DurationPhases: 3,
        RequiredSkills: "carpentry",
        PreferredPhases: "[2,3,4]",
        MaxConcurrent: 1,
    },
];

// Columns for the Tasks grid (visually similar to screenshot)
const taskColumns = [
    { field: "TaskID", header: "Task ID", sortable: true, width: "120px" },
    { field: "TaskName", header: "Task Name", sortable: true, width: "220px" },
    { field: "Category", header: "Category", sortable: true, width: "160px" },
    {
        field: "DurationPhases",
        header: "Duration (Phases)",
        sortable: true,
        width: "160px",
    },
    {
        field: "RequiredSkills",
        header: "Required Skills",
        sortable: true,
        width: "160px",
    },
    {
        field: "PreferredPhases",
        header: "Preferred Phases",
        sortable: false,
        width: "160px"
    },
    { field: "MaxConcurrent", header: "Max Concurrent", width: "160px" },
];

// Parse CSV or XLSX into array of objects
async function parseFile(file: File): Promise<GenericRow[]> {
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "csv") {
        return new Promise((resolve, reject) => {
            Papa.parse<GenericRow>(file, {
                header: true,
                skipEmptyLines: true,
                complete: (res) => resolve(res.data as GenericRow[]),
                error: (err) => reject(err),
            });
        });
    }

    if (ext === "xlsx" || ext === "xls") {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json<GenericRow>(sheet, { defval: "" });
        return json as GenericRow[];
    }

    // Fallback: try CSV parser
    return new Promise((resolve, reject) => {
        Papa.parse<GenericRow>(file, {
            header: true,
            skipEmptyLines: true,
            complete: (res) => resolve(res.data as GenericRow[]),
            error: (err) => reject(err),
        });
    });
}

// --- Validation Helpers ---
type ValidationError = {
  type: string;
  message: string;
  entity?: string;
  rowIndex?: number;
  field?: string;
};

function validateClients(clients: GenericRow[], tasks: GenericRow[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const ids = new Set<string>();
  const taskIDs = new Set(tasks.map((t) => t.TaskID));
  clients.forEach((row, i) => {
    // Duplicate IDs
    if (ids.has(row.ClientID)) {
      errors.push({ type: "DuplicateID", message: `Duplicate ClientID: ${row.ClientID}`, entity: "clients", rowIndex: i, field: "ClientID" });
    }
    ids.add(row.ClientID);

    // PriorityLevel out of range
    if (row.PriorityLevel && (row.PriorityLevel < 1 || row.PriorityLevel > 5)) {
      errors.push({ type: "OutOfRange", message: `PriorityLevel must be 1-5`, entity: "clients", rowIndex: i, field: "PriorityLevel" });
    }

    // RequestedTaskIDs unknown
    if (row.RequestedTaskIDs) {
      const requested = String(row.RequestedTaskIDs).split(",").map((x) => x.trim());
      requested.forEach((tid) => {
        if (tid && !taskIDs.has(tid)) {
          errors.push({ type: "UnknownReference", message: `RequestedTaskID ${tid} not found in tasks`, entity: "clients", rowIndex: i, field: "RequestedTaskIDs" });
        }
      });
    }

    // Broken JSON in AttributesJSON
    if (row.AttributesJSON) {
      try {
        JSON.parse(row.AttributesJSON);
      } catch {
        errors.push({ type: "BrokenJSON", message: `AttributesJSON is not valid JSON`, entity: "clients", rowIndex: i, field: "AttributesJSON" });
      }
    }
  });
  return errors;
}

function validateWorkers(workers: GenericRow[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const ids = new Set<string>();
  workers.forEach((row, i) => {
    // Duplicate IDs
    if (ids.has(row.WorkerID)) {
      errors.push({ type: "DuplicateID", message: `Duplicate WorkerID: ${row.WorkerID}`, entity: "workers", rowIndex: i, field: "WorkerID" });
    }
    ids.add(row.WorkerID);

    // Malformed AvailableSlots
    if (row.AvailableSlots) {
      let slots: number[] = [];
      try {
        if (typeof row.AvailableSlots === "string") {
          slots = JSON.parse(row.AvailableSlots.replace(/'/g, '"'));
        } else {
          slots = row.AvailableSlots;
        }
        if (!Array.isArray(slots) || slots.some((s) => typeof s !== "number")) {
          throw new Error();
        }
      } catch {
        errors.push({ type: "MalformedList", message: `AvailableSlots must be a numeric array`, entity: "workers", rowIndex: i, field: "AvailableSlots" });
      }
    }

    // MaxLoadPerPhase missing or not a number
    if (row.MaxLoadPerPhase && isNaN(Number(row.MaxLoadPerPhase))) {
      errors.push({ type: "MalformedValue", message: `MaxLoadPerPhase must be a number`, entity: "workers", rowIndex: i, field: "MaxLoadPerPhase" });
    }
  });
  return errors;
}

function validateTasks(tasks: GenericRow[], workers: GenericRow[]): ValidationError[] {
  const errors: ValidationError[] = [];
  const ids = new Set<string>();
  const workerSkills = new Set(
    workers.flatMap((w) => String(w.Skills || "").split(",").map((s) => s.trim()))
  );
  tasks.forEach((row, i) => {
    // Duplicate IDs
    if (ids.has(row.TaskID)) {
      errors.push({ type: "DuplicateID", message: `Duplicate TaskID: ${row.TaskID}`, entity: "tasks", rowIndex: i, field: "TaskID" });
    }
    ids.add(row.TaskID);

    // Duration < 1
    if (row.DurationPhases && Number(row.DurationPhases) < 1) {
      errors.push({ type: "OutOfRange", message: `DurationPhases must be >= 1`, entity: "tasks", rowIndex: i, field: "DurationPhases" });
    }

    // RequiredSkills not covered by any worker
    if (row.RequiredSkills) {
      const required = String(row.RequiredSkills).split(",").map((x) => x.trim());
      required.forEach((skill) => {
        if (skill && !workerSkills.has(skill)) {
          errors.push({ type: "SkillCoverage", message: `RequiredSkill ${skill} not found in any worker`, entity: "tasks", rowIndex: i, field: "RequiredSkills" });
        }
      });
    }

    // PreferredPhases malformed
    if (row.PreferredPhases) {
      const val = String(row.PreferredPhases);
      let valid = false;
      if (/^\[\d+(,\d+)*\]$/.test(val)) valid = true;
      if (/^\d+-\d+$/.test(val)) valid = true;
      if (!valid) {
        errors.push({ type: "MalformedList", message: `PreferredPhases must be a list [1,2] or range 1-3`, entity: "tasks", rowIndex: i, field: "PreferredPhases" });
      }
    }

    // MaxConcurrent missing or not a number
    if (row.MaxConcurrent && isNaN(Number(row.MaxConcurrent))) {
      errors.push({ type: "MalformedValue", message: `MaxConcurrent must be a number`, entity: "tasks", rowIndex: i, field: "MaxConcurrent" });
    }
  });
  return errors;
}

// --- Main Component ---
export default function Home() {
    // Uploaded/parsed datasets
    const [clients, setClients] = useState<GenericRow[] | null>(null);
    const [workers, setWorkers] = useState<GenericRow[] | null>(null);
    const [tasks, setTasks] = useState<GenericRow[] | null>(null);

    // UI state
    const [activeTab, setActiveTab] = useState<DatasetType>("tasks");
    const [aiModifier, setAiModifier] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [prioritizationWeight, setPrioritizationWeight] = useState(50); // Default to 50%

    // --- Advanced Validation State ---
    const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);

    const activeData: GenericRow[] = useMemo(() => {
        if (activeTab === "clients") return clients ?? [];
        if (activeTab === "workers") return workers ?? [];
        return tasks ?? sampleTasks; // default to sample tasks for nice first render
    }, [activeTab, clients, workers, tasks]);

    const dynamicColumns = useMemo(() => {
        if (activeTab === "tasks") return taskColumns;
        // Generate columns from dataset keys for Clients/Workers
        const first = activeData[0];
        if (!first) return [] as any[];
        return Object.keys(first).map((k) => ({
            field: k,
            header: k,
            sortable: true,
        }));
    }, [activeTab, activeData]);

    // Basic header validation by type
    const requiredHeaders: Record<DatasetType, string[]> = {
        clients: ["ClientID"],
        workers: ["WorkerID"],
        tasks: ["TaskID", "TaskName"],
    };

    // Upload handlers
    const handleUpload = async (type: DatasetType, file: File) => {
        try {
            const rows = await parseFile(file);
            const headers = rows.length ? Object.keys(rows[0]) : [];
            const missing = requiredHeaders[type].filter((h) => !headers.includes(h));
            if (missing.length) {
                setError(`${type} file missing required headers: ${missing.join(", ")}`);
                return;
            }
            setError(null);
            if (type === "clients") setClients(rows);
            if (type === "workers") setWorkers(rows);
            if (type === "tasks") setTasks(rows);
        } catch (e) {
            console.error("Failed to parse file", e);
            setError("Failed to parse file. Please ensure it's a valid CSV/XLSX.");
        }
    };

    // Run validations whenever data changes
    useMemo(() => {
        let errors: ValidationError[] = [];
        if (clients) errors = errors.concat(validateClients(clients, tasks ?? []));
        if (workers) errors = errors.concat(validateWorkers(workers));
        if (tasks) errors = errors.concat(validateTasks(tasks, workers ?? []));
        setValidationErrors(errors);
    }, [clients, workers, tasks]);

    const handleExportRules = () => {
        const rules = {
            prioritization: {
                clientPriority: 100 - prioritizationWeight,
                taskEfficiency: prioritizationWeight,
            },
            // Future rules can be added here
        };
        const blob = new Blob([JSON.stringify(rules, null, 2)], { type: "application/json;charset=utf-8;" });
        saveAs(blob, "rules.json");
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <header>
                    <h1 className="text-3xl font-bold text-slate-800">
                        AI Data 🚀 Data Alchemist Configurator
                    </h1>
                </header>

                {/* Upload row (1,2,3) */}
                <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white rounded-xl shadow-md p-6">
                        <h2 className="font-semibold text-slate-800 mb-4">1. Upload Clients</h2>
                        <FileUpload
                            type="clients"
                            accept=".csv,.xlsx"
                            onUpload={(file) => handleUpload("clients", file)}
                        />
                    </div>
                    <div className="bg-white rounded-xl shadow-md p-6">
                        <h2 className="font-semibold text-slate-800 mb-4">2. Upload Workers</h2>
                        <FileUpload
                            type="workers"
                            accept=".csv,.xlsx"
                            onUpload={(file) => handleUpload("workers", file)}
                        />
                    </div>
                    <div className="bg-white rounded-xl shadow-md p-6">
                        <h2 className="font-semibold text-slate-800 mb-4">3. Upload Tasks</h2>
                        <FileUpload
                            type="tasks"
                            accept=".csv,.xlsx"
                            onUpload={(file) => handleUpload("tasks", file)}
                        />
                    </div>
                </section>

                {/* Tabs and Data Grid Section */}
                <section>
                    <div className="flex items-center justify-between mb-4">
                        <div className="inline-flex bg-slate-200/80 rounded-lg p-1">
                            {["clients", "workers", "tasks"].map((tab) => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab as DatasetType)}
                                    className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all duration-200 ${
                                        activeTab === tab
                                            ? "bg-white text-slate-800 shadow-sm"
                                            : "text-slate-600 hover:bg-slate-300/50"
                                    }`}
                                >
                                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-3">
                            <button
                                className="px-4 py-2 rounded-lg text-sm font-semibold border bg-white hover:bg-slate-50 text-slate-700"
                                onClick={() => {
                                    const csv = Papa.unparse(activeData || []);
                                    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                                    saveAs(blob, `${activeTab}.csv`);
                                }}
                            >
                                Export CSV
                            </button>
                            <button
                                className="px-4 py-2 rounded-lg text-sm font-semibold border bg-white hover:bg-slate-50 text-slate-700"
                                onClick={() => {
                                    const ws = XLSX.utils.json_to_sheet(activeData || []);
                                    const wb = XLSX.utils.book_new();
                                    XLSX.utils.book_append_sheet(wb, ws, activeTab);
                                    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
                                    const blob = new Blob([wbout], { type: "application/octet-stream" });
                                    saveAs(blob, `${activeTab}.xlsx`);
                                }}
                            >
                                Export XLSX
                            </button>
                            <button
                                className="px-4 py-2 rounded-lg text-sm font-semibold border bg-blue-600 hover:bg-blue-700 text-white"
                                onClick={handleExportRules}
                            >
                                Export Rules
                            </button>
                        </div>
                    </div>
                    
                    {/* Data Grid - Note: Styling the grid cells requires changes in the DataGrid component itself. */}
                    <div className="bg-white rounded-xl shadow-md p-2">
                        <DataGrid
                            data={activeData}
                            columns={dynamicColumns as any}
                            pageSize={5}
                            editable
                            onChange={(next) => {
                                if (activeTab === "clients") setClients(next);
                                if (activeTab === "workers") setWorkers(next);
                                if (activeTab === "tasks") setTasks(next);
                            }}
                        />
                    </div>
                </section>

                {/* AI Data Modifier */}
                <section className="bg-white rounded-xl shadow-md p-6">
                    <div className="flex items-center gap-2 text-slate-800 font-semibold mb-2">
                        <Sparkles className="h-5 w-5 text-yellow-500" />
                        AI Data Modifier
                    </div>
                    <p className="text-slate-500 text-sm mb-4">
                        Describe the changes you want to make in plain English.
                    </p>
                    <div className="flex gap-4">
                        <input
                            className="flex-1 bg-slate-100 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            placeholder="e.g., Set PriorityLevel to 5 for clients in the 'Premium' group"
                            value={aiModifier}
                            onChange={(e) => setAiModifier(e.target.value)}
                        />
                        <button
                            className="whitespace-nowrap px-6 py-2 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800 transition-colors"
                            onClick={async () => {
                                try {
                                    const payload = {
                                        action: "validate",
                                        data: { type: activeTab, content: activeData, modifier: aiModifier },
                                    };
                                    const res = await fetch("/api/ai", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify(payload),
                                    });
                                    const json = await res.json();
                                    if (!res.ok) throw new Error(json.error || "AI error");
                                    alert(json.result || "No result returned");
                                } catch (err: any) {
                                    alert("AI request failed: " + (err?.message || "Unknown error"));
                                }
                            }}
                        >
                            Generate Fix
                        </button>
                    </div>
                </section>

                {/* Prioritization & Weights Section */}
                <section className="bg-white rounded-xl shadow-md p-6">
                    <div className="flex items-center gap-2 text-slate-800 font-semibold mb-2">
                        <SlidersHorizontal className="h-5 w-5 text-blue-500" />
                        Prioritization & Weights
                    </div>
                    <p className="text-slate-500 text-sm mb-4">
                        Adjust the weight between client priority and task efficiency.
                    </p>
                    <div className="flex items-center gap-4">
                        <span className="text-sm font-medium text-slate-600">Client Priority</span>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={prioritizationWeight}
                            onChange={(e) => setPrioritizationWeight(Number(e.target.value))}
                            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <span className="text-sm font-medium text-slate-600">Task Efficiency</span>
                    </div>
                    <div className="text-center text-sm text-slate-500 mt-2">
                        Weight: {100 - prioritizationWeight}% Client Priority / {prioritizationWeight}% Task Efficiency
                    </div>
                </section>

                {/* Error banner */}
                {error && (
                    <div className="p-4 border border-red-300 bg-red-100 text-red-800 rounded-lg flex items-center gap-3">
                        <AlertTriangle className="h-5 w-5" />
                        <span className="font-medium">{error}</span>
                    </div>
                )}

                {/* --- Validator Summary Panel --- */}
                {validationErrors.length > 0 && (
                    <section className="bg-white rounded-xl shadow-md p-6">
                        <div className="flex items-center gap-2 text-slate-800 font-semibold mb-3">
                            <AlertTriangle className="h-5 w-5 text-red-500" />
                            Validator Summary
                        </div>
                        <ul className="list-disc pl-5 space-y-1.5 text-sm">
                            {validationErrors.map((err, idx) => (
                                <li key={idx} className="text-red-700">
                                    <span className="font-semibold">{err.entity?.toUpperCase()} Row {err.rowIndex !== undefined ? err.rowIndex + 1 : ""}:</span>{" "}
                                    <span>{err.message}</span>
                                    {err.field && <span className="ml-2 text-xs font-mono bg-red-100 px-1 py-0.5 rounded">[{err.field}]</span>}
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {/* Create Rule with AI */}
                <section className="bg-white rounded-xl shadow-md p-6">
                    <div className="flex items-center gap-2 text-slate-800 font-semibold mb-2">
                        <Sparkles className="h-5 w-5 text-yellow-500" />
                        Create Rule with AI
                    </div>
                     <p className="text-slate-500 text-sm mb-4">
                        Describe the rule in a single sentence.
                    </p>
                    <div className="flex gap-4">
                        <input
                            className="flex-1 bg-slate-100 border border-slate-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                            placeholder="e.g., The engineering group can only handle 10 slots per phase"
                            id="rule-input"
                        />
                        <button
                            className="whitespace-nowrap px-6 py-2 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800 transition-colors"
                            onClick={async () => {
                                const input = document.getElementById("rule-input") as HTMLInputElement;
                                const ruleText = input?.value || "";
                                if (!ruleText) return alert("Please enter a rule");
                                try {
                                    const res = await fetch("/api/ai", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                            action: "search",
                                            data: { query: ruleText, content: activeData },
                                        }),
                                    });
                                    const json = await res.json();
                                    if (!res.ok) throw new Error(json.error || "Rule error");
                                    alert("Rule suggestion: " + (json.result || "No suggestion"));
                                } catch (e: any) {
                                    alert("Rule request failed: " + (e?.message || "Unknown error"));
                                }
                            }}
                        >
                            Create
                        </button>
                    </div>
                </section>
            </div>
        </div>
    );
}
