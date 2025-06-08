'use strict'
import Condition from './condition'
import RuleResult from './rule-result'
import debug from './debug'
import deepClone from 'clone'
import EventEmitter from 'eventemitter2'
/**
 * Rule class for defining and evaluating business rules with scoring and weight support
 */
class Rule extends EventEmitter {
  /**
   * returns a new Rule instance
   * @param {Object|string} options - options object, or json string that can be parsed into options
   * @param {number} options.priority - rule priority (>1) - higher runs sooner.
   * @param {Object} options.event - event to fire when rule evaluates as successful
   * @param {string} options.event.type - name of event to emit
   * @param {Object} options.event.params - parameters to pass to the event listener
   * @param {Object} options.conditions - conditions to evaluate when processing this rule
   * @param {any} options.name - identifier for a particular rule, particularly valuable in RuleResult output
   * @param {Function} options.onSuccess - callback to execute when rule passes
   * @param {Function} options.onFailure - callback to execute when rule fails
   * @return {Rule} instance
   */
  constructor (options) {
    super()
    if (typeof options === 'string') {
      options = JSON.parse(options)
    }
    if (options && options.conditions) {
      this.setConditions(options.conditions)
    }
    if (options && options.onSuccess) {
      this.on('success', options.onSuccess)
    }
    if (options && options.onFailure) {
      this.on('failure', options.onFailure)
    }
    if (options && (options.name || options.name === 0)) {
      this.setName(options.name)
    }
    const priority = (options && options.priority) || 1
    this.setPriority(priority)
    const event = (options && options.event) || { type: 'unknown' }
    this.setEvent(event)
  }

  /**
   * Sets the priority of the rule
   * @param {number} priority (>=1) - increasing the priority causes the rule to be run prior to other rules
   */
  setPriority (priority) {
    priority = parseInt(priority, 10)
    if (priority <= 0) { throw new Error('Priority must be greater than zero') }
    this.priority = priority
    return this
  }

  /**
   * Sets the name of the rule
   * @param {any} name - any truthy input and zero is allowed
   */
  setName (name) {
    if (!name && name !== 0) {
      throw new Error('Rule "name" must be defined')
    }
    this.name = name
    return this
  }

  /**
   * Sets the conditions to run when evaluating the rule.
   * @param {Object} conditions - conditions, root element must be a boolean operator
   */
  setConditions (conditions) {
    if (!Object.prototype.hasOwnProperty.call(conditions, 'all') &&
      !Object.prototype.hasOwnProperty.call(conditions, 'any') &&
      !Object.prototype.hasOwnProperty.call(conditions, 'not') &&
      !Object.prototype.hasOwnProperty.call(conditions, 'condition')) {
      throw new Error('"conditions" root must contain a single instance of "all", "any", "not", or "condition"')
    }
    this.conditions = new Condition(conditions)
    return this
  }

  /**
   * Sets the event to emit when the conditions evaluate truthy
   * @param {Object} event - event to emit
   * @param {string} event.type - event name to emit on
   * @param {Object} event.params - parameters to emit as the argument of the event emission
   */
  setEvent (event) {
    if (!event) { throw new Error('Rule: setEvent() requires event object') }
    if (!Object.prototype.hasOwnProperty.call(event, 'type')) {
      throw new Error('Rule: setEvent() requires event object with "type" property')
    }
    this.ruleEvent = {
      type: event.type
    }
    this.event = this.ruleEvent
    if (event.params) { this.ruleEvent.params = event.params }
    return this
  }

  /**
   * returns the event object
   * @returns {Object} event
   */
  getEvent () {
    return this.ruleEvent
  }

  /**
   * returns the priority
   * @returns {number} priority
   */
  getPriority () {
    return this.priority
  }

  /**
   * returns the conditions object
   * @returns {Condition} conditions
   */
  getConditions () {
    return this.conditions
  }

  /**
   * returns the engine object
   * @returns {Engine} engine
   */
  getEngine () {
    return this.engine
  }

  /**
   * Sets the engine to run the rules under
   * @param {Engine} engine
   * @returns {Rule}
   */
  setEngine (engine) {
    this.engine = engine
    return this
  }

  toJSON (stringify = true) {
    const props = {
      conditions: this.conditions.toJSON(false),
      priority: this.priority,
      event: this.ruleEvent,
      name: this.name
    }
    if (stringify) {
      return JSON.stringify(props)
    }
    return props
  }

