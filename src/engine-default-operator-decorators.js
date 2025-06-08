'use strict'
import OperatorDecorator from './operator-decorator'
/**
 * Default operator decorators for enhanced operator functionality with scoring support
 *
 * These decorators modify operator behavior while preserving the new scoring system.
 * All decorators return scores between 0 and 1, maintaining compatibility with
 * the weighted scoring evaluation system.
 */
const OperatorDecorators = []
/**
 * 'someFact' decorator - Tests if any element in the fact array matches the condition
 * Scoring: Returns the maximum score from testing each array element
 * @param {Array} factValue - array of values to test
 * @param {*} jsonValue - value to compare against each array element
 * @param {Function} next - the decorated operator function
 * @param {Function} validator - validates that factValue is an array
 * @return {number} maximum score (0-1) from all array element comparisons
 */
OperatorDecorators.push(new OperatorDecorator('someFact', (factValue, jsonValue, next) => Math.max(0, ...factValue.map(fv => next(fv, jsonValue))), Array.isArray))
/**
 * 'someValue' decorator - Tests if the fact matches any element in the value array
 * Scoring: Returns the maximum score from testing against each array element
 * @param {*} factValue - value to test against each array element
 * @param {Array} jsonValue - array of values to test against
 * @param {Function} next - the decorated operator function
 * @return {number} maximum score (0-1) from all value comparisons
 */
OperatorDecorators.push(new OperatorDecorator('someValue', (factValue, jsonValue, next) => Math.max(0, ...jsonValue.map(jv => next(factValue, jv)))))
/**
 * 'everyFact' decorator - Tests if all elements in the fact array match the condition
 * Scoring: Returns the average score from testing each array element
 * @param {Array} factValue - array of values to test
 * @param {*} jsonValue - value to compare against each array element
 * @param {Function} next - the decorated operator function
 * @param {Function} validator - validates that factValue is an array
 * @return {number} average score (0-1) from all array element comparisons
 */
OperatorDecorators.push(new OperatorDecorator('everyFact', (factValue, jsonValue, next) => factValue.length === 0 ? 1 : factValue.reduce((sum, fv) => sum + next(fv, jsonValue), 0) / factValue.length, Array.isArray))
/**
 * 'everyValue' decorator - Tests if the fact matches all elements in the value array
 * Scoring: Returns the average score from testing against each array element
 * @param {*} factValue - value to test against each array element
 * @param {Array} jsonValue - array of values to test against
 * @param {Function} next - the decorated operator function
 * @return {number} average score (0-1) from all value comparisons
 */
OperatorDecorators.push(new OperatorDecorator('everyValue', (factValue, jsonValue, next) => jsonValue.length === 0 ? 1 : jsonValue.reduce((sum, jv) => sum + next(factValue, jv), 0) / jsonValue.length))
/**
 * 'swap' decorator - Reverses the order of arguments passed to the operator
 * Scoring: Passes through the score from the decorated operator unchanged
 * @param {*} factValue - becomes the jsonValue parameter
 * @param {*} jsonValue - becomes the factValue parameter
 * @param {Function} next - the decorated operator function
 * @return {number} score (0-1) from the swapped operator evaluation
 */
OperatorDecorators.push(new OperatorDecorator('swap', (factValue, jsonValue, next) => next(jsonValue, factValue)))
/**
 * 'not' decorator - Inverts the logical result of the operator
 * Scoring: Returns 1 if the decorated operator score is < 1, otherwise returns 0
 * This maintains binary pass/fail semantics for logical negation
 * @param {*} factValue - value to pass to decorated operator
 * @param {*} jsonValue - value to pass to decorated operator
 * @param {Function} next - the decorated operator function
 * @return {number} inverted score: 1 if next() < 1, otherwise 0
 */
OperatorDecorators.push(new OperatorDecorator('not', (factValue, jsonValue, next) => next(factValue, jsonValue) >= 1 ? 0 : 1))
export default OperatorDecorators
