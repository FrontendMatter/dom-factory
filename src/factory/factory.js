import { watch, unwatch } from 'watch-object'

const isElement = (el) => (el instanceof HTMLElement)

const isObject = (obj) => ({}.toString.call(obj) === '[object Array]')

const isFunction = (fn) => typeof fn === 'function'

const toKebabCase = (str) => str.replace(/([A-Z])/g, ($1) => `-${ $1 }`.toLowerCase())

/**
 * Assign descriptors
 * @param  {Object}    target
 * @param  {...Object} sources
 * @return {Object}
 */
export const assign = (target, ...sources) => {
  sources.forEach(source => {
    if (!source) {
      return
    }
    let descriptors = Object.keys(source).reduce((descriptors, key) => {
      descriptors[key] = Object.getOwnPropertyDescriptor(source, key)
      return descriptors
    }, {})
    Object.getOwnPropertySymbols(source).forEach(sym => {
      let descriptor = Object.getOwnPropertyDescriptor(source, sym)
      if (descriptor.enumerable) {
        descriptors[sym] = descriptor
      }
    })
    Object.defineProperties(target, descriptors)
  })
  return target
}

/**
 * Set the default property options
 * @param  {Object} opts
 * @return {Object}
 */
const propOptions = (opts = {}) => {
  opts = assign({}, opts)
  opts.readOnly = opts.readOnly || false
  opts.reflectToAttribute = opts.reflectToAttribute || false
  opts.value = opts.value
  opts.type = opts.type
  return opts
}

/**
 * Create property
 * @param  {String} prop The property name
 * @param  {Object} opts The property options
 * @param  {Object} src  The source object
 */
const createProp = (prop, opts = {}, src) => {
  opts = propOptions(opts)
  const property = {
    enumerable: true,
    configurable: true,
    writable: !opts.readOnly,
    value: opts.value
  }
  Object.defineProperty(src, prop, property)
}

/**
 * Set the initial value for a property
 * @param  {String} prop  The property name
 * @param  {?}      value The property value
 * @param  {Object} src   The source object
 */
const propValue = (prop, value, src) => {
  if (!value || !!src[prop]) {
    return
  }
  if (isFunction(value)) {
    src[prop] = value.call(src)
  }
  else {
    src[prop] = value
  }
}

/**
 * Keep a property value in sync with a HTMLElement attribute
 * @param  {String} prop The property name
 * @param  {Object} opts The property options
 * @param  {Object} src  The source object
 */
const reflectToAttribute = (prop, opts = {}, src) => {
  opts = propOptions(opts)
  if (!opts.reflectToAttribute) {
    return
  }
  const propKebab = toKebabCase(prop)
  const descriptor = Object.getOwnPropertyDescriptor(src, prop)
  const property = {
    enumerable: descriptor.enumerable,
    configurable: descriptor.configurable,
    get: function () {
      return opts.type === Boolean
        ? this.element.hasAttribute(propKebab)
        : this.element.getAttribute(propKebab)
    },
    set: function (value) {
      this.element[value ? 'setAttribute' : 'removeAttribute'](propKebab, opts.type === Boolean ? prop : value)
    }
  }
  Object.defineProperty(src, prop, property)
}

/**
 * Create properties
 * @param  {Object} src The source object
 */
const makeProperties = (src) => {
  if (typeof src.properties !== 'object') {
    return
  }
  for (let prop in src.properties) {
    if (src.properties.hasOwnProperty(prop)) {
      let opts = src.properties[prop]

      createProp(prop, opts, src)
      reflectToAttribute(prop, opts, src)
      propValue(prop, opts.value, src)
    }
  }
}

/**
 * Get the configuration for observers
 * @param  {Object} src The source object
 * @return {Array<Object(fn, args)>}
 */
const observers = (src) => {
  if ({}.toString.call(src.observers) !== '[object Array]') {
    return []
  }
  return src.observers.map(sig => {
    let [, fn, args] = sig.match(/([a-zA-Z-_]+)\(([^)]*)\)/)
    args = args.split(',').map(a => a.trim()).filter(a => a.length)
    return {
      fn,
      args
    }
  })
  .filter(({ fn }) => isFunction(src[fn]))
}

