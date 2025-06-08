'use strict'
/**
 * Operator class for defining and evaluating custom comparison operators with scoring support
 *
 * In the updated rule engine, operators return scores between 0 and 1 instead of boolean values.
 * This enables fuzzy matching, weighted evaluations, and more nuanced rule assessments.
 *
 * Score interpretation:
 * - 0: Complete mismatch/failure
 * - 1: Perfect match/complete success
 * - 0 < score < 1: Partial match with varying degrees of closeness
 */
export default class Operator {
  /**
   * Constructor for creating operator instances
   * @param {string} name - unique operator identifier (e.g., 'greaterThan', 'contains')
   * @param {Function} cb - evaluation callback that returns a score between 0 and 1
   * @param {Function} [factValueValidator] - optional validator for fact value data types
   * @returns {Operator} new operator instance
   */
  constructor (name, cb, factValueValidator) {
    this.name = String(name)
    if (!name) { throw new Error('Missing operator name') }
    if (typeof cb !== 'function') { throw new Error('Missing operator callback') }
    this.cb = cb
    this.factValueValidator = factValueValidator
    if (!this.factValueValidator) { this.factValueValidator = () => true }
  }

  /**
   * Evaluates the operator against fact and condition values
   *
   * The evaluation process:
   * 1. Validates the fact value using the optional validator
   * 2. Calls the operator callback with fact and condition values
   * 3. Ensures the returned score is clamped between 0 and 1
   * 4. Returns 0 if validation fails, otherwise returns the computed score
   *
   * @param {any} factValue - the computed fact value to test
   * @param {any} jsonValue - the condition value to compare against
   * @returns {number} score between 0 and 1 indicating match strength
   */
  evaluate (factValue, jsonValue) {
    if (!this.factValueValidator(factValue)) {
      return 0
    }
    return Math.max(0, Math.min(1, this.cb(factValue, jsonValue)))
  }
}
