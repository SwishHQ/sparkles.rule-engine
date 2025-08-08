'use strict'
import Engine from './engine'
import Rule from './rule'
import Almanac from './almanac'
import debug from './debug'

/**
 * ValidateEngine extends the base Engine class with specialized validation functionality
 * for evaluating rules against JSON conditions and providing detailed validation results.
 */
export default class ValidateEngine extends Engine {
  /**
   * Creates a new ValidateEngine instance
   * @param {Rule[]} rules - array of rules to initialize with
   * @param {Object} options - engine configuration options
   */
  constructor(rules = [], options = {}) {
    super(rules, options)
    this._defaultValueProviders = new Map()
  }

  /**
   * Checks if a condition object uses a specific fact
   * @param {Object} condition - condition object to check
   * @param {string} factId - fact identifier to search for
   * @return {boolean} whether the condition uses this fact
   * @private
   */
  _conditionUsesFact(condition, factId) {
    if (!condition) return false
    
    // Check if this condition directly uses the fact
    if (condition.fact === factId) {
      return true
    }
    
    // Check nested conditions
    if (condition.all && Array.isArray(condition.all)) {
      return condition.all.some(c => this._conditionUsesFact(c, factId))
    }
    
    if (condition.any && Array.isArray(condition.any)) {
      return condition.any.some(c => this._conditionUsesFact(c, factId))
    }
    
    if (condition.not) {
      return this._conditionUsesFact(condition.not, factId)
    }
    
    return false
  }

