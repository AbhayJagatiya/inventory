import { useState, useEffect } from 'react'

/**
 * useDebounce – debounces a value by delayMs milliseconds
 */
export function useDebounce(value, delayMs = 400) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}

export default useDebounce

