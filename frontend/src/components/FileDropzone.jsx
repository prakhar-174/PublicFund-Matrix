import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { UploadCloud, FileCheck, X, FileSpreadsheet } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

/**
 * Format bytes into human-readable string.
 */
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export default function FileDropzone({
  file = null,
  onFileSelect,
  onFileRemove,
  disabled = false,
  accept = '.csv, .xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, text/csv',
}) {
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const fileInputRef = useRef(null)

  const handleDragEnter = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) setIsDraggingOver(true)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) setIsDraggingOver(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    // Avoid flicker if leaving to a child element
    if (e.currentTarget.contains(e.relatedTarget)) return
    setIsDraggingOver(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDraggingOver(false)
    if (disabled) return

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0]
      onFileSelect?.(droppedFile)
    }
  }

  const handleInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0]
      onFileSelect?.(selectedFile)
    }
  }

  const openFileDialog = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  // 1. File Selected State
  if (file) {
    return (
      <div className="rounded-xl border border-accent-emerald/40 bg-accent-emerald/5 p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-accent-emerald/15 border border-accent-emerald/30 flex items-center justify-center shrink-0">
              <FileCheck className="h-6 w-6 text-accent-emerald" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{file.name}</p>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                <span className="font-mono">{formatFileSize(file.size)}</span>
                <span>&bull;</span>
                <span className="uppercase text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded font-mono">
                  {file.name.split('.').pop()}
                </span>
                <span className="text-accent-emerald font-medium ml-1">Ready for import</span>
              </div>
            </div>
          </div>

          {!disabled && onFileRemove && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onFileRemove}
              className="text-slate-400 hover:text-white hover:bg-slate-800 h-8 w-8 p-0 shrink-0"
              title="Remove file"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    )
  }

  // 2. Idle & Dragging-Over States
  return (
    <motion.div
      animate={{ scale: isDraggingOver ? 1.02 : 1 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={openFileDialog}
      className={cn(
        'relative rounded-xl border-2 border-dashed p-10 text-center cursor-pointer transition-colors flex flex-col items-center justify-center select-none shadow-sm',
        isDraggingOver
          ? 'border-accent-blue bg-accent-blue/10 ring-2 ring-accent-blue/20'
          : 'border-slate-800 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-900/60',
        disabled && 'pointer-events-none opacity-50 cursor-not-allowed'
      )}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleInputChange}
        className="hidden"
        disabled={disabled}
      />

      <div
        className={cn(
          'w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors',
          isDraggingOver
            ? 'bg-accent-blue/20 text-accent-blue'
            : 'bg-slate-800 text-slate-400 group-hover:text-slate-300'
        )}
      >
        <UploadCloud className="h-6 w-6" />
      </div>

      <h4 className="text-sm font-semibold text-white">
        {isDraggingOver ? 'Drop CSV or Excel file here' : 'Drop CSV or Excel file here'}
      </h4>
      <p className="text-xs text-slate-400 mt-1 max-w-sm">
        or click to browse from your computer. Supported formats: .csv, .xlsx, .xls
      </p>

      <div className="mt-4 flex items-center gap-2 text-[11px] text-slate-400 font-mono">
        <FileSpreadsheet className="h-3.5 w-3.5 text-slate-400" />
        <span>Strict schema validation enforced on all rows</span>
      </div>
    </motion.div>
  )
}