  /**
   * Finds all rules that would be satisfied by a given set of facts
   * This includes fully satisfied, partially satisfied, and independent rules
   * @param {Object} facts - facts to test against
   * @param {string} [focusedFactId] - if provided, rules that do not use this fact are always independent
   * @return {Promise<Object>} analysis of which rules would be satisfied
   */
  async findSatisfiedRules(facts, focusedFactId) {
    debug('validateEngine::findSatisfiedRules', { factIds: Object.keys(facts) })
    
    const providedFactIds = Object.keys(facts)
    
    // Categorize rules into different satisfaction types
    const fullySatisfiedRules = []
    const partiallySatisfiedRules = []
    const independentRules = []
    const unsatisfiedRules = []
    
    for (const rule of this.rules) {
      // If focusedFactId is provided, use it for independence logic
      const usesFocusedFact = focusedFactId
        ? this._conditionUsesFact(rule.getConditions(), focusedFactId)
        : providedFactIds.some(factId => this._conditionUsesFact(rule.getConditions(), factId))
      // For context-based: does the rule use ANY provided fact?
      const usesAnyProvidedFact = providedFactIds.some(factId => this._conditionUsesFact(rule.getConditions(), factId))
      
      // Check if rule has any conditions at all
      const hasConditions = this._hasConditions(rule.getConditions())
      
      if (!hasConditions) {
        // Rule has no conditions - it's independent and always satisfied
        independentRules.push({
          name: rule.name,
          priority: rule.priority,
          score: 1,
          event: rule.event,
          satisfactionType: 'independent',
          reason: 'independent_and_satisfied'
        })
      } else if (focusedFactId && !usesFocusedFact) {
        // If focusedFactId is set and rule does not use it, always independent
        independentRules.push({
          name: rule.name,
          priority: rule.priority,
          score: 0,
          event: rule.event,
          satisfactionType: 'independent',
          reason: 'independent_and_satisfied'
        })
      } else if (!focusedFactId && !usesAnyProvidedFact) {
        // For context-based: rule does not use any provided fact, so independent
        independentRules.push({
          name: rule.name,
          priority: rule.priority,
          score: 0,
          event: rule.event,
          satisfactionType: 'independent',
          reason: 'independent_and_satisfied'
        })
      } else {
        // Rule has conditions - check if it uses provided facts and if it has missing facts
        const missingFacts = this._getMissingFactsForRule(rule, facts)
        const hasMissingFacts = Object.keys(missingFacts).length > 0
        const usesProvidedFacts = providedFactIds.some(factId => 
          this._conditionUsesFact(rule.getConditions(), factId)
        )
        
        if (hasMissingFacts && usesProvidedFacts) {
          // Rule has missing facts but also uses provided facts
          // First, evaluate with available facts to see if it would fail anyway
          const tempEngine = this._createTemporaryEngine([rule], {
            allowUndefinedFacts: true
          })
          
          try {
            const result = await tempEngine.run(facts)
            if (result.results.length > 0) {
              // Rule is fully satisfied even with missing facts
              fullySatisfiedRules.push({
                name: rule.name,
                priority: rule.priority,
                score: result.results[0].score,
                event: result.results[0].event,
                satisfactionType: 'fully_satisfied',
                reason: 'fully_satisfied_with_fact'
              })
            } else {
              // Rule failed evaluation with available facts
              // Now check if it would succeed with the missing facts
              const completeFacts = { ...facts, ...missingFacts }
              const completeEngine = this._createTemporaryEngine([rule], {
                allowUndefinedFacts: false
              })
              
              try {
                const completeResult = await completeEngine.run(completeFacts)
                if (completeResult.results.length > 0) {
                  // Rule would be satisfied if missing facts were provided
                  partiallySatisfiedRules.push({
                    name: rule.name,
                    priority: rule.priority,
                    score: 0,
                    event: rule.event,
                    satisfactionType: 'partially_satisfied',
                    reason: 'partially_satisfied_missing_facts',
                    missingFacts: missingFacts
                  })
                } else {
                  // Rule would fail even with missing facts - it's unsatisfied
                  unsatisfiedRules.push({
                    name: rule.name,
                    priority: rule.priority,
                    score: 0,
                    event: rule.event,
                    satisfactionType: 'unsatisfied',
                    reason: 'unsatisfied_condition_mismatch'
                  })
                }
              } catch (completeError) {
                // If complete evaluation fails, treat as unsatisfied
                unsatisfiedRules.push({
                  name: rule.name,
                  priority: rule.priority,
                  score: 0,
                  event: rule.event,
                  satisfactionType: 'unsatisfied',
                  reason: 'unsatisfied_condition_mismatch'
                })
              }
            }
          } catch (error) {
            // If evaluation fails due to missing facts, check if it would succeed with them
            const completeFacts = { ...facts, ...missingFacts }
            const completeEngine = this._createTemporaryEngine([rule], {
              allowUndefinedFacts: false
            })
            
            try {
              const completeResult = await completeEngine.run(completeFacts)
              if (completeResult.results.length > 0) {
                partiallySatisfiedRules.push({
                  name: rule.name,
                  priority: rule.priority,
                  score: 0,
                  event: rule.event,
                  satisfactionType: 'partially_satisfied',
                  reason: 'partially_satisfied_missing_facts',
                  missingFacts: missingFacts
                })
              } else {
                unsatisfiedRules.push({
                  name: rule.name,
                  priority: rule.priority,
                  score: 0,
                  event: rule.event,
                  satisfactionType: 'unsatisfied',
                  reason: 'unsatisfied_condition_mismatch'
                })
              }
            } catch (completeError) {
              // If complete evaluation fails, treat as unsatisfied
              unsatisfiedRules.push({
                name: rule.name,
                priority: rule.priority,
                score: 0,
                event: rule.event,
                satisfactionType: 'unsatisfied',
                reason: 'unsatisfied_condition_mismatch'
              })
            }
          }
        } else if (hasMissingFacts && !usesProvidedFacts) {
          // Rule has missing facts but doesn't use any provided facts
          // It's independent since it doesn't depend on current facts
          independentRules.push({
            name: rule.name,
            priority: rule.priority,
            score: 0,
            event: rule.event,
            satisfactionType: 'independent',
            reason: 'independent_missing_facts'
          })
        } else if (!usesProvidedFacts) {
          // Rule doesn't use any provided facts - it's independent
          independentRules.push({
            name: rule.name,
            priority: rule.priority,
            score: 0,
            event: rule.event,
            satisfactionType: 'independent',
            reason: 'independent_and_satisfied'
          })
        } else {
          // Rule has all required facts and uses provided facts - evaluate it
          const tempEngine = this._createTemporaryEngine([rule], {
            allowUndefinedFacts: false
          })
          
          try {
            const result = await tempEngine.run(facts)
            if (result.results.length > 0) {
              // Rule is fully satisfied
              fullySatisfiedRules.push({
                name: rule.name,
                priority: rule.priority,
                score: result.results[0].score,
                event: result.results[0].event,
                satisfactionType: 'fully_satisfied',
                reason: 'fully_satisfied_with_fact'
              })
            } else {
              // Rule has all facts but conditions don't match
              unsatisfiedRules.push({
                name: rule.name,
                priority: rule.priority,
                score: result.failureResults.length > 0 ? result.failureResults[0].score : 0,
                event: result.failureResults.length > 0 ? result.failureResults[0].event : null,
                satisfactionType: 'unsatisfied',
                reason: 'unsatisfied_condition_mismatch'
              })
            }
          } catch (error) {
            // If evaluation fails, treat as unsatisfied
            unsatisfiedRules.push({
              name: rule.name,
              priority: rule.priority,
              score: 0,
              event: null,
              satisfactionType: 'unsatisfied',
              reason: 'unsatisfied_evaluation_error'
            })
          }
        }
      }
    }
    
    return {
      facts,
      timestamp: new Date().toISOString(),
      fullySatisfiedRules: fullySatisfiedRules,
      partiallySatisfiedRules: partiallySatisfiedRules,
      independentRules: independentRules,
      unsatisfiedRules: unsatisfiedRules,
      summary: {
        totalRules: this.rules.length,
        fullySatisfied: fullySatisfiedRules.length,
        partiallySatisfied: partiallySatisfiedRules.length,
        independent: independentRules.length,
        totalSatisfied: fullySatisfiedRules.length + partiallySatisfiedRules.length + independentRules.length,
        unsatisfied: unsatisfiedRules.length,
        satisfactionRate: this.rules.length > 0 ? (fullySatisfiedRules.length + partiallySatisfiedRules.length + independentRules.length) / this.rules.length : 0
      }
    }
  }

