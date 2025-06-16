'use strict'
import Operator from './operator'
/**
 * Default operators for rule evaluation with advanced scoring support
 *
 * All operators now return scores between 0 and 1 instead of boolean values:
 * - 0 indicates no match/complete failure
 * - 1 indicates perfect match/complete success
 * - Values between 0 and 1 indicate partial matches
 *
 * This scoring system enables:
 * - Fuzzy matching and gradual transitions
 * - More nuanced rule evaluation
 * - Weighted condition aggregation
 * - Better ranking of rule results
 */
const Operators = []
// Equality operators - return 1 for exact match, 0 otherwise
Operators.push(new Operator('equal', (a, b) => a === b ? 1 : 0))
Operators.push(new Operator('notEqual', (a, b) => a !== b ? 1 : 0))
// Array membership operators - return 1 if condition met, 0 otherwise
Operators.push(new Operator('in', (a, b) => b.indexOf(a) > -1 ? 1 : 0))
Operators.push(new Operator('notIn', (a, b) => b.indexOf(a) === -1 ? 1 : 0))
// Array containment operators - validate that fact value is an array
Operators.push(new Operator('contains', (a, b) => a.indexOf(b) > -1 ? 1 : 0, Array.isArray))
Operators.push(new Operator('doesNotContain', (a, b) => a.indexOf(b) === -1 ? 1 : 0, Array.isArray))
/**
 * Validator function for numeric comparison operators
 * Ensures the fact value can be parsed as a valid number
 * @param {*} factValue - the value to validate
 * @return {boolean} true if the value is a valid number
 */
function numberValidator (factValue) {
  return Number.parseFloat(factValue).toString() !== 'NaN'
}
// Numeric comparison operators with exponential decay scoring
// These operators use exponential functions to provide smooth scoring transitions:
// - Values that exactly meet the condition score 1.0
// - Values close to the threshold get high scores (0.8-0.99)
// - Values far from the threshold get low scores (0.01-0.3)
// - This creates smooth gradients instead of hard pass/fail boundaries
/**
 * Exponential scoring for "less than" comparisons
 * Score decreases exponentially as factValue exceeds the threshold
 */
Operators.push(new Operator('lessThan', (a, b) => Math.exp(-Math.max(0, ((a - b) / 250) + Number.EPSILON)), numberValidator))
/**
 * Exponential scoring for "less than or equal" comparisons
 * Score decreases exponentially as factValue exceeds the threshold
 */
Operators.push(new Operator('lessThanInclusive', (a, b) => Math.exp(-Math.max(0, (a - b) / 250)), numberValidator))
/**
 * Exponential scoring for "greater than" comparisons
 * Score decreases exponentially as factValue falls below the threshold
 */
Operators.push(new Operator('greaterThan', (a, b) => Math.exp(-Math.max(0, ((b - a) / 250) + Number.EPSILON)), numberValidator))
/**
 * Exponential scoring for "greater than or equal" comparisons
 * Score decreases exponentially as factValue falls below the threshold
 */
Operators.push(new Operator('greaterThanInclusive', (a, b) => Math.exp(-Math.max(0, (b - a) / 250)), numberValidator))
export default Operators
