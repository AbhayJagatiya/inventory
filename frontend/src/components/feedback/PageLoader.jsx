import { Loader2 } from 'lucide-react'

function PageLoader({ message = 'Loading…' }) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-slate-50 z-50">
      <Loader2 size={36} className="text-blue-600 animate-spin mb-3" />
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  )
}

export default PageLoader

