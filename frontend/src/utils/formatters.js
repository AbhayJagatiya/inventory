// ─── Currency (INR) ──────────────────────────────────────────────────────────
export const formatCurrency = (amount, opts = {}) => {
  if (amount == null || amount === '') return '—'
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
    ...opts,
  }).format(amount)
}

// ─── Dates ───────────────────────────────────────────────────────────────────
export const formatDate = (dateStr, opts = {}) => {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  if (isNaN(date)) return '—'
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...opts,
  })
}

export const formatDateTime = (dateStr) => {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  if (isNaN(date)) return '—'
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

export const formatRelativeTime = (dateStr) => {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDate(dateStr)
}

export const daysSince = (dateStr) => {
  if (!dateStr) return null
  const date = new Date(dateStr)
  const now = new Date()
  return Math.floor((now - date) / 86400000)
}

// ─── File Size ────────────────────────────────────────────────────────────────
export const formatFileSize = (bytes) => {
  if (!bytes) return '0 B'
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
}

// ─── Numbers ─────────────────────────────────────────────────────────────────
export const formatNumber = (n) => {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-IN').format(n)
}

// ─── Text ─────────────────────────────────────────────────────────────────────
export const truncate = (str, len = 40) => {
  if (!str) return ''
  return str.length > len ? str.slice(0, len) + '…' : str
}

export const titleCase = (str) => {
  if (!str) return ''
  return str
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase())
}

// ─── File Download Helper ─────────────────────────────────────────────────────
export const downloadBlob = (response, filename) => {
  const url = URL.createObjectURL(response.data)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  URL.revokeObjectURL(url)
  a.remove()
}

