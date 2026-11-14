// Opening a popup by resting the pointer on its trigger: a delay before it
// opens, a delay before it closes, and a bridge spanning the trigger and the
// popup, so the pointer can cross from one to the other.
import { on } from "../kernel/events"
import { activeLayers, layerContains } from "../platform/layers"
import { bridgeBetween } from "./bridge"

type Bridged = {
  popup: () => HTMLElement | undefined
  close: (event: PointerEvent) => void
}

// Popups the pointer left that only their bridge keeps open, shared by every
// copy of core on the page. Entering another hover element closes them.
const bridged = () =>
  ((globalThis as Record<symbol, unknown>)[Symbol.for("ui-sdk.hover@1")] ??=
    new Set<Bridged>()) as Set<Bridged>

// Whether a node is inside a popup, or a popup nested under it, even portaled.
function holds(popup: HTMLElement | undefined, target: Node) {
  const layer = popup && activeLayers().find((each) => each.el === popup)
  return layer ? layerContains(layer, target) : !!popup?.contains(target)
}

function createHoverIntent(options: {
  // The two elements the pointer may move between, looked up live.
  trigger: () => HTMLElement | undefined
  popup: () => HTMLElement | undefined
  // Whether leaving should close the popup now: it's open, and the pointer opened it.
  closesOnLeave: () => boolean
  // Milliseconds before closing once the pointer has left both. Read on every leave.
  closeDelay: () => number
  // Closes the popup, after the delay.
  close: (event: PointerEvent) => void
}) {
  let openTimer: ReturnType<typeof setTimeout> | undefined
  let closeTimer: ReturnType<typeof setTimeout> | undefined
  let stopBridge: (() => void) | undefined

  const self: Bridged = {
    popup: options.popup,
    close(event) {
      clear()
      options.close(event)
    },
  }

  function stopWatching() {
    stopBridge?.()
    stopBridge = undefined
    bridged().delete(self)
  }

  // Forgets any pending open or close, like after a press.
  function clear() {
    clearTimeout(openTimer)
    clearTimeout(closeTimer)
    stopWatching()
  }

  function scheduleClose(event: PointerEvent) {
    stopWatching()
    clearTimeout(closeTimer)
    closeTimer = setTimeout(() => options.close(event), options.closeDelay())
  }

  return {
    clear,
    // The pointer entered the trigger or the popup. Entering either keeps an
    // open popup open. From the trigger, `open` runs after `delay`, at once
    // for 0. Touch has no hover, so a tap never counts.
    enter(event: PointerEvent, open?: () => void, delay = 0) {
      if (event.pointerType === "touch") {
        return
      }
      clearTimeout(closeTimer)
      stopWatching()
      // Popups crossed on the way here close, unless this element is inside one.
      const target = event.target as Node | null
      if (target && !holds(options.popup(), target)) {
        for (const other of bridged()) {
          if (other !== self && !holds(other.popup(), target)) {
            other.close(event)
          }
        }
      }
      if (!open) {
        return
      }
      clearTimeout(openTimer)
      if (delay > 0) {
        openTimer = setTimeout(open, delay)
      } else {
        open()
      }
    },
    // The pointer left the trigger or the popup. A pending open is dropped.
    // On its way between the two, the popup stays open until the pointer
    // leaves the area that spans both.
    leave(event: PointerEvent) {
      if (event.pointerType === "touch") {
        return
      }
      clearTimeout(openTimer)
      if (!options.closesOnLeave()) {
        return
      }
      const trigger = options.trigger()
      const popup = options.popup()
      if (!trigger || !popup) {
        return scheduleClose(event)
      }
      const inside = bridgeBetween(
        trigger.getBoundingClientRect(),
        popup.getBoundingClientRect()
      )
      if (!inside(event.clientX, event.clientY)) {
        return scheduleClose(event)
      }
      stopWatching()
      bridged().add(self)
      stopBridge = on(popup.ownerDocument, "pointermove", (move) => {
        if (!inside(move.clientX, move.clientY)) {
          scheduleClose(move)
        }
      })
    },
  }
}

type HoverIntent = ReturnType<typeof createHoverIntent>

export { createHoverIntent, type HoverIntent }
