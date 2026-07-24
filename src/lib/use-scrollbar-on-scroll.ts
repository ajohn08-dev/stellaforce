import * as React from "react"

/**
 * Pairs with the `.scrollbar-hover` CSS utility: returns an `onScroll`
 * handler and a boolean to spread onto the scrollable element (`isScrolling`
 * -> add the `is-scrolling` class) so the scrollbar only renders while
 * actually being scrolled, fading out again after `idleMs` of inactivity.
 */
export function useScrollbarOnScroll(idleMs = 600) {
  const [isScrolling, setIsScrolling] = React.useState(false)
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const onScroll = React.useCallback(() => {
    setIsScrolling(true)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setIsScrolling(false), idleMs)
  }, [idleMs])

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return { isScrolling, onScroll }
}
