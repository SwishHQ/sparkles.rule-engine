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

// Demo 1: Validate a single fact
async function demoValidateFact() {
  console.log('1. Validating single fact: storeId = "xyz"')
  
  const result = await validateEngine.validateFact('storeId', 'xyz', {
    time: '22:30',
    appVersion: '1.0.1'
  })
  
  console.log('Validation Result:')
  console.log('- Summary:', result.summary)
  console.log('- Rules using storeId (passed):', result.rulesUsingFact.passed.map(r => r.name))
  console.log('- Rules not using storeId (passed):', result.rulesNotUsingFact.passed.map(r => r.name))
  console.log('- Total passed rules:', result.allResults.passed.length)
}

// Demo 2: Validate multiple facts
async function demoValidateFacts() {
  console.log('\n2. Validating multiple facts')
  
  const facts = {
    storeId: 'xyz',
    time: '22:30',
    appVersion: '1.0.1'
  }
  
  const result = await validateEngine.validateFacts(facts)
  
  console.log('Validation Result:')
  console.log('- Summary:', result.summary)
  console.log('- Passed rules:', result.results.passed.map(r => r.name))
  console.log('- Failed rules:', result.results.failed.map(r => r.name))
  console.log('- Fact analysis:', Object.keys(result.factAnalysis))
}

// Demo 3: Validate a JSON condition
async function demoValidateCondition() {
  console.log('\n3. Validating JSON condition')
  
  const conditionJson = {
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
  }
  
  const result = await validateEngine.validateCondition(conditionJson, {
    appVersion: '1.0.1'
  })
  
  console.log('Validation Result:')
  console.log('- Extracted facts:', result.extractedFacts)
  console.log('- Summary:', result.summary)
  console.log('- Passed rules:', result.results.passed.map(r => r.name))
  console.log('- Fact usage analysis:', result.factUsage)
}

// Demo 4: Validate a specific rule
async function demoValidateRule() {
  console.log('\n4. Validating specific rule')
  
  const facts = {
    storeId: 'xyz',
    time: '22:30',
    appVersion: '1.0.1'
  }
  
  const result = await validateEngine.validateRule('store-specific-campaign', facts)
  
  console.log('Validation Result:')
  console.log('- Rule:', result.rule.name)
  console.log('- Passed:', result.result.passed)
  console.log('- Score:', result.result.score)
  console.log('- Condition analysis:', result.conditionAnalysis)
}

// Demo 5: Find satisfied rules
async function demoFindSatisfiedRules() {
  console.log('\n5. Finding satisfied rules')
  
  const facts = {
    storeId: 'xyz',
    time: '22:30',
    appVersion: '1.0.1'
  }
  
  const result = await validateEngine.findSatisfiedRules(facts)
  
  console.log('Result:')
  console.log('- Satisfied rules:', result.satisfiedRules.map(r => r.name))
  console.log('- Unsatisfied rules:', result.unsatisfiedRules.map(r => r.name))
  console.log('- Summary:', result.summary)
}

// Demo 6: Validate generic object with conditions
async function demoValidateObjectWithConditions() {
  console.log('\n6. Validating generic object with conditions')
  
  // Example 1: Campaign
  const campaign = {
    id: 'campaign-001',
    name: 'Store Time Campaign',
    type: 'campaign',
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
    }
  }
  
  const campaignResult = await validateEngine.validateObjectWithConditions(campaign, {
    appVersion: '1.0.1'
  })
  
  console.log('Campaign Validation Result:')
  console.log('- Object:', campaignResult.object.name, `(${campaignResult.object.type})`)
  console.log('- Extracted facts:', campaignResult.extractedFacts)
  console.log('- Summary:', campaignResult.summary)
  
  // Example 2: Feature Flag
  const featureFlag = {
    id: 'feature-001',
    name: 'New UI Feature',
    type: 'feature-flag',
    conditions: {
      all: [
        {
          fact: 'userRole',
          value: 'admin',
          operator: 'equal'
        },
        {
          fact: 'appVersion',
          value: '2.0.0',
          operator: 'greaterThan'
        }
      ]
    }
  }
  
  const featureResult = await validateEngine.validateObjectWithConditions(featureFlag, {
    userRole: 'admin',
    appVersion: '2.1.0'
  })
  
  console.log('\nFeature Flag Validation Result:')
  console.log('- Object:', featureResult.object.name, `(${featureResult.object.type})`)
  console.log('- Extracted facts:', featureResult.extractedFacts)
  console.log('- Summary:', featureResult.summary)
}



// Demo 6: Validation history
async function demoValidationHistory() {
      console.log('\n6. Validation history')
  
  // First, validate a fact
  await validateEngine.validateFact('storeId', 'xyz', { time: '22:30' })
  await validateEngine.validateFact('storeId', 'abc', { time: '22:30' })
  await validateEngine.validateFact('time', '22:30', { storeId: 'xyz' })
  
  // Get history for storeId
  const history = validateEngine.getValidationHistory('storeId')
  console.log('Validation history for storeId:')
  history.forEach((validation, index) => {
    console.log(`- Entry ${index + 1}: ${validation.factValue} (${validation.timestamp})`)
  })
}

// Demo 7: Complex condition validation
async function demoComplexCondition() {
      console.log('\n7. Complex condition validation')
  
  const complexCondition = {
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
          }
        ]
      }
    ]
  }
  
  const result = await validateEngine.validateCondition(complexCondition, {
    time: '22:30'
  })
  
  console.log('Complex condition validation:')
  console.log('- Extracted facts:', result.extractedFacts)
  console.log('- Summary:', result.summary)
  console.log('- Passed rules:', result.results.passed.map(r => r.name))
}

// Run all demos
async function runAllDemos() {
  try {
    await demoValidateFact()
    await demoValidateFacts()
    await demoValidateCondition()
    await demoValidateRule()
    await demoFindSatisfiedRules()
    await demoValidateObjectWithConditions()
    await demoValidationHistory()
    await demoComplexCondition()
    
    console.log('\n=== All demos completed successfully! ===')
    console.log('\nKey Features Demonstrated:')
    console.log('✓ validateFact() - Validate single fact against all rules')
    console.log('✓ validateFacts() - Validate multiple facts')
    console.log('✓ validateCondition() - Validate JSON condition object')
    console.log('✓ validateRule() - Validate specific rule')
    console.log('✓ findSatisfiedRules() - Find all satisfied rules')
    console.log('✓ validateObjectWithConditions() - Validate any object with conditions')
    console.log('✓ getValidationHistory() - Track validation history')
    console.log('✓ Complex conditions - Handle nested all/any/not logic')
  } catch (error) {
    console.error('Error running demos:', error.message)
  }
}

runAllDemos() 