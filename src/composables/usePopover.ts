import { nextTick, onBeforeUnmount, ref, watch, type Ref } from 'vue'

/**
 * A panel teleported to <body> and pinned under its trigger, so cards with overflow-hidden or
 * scrolling tables never clip it. Flips above the trigger when there is no room below,
 * follows scrolling, and closes on a click outside.
 */
export function usePopover(trigger: Ref<HTMLElement | null>, panel: Ref<HTMLElement | null>) {
  const open = ref(false)
  const placement = ref<'below' | 'above'>('below')
  const style = ref<Record<string, string>>({})

  function place() {
    const anchor = trigger.value?.getBoundingClientRect()
    if (!anchor) return

    const gap = 6
    const margin = 8
    const height = panel.value?.offsetHeight ?? 0
    const width = Math.max(panel.value?.offsetWidth ?? 0, anchor.width)
    const roomBelow = window.innerHeight - anchor.bottom
    placement.value = roomBelow < height + gap + margin && anchor.top > roomBelow ? 'above' : 'below'

    const left = Math.max(margin, Math.min(anchor.left, window.innerWidth - width - margin))
    style.value = {
      left: `${left}px`,
      minWidth: `${anchor.width}px`,
      ...(placement.value === 'below'
        ? { top: `${anchor.bottom + gap}px` }
        : { bottom: `${window.innerHeight - anchor.top + gap}px` }),
    }
  }

  function onPointerDown(event: Event) {
    const target = event.target as Node
    if (!trigger.value?.contains(target) && !panel.value?.contains(target)) open.value = false
  }

  function listen(on: boolean) {
    if (on) {
      window.addEventListener('scroll', place, true)
      window.addEventListener('resize', place)
      document.addEventListener('pointerdown', onPointerDown, true)
    } else {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
      document.removeEventListener('pointerdown', onPointerDown, true)
    }
  }

  watch(open, async (isOpen) => {
    listen(isOpen)
    if (!isOpen) return
    await nextTick()
    place()
  })

  onBeforeUnmount(() => listen(false))

  return { open, placement, style, place }
}
