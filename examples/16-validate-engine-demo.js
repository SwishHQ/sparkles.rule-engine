require('babel-polyfill')
const { ValidateEngine, Rule } = require('../dist/rule-engine')

// Create ValidateEngine instance
const validateEngine = new ValidateEngine()

// Add some rules for demonstration
validateEngine.addRule(new Rule({
  name: 'store-specific-campaign',
  conditions: {
    all: [
      {
        fact: 'storeId',
        value: 'xyz',
        operator: 'equal'
      },
      {
        fact: 'time',
        value: '21:40',
        operator: 'greaterThanInclusive'
      },
      {
        fact: 'time',
        value: '23:59',
        operator: 'lessThanInclusive'
      }
    ]
  },
  event: {
    type: 'campaign-triggered',
    params: { campaignId: 'store-specific-campaign' }
  }
}))

validateEngine.addRule(new Rule({
  name: 'global-campaign',
  conditions: {
    all: [
      {
        fact: 'appVersion',
        value: '1.0.0',
        operator: 'greaterThan'
      }
    ]
  },
  event: {
    type: 'campaign-triggered',
    params: { campaignId: 'global-campaign' }
  }
}))

validateEngine.addRule(new Rule({
  name: 'time-based-campaign',
  conditions: {
    all: [
      {
        fact: 'time',
        value: '22:00',
        operator: 'greaterThanInclusive'
      }
    ]
  },
  event: {
    type: 'campaign-triggered',
    params: { campaignId: 'time-based-campaign' }
  }
}))

console.log('=== ValidateEngine Demo ===\n')

// Demo 1: Find satisfied rules (context mode)
async function demoFindSatisfiedRules () {
  console.log('1. Finding satisfied rules (context mode)')

  const facts = {
    storeId: 'xyz',
    time: '22:30'
    // Note: missing appVersion, so global-campaign will be partially satisfied
  }

  const result = await validateEngine.findSatisfiedRules(facts)

  console.log('Result:')
  console.log('- Fully satisfied rules:', result.fullySatisfiedRules.map(r => r.name))
  console.log('- Partially satisfied rules:', result.partiallySatisfiedRules.map(r => r.name))
  console.log('- Independent rules:', result.independentRules.map(r => r.name))
  console.log('- Unsatisfied rules:', result.unsatisfiedRules.map(r => r.name))
  console.log('- Summary:', result.summary)
}

// Demo 2: Find satisfied rules with focused fact
async function demoFindSatisfiedRulesWithFocusedFact () {
  console.log('\n2. Finding satisfied rules with focused fact: storeId')

  const facts = {
    storeId: 'xyz',
    time: '22:30'
    // Note: missing appVersion, so global-campaign will be partially satisfied
  }

  const result = await validateEngine.findSatisfiedRules(facts, 'storeId')

  console.log('Result (focused on storeId):')
  console.log('- Rules using storeId (fully/partially satisfied):',
    [...result.fullySatisfiedRules, ...result.partiallySatisfiedRules].map(r => r.name))
  console.log('- Rules independent of storeId:', result.independentRules.map(r => r.name))
  console.log('- Summary:', result.summary)
}

// Demo 3: Find partially satisfied rules for a specific fact
async function demoFindPartiallySatisfiedRules () {
  console.log('\n3. Finding partially satisfied rules for storeId')

  const result = await validateEngine.findPartiallySatisfiedRules('storeId', 'xyz', {
    time: '22:30',
    appVersion: '1.0.1'
  })

  console.log('Result:')
  console.log('- Fact ID:', result.factId)
  console.log('- Fact Value:', result.factValue)
  console.log('- Context Facts:', result.contextFacts)
  console.log('- Partially satisfied rules:', result.rules.partiallySatisfied.map(r => r.name))
  console.log('- Independent rules:', result.rules.independent.map(r => r.name))
  console.log('- Summary:', result.summary)
}

// Demo 4: Find partially satisfied rules from context
async function demoFindPartiallySatisfiedRulesFromContext () {
  console.log('\n4. Finding partially satisfied rules from context')

  const contextFacts = {
    storeId: 'xyz',
    time: '22:30'
  }

  const result = await validateEngine.findPartiallySatisfiedRulesFromContext(contextFacts)

  console.log('Result:')
  console.log('- Context Facts:', result.contextFacts)
  console.log('- Fully satisfied rules:', result.rules.fullySatisfied.map(r => r.name))
  console.log('- Partially satisfied rules:', result.rules.partiallySatisfied.map(r => r.name))
  console.log('- Independent rules:', result.rules.independent.map(r => r.name))
  console.log('- Summary:', result.summary)
}

// Demo 5: Custom default value provider
async function demoCustomDefaultValueProvider () {
  console.log('\n5. Custom default value provider')

  // Register a custom default value provider for the 'greaterThan' operator
  validateEngine.registerDefaultValueProvider('greaterThan', (threshold, condition) => {
    if (typeof threshold === 'number') {
      return threshold + 10 // Return 10 more than threshold
    }
    return threshold
  })

  const facts = {
    storeId: 'xyz'
  }

  const result = await validateEngine.findSatisfiedRules(facts)

  console.log('Result with custom default value provider:')
  console.log('- Partially satisfied rules with missing facts:')
  result.partiallySatisfiedRules.forEach(rule => {
    console.log(`  - ${rule.name}: missing ${JSON.stringify(rule.missingFacts)}`)
  })

  // Clean up
  validateEngine.unregisterDefaultValueProvider('greaterThan')
}

