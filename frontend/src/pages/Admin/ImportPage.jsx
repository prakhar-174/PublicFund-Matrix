import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  RefreshCw,
  Database,
  ShieldCheck,
} from 'lucide-react'

import FileDropzone from '@/components/FileDropzone'
import { useImportBudgets } from '@/api/hooks/useImport'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'

export default function ImportPage() {
  const [selectedFile, setSelectedFile] = useState(null)
  const [progress, setProgress] = useState(0)
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [importError, setImportError] = useState(null)

  const importMutation = useImportBudgets({
    onSuccess: (data) => {
      setProgress(100)
      setTimeout(() => {
        setIsImporting(false)
        setImportResult(data)
      }, 350)
    },
    onError: (err) => {
      setIsImporting(false)
      setProgress(0)
      const data = err?.response?.data
      setImportError({
        detail: data?.detail || err?.message || 'Failed to import file.',
        errors: data?.errors || [],
        rows_total: data?.rows_total,
        rows_invalid: data?.rows_invalid,
      })
    },
  })

  const handleFileSelect = (file) => {
    setSelectedFile(file)
    setImportResult(null)
    setImportError(null)
    setProgress(0)
  }

  const handleFileRemove = () => {
    setSelectedFile(null)
    setImportResult(null)
    setImportError(null)
    setProgress(0)
  }

  const handleStartImport = () => {
    if (!selectedFile) return
    setIsImporting(true)
    setImportResult(null)
    setImportError(null)

    // Animate progress 0 -> 90% over 2s
    setProgress(90)

    const formData = new FormData()
    formData.append('file', selectedFile)

    importMutation.mutate(formData)
  }

  const handleReset = () => {
    setSelectedFile(null)
    setImportResult(null)
    setImportError(null)
    setProgress(0)
    setIsImporting(false)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="space-y-6 max-w-4xl pb-12"
    >
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Database className="h-6 w-6 text-accent-blue" />
            <span>Data Import & Ingestion</span>
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Ingest departmental budget allocations and historical actuals from CSV or Excel spreadsheets.
          </p>
        </div>

        <Badge
          variant="outline"
          className="border-slate-700 bg-slate-900 text-slate-300 text-xs px-3 py-1 flex items-center gap-1.5 self-start sm:self-auto"
        >
          <ShieldCheck className="h-3.5 w-3.5 text-accent-violet" />
          <span>Admin Access Verified</span>
        </Badge>
      </div>

      {/* Import Guidance Notice */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-300 flex items-start gap-3">
        <FileSpreadsheet className="h-5 w-5 text-accent-blue shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-white">Import Guidelines & Schema Requirements</p>
          <p className="text-slate-400 leading-relaxed">
            The workbook or CSV must contain header columns:{' '}
            <code className="text-accent-blue bg-slate-950 px-1 py-0.5 rounded">department_code</code>,{' '}
            <code className="text-accent-blue bg-slate-950 px-1 py-0.5 rounded">fiscal_year</code>,{' '}
            <code className="text-accent-blue bg-slate-950 px-1 py-0.5 rounded">allocated_amount</code>,{' '}
            <code className="text-accent-blue bg-slate-950 px-1 py-0.5 rounded">spent_amount</code>, and{' '}
            <code className="text-accent-blue bg-slate-950 px-1 py-0.5 rounded">requested_amount</code>.
            All-or-nothing transactional guarantees apply: invalid rows block the import so fixes can be made safely.
          </p>
        </div>
      </div>

      {/* File Dropzone */}
      <div className="space-y-4">
        <FileDropzone
          file={selectedFile}
          onFileSelect={handleFileSelect}
          onFileRemove={handleFileRemove}
          disabled={isImporting}
        />

        {/* Progress Bar (Visible while importing) */}
        {isImporting && (
          <div className="space-y-2 bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-300 flex items-center gap-2">
                <RefreshCw className="h-3.5 w-3.5 text-accent-blue animate-spin" />
                <span>Validating schema and importing records...</span>
              </span>
              <span className="font-mono text-accent-blue font-semibold">{progress}%</span>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-2.5 overflow-hidden border border-slate-800">
              <motion.div
                className="bg-accent-blue h-full rounded-full"
                initial={{ width: '0%' }}
                animate={{ width: `${progress}%` }}
                transition={
                  progress === 90
                    ? { duration: 2, ease: 'easeOut' }
                    : { duration: 0.3, ease: 'easeIn' }
                }
              />
            </div>
          </div>
        )}

        {/* Preview & Import Action Button */}
        {selectedFile && !isImporting && !importResult && (
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleFileRemove}
              className="bg-slate-900 border-slate-800 text-slate-300 text-xs h-9 hover:bg-slate-800"
            >
              Cancel
            </Button>

            <Button
              type="button"
              onClick={handleStartImport}
              className="bg-accent-blue hover:bg-accent-blue/90 text-white text-xs h-9 px-5 shadow-sm flex items-center gap-2 font-medium"
            >
              <Upload className="h-4 w-4" />
              <span>Preview &amp; Import</span>
            </Button>
          </div>
        )}
      </div>

      {/* Result Panel */}
      <AnimatePresence mode="wait">
        {importResult && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            {/* Success Emerald Alert */}
            <Alert className="border-accent-emerald/40 bg-accent-emerald/10 text-accent-emerald shadow-sm">
              <CheckCircle2 className="h-5 w-5 text-accent-emerald" />
              <div className="flex-1">
                <AlertTitle className="text-sm font-semibold text-accent-emerald flex items-center justify-between">
                  <span>Import Successful</span>
                  <Badge className="bg-accent-emerald/20 text-accent-emerald border-accent-emerald/30 font-mono text-[11px]">
                    {importResult.rows_total ??
                      (importResult.created ?? 0) + (importResult.updated ?? 0)}{' '}
                    Records
                  </Badge>
                </AlertTitle>
                <AlertDescription className="text-xs text-accent-emerald/90 mt-1">
                  {importResult.rows_total ??
                    (importResult.created ?? 0) + (importResult.updated ?? 0)}{' '}
                  records imported successfully into the system database.
                </AlertDescription>
              </div>
            </Alert>

            {/* Summary statistics card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <div>
                  <span className="text-slate-400 text-xs block">Total Processed</span>
                  <span className="text-lg font-bold font-mono text-white">
                    {importResult.rows_total ??
                      (importResult.created ?? 0) + (importResult.updated ?? 0)}
                  </span>
                </div>
                {importResult.created !== undefined && (
                  <div>
                    <span className="text-slate-400 text-xs block">Created</span>
                    <span className="text-lg font-bold font-mono text-accent-emerald">
                      {importResult.created}
                    </span>
                  </div>
                )}
                {importResult.updated !== undefined && (
                  <div>
                    <span className="text-slate-400 text-xs block">Updated</span>
                    <span className="text-lg font-bold font-mono text-accent-blue">
                      {importResult.updated}
                    </span>
                  </div>
                )}
              </div>

              <Button
                onClick={handleReset}
                variant="outline"
                size="sm"
                className="bg-slate-950 border-slate-800 text-slate-200 text-xs h-8 hover:bg-slate-800"
              >
                Import Another File
              </Button>
            </div>
          </motion.div>
        )}

        {importError && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            {/* Error Red Alert */}
            <Alert className="border-destructive/40 bg-destructive/10 text-destructive shadow-sm">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <div className="flex-1">
                <AlertTitle className="text-sm font-semibold flex items-center justify-between">
                  <span>Import Failed</span>
                  {importError.rows_invalid && (
                    <Badge variant="destructive" className="text-[11px] font-mono">
                      {importError.rows_invalid} Errors Detected
                    </Badge>
                  )}
                </AlertTitle>
                <AlertDescription className="text-xs text-destructive/90 mt-1">
                  {importError.detail}
                </AlertDescription>
              </div>
            </Alert>

            {/* List of row-level errors if provided */}
            {importError.errors && importError.errors.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
                <h4 className="text-xs font-semibold text-slate-200 flex items-center justify-between">
                  <span>Row-level Validation Errors</span>
                  <span className="text-[11px] text-slate-400">
                    Fix these items in your spreadsheet and retry
                  </span>
                </h4>
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {importError.errors.map((errItem, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-950 border border-red-900/30 rounded-lg p-2.5 text-xs text-slate-300 font-mono"
                    >
                      {typeof errItem === 'string' ? (
                        errItem
                      ) : (
                        <div>
                          {errItem.row && (
                            <span className="text-red-400 font-semibold mr-2">
                              Row {errItem.row}:
                            </span>
                          )}
                          <span>{errItem.error || errItem.detail || JSON.stringify(errItem)}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button
                onClick={handleReset}
                variant="outline"
                size="sm"
                className="bg-slate-900 border-slate-800 text-slate-200 text-xs h-8 hover:bg-slate-800"
              >
                Try Again
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
