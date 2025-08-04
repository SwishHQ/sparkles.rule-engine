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
    this.validationResults = new Map()
  }

  /**
   * Finds all rules that use a specific fact
   * @param {string} factId - the fact identifier to search for
   * @return {Rule[]} array of rules that use this fact
   */
  findRulesUsingFact(factId) {
    return this.rules.filter(rule => 
      this._conditionUsesFact(rule.getConditions(), factId)
    )
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
   * Validates a single fact value against all rules in the engine
   * @param {string} factId - the fact identifier to validate
   * @param {*} factValue - the value to validate
   * @param {Object} contextFacts - additional facts for context
   * @return {Promise<Object>} validation result with detailed analysis
   */
  async validateFact(factId, factValue, contextFacts = {}) {
    debug('validateEngine::validateFact', { factId, factValue })
    
    const allFacts = { [factId]: factValue, ...contextFacts }
    
    // Create a temporary engine with the same rules but allow undefined facts
    const tempEngine = new ValidateEngine(this.rules, {
      allowUndefinedFacts: true,
      pathResolver: this.pathResolver
    })
    
    const result = await tempEngine.run(allFacts)
    
    const rulesUsingFact = this.findRulesUsingFact(factId)
    const rulesNotUsingFact = this.rules.filter(rule => 
      !this._conditionUsesFact(rule.getConditions(), factId)
    )
    
    const validation = {
      factId,
      factValue,
      timestamp: new Date().toISOString(),
      summary: {
        totalRules: this.rules.length,
        rulesUsingFact: rulesUsingFact.length,
        rulesNotUsingFact: rulesNotUsingFact.length,
        passedRules: result.results.length,
        failedRules: result.failureResults.length
      },
      rulesUsingFact: {
        passed: result.results.filter(r => 
          rulesUsingFact.some(rule => rule.name === r.name)
        ),
        failed: result.failureResults.filter(r => 
          rulesUsingFact.some(rule => rule.name === r.name)
        )
      },
      rulesNotUsingFact: {
        passed: result.results.filter(r => 
          rulesNotUsingFact.some(rule => rule.name === r.name)
        ),
        failed: result.failureResults.filter(r => 
          rulesNotUsingFact.some(rule => rule.name === r.name)
        )
      },
      allResults: {
        passed: result.results,
        failed: result.failureResults
      }
    }
    
    this.validationResults.set(`${factId}:${JSON.stringify(factValue)}`, validation)
    return validation
  }

  /**
   * Validates multiple facts against all rules
   * @param {Object} facts - object containing factId: factValue pairs
   * @return {Promise<Object>} validation results for all facts
   */
  async validateFacts(facts) {
    debug('validateEngine::validateFacts', { factIds: Object.keys(facts) })
    
    // Create a temporary engine with the same rules but allow undefined facts
    const tempEngine = new ValidateEngine(this.rules, {
      allowUndefinedFacts: true,
      pathResolver: this.pathResolver
    })
    
    const result = await tempEngine.run(facts)
    const validation = {
      facts,
      timestamp: new Date().toISOString(),
      summary: {
        totalRules: this.rules.length,
        passedRules: result.results.length,
        failedRules: result.failureResults.length,
        successRate: this.rules.length > 0 ? result.results.length / this.rules.length : 0
      },
      results: {
        passed: result.results,
        failed: result.failureResults
      },
      factAnalysis: {}
    }
    
    // Analyze each fact's impact
    for (const [factId, factValue] of Object.entries(facts)) {
      validation.factAnalysis[factId] = {
        rulesUsingFact: this.findRulesUsingFact(factId).map(r => r.name),
        rulesNotUsingFact: this.rules.filter(rule => 
          !this._conditionUsesFact(rule.getConditions(), factId)
        ).map(r => r.name)
      }
    }
    
    return validation
  }

  /**
   * Validates a JSON condition object against the engine rules
   * @param {Object} conditionJson - JSON object representing conditions to validate
   * @param {Object} contextFacts - additional facts for context
   * @return {Promise<Object>} validation result for the condition
   */
  async validateCondition(conditionJson, contextFacts = {}) {
    debug('validateEngine::validateCondition', { conditionJson })
    
    // Extract facts from the condition JSON
    const factsFromCondition = this._extractFactsFromCondition(conditionJson)
    const allFacts = { ...factsFromCondition, ...contextFacts }
    
    // Create a temporary engine with the same rules but allow undefined facts
    const tempEngine = new ValidateEngine(this.rules, {
      allowUndefinedFacts: true,
      pathResolver: this.pathResolver
    })
    
    const result = await tempEngine.run(allFacts)
    
    const validation = {
      condition: conditionJson,
      extractedFacts: factsFromCondition,
      contextFacts,
      timestamp: new Date().toISOString(),
      summary: {
        totalRules: this.rules.length,
        passedRules: result.results.length,
        failedRules: result.failureResults.length,
        successRate: this.rules.length > 0 ? result.results.length / this.rules.length : 0
      },
      results: {
        passed: result.results,
        failed: result.failureResults
      },
      factUsage: this._analyzeFactUsage(factsFromCondition)
    }
    
    return validation
  }

  /**
   * Validates a specific rule against given facts
   * @param {string|Rule} ruleOrName - rule instance or rule name
   * @param {Object} facts - facts to validate against
   * @return {Promise<Object>} validation result for the specific rule
   */
  async validateRule(ruleOrName, facts) {
    debug('validateEngine::validateRule', { ruleOrName, factIds: Object.keys(facts) })
    
    let rule
    if (typeof ruleOrName === 'string') {
      rule = this.rules.find(r => r.name === ruleOrName)
      if (!rule) {
        throw new Error(`Rule not found: ${ruleOrName}`)
      }
    } else {
      rule = ruleOrName
    }
    
    // Create a temporary engine with just this rule and the facts
    const tempEngine = new ValidateEngine([rule], {
      allowUndefinedFacts: this.allowUndefinedFacts,
      pathResolver: this.pathResolver
    })
    
    const result = await tempEngine.run(facts)
    
    const validation = {
      rule: {
        name: rule.name,
        priority: rule.priority,
        conditions: rule.getConditions()
      },
      facts,
      timestamp: new Date().toISOString(),
      result: {
        passed: result.results.length > 0,
        score: result.results.length > 0 ? result.results[0].score : 0,
        event: result.results.length > 0 ? result.results[0].event : null
      },
      conditionAnalysis: this._analyzeRuleConditions(rule, facts)
    }
    
    return validation
  }

  /**
   * Finds all rules that would be satisfied by a given set of facts
   * @param {Object} facts - facts to test against
   * @return {Promise<Object>} analysis of which rules would be satisfied
   */
  async findSatisfiedRules(facts) {
    debug('validateEngine::findSatisfiedRules', { factIds: Object.keys(facts) })
    
    // Create a temporary engine with the same rules but allow undefined facts
    const tempEngine = new ValidateEngine(this.rules, {
      allowUndefinedFacts: true,
      pathResolver: this.pathResolver
    })
    
    const result = await tempEngine.run(facts)
    
    return {
      facts,
      timestamp: new Date().toISOString(),
      satisfiedRules: result.results.map(r => ({
        name: r.name,
        priority: r.priority,
        score: r.score,
        event: r.event
      })),
      unsatisfiedRules: result.failureResults.map(r => ({
        name: r.name,
        priority: r.priority,
        score: r.score,
        event: r.event
      })),
      summary: {
        totalRules: this.rules.length,
        satisfied: result.results.length,
        unsatisfied: result.failureResults.length,
        satisfactionRate: this.rules.length > 0 ? result.results.length / this.rules.length : 0
      }
    }
  }

  /**
   * Validates any object with conditions against the engine rules
   * @param {Object} objectWithConditions - object containing conditions and optional metadata
   * @param {Object} contextFacts - additional facts for context
   * @return {Promise<Object>} validation result for the object
   */
  async validateObjectWithConditions(objectWithConditions, contextFacts = {}) {
    const objectId = objectWithConditions.id || objectWithConditions.name || 'unknown'
    debug('validateEngine::validateObjectWithConditions', { objectId })
    
    if (!objectWithConditions.conditions) {
      throw new Error('Object must have conditions property')
    }
    
    const factsFromConditions = this._extractFactsFromCondition(objectWithConditions.conditions)
    const allFacts = { ...factsFromConditions, ...contextFacts }
    
    // Create a temporary engine with the same rules but allow undefined facts
    const tempEngine = new ValidateEngine(this.rules, {
      allowUndefinedFacts: true,
      pathResolver: this.pathResolver
    })
    
    const result = await tempEngine.run(allFacts)
    
    const validation = {
      object: {
        id: objectWithConditions.id,
        name: objectWithConditions.name,
        type: objectWithConditions.type || 'unknown',
        conditions: objectWithConditions.conditions
      },
      extractedFacts: factsFromConditions,
      contextFacts,
      timestamp: new Date().toISOString(),
      summary: {
        totalRules: this.rules.length,
        passedRules: result.results.length,
        failedRules: result.failureResults.length,
        successRate: this.rules.length > 0 ? result.results.length / this.rules.length : 0
      },
      results: {
        passed: result.results,
        failed: result.failureResults
      },
      factUsage: this._analyzeFactUsage(factsFromConditions)
    }
    
    return validation
  }



  /**
   * Gets validation history for a specific fact
   * @param {string} factId - fact identifier
   * @return {Array} array of validation results for this fact
   */
  getValidationHistory(factId) {
    const history = []
    for (const [key, validation] of this.validationResults.entries()) {
      if (key.startsWith(`${factId}:`)) {
        history.push(validation)
      }
    }
    return history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  }

  /**
   * Clears validation history
   */
  clearValidationHistory() {
    this.validationResults.clear()
  }

  /**
   * Extracts facts from a condition JSON object
   * @private
   */
  _extractFactsFromCondition(condition) {
    const facts = {}
    
    const extractFromCondition = (cond) => {
      if (cond.fact && cond.value !== undefined) {
        facts[cond.fact] = cond.value
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
   * Analyzes how facts are used across rules
   * @private
   */
  _analyzeFactUsage(facts) {
    const analysis = {}
    
    for (const factId of Object.keys(facts)) {
      const rulesUsingFact = this.findRulesUsingFact(factId)
      const rulesNotUsingFact = this.rules.filter(rule => 
        !this._conditionUsesFact(rule.getConditions(), factId)
      )
      
      analysis[factId] = {
        rulesUsingFact: rulesUsingFact.map(r => r.name),
        rulesNotUsingFact: rulesNotUsingFact.map(r => r.name),
        usageCount: rulesUsingFact.length,
        dependencyLevel: rulesUsingFact.length / this.rules.length
      }
    }
    
    return analysis
  }

  /**
   * Analyzes rule conditions against given facts
   * @private
   */
  _analyzeRuleConditions(rule, facts) {
    const conditions = rule.getConditions()
    const analysis = {
      totalConditions: 0,
      satisfiedConditions: 0,
      unsatisfiedConditions: 0,
      conditionDetails: []
    }
    
    const analyzeCondition = (condition, level = 0) => {
      if (condition.fact) {
        analysis.totalConditions++
        const factValue = facts[condition.fact]
        const isSatisfied = this._evaluateSimpleCondition(condition, factValue)
        
        if (isSatisfied) {
          analysis.satisfiedConditions++
        } else {
          analysis.unsatisfiedConditions++
        }
        
        analysis.conditionDetails.push({
          fact: condition.fact,
          operator: condition.operator,
          expectedValue: condition.value,
          actualValue: factValue,
          satisfied: isSatisfied,
          level
        })
      }
      
      if (condition.all) {
        condition.all.forEach(c => analyzeCondition(c, level + 1))
      }
      
      if (condition.any) {
        condition.any.forEach(c => analyzeCondition(c, level + 1))
      }
      
      if (condition.not) {
        analyzeCondition(condition.not, level + 1)
      }
    }
    
    analyzeCondition(conditions)
    return analysis
  }

  /**
   * Evaluates a simple condition
   * @private
   */
  _evaluateSimpleCondition(condition, factValue) {
    const { operator, value } = condition
    
    switch (operator) {
      case 'equal':
        return factValue === value
      case 'notEqual':
        return factValue !== value
      case 'greaterThan':
        return factValue > value
      case 'greaterThanInclusive':
        return factValue >= value
      case 'lessThan':
        return factValue < value
      case 'lessThanInclusive':
        return factValue <= value
      case 'in':
        return Array.isArray(value) && value.includes(factValue)
      case 'notIn':
        return Array.isArray(value) && !value.includes(factValue)
      case 'contains':
        return Array.isArray(factValue) && factValue.includes(value)
      case 'doesNotContain':
        return Array.isArray(factValue) && !factValue.includes(value)
      default:
        return false
    }
  }


} 