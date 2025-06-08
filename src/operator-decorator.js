'use strict'
import Operator from './operator'
/**
 * OperatorDecorator class for modifying the behavior of existing operators
 */
export default class OperatorDecorator {
  /**
   * Constructor
   * @param {string} name - decorator identifier
   * @param {Function} cb - callback that takes the next operator as a parameter
   * @param {Function} [factValueValidator] - optional validator for asserting the data type of the fact
   * @returns {OperatorDecorator} - instance
   */
  constructor (name, cb, factValueValidator) {
    this.name = String(name)
    if (!name) { throw new Error('Missing decorator name') }
    if (typeof cb !== 'function') { throw new Error('Missing decorator callback') }
    this.cb = cb
    this.factValueValidator = factValueValidator
    if (!this.factValueValidator) { this.factValueValidator = () => true }
  }

  /**
   * Takes the operator and decorates it with additional functionality
   * @param {Operator} operator - operator to decorate
   * @returns {Operator} - decorated operator instance
   */
  decorate (operator) {
    const next = operator.evaluate.bind(operator)
    return new Operator(`${this.name}:${operator.name}`, (factValue, jsonValue) => {
      return this.cb(factValue, jsonValue, next)
    }, this.factValueValidator)
  }
}
