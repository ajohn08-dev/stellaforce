import { cn } from "@/lib/utils"

// Natural aspect ratio from the Figma source (123.298 x 24).
const LOGO_ASPECT_RATIO = 123.298 / 24

// Icon-only mark, no wordmark — viewBox is 39 x 23.
const LOGO_MARK_ASPECT_RATIO = 39 / 23

/**
 * Stella Force logo lockup (mark + wordmark), from Figma "S2.0" node 3:1076.
 * Single combined asset at public/brand/logo.svg (raster fallback at
 * logo.png) with brand colors baked in, so it renders the same in light and
 * dark mode. Pass `height` to resize proportionally.
 */
export function Logo({
  height = 24,
  className,
}: {
  height?: number
  className?: string
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/logo.svg"
      alt="Stellaforce"
      style={{ height, width: height * LOGO_ASPECT_RATIO }}
      className={cn("w-auto", className)}
    />
  )
}

/** Icon-only version of the logo (no "Stellaforce" wordmark) — used when the sidebar is collapsed. */
export function LogoMark({
  height = 24,
  className,
}: {
  height?: number
  className?: string
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/logo-mark.svg"
      alt="Stellaforce"
      style={{ height, width: height * LOGO_MARK_ASPECT_RATIO }}
      className={cn("w-auto", className)}
    />
  )
}