  /**
   * Priorizes an array of conditions based on "priority"
   *   When no explicit priority is provided on the condition itself, the condition's priority is determine by its fact
   * @param  {Condition[]} conditions
   * @return {Condition[][]} prioritized two-dimensional array of conditions
   *    Each outer array element represents a single priority(integer).  Inner array is
   *    all conditions with that priority.
   */
  prioritizeConditions (conditions) {
    const factSets = conditions.reduce((sets, condition) => {
      // if a priority has been set on this specific condition, honor that first
      // otherwise, use the fact's priority
      let priority = condition.priority
      if (!priority) {
        const fact = this.engine.getFact(condition.fact)
        priority = (fact && fact.priority) || 1
      }
      if (!sets[priority]) { sets[priority] = [] }
      sets[priority].push(condition)
      return sets
    }, {})
    return Object.keys(factSets)
      .sort((a, b) => {
        return Number(a) > Number(b) ? -1 : 1 // order highest priority -> lowest
      })
      .map((priority) => factSets[priority])
  }

  /**
   * Evaluates the rule, starting with the root boolean operator and recursing down
   * All evaluation is done within the context of an almanac
   * @param {Almanac} almanac - almanac instance for rule evaluation
   * @return {Promise<RuleResult>} rule evaluation result with score
   */
  evaluate (almanac) {
    const ruleResult = new RuleResult(this.conditions, this.ruleEvent, this.priority, this.name)
    /**
     * Evaluates the rule conditions
     * @param {Condition} condition - condition to evaluate
     * @return {Promise<number>} - resolves with the score of the condition evaluation (0-1)
     */
    const evaluateCondition = (condition) => {
      if (condition.isConditionReference()) {
        return realize(condition)
      } else if (condition.isBooleanOperator()) {
        const subConditions = condition[condition.operator]
        let comparisonPromise
        if (condition.operator === 'all') {
          comparisonPromise = all(subConditions)
        } else if (condition.operator === 'any') {
          comparisonPromise = any(subConditions)
        } else {
          comparisonPromise = not(subConditions)
        }
        // for booleans, rule passing is determined by the all/any/not result
        return comparisonPromise.then((comparisonValue) => {
          condition.result = comparisonValue >= 1
          condition.score = comparisonValue
          return comparisonValue
        })
      } else {
        return condition
          .evaluate(almanac, this.engine.operators)
          .then((evaluationResult) => {
            const score = evaluationResult.score
            condition.factResult = evaluationResult.leftHandSideValue
            condition.valueResult = evaluationResult.rightHandSideValue
            condition.result = evaluationResult.result
            condition.score = score
            return score
          })
      }
    }
    /**
     * Evaluates an array of conditions using weighted scoring
     *
     * This replaces the previous priority-based short-circuiting approach with a comprehensive
     * scoring system that evaluates all conditions to provide weighted scores.
     *
     * Previous behavior:
     *   - Ordered top level conditions based on priority
     *   - Iterated over each priority set, evaluating each condition
     *   - Short-circuited when any condition guaranteed the rule to be truthy or falsey
     *   - Did not evaluate additional conditions after short-circuit
     *
     * New scoring behavior:
     *   - Orders conditions based on priority for consistent evaluation order
     *   - Evaluates ALL conditions regardless of individual results
     *   - Collects scores from each condition (0-1 range)
     *   - Applies weighted scoring logic based on operator (all/any/not)
     *   - Returns aggregated score that determines final rule result
     *
     * @param {Condition[]} conditions - conditions to be evaluated
     * @param {Function} method - evaluation method (evaluateAll or evaluateAny)
     * @return {Promise<number>} weighted score based on condition evaluation + method
     */
    const evaluateConditions = (conditions, method) => {
      if (!Array.isArray(conditions)) { conditions = [conditions] }
      conditions = this.prioritizeConditions(conditions).flat()
      return Promise.all(conditions.map((condition) => evaluateCondition(condition))).then((conditionScores) => {
        debug('rule::evaluateConditions', { results: conditionScores.map((score) => score >= 1), scores: conditionScores })
        return method(conditionScores, conditions)
      })
    }
    /**
     * Evaluates conditions with 'any' logic using weighted maximum scoring
     * Returns the highest weighted score among all conditions
     *
     * Weight handling for 'any' logic:
     *   - Each condition can have an optional weight (defaults to 1)
     *   - Higher weights increase the importance of that condition's score
     *   - The final score is the maximum weighted score normalized by its weight
     *   - This ensures that a high-weight condition scoring well dominates the result
     *   - Example: condition A (weight=3, score=0.5) vs condition B (weight=1, score=0.8)
     *     → A weighted = 1.5, B weighted = 0.8 → A wins → final score = 1.5/3 = 0.5
     *
     * @param {number[]} conditionScores - array of condition scores
     * @param {Condition[]} conditions - array of conditions with weights
     * @return {number} maximum weighted score
     */
    const evaluateAny = (conditionScores, conditions) => {
      if (conditionScores.length === 0) {
        return 0
      }
      let maxWeight = conditions[0].weight || 1
      let maxWeightedScore = conditionScores[0] * maxWeight
      for (let i = 1; i < conditionScores.length; i++) {
        const weight = conditions[i].weight || 1
        const weightedScore = conditionScores[i] * weight
        if (weightedScore > maxWeightedScore) {
          maxWeightedScore = weightedScore
          maxWeight = weight
        }
      }
      return maxWeightedScore / maxWeight
    }
    /**
     * Evaluates conditions with 'all' logic using weighted average scoring
     * Returns the weighted average of all condition scores
     *
     * Weight handling for 'all' logic:
     *   - Each condition can have an optional weight (defaults to 1)
     *   - Higher weights make that condition contribute more to the final average
     *   - The final score is the sum of all weighted scores divided by total weight
     *   - This ensures that important conditions have greater influence on the result
     *   - Example: condition A (weight=3, score=0.9) + condition B (weight=1, score=0.3)
     *     → (3*0.9 + 1*0.3) / (3+1) = 3.0 / 4 = 0.75
     *
     * @param {number[]} conditionScores - array of condition scores
     * @param {Condition[]} conditions - array of conditions with weights
     * @return {number} weighted average score
     */
    const evaluateAll = (conditionScores, conditions) => {
      if (conditionScores.length === 0) {
        return 1
      }
      let totalWeight = conditions[0].weight || 1
      let totalWeightedScore = conditionScores[0] * totalWeight
      for (let i = 1; i < conditionScores.length; i++) {
        const weight = conditions[i].weight || 1
        totalWeightedScore += conditionScores[i] * weight
        totalWeight += weight
      }
      return totalWeightedScore / totalWeight
    }
    /**
     * Runs an 'any' boolean operator on an array of conditions
     * @param {Condition[]} conditions to be evaluated
     * @return {Promise<number>} condition evaluation score
     */
    const any = (conditions) => {
      return evaluateConditions(conditions, evaluateAny)
    }
    /**
     * Runs an 'all' boolean operator on an array of conditions
     * @param {Condition[]} conditions to be evaluated
     * @return {Promise<number>} condition evaluation score
     */
    const all = (conditions) => {
      return evaluateConditions(conditions, evaluateAll)
    }
    /**
     * Runs a 'not' boolean operator on a single condition
     *
     * Score inversion logic:
     *   - Evaluates the inner condition to get its score (0-1)
     *   - If score >= 1 (condition passes), returns 0 (not fails)
     *   - If score < 1 (condition fails), returns 1 (not passes)
     *   - This maintains binary pass/fail behavior for the 'not' operator
     *   - Note: Partial scores (0 < score < 1) are treated as failures and inverted to 1
     *
     * @param {Condition} condition to be evaluated
     * @return {Promise<number>} inverted condition evaluation score
     */
    const not = (condition) => {
      return evaluateCondition(condition).then((score) => score >= 1 ? 0 : 1)
    }
    /**
     * Dereferences the condition reference and then evaluates it.
     * @param {Condition} conditionReference
     * @returns {Promise<number>} condition evaluation score
     */
    const realize = (conditionReference) => {
      const condition = this.engine.conditions.get(conditionReference.condition)
      if (!condition) {
        if (this.engine.allowUndefinedConditions) {
          // undefined conditions always fail
          conditionReference.result = false
          conditionReference.score = 0
          return Promise.resolve(0)
        } else {
          throw new Error(`No condition ${conditionReference.condition} exists`)
        }
      } else {
        // project the referenced condition onto reference object and evaluate it.
        delete conditionReference.condition
        Object.assign(conditionReference, deepClone(condition))
        return evaluateCondition(conditionReference)
      }
    }
    /**
     * Emits based on rule evaluation result, and decorates ruleResult with 'result' and 'score' properties
     * @param {number} score - rule evaluation score (0-1)
     */
    const processScore = (score) => {
      const result = score >= 1
      ruleResult.setResult(result)
      ruleResult.setScore(score)
      let processEvent = Promise.resolve()
      if (this.engine.replaceFactsInEventParams) {
        processEvent = ruleResult.resolveEventParams(almanac)
      }
      const event = result ? 'success' : 'failure'
      return processEvent.then(() => this.emitAsync(event, ruleResult.event, almanac, ruleResult)).then(() => ruleResult)
    }
    if (ruleResult.conditions.any) {
      return any(ruleResult.conditions.any).then((score) => processScore(score))
    } else if (ruleResult.conditions.all) {
      return all(ruleResult.conditions.all).then((score) => processScore(score))
    } else if (ruleResult.conditions.not) {
      return not(ruleResult.conditions.not).then((score) => processScore(score))
    } else {
      return realize(ruleResult.conditions).then((score) => processScore(score))
    }
  }
}
export default Rule
