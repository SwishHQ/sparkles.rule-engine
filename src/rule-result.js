'use strict'
import deepClone from 'clone'
/**
 * RuleResult class for storing rule evaluation results with scoring information
 */
export default class RuleResult {
  /**
   * Constructor for creating rule result instances
   * @param {Object} conditions - rule conditions that were evaluated
   * @param {Object} event - event object associated with the rule
   * @param {number} priority - rule priority level
   * @param {string} name - rule name/identifier
   */
  constructor (conditions, event, priority, name) {
    this.conditions = deepClone(conditions)
    this.event = deepClone(event)
    this.priority = deepClone(priority)
    this.name = deepClone(name)
    this.result = null
    this.score = 0
  }

  /**
   * Sets the rule evaluation result (boolean)
   * @param {boolean} result - whether the rule passed (score >= 1) or failed
   */
  setResult (result) {
    this.result = result
  }

  /**
   * Sets the rule evaluation score
   * @param {number} score - rule score between 0 and 1 indicating match strength
   */
  setScore (score) {
    this.score = score
  }

  /**
   * Resolves fact references in event parameters
   * @param {Almanac} almanac - almanac instance for fact value resolution
   * @return {Promise} resolves when all event parameters have been processed
   */
  resolveEventParams (almanac) {
    if (this.event.params !== null && typeof this.event.params === 'object') {
      const updates = []
      for (const key in this.event.params) {
        if (Object.prototype.hasOwnProperty.call(this.event.params, key)) {
          updates.push(almanac
            .getValue(this.event.params[key])
            .then((val) => (this.event.params[key] = val)))
        }
      }
      return Promise.all(updates)
    }
    return Promise.resolve()
  }

  /**
   * Serializes the rule result to JSON format
   * @param {boolean} stringify - whether to return JSON string or object (default: true)
   * @return {string|Object} JSON representation of the rule result including score
   */
  toJSON (stringify = true) {
    const props = {
      conditions: this.conditions.toJSON(false),
      event: this.event,
      priority: this.priority,
      name: this.name,
      score: this.score,
      result: this.result
    }
    if (stringify) {
      return JSON.stringify(props)
    }
    return props
  }
}
