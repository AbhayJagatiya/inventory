import { Link } from 'react-router-dom'
import { Construction, ArrowLeft } from 'lucide-react'
import PageHeader from '../layout/PageHeader'
import Button from './Button'
import { ROUTES } from '../../constants/routes'

function ModulePlaceholder({
  title,
  subtitle,
  moduleName,
  phaseNumber,
  endpoint,
  expectedFeatures = [],
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <Link to={ROUTES.DASHBOARD}>
            <Button variant="secondary" size="sm" leftIcon={<ArrowLeft size={14} />}>
              Back to Dashboard
            </Button>
          </Link>
        }
      />

      <div className="bg-white rounded-lg border border-slate-200 p-8 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-blue-50 text-blue-700 rounded-lg shrink-0">
            <Construction size={28} />
          </div>
          <div className="space-y-3 max-w-2xl">
            <div>
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800">
                Phase {phaseNumber} Module
              </span>
              <h2 className="text-base font-semibold text-slate-800 mt-2">{moduleName} Architecture & Contract Initialized</h2>
              <p className="text-xs text-slate-500 mt-1">
                API Service and schemas mapped to backend endpoint: <code className="font-mono text-blue-700 bg-blue-50 px-1 py-0.5 rounded">{endpoint}</code>
              </p>
            </div>

            {expectedFeatures.length > 0 && (
              <div className="pt-2">
                <p className="text-xs font-medium text-slate-700 mb-2">Planned Functional Capabilities in this Screen:</p>
                <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                  {expectedFeatures.map((feat, idx) => (
                    <li key={idx}>{feat}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
              <span className="text-xs text-slate-400">
                Data contracts and API handlers in <code className="font-mono text-slate-600">src/api/</code> are already prepared.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ModulePlaceholder

