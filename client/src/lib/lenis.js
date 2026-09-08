import Lenis from 'lenis'

let lenisInstance = null

export function initLenis() {
  if (typeof window === 'undefined') return null
  if (lenisInstance) return lenisInstance

  lenisInstance = new Lenis({
    duration: 1.0,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    orientation: 'vertical',
    gestureOrientation: 'vertical',
    smoothWheel: true,
    wheelMultiplier: 1.0,
    touchMultiplier: 1.5,
  })

  function raf(time) {
    lenisInstance.raf(time)
    requestAnimationFrame(raf)
  }
  requestAnimationFrame(raf)

  return lenisInstance
}

export function getLenis() {
  return lenisInstance
}

export function scrollToTarget(target, offset = -20) {
  if (lenisInstance) {
    lenisInstance.scrollTo(target, { offset, duration: 1.0 })
  } else {
    const el = typeof target === 'string' ? document.querySelector(target) : target
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }
}
