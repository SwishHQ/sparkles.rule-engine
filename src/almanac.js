'use strict'
import Fact from './fact'
import { UndefinedFactError } from './errors'
import debug from './debug'
import { JSONPath } from 'jsonpath-plus'
/**
 * Default path resolver using JSONPath for object property access
 * @param {*} value - the object to traverse
 * @param {string} path - JSONPath expression
 * @return {*} the resolved value at the path
 */
function defaultPathResolver (value, path) {
  return JSONPath({ path, json: value, wrap: false })
}
/**
 * The Almanac maintains state for a single engine run, including:
 * - Fact definitions and their computed values
 * - Cache of fact results to avoid redundant calculations
 * - Events emitted during rule evaluation
 * - Rule results and their scores
 *
 * Each engine.run() creates a new Almanac instance to ensure isolation
 * between different rule evaluation sessions.
 */
export default class Almanac {
  /**
   * Creates a new Almanac instance
   * @param {Object} options - configuration options
   * @param {boolean} options.allowUndefinedFacts - whether to allow undefined facts (default: false)
   * @param {Function} options.pathResolver - custom path resolver function
   */
  constructor (options = {}) {
    this.factMap = new Map()
    this.factResultsCache = new Map() // { cacheKey: Promise<factValue> }
    this.allowUndefinedFacts = Boolean(options.allowUndefinedFacts)
    this.pathResolver = options.pathResolver || defaultPathResolver
    this.events = { success: [], failure: [] }
    this.ruleResults = []
  }

  /**
   * Adds an event to the appropriate outcome collection
   * @param {Object} event - the event object to store
   * @param {string} outcome - either "success" or "failure"
   */
  addEvent (event, outcome) {
    if (!outcome) { throw new Error('outcome required: "success" | "failure"]') }
    this.events[outcome].push(event)
  }

  /**
   * Retrieves events by outcome type
   * @param {string} outcome - "success", "failure", or empty string for all events
   * @return {Object[]} array of events
   */
  getEvents (outcome = '') {
    if (outcome) { return this.events[outcome] }
    return this.events.success.concat(this.events.failure)
  }

  /**
   * Adds a rule result to the almanac's collection
   * @param {RuleResult} ruleResult - result of rule evaluation including score
   */
  addResult (ruleResult) {
    this.ruleResults.push(ruleResult)
  }

  /**
   * Retrieves all rule results from this almanac session
   * @return {RuleResult[]} array of rule results with scores
   */
  getResults () {
    return this.ruleResults
  }

  /**
   * Retrieves a fact definition by identifier
   * @param {string} factId - unique fact identifier
   * @return {Fact|undefined} the fact instance, or undefined if not found
   */
  _getFact (factId) {
    return this.factMap.get(factId)
  }

  /**
   * Registers a constant fact and caches its value immediately
   * @param {Fact} fact - the constant fact to register
   */
  _addConstantFact (fact) {
    this.factMap.set(fact.id, fact)
    this._setFactValue(fact, {}, fact.value)
  }

  /**
   * Caches the computed value of a fact for future retrieval
   * @param {Fact} fact - the fact definition
   * @param {Object} params - parameters used to compute this fact value
   * @param {*} value - the computed value to cache
   * @return {Promise} promise that resolves to the cached value
   */
  _setFactValue (fact, params, value) {
    const cacheKey = fact.getCacheKey(params)
    const factValue = Promise.resolve(value)
    if (cacheKey) {
      this.factResultsCache.set(cacheKey, factValue)
    }
    return factValue
  }

  /**
   * Registers a fact definition with the almanac
   * @param {string|Fact} id - fact identifier or Fact instance
   * @param {*|Function} valueOrMethod - static value or computation method
   * @param {Object} options - fact configuration options
   * @return {Almanac} this almanac instance for chaining
   */
  addFact (id, valueOrMethod, options) {
    let factId = id
    let fact
    if (id instanceof Fact) {
      factId = id.id
      fact = id
    } else {
      fact = new Fact(id, valueOrMethod, options)
    }
    debug('almanac::addFact', { id: factId })
    this.factMap.set(factId, fact)
    if (fact.isConstant()) {
      this._setFactValue(fact, {}, fact.value)
    }
    return this
  }

  /**
   * Adds a runtime fact during rule evaluation
   * @deprecated Use addFact() instead
   * @param {string} factId - unique fact identifier
   * @param {*} value - constant value for this fact
   */
  addRuntimeFact (factId, value) {
    debug('almanac::addRuntimeFact', { id: factId })
    const fact = new Fact(factId, value)
    return this._addConstantFact(fact)
  }

  /**
   * Computes and returns the value of a fact, with optional path traversal
   * Utilizes caching to avoid redundant computations for the same parameters
   * @param {string} factId - fact identifier to evaluate
   * @param {Object} params - parameters to pass to dynamic facts
   * @param {string} path - JSONPath expression for extracting nested properties
   * @return {Promise<*>} promise resolving to the fact value
   */
  factValue (factId, params = {}, path = '') {
    let factValuePromise
    const fact = this._getFact(factId)
    if (fact === undefined) {
      if (this.allowUndefinedFacts) {
        return Promise.resolve(undefined)
      } else {
        return Promise.reject(new UndefinedFactError(`Undefined fact: ${factId}`))
      }
    }
    if (fact.isConstant()) {
      factValuePromise = Promise.resolve(fact.calculate(params, this))
    } else {
      const cacheKey = fact.getCacheKey(params)
      const cacheVal = cacheKey && this.factResultsCache.get(cacheKey)
      if (cacheVal) {
        factValuePromise = Promise.resolve(cacheVal)
        debug('almanac::factValue cache hit for fact', { id: factId })
      } else {
        debug('almanac::factValue cache miss, calculating', { id: factId })
        factValuePromise = this._setFactValue(fact, params, fact.calculate(params, this))
      }
    }
    if (path) {
      debug('condition::evaluate extracting object', { property: path })
      return factValuePromise
        .then(factValue => {
          if (factValue != null && typeof factValue === 'object') {
            const pathValue = this.pathResolver(factValue, path)
            debug('condition::evaluate extracting object', { property: path, received: pathValue })
            return pathValue
          } else {
            debug('condition::evaluate could not compute object path of non-object', { path, factValue, type: typeof factValue })
            return factValue
          }
        })
    }
    return factValuePromise
  }

  /**
   * Resolves a value, either returning it directly or computing it as a fact reference
   * @param {*} value - either a primitive value or a fact reference object { fact: 'factId', params?: {}, path?: '' }
   * @return {Promise<*>} promise resolving to the final value
   */
  getValue (value) {
    if (value != null && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'fact')) { // value = { fact: 'xyz' }
      return this.factValue(value.fact, value.params, value.path)
    }
    return Promise.resolve(value)
  }
}
