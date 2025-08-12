'use strict'
import Engine from './engine'
import Rule from './rule'
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
  constructor (rules = [], options = {}) {
    super(rules, options)
  }

  /**
   * Checks if a condition object uses a specific fact
   * @param {Object} condition - condition object to check
   * @param {string} factId - fact identifier to search for
   * @return {boolean} whether the condition uses this fact
   * @private
   */
  _conditionUsesFact (condition, factId) {
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
  async findSatisfiedRules (facts, focusedFactId) {
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
          // Create a modified rule that excludes conditions using missing facts
          const modifiedRule = this._createRuleWithoutMissingFacts(rule, Object.keys(missingFacts))

          if (modifiedRule) {
            // Evaluate the modified rule with available facts
            const tempEngine = this._createTemporaryEngine([modifiedRule], {
              allowUndefinedFacts: false
            })

            try {
              const result = await tempEngine.run(facts)
              if (result.results.length > 0) {
                // Rule passes without missing facts, but since we had missing facts,
                // it should be classified as partially satisfied
                partiallySatisfiedRules.push({
                  name: rule.name,
                  priority: rule.priority,
                  score: result.results[0].score,
                  event: result.results[0].event,
                  satisfactionType: 'partially_satisfied',
                  reason: 'partially_satisfied_missing_facts',
                  missingFacts: missingFacts
                })
              } else {
                // Rule failed evaluation even without missing facts
                // This means the rule would be partially satisfied if proper values were provided
                partiallySatisfiedRules.push({
                  name: rule.name,
                  priority: rule.priority,
                  score: 0,
                  event: rule.event,
                  satisfactionType: 'partially_satisfied',
                  reason: 'partially_satisfied_missing_facts',
                  missingFacts: missingFacts
                })
              }
            } catch (error) {
              // If evaluation fails, treat as partially satisfied since we have missing facts
              partiallySatisfiedRules.push({
                name: rule.name,
                priority: rule.priority,
                score: 0,
                event: rule.event,
                satisfactionType: 'partially_satisfied',
                reason: 'partially_satisfied_missing_facts',
                missingFacts: missingFacts
              })
            }
          } else {
            // If no conditions remain after removing missing facts, treat as partially satisfied
            partiallySatisfiedRules.push({
              name: rule.name,
              priority: rule.priority,
              score: 0,
              event: rule.event,
              satisfactionType: 'partially_satisfied',
              reason: 'partially_satisfied_missing_facts',
              missingFacts: missingFacts
            })
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
  async findPartiallySatisfiedRules (factId, factValue, contextFacts = {}) {
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
  async findPartiallySatisfiedRulesFromContext (contextFacts) {
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
  _hasConditions (condition) {
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
  _getMissingFactsForRule (rule, currentFacts) {
    const requiredFacts = this._extractFactsFromCondition(rule.getConditions())
    const missingFacts = {}

    for (const factId of Object.keys(requiredFacts)) {
      if (!(factId in currentFacts)) {
        missingFacts[factId] = null // We don't need default values anymore
      }
    }

    return missingFacts
  }

  /**
   * Extracts facts from a condition JSON object
   * @private
   */
  _extractFactsFromCondition (condition) {
    const facts = {}

    const extractFromCondition = (cond) => {
      if (cond.fact && cond.value !== undefined) {
        // Just collect the fact ID, we don't need default values
        facts[cond.fact] = true
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
   * Creates a temporary engine with all operators copied
   * @param {Rule[]} rules - rules to add to the temporary engine
   * @param {Object} options - engine options
   * @return {ValidateEngine} temporary engine with all operators copied
   * @private
   */
  _createTemporaryEngine (rules, options = {}) {
    const tempEngine = new ValidateEngine(rules, {
      allowUndefinedFacts: options.allowUndefinedFacts || false,
      pathResolver: this.pathResolver
    })

    // Copy ALL operators from the original engine
    const originalOperators = this.operators.operators
    for (const [name, operator] of originalOperators.entries()) {
      tempEngine.addOperator(name, operator.cb)
    }

    return tempEngine
  }

  /**
   * Creates a new Rule object with conditions that exclude conditions using missing facts.
   * This is a helper method to modify a rule's conditions for evaluation.
   * @param {Rule} originalRule - The original rule to modify.
   * @param {string[]} missingFactIds - An array of fact IDs that are missing.
   * @return {Rule|null} A new Rule object with conditions excluding the missing facts,
   *                      or null if the rule becomes empty after removing conditions.
   * @private
   */
  _createRuleWithoutMissingFacts (originalRule, missingFactIds) {
    // Get the original conditions
    const originalConditions = originalRule.getConditions()

    // Create a deep copy of the conditions and filter out those using missing facts
    const filteredConditions = this._filterConditionsWithoutMissingFacts(originalConditions, missingFactIds)

    if (!filteredConditions || (filteredConditions.all && filteredConditions.all.length === 0) ||
        (filteredConditions.any && filteredConditions.any.length === 0)) {
      return null // Rule becomes empty after removing all conditions
    }

    // Create a new rule with the filtered conditions
    return new Rule({
      name: originalRule.name,
      priority: originalRule.priority,
      event: originalRule.event,
      conditions: filteredConditions
    })
  }

  /**
   * Recursively filters conditions to remove those that use missing facts
   * @param {Object} conditions - The conditions object to filter
   * @param {string[]} missingFactIds - Array of missing fact IDs
   * @return {Object|null} Filtered conditions or null if all conditions are removed
   * @private
   */
  _filterConditionsWithoutMissingFacts (conditions, missingFactIds) {
    if (!conditions) return null

    // If this is a simple condition (has fact property)
    if (conditions.fact) {
      const usesMissingFact = missingFactIds.includes(conditions.fact)
      return usesMissingFact ? null : conditions
    }

    // Handle 'all' conditions
    if (conditions.all && Array.isArray(conditions.all)) {
      const filteredAll = conditions.all
        .map(condition => this._filterConditionsWithoutMissingFacts(condition, missingFactIds))
        .filter(condition => condition !== null)

      if (filteredAll.length === 0) return null
      // Always return an 'all' structure, even with one condition
      return { all: filteredAll }
    }

    // Handle 'any' conditions
    if (conditions.any && Array.isArray(conditions.any)) {
      const filteredAny = conditions.any
        .map(condition => this._filterConditionsWithoutMissingFacts(condition, missingFactIds))
        .filter(condition => condition !== null)

      if (filteredAny.length === 0) return null
      // Always return an 'any' structure, even with one condition
      return { any: filteredAny }
    }

    // Handle 'not' conditions
    if (conditions.not) {
      const filteredNot = this._filterConditionsWithoutMissingFacts(conditions.not, missingFactIds)
      return filteredNot ? { not: filteredNot } : null
    }

    return conditions
  }
}
