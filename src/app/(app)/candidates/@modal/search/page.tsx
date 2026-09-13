/**
 * Nothing to render — this exists purely to keep `@modal/(.)[id]` off
 * /candidates/search.
 *
 * The ask bar pushes to /candidates/search from /candidates, which is a soft
 * navigation inside this layout, so the interceptor fires. With no static
 * route in this slot `[id]` matches "search", the modal calls
 * getCandidate("search"), and the page 404s behind a profile sheet. A static
 * segment outranks the dynamic interceptor, so this file is the fix.
 */
export default function ModalSearchSlot() {
  return null
}
