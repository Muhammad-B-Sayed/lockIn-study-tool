import '@testing-library/jest-dom/vitest'

class MemoryStorage {
  private store = new Map<string, string>()

  clear() {
    this.store.clear()
  }

  getItem(key: string) {
    return this.store.get(key) ?? null
  }

  key(index: number) {
    return Array.from(this.store.keys())[index] ?? null
  }

  removeItem(key: string) {
    this.store.delete(key)
  }

  setItem(key: string, value: string) {
    this.store.set(key, value)
  }

  get length() {
    return this.store.size
  }
}

Object.defineProperty(window, 'localStorage', {
  value: new MemoryStorage(),
  writable: true,
})

// jsdom has no layout engine or native dialog implementation.
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => {
      const events = new EventTarget()
      const max = /max-width:\s*(\d+)px/.exec(query)
      const min = /min-width:\s*(\d+)px/.exec(query)
      return Object.assign(events, {
        media: query,
        matches: max ? window.innerWidth <= Number(max[1]) : min ? window.innerWidth >= Number(min[1]) : false,
        onchange: null,
        addListener: (listener: EventListener) => events.addEventListener('change', listener),
        removeListener: (listener: EventListener) => events.removeEventListener('change', listener),
      })
    },
  })
}
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
}
if (!HTMLDialogElement.prototype.close) {
  HTMLDialogElement.prototype.close = function () {
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
}
if (!HTMLElement.prototype.scrollIntoView) HTMLElement.prototype.scrollIntoView = () => {}
Object.defineProperty(window, 'scrollTo', { writable: true, value: () => {} })
