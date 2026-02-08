/**
 * Hook to track the previous value of a state or prop.
 * Useful for comparing current vs previous values in effects.
 */

import { useRef, useEffect } from 'react'

/**
 * Returns the previous value of the provided value.
 * On first render, returns undefined.
 *
 * @example
 * const prevCount = usePrevious(count)
 * useEffect(() => {
 *   if (prevCount !== undefined && count > prevCount) {
 *     console.log('count increased')
 *   }
 * }, [count, prevCount])
 */
export function usePrevious<T>(value: T): T | undefined {
    const ref = useRef<T | undefined>(undefined)

    useEffect(() => {
        ref.current = value
    })

    return ref.current
}
