// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { createHoverIntent } from "../src/foundation/popups/hover"
import { type Layer, pushLayer } from "../src/foundation/platform/layers"

// Rows of a table, 30px tall, each with a trigger from x = 0 to 100 and a
// popup 200px tall to its right, from x = 108 to 300, starting at its row.
function row(index: number) {
  const top = index * 30
  const trigger = box({ left: 0, right: 100, top, bottom: top + 30 })
  const popup = box({ left: 108, right: 300, top, bottom: top + 200 })
  const close = vi.fn()
  const intent = createHoverIntent({
    trigger: () => trigger,
    popup: () => popup,
    closesOnLeave: () => true,
    closeDelay: () => 0,
    close,
  })
  return { trigger, popup, close, intent }
}

function box(rect: {
  left: number
  right: number
  top: number
  bottom: number
}) {
  const element = document.createElement("div")
  element.getBoundingClientRect = () =>
    ({ ...rect, x: rect.left, y: rect.top }) as DOMRect
  document.body.append(element)
  return element
}

function pointer(type: string, x: number, y: number, target?: Element) {
  const event = new Event(type) as PointerEvent
  Object.assign(event, { pointerType: "mouse", clientX: x, clientY: y })
  if (target) {
    Object.defineProperty(event, "target", { value: target })
  }
  return event
}

const move = (x: number, y: number) =>
  document.dispatchEvent(pointer("pointermove", x, y))

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  vi.useRealTimers()
  document.body.replaceChildren()
})

describe("hover intent", () => {
  test("entering the next row's trigger closes the popup crossed on the way", () => {
    const first = row(0)
    const second = row(1)
    first.intent.leave(pointer("pointerleave", 50, 30))
    move(50, 35)
    second.intent.enter(
      pointer("pointerenter", 50, 35, second.trigger),
      () => {},
      0
    )
    expect(first.close).toHaveBeenCalledOnce()
  })

  test("a popup the pointer only rests in still waits for its bridge", () => {
    const first = row(0)
    first.intent.leave(pointer("pointerleave", 50, 30))
    move(50, 40)
    vi.runAllTimers()
    expect(first.close).not.toHaveBeenCalled()
  })

  test("a trigger inside a crossed popup, like a nested one, keeps it open", () => {
    const parent = row(0)
    const nested = box({ left: 120, right: 200, top: 10, bottom: 30 })
    parent.popup.append(nested)
    const child = createHoverIntent({
      trigger: () => nested,
      popup: () => undefined,
      closesOnLeave: () => true,
      closeDelay: () => 0,
      close: () => {},
    })
    parent.intent.leave(pointer("pointerleave", 100, 15))
    child.enter(pointer("pointerenter", 120, 15, nested), () => {}, 0)
    expect(parent.close).not.toHaveBeenCalled()
  })

  test("a trigger in a popup nested under a crossed one, though portaled, keeps it open", () => {
    const parent = row(0)
    const portaled = box({ left: 400, right: 500, top: 0, bottom: 100 })
    const nested = box({ left: 410, right: 490, top: 10, bottom: 30 })
    portaled.append(nested)
    const layer = (el: HTMLElement, up?: Layer): Layer => ({
      el,
      parent: up,
      active: () => true,
      modal: false,
      contains: (target) => el.contains(target),
    })
    const parentLayer = layer(parent.popup)
    const pops = [
      pushLayer(parentLayer),
      pushLayer(layer(portaled, parentLayer)),
    ]
    const child = createHoverIntent({
      trigger: () => nested,
      popup: () => undefined,
      closesOnLeave: () => true,
      closeDelay: () => 0,
      close: () => {},
    })
    parent.intent.leave(pointer("pointerleave", 100, 15))
    child.enter(pointer("pointerenter", 410, 15, nested), () => {}, 0)
    expect(parent.close).not.toHaveBeenCalled()
    pops.forEach((pop) => pop())
  })
})
