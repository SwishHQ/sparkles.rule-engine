'use strict'
import debug from './debug'
/**
 * Condition class for representing and evaluating rule conditions with scoring and weight support
 */
export default class Condition {
  /**
   * Constructor for creating condition instances
   * @param {Object} properties - condition properties
   * @param {string} properties.fact - fact identifier for non-boolean conditions
   * @param {string} properties.operator - operator name for non-boolean conditions
   * @param {any} properties.value - value to compare against for non-boolean conditions
   * @param {string} properties.path - optional path for accessing nested fact properties
   * @param {Object} properties.params - optional parameters to pass to fact calculation
   * @param {number} properties.priority - optional priority for condition evaluation order
   * @param {number} properties.weight - optional weight for condition importance (default: 1)
   * @param {string} properties.name - optional condition name
   * @param {Array} properties.all - array of sub-conditions for 'all' boolean operator
   * @param {Array} properties.any - array of sub-conditions for 'any' boolean operator
   * @param {Object} properties.not - single sub-condition for 'not' boolean operator
   * @param {string} properties.condition - reference to a named condition
   */
  constructor (properties) {
    if (!properties) { throw new Error('Condition: constructor options required') }
    const booleanOperator = Condition.booleanOperator(properties)
    Object.assign(this, properties)
    if (booleanOperator) {
      const subConditions = properties[booleanOperator]
      const subConditionsIsArray = Array.isArray(subConditions)
      if (booleanOperator !== 'not' && !subConditionsIsArray) {
        throw new Error(`"${booleanOperator}" must be an array`)
      }
      if (booleanOperator === 'not' && subConditionsIsArray) {
        throw new Error(`"${booleanOperator}" cannot be an array`)
      }
      this.operator = booleanOperator
      // boolean conditions always have a priority; default 1
      this.priority = parseInt(properties.priority, 10) || 1
      // boolean conditions can have weights for scoring; default 1
      this.weight = parseInt(properties.weight, 10) || 1
      if (subConditionsIsArray) {
        this[booleanOperator] = subConditions.map((c) => new Condition(c))
      } else {
        this[booleanOperator] = new Condition(subConditions)
      }
    } else if (!Object.prototype.hasOwnProperty.call(properties, 'condition')) {
      if (!Object.prototype.hasOwnProperty.call(properties, 'fact')) {
        throw new Error('Condition: constructor "fact" property required')
      }
      if (!Object.prototype.hasOwnProperty.call(properties, 'operator')) {
        throw new Error('Condition: constructor "operator" property required')
      }
      if (!Object.prototype.hasOwnProperty.call(properties, 'value')) {
        throw new Error('Condition: constructor "value" property required')
      }
      // a non-boolean condition does not have a priority by default. this allows
      // priority to be dictated by the fact definition
      if (Object.prototype.hasOwnProperty.call(properties, 'priority')) {
        properties.priority = parseInt(properties.priority, 10)
      }
      // a non-boolean condition does not have a weight by default
      if (Object.prototype.hasOwnProperty.call(properties, 'weight')) {
        properties.weight = parseInt(properties.weight, 10)
      }
    }
  }

  /**
   * Converts the condition into a json-friendly structure
   * @param   {Boolean} stringify - whether to return as a json string
   * @returns {string,object} json string or json-friendly object
   */
  toJSON (stringify = true) {
    const props = {}
    if (this.priority) {
      props.priority = this.priority
    }
    if (this.weight) {
      props.weight = this.weight
    }
    if (this.name) {
      props.name = this.name
    }
    const oper = Condition.booleanOperator(this)
    if (oper) {
      if (Array.isArray(this[oper])) {
        props[oper] = this[oper].map((c) => c.toJSON(false))
      } else {
        props[oper] = this[oper].toJSON(false)
      }
    } else if (this.isConditionReference()) {
      props.condition = this.condition
    } else {
      props.operator = this.operator
      props.value = this.value
      props.fact = this.fact
      if (this.factResult !== undefined) {
        props.factResult = this.factResult
      }
      if (this.valueResult !== undefined) {
        props.valueResult = this.valueResult
      }
      if (this.result !== undefined) {
        props.result = this.result
      }
      if (this.score !== undefined) {
        props.score = this.score
      }
      if (this.params) {
        props.params = this.params
      }
      if (this.path) {
        props.path = this.path
      }
    }
    if (stringify) {
      return JSON.stringify(props)
    }
    return props
  }

  /**
   * Evaluates the condition against the provided almanac and operator map
   * Returns a score between 0 and 1 indicating how well the condition matches
   * @param {Almanac} almanac - almanac instance for fact retrieval
   * @param {OperatorMap} operatorMap - map of available operators
   * @return {Promise<Object>} evaluation result with score, result, and values
   * @return {Promise<Object>} evaluation result containing:
   *   - score: number between 0-1 indicating match strength
   *   - result: boolean indicating if score >= 1
   *   - leftHandSideValue: the actual fact value
   *   - rightHandSideValue: the comparison value
   *   - operator: the operator used
   */
  evaluate (almanac, operatorMap) {
    if (!almanac) { return Promise.reject(new Error('almanac required')) }
    if (!operatorMap) { return Promise.reject(new Error('operatorMap required')) }
    if (this.isBooleanOperator()) {
      return Promise.reject(new Error('Cannot evaluate() a boolean condition'))
    }
    const op = operatorMap.get(this.operator)
    if (!op) {
      return Promise.reject(new Error(`Unknown operator: ${this.operator}`))
    }
    return Promise.all([
      almanac.getValue(this.value),
      almanac.factValue(this.fact, this.params, this.path)
    ]).then(([rightHandSideValue, leftHandSideValue]) => {
      const score = op.evaluate(leftHandSideValue, rightHandSideValue)
      const result = score >= 1
      debug('condition::evaluate', {
        leftHandSideValue,
        operator: this.operator,
        rightHandSideValue,
        score,
        result
      })
      return {
        score,
        result,
        leftHandSideValue,
        rightHandSideValue,
        operator: this.operator
      }
    })
  }

  /**
   * Determines the boolean operator type for a condition object
   * @param {Object} condition - condition object to inspect
   * @return {string|undefined} 'all', 'any', 'not', or undefined
   */
  static booleanOperator (condition) {
    if (Object.prototype.hasOwnProperty.call(condition, 'any')) {
      return 'any'
    } else if (Object.prototype.hasOwnProperty.call(condition, 'all')) {
      return 'all'
    } else if (Object.prototype.hasOwnProperty.call(condition, 'not')) {
      return 'not'
    }
  }

  /**
   * Returns the boolean operator type for this condition instance
   * @return {string|undefined} 'all', 'any', 'not', or undefined
   */
  booleanOperator () {
    return Condition.booleanOperator(this)
  }

  /**
   * Determines if this condition uses a boolean operator (all, any, not)
   * @return {boolean} true if this is a boolean operator condition
   */
  isBooleanOperator () {
    return Condition.booleanOperator(this) !== undefined
  }

  /**
   * Determines if this condition is a reference to a named condition
   * @return {boolean} true if this condition references another condition by name
   */
  isConditionReference () {
    return Object.prototype.hasOwnProperty.call(this, 'condition')
  }
}