  /**
   * Finds partially satisfied rules for a specific fact with context
   * @param {string} factId - the fact identifier to focus on
   * @param {any} factValue - the value of the fact
   * @param {Object} contextFacts - additional context facts
   * @return {Promise<Object>} analysis of which rules would be satisfied
   */
  async findPartiallySatisfiedRules(factId, factValue, contextFacts = {}) {
    const facts = { [factId]: factValue, ...contextFacts }
    const result = await this.findSatisfiedRules(facts, factId)
    
    return {
      factId,
      factValue,
      contextFacts,
      timestamp: result.timestamp,
      summary: result.summary,
      rules: {
        partiallySatisfied: result.partiallySatisfiedRules,
        independent: result.independentRules,
        fullySatisfied: result.fullySatisfiedRules,
        unsatisfied: result.unsatisfiedRules
      }
    }
  }

  /**
   * Finds partially satisfied rules from a context object
   * @param {Object} contextFacts - context facts to test against
   * @return {Promise<Object>} analysis of which rules would be satisfied
   */
  async findPartiallySatisfiedRulesFromContext(contextFacts) {
    const result = await this.findSatisfiedRules(contextFacts) // no focusedFactId
    
    // Update reasons for context-based analysis
    const updatedFullySatisfied = result.fullySatisfiedRules.map(rule => ({
      ...rule,
      reason: rule.reason === 'fully_satisfied_with_fact' ? 'fully_satisfied' : rule.reason
    }))
    
    return {
      contextFacts,
      timestamp: result.timestamp,
      summary: result.summary,
      rules: {
        partiallySatisfied: result.partiallySatisfiedRules,
        independent: result.independentRules,
        fullySatisfied: updatedFullySatisfied,
        unsatisfied: result.unsatisfiedRules
      }
    }
  }

  /**
   * Checks if a rule has any conditions
   * @private
   */
  _hasConditions(condition) {
    if (!condition) return false
    
    if (condition.fact) return true
    
    if (condition.all && Array.isArray(condition.all)) {
      return condition.all.length > 0 && condition.all.some(c => this._hasConditions(c))
    }
    
    if (condition.any && Array.isArray(condition.any)) {
      return condition.any.length > 0 && condition.any.some(c => this._hasConditions(c))
    }
    
    if (condition.not) {
      return this._hasConditions(condition.not)
    }
    
    return false
  }

