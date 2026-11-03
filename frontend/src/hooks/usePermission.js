import { useAuth } from '../context/AuthContext'

/**
 * usePermission – declarative permission checks
 *
 * @param {string|string[]} required – single permission code or array
 * @param {'any'|'all'} mode – 'any' (default) or 'all'
 * @returns {{ can: boolean, isLoading: boolean }}
 */
export function usePermission(required, mode = 'any') {
  const { hasPermission, hasAnyPermission, hasAllPermissions, isLoading } = useAuth()

  let can = false
  if (required) {
    const codes = Array.isArray(required) ? required : [required]
    can = mode === 'all'
      ? hasAllPermissions(...codes)
      : hasAnyPermission(...codes)
  }

  return { can, isLoading }
}

export default usePermission