// Demo 6: Complex condition analysis
async function demoComplexConditionAnalysis () {
  console.log('\n6. Complex condition analysis')

  // Add a rule with complex nested conditions
  validateEngine.addRule(new Rule({
    name: 'complex-campaign',
    conditions: {
      any: [
        {
          all: [
            {
              fact: 'storeId',
              value: 'xyz',
              operator: 'equal'
            },
            {
              fact: 'time',
              value: '22:00',
              operator: 'greaterThanInclusive'
            }
          ]
        },
        {
          all: [
            {
              fact: 'appVersion',
              value: '2.0.0',
              operator: 'greaterThan'
            },
            {
              fact: 'userRole',
              value: 'admin',
              operator: 'equal'
            }
          ]
        }
      ]
    },
    event: {
      type: 'campaign-triggered',
      params: { campaignId: 'complex-campaign' }
    }
  }))

  const facts = {
    storeId: 'xyz',
    time: '22:30'
  }

  const result = await validateEngine.findSatisfiedRules(facts)

  console.log('Complex condition result:')
  console.log('- Fully satisfied rules:', result.fullySatisfiedRules.map(r => r.name))
  console.log('- Partially satisfied rules:', result.partiallySatisfiedRules.map(r => r.name))
  console.log('- Independent rules:', result.independentRules.map(r => r.name))
  console.log('- Summary:', result.summary)
}

// Demo 7: Rule without conditions
async function demoRuleWithoutConditions () {
  console.log('\n7. Rule without conditions')

  // Add a rule with a condition that always evaluates to true
  validateEngine.addRule(new Rule({
    name: 'always-active-campaign',
    conditions: {
      all: [
        {
          fact: 'alwaysTrue',
          operator: 'equal',
          value: true
        }
      ]
    },
    event: {
      type: 'campaign-triggered',
      params: { campaignId: 'always-active-campaign' }
    }
  }))

  const facts = {
    storeId: 'xyz'
  }

  const result = await validateEngine.findSatisfiedRules(facts)

  console.log('Result with rule that has a missing fact (alwaysTrue):')
  console.log('- Partially satisfied rules:', result.partiallySatisfiedRules.map(r => r.name))
  console.log('- Independent rules:', result.independentRules.map(r => r.name))
  console.log('- Summary:', result.summary)
}

// Demo 8: Partially satisfied rules example
async function demoPartiallySatisfiedRules () {
  console.log('\n8. Partially satisfied rules example')

  // Add a rule that requires multiple facts with simple conditions
  validateEngine.addRule(new Rule({
    name: 'simple-multi-fact-campaign',
    conditions: {
      all: [
        {
          fact: 'storeId',
          value: 'xyz',
          operator: 'equal'
        },
        {
          fact: 'userRole',
          value: 'admin',
          operator: 'equal'
        },
        {
          fact: 'isActive',
          value: true,
          operator: 'equal'
        }
      ]
    },
    event: {
      type: 'campaign-triggered',
      params: { campaignId: 'simple-multi-fact-campaign' }
    }
  }))

  // Provide facts that match the conditions but are missing isActive
  const facts = {
    storeId: 'xyz',
    userRole: 'admin'
    // Missing isActive - this should make the rule partially satisfied
  }

  const result = await validateEngine.findSatisfiedRules(facts)

  console.log('Result with partial facts:')
  console.log('- Fully satisfied rules:', result.fullySatisfiedRules.map(r => r.name))
  console.log('- Partially satisfied rules:', result.partiallySatisfiedRules.map(r => r.name))
  console.log('- Independent rules:', result.independentRules.map(r => r.name))
  console.log('- Unsatisfied rules:', result.unsatisfiedRules.map(r => r.name))

  if (result.partiallySatisfiedRules.length > 0) {
    console.log('- Missing facts for partially satisfied rules:')
    result.partiallySatisfiedRules.forEach(rule => {
      console.log(`  - ${rule.name}: missing ${JSON.stringify(rule.missingFacts)}`)
    })
  }

  console.log('- Summary:', result.summary)

  // Now provide all facts to show fully satisfied
  console.log('\nNow providing all required facts:')
  const completeFacts = {
    storeId: 'xyz',
    userRole: 'admin',
    isActive: true
  }

  const completeResult = await validateEngine.findSatisfiedRules(completeFacts)

  console.log('- Fully satisfied rules:', completeResult.fullySatisfiedRules.map(r => r.name))
  console.log('- Partially satisfied rules:', completeResult.partiallySatisfiedRules.map(r => r.name))
  console.log('- Summary:', completeResult.summary)
}

// Run all demos
async function runAllDemos () {
  try {
    await demoFindSatisfiedRules()
    await demoFindSatisfiedRulesWithFocusedFact()
    await demoFindPartiallySatisfiedRules()
    await demoFindPartiallySatisfiedRulesFromContext()
    await demoCustomDefaultValueProvider()
    await demoComplexConditionAnalysis()
    await demoRuleWithoutConditions()
    await demoPartiallySatisfiedRules()

    console.log('\n=== All demos completed successfully! ===')
    console.log('\nKey Features Demonstrated:')
    console.log('✓ findSatisfiedRules() - Find all satisfied rules (context mode)')
    console.log('✓ findSatisfiedRules(facts, focusedFactId) - Focused fact mode')
    console.log('✓ findPartiallySatisfiedRules() - Single fact with context')
    console.log('✓ findPartiallySatisfiedRulesFromContext() - Context-only analysis')
    console.log('✓ registerDefaultValueProvider() - Custom default values')
    console.log('✓ Complex conditions - Handle nested all/any/not logic')
    console.log('✓ Rules without conditions - Always satisfied')
    console.log('✓ Partially satisfied rules - Missing facts example')
  } catch (error) {
    console.error('Error running demos:', error.message)
  }
}

runAllDemos()