const dotObject = (str, obj) => {
  return str.split('.').reduce((o, i) => o[i], obj)
}

const dotObjectPropParent = (str, obj) => {
  let dots = str.split('.')
  let prop = dots.pop()
  let parent = dotObject(dots.join('.'), obj)
  return {
    parent,
    prop
  }
}

/**
 * Create observers
 * @param  {Object} src The source object
 */
const makeObservers = (src) => {
  if ({}.toString.call(src.observers) !== '[object Array]') {
    return
  }
  observers(src).forEach(({ fn, args }) => {
    src[fn] = src[fn].bind(src)
    args.forEach(arg => {
      if (arg.indexOf('.') !== -1) {
        const { prop, parent } = dotObjectPropParent(arg, src)
        watch(parent, prop, src[fn])
      }
      else {
        watch(src, arg, src[fn])
      }
    })
  })
}

/**
 * Get the configuration for DOM event listeners
 * @param  {Object} src The source object
 * @return {Array<Object(element, fn, events)>}
 */
const listeners = (src) => {
  if (!isObject(src.listeners)) {
    return []
  }
  return src.listeners.map(sig => {
    let match = sig.match(/(.*\.)?([a-zA-Z-_]+)\(([^)]*)\)/)
    let [, element, fn, events] = match
    events = events.split(',').map(a => a.trim()).filter(a => a.length)
    element = element ? element.substr(0, element.length - 1) : 'element'
    return {
      element,
      fn,
      events
    }
  })
  .filter(({ element, fn }) => {
    return isFunction(src[fn]) && 
      (isElement(src[element]) || isElement(src[element]['element']))
  })
}

/**
 * Create DOM event listeners
 * @param  {Object} src The source object
 */
const makeListeners = (src) => {
  listeners(src).forEach(({ element, fn, events }) => {
    src[fn] = src[fn].bind(src)
    if (isElement(src[element])) {
      element = src[element]
    }
    else if (isElement(src[element]['element'])) {
      element = src[element]['element']
    }
    events.forEach(e => element.addEventListener(e, src[fn]))
  })
}

export const factory = (factory) => {
  if (!factory || 
    typeof factory !== 'object' || 
    factory.element === undefined || 
    !isElement(factory.element)) {
    console.error('[dom-component] Invalid factory.')
    return
  }

  let component = {

    /**
     * Set a property on the component
     * @param {String}  prop  The property name
     * @param {?}       value The property value
     */
    $set (prop, value) {
      if (!prop || value === undefined || this.properties === undefined || !this.properties.hasOwnProperty(prop)) {
        return
      }
      const opts = propOptions(this.properties[prop])
      const descriptor = Object.getOwnPropertyDescriptor(this, prop)

      if (opts.readOnly && descriptor.writable !== undefined) {
        let property = {
          enumerable: descriptor.enumerable,
          configurable: descriptor.configurable,
          writable: false,
          value
        }
        Object.defineProperty(this, prop, property)
        return
      }

      this[prop] = value
    },

    /**
     * Initialize component
     */
    init () {
      makeObservers(this)
      makeListeners(this)

      if (isFunction(factory.init)) {
        factory.init.call(this)
      }
    },

    /**
     * Destroy component
     */
    destroy () {
      observers(factory).forEach(({ fn, args }) => {
        args.forEach(arg => {
          if (arg.indexOf('.') !== -1) {
            const { prop, parent } = dotObjectPropParent(arg, this)
            unwatch(parent, prop, this[fn])
          }
          else {
            unwatch(this, arg, this[fn])
          }
        })
      })

      listeners(factory).forEach(({ element, fn, events }) => {
        if (isElement(this[element])) {
          element = this[element]
        }
        else if (isElement(this[element]['element'])) {
          element = this[element]['element']
        }
        events.forEach(e => element.removeEventListener(e, this[fn]))
      })

      if (isFunction(factory.destroy)) {
        factory.destroy.call(this)
      }
    },

    /**
     * Fire a DOM Event on the HTMLElement
     * @param  {String} eventName The event name
     */
    fire (eventName) {
      let event = document.createEvent('Event')
      event.initEvent(eventName, true, true)
      this.element.dispatchEvent(event)
    }
  }

  makeProperties(factory)

  return assign(
    {},
    factory,
    component
  )
}