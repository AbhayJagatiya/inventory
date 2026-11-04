import { Link } from 'react-router-dom'
import { Construction, ArrowLeft } from 'lucide-react'
import PageHeader from '../layout/PageHeader'
import Button from './Button'
import GlassCard from './GlassCard'
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
    <div className="space-y-6 max-w-7xl mx-auto">
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

      <GlassCard level={1} className="p-8">
        <div className="flex items-start gap-5">
          <div className="p-3.5 bg-forest-500/10 dark:bg-forest-400/10 text-forest-700 dark:text-forest-300 border border-forest-500/20 rounded-2xl shrink-0">
            <Construction size={28} />
          </div>
          <div className="space-y-4 max-w-2xl">
            <div>
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-forest-500/15 text-forest-800 dark:text-forest-200 border border-forest-500/20">
                Phase {phaseNumber} Module
              </span>
              <h2 className="text-base font-bold text-forest-950 dark:text-forest-50 mt-2.5">
                {moduleName} Architecture & Contract Initialized
              </h2>
              <p className="text-xs text-forest-600 dark:text-forest-400 mt-1">
                API Service and schemas mapped to backend endpoint:{' '}
                <code className="font-mono text-forest-700 dark:text-forest-300 bg-forest-500/10 px-1.5 py-0.5 rounded-md border border-forest-500/10">
                  {endpoint}
                </code>
              </p>
            </div>

            {expectedFeatures.length > 0 && (
              <div className="pt-2">
                <p className="text-xs font-bold text-forest-900 dark:text-forest-100 mb-2">
                  Planned Functional Capabilities in this Screen:
                </p>
                <ul className="text-xs text-forest-700 dark:text-forest-300 space-y-1.5 list-disc list-inside">
                  {expectedFeatures.map((feat, idx) => (
                    <li key={idx}>{feat}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pt-4 border-t border-forest-500/10 dark:border-forest-400/10 flex items-center gap-3">
              <span className="text-xs text-forest-500 dark:text-forest-400">
                Data contracts and API handlers in <code className="font-mono text-forest-700 dark:text-forest-300">src/api/</code> are already prepared.
              </span>
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  )
}

export default ModulePlaceholder