  /**
   * Gets the missing facts required for a rule to be satisfied
   * @private
   */
  _getMissingFactsForRule(rule, currentFacts) {
    const requiredFacts = this._extractFactsFromCondition(rule.getConditions())
    const missingFacts = {}
    
    for (const [factId, defaultValue] of Object.entries(requiredFacts)) {
      if (!(factId in currentFacts)) {
        missingFacts[factId] = defaultValue
      }
    }
    
    return missingFacts
  }

  /**
   * Extracts facts from a condition JSON object
   * @private
   */
  _extractFactsFromCondition(condition) {
    const facts = {}
    
    const extractFromCondition = (cond) => {
      if (cond.fact && cond.value !== undefined) {
        // For missing facts, provide reasonable defaults based on the operator
        const defaultValue = this._getDefaultValueForCondition(cond)
        facts[cond.fact] = defaultValue
      }
      
      if (cond.all) {
        cond.all.forEach(extractFromCondition)
      }
      
      if (cond.any) {
        cond.any.forEach(extractFromCondition)
      }
      
      if (cond.not) {
        extractFromCondition(cond.not)
      }
    }
    
    extractFromCondition(condition)
    return facts
  }

  /**
   * Gets a default value for a condition that would satisfy it
   * This method can be extended by subclasses or through operator decorators
   * @param {Object} condition - the condition object
   * @return {any} default value that would satisfy the condition
   * @private
   */
  _getDefaultValueForCondition(condition) {
    const { operator, value } = condition
    
    // Try to get default value from registered default value providers first
    const defaultValueProvider = this._getDefaultValueProvider(operator)
    if (defaultValueProvider) {
      try {
        return defaultValueProvider(value, condition)
      } catch (error) {
        // Fall back to built-in logic
      }
    }
    
    // Built-in default value logic for common operators
    return this._getBuiltInDefaultValue(operator, value)
  }

  /**
   * Gets the default value provider for an operator
   * @param {string} operator - the operator name
   * @return {Function|null} the default value provider function or null
   * @private
   */
  _getDefaultValueProvider(operator) {
    // Check if we have a default value provider registered for this operator
    if (this._defaultValueProviders && this._defaultValueProviders.has(operator)) {
      return this._defaultValueProviders.get(operator)
    }
    return null
  }

  /**
   * Registers a default value provider for an operator
   * @param {string} operator - the operator name
   * @param {Function} provider - function that takes (threshold, condition) and returns a default value
   * @public
   */
  registerDefaultValueProvider(operator, provider) {
    if (!this._defaultValueProviders) {
      this._defaultValueProviders = new Map()
    }
    this._defaultValueProviders.set(operator, provider)
  }

  /**
   * Unregisters a default value provider for an operator
   * @param {string} operator - the operator name
   * @public
   */
  unregisterDefaultValueProvider(operator) {
    if (this._defaultValueProviders) {
      this._defaultValueProviders.delete(operator)
    }
  }

  /**
   * Creates a temporary engine with all operators and default value providers copied
   * @param {Rule[]} rules - rules to add to the temporary engine
   * @param {Object} options - engine options
   * @return {ValidateEngine} temporary engine with all operators copied
   * @private
   */
  _createTemporaryEngine(rules, options = {}) {
    const tempEngine = new ValidateEngine(rules, {
      allowUndefinedFacts: options.allowUndefinedFacts || false,
      pathResolver: this.pathResolver
    })
    
    // Copy ALL operators from the original engine
    const originalOperators = this.operators.operators
    for (const [name, operator] of originalOperators.entries()) {
      tempEngine.addOperator(name, operator.cb)
    }
    
    // Copy ALL default value providers
    if (this._defaultValueProviders) {
      for (const [name, provider] of this._defaultValueProviders.entries()) {
        tempEngine.registerDefaultValueProvider(name, provider)
      }
    }
    
    return tempEngine
  }

  /**
   * Gets built-in default values for common operators
   * @param {string} operator - the operator name
   * @param {any} threshold - the threshold value
   * @return {any} default value that would satisfy the condition
   * @private
   */
  _getBuiltInDefaultValue(operator, threshold) {
    // For comparison operators, provide a value that would satisfy the condition
    switch (operator) {
      case 'equal':
        return threshold
      
      case 'notEqual':
        // Return a different value of the same type
        return typeof threshold === 'string' ? threshold + '_different' : threshold + 1
      
      case 'greaterThan':
      case 'isTimeGreaterThan':
        return this._getValueGreaterThan(threshold)
      
      case 'lessThan':
      case 'isTimeLessThan':
        return this._getValueLessThan(threshold)
      
      case 'greaterThanInclusive':
        return this._getValueGreaterThanOrEqual(threshold)
      
      case 'lessThanInclusive':
        return this._getValueLessThanOrEqual(threshold)
      
      case 'in':
        // For array membership, return the first element if it exists
        return Array.isArray(threshold) && threshold.length > 0 ? threshold[0] : threshold
      
      case 'contains':
        // For array containment, return a value that would be in the array
        return Array.isArray(threshold) && threshold.length > 0 ? threshold[0] : threshold
      
      case 'includes':
        // For array inclusion, return the first element if it exists
        return Array.isArray(threshold) && threshold.length > 0 ? threshold[0] : threshold
      
      default:
        // For unknown operators, return the threshold as-is
        return threshold
    }
  }

  /**
   * Gets a value that's greater than the threshold
   * @param {any} threshold - the threshold value
   * @return {any} value greater than threshold
   * @private
   */
  _getValueGreaterThan(threshold) {
    if (typeof threshold === 'number') {
      return threshold + 1
    } else if (typeof threshold === 'string') {
      // Handle time strings
      if (threshold.includes(':')) {
        return this._getTimeGreaterThan(threshold)
      }
      // For other strings, append a character
      return threshold + '1'
    }
    return threshold
  }

  /**
   * Gets a value that's less than the threshold
   * @param {any} threshold - the threshold value
   * @return {any} value less than threshold
   * @private
   */
  _getValueLessThan(threshold) {
    if (typeof threshold === 'number') {
      return threshold - 1
    } else if (typeof threshold === 'string') {
      // Handle time strings
      if (threshold.includes(':')) {
        return this._getTimeLessThan(threshold)
      }
      // For other strings, remove last character if possible
      return threshold.length > 1 ? threshold.slice(0, -1) : threshold
    }
    return threshold
  }

  /**
   * Gets a value that's greater than or equal to the threshold
   * @param {any} threshold - the threshold value
   * @return {any} value greater than or equal to threshold
   * @private
   */
  _getValueGreaterThanOrEqual(threshold) {
    if (typeof threshold === 'number') {
      return threshold
    } else if (typeof threshold === 'string') {
      // Handle time strings
      if (threshold.includes(':')) {
        return threshold
      }
      // For other strings, return as-is
      return threshold
    }
    return threshold
  }

  /**
   * Gets a value that's less than or equal to the threshold
   * @param {any} threshold - the threshold value
   * @return {any} value less than or equal to threshold
   * @private
   */
  _getValueLessThanOrEqual(threshold) {
    if (typeof threshold === 'number') {
      return threshold
    } else if (typeof threshold === 'string') {
      // Handle time strings
      if (threshold.includes(':')) {
        return threshold
      }
      // For other strings, return as-is
      return threshold
    }
    return threshold
  }

  /**
   * Gets a time value that's greater than the given threshold
   * @private
   */
  _getTimeGreaterThan(threshold) {
    const [hours, minutes] = threshold.split(':').map(Number)
    const totalMinutes = hours * 60 + minutes
    const newTotalMinutes = totalMinutes + 30 // Add 30 minutes
    const newHours = Math.floor(newTotalMinutes / 60)
    const newMinutes = newTotalMinutes % 60
    return `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`
  }

  /**
   * Gets a time value that's less than the given threshold
   * @private
   */
  _getTimeLessThan(threshold) {
    const [hours, minutes] = threshold.split(':').map(Number)
    const totalMinutes = hours * 60 + minutes
    const newTotalMinutes = Math.max(0, totalMinutes - 30) // Subtract 30 minutes, but not below 0
    const newHours = Math.floor(newTotalMinutes / 60)
    const newMinutes = newTotalMinutes % 60
    return `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`
  }

} 