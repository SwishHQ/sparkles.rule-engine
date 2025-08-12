const { ValidateEngine, Rule } = require('../dist/rule-engine')

// Helper function to convert time to minutes
function timeToMinutes (timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number)
  return hours * 60 + minutes
}

async function testIndependentRules () {
  console.log('=== Testing Independent Rules Classification ===\n')

  // Create engine with custom operators
  const engine = new ValidateEngine([], { allowUndefinedFacts: true })

  // Add custom operators
  engine.addOperator('isTimeGreaterThan', (factValue, threshold) => {
    const factMinutes = timeToMinutes(factValue)
    const thresholdMinutes = timeToMinutes(threshold)
    return factMinutes > thresholdMinutes ? 1 : 0
  })

  engine.addOperator('isTimeLessThan', (factValue, threshold) => {
    const factMinutes = timeToMinutes(factValue)
    const thresholdMinutes = timeToMinutes(threshold)
    return factMinutes < thresholdMinutes ? 1 : 0
  })

  // Test Case 1: Rule that requires facts not provided at all
  console.log('Test Case 1: Rule requiring facts not provided at all')
  const independentRule1 = new Rule({
    name: 'Independent Campaign 1',
    priority: 10,
    event: { type: 'campaign-enabled', params: { campaignId: 'independent-1' } },
    conditions: {
      all: [
        {
          fact: 'userLocation',
          operator: 'isPointInPolygon',
          value: [
            { latitude: 12.9716, longitude: 77.5946 },
            { latitude: 12.9717, longitude: 77.5947 }
          ]
        },
        {
          fact: 'orderItems',
          operator: 'noSkuWithRefIdIn',
          value: ['blacklisted-1', 'blacklisted-2']
        }
      ]
    }
  })

  engine.addRule(independentRule1)

  const facts1 = {
    storeId: 'store-2',
    time: '22:30'
  }

  console.log('Facts provided:', facts1)
  console.log('Rule requires: userLocation, orderItems')
  console.log('Expected: Independent (rule requires facts not provided)')

  const result1 = await engine.findSatisfiedRules(facts1)
  console.log('Result:')
  console.log('- Fully satisfied:', result1.fullySatisfiedRules.length)
  console.log('- Partially satisfied:', result1.partiallySatisfiedRules.length)
  console.log('- Independent:', result1.independentRules.length)
  console.log('- Unsatisfied:', result1.unsatisfiedRules.length)

  if (result1.independentRules.length > 0) {
    const rule = result1.independentRules[0]
    console.log('- Rule name:', rule.name)
    console.log('- Reason:', rule.reason)
  }
  console.log()

  // Test Case 2: Rule with no conditions (always independent)
  console.log('Test Case 2: Rule with no conditions')
  const independentRule2 = new Rule({
    name: 'Independent Campaign 2',
    priority: 10,
    event: { type: 'campaign-enabled', params: { campaignId: 'independent-2' } },
    conditions: {
      all: [] // Empty conditions array
    }
  })

  engine.addRule(independentRule2)

  const facts2 = {
    storeId: 'store-2',
    time: '22:30'
  }

  console.log('Facts provided:', facts2)
  console.log('Rule has: No conditions')
  console.log('Expected: Independent (rule has no conditions)')

  const result2 = await engine.findSatisfiedRules(facts2)
  console.log('Result:')
  console.log('- Fully satisfied:', result2.fullySatisfiedRules.length)
  console.log('- Partially satisfied:', result2.partiallySatisfiedRules.length)
  console.log('- Independent:', result2.independentRules.length)
  console.log('- Unsatisfied:', result2.unsatisfiedRules.length)

  if (result2.independentRules.length > 0) {
    const rule = result2.independentRules[0]
    console.log('- Rule name:', rule.name)
    console.log('- Reason:', rule.reason)
  }
  console.log()

  // Test Case 3: Mixed scenario - some rules use provided facts, others don't
  console.log('Test Case 3: Mixed scenario - rules that use and don\'t use provided facts')
  const mixedRule1 = new Rule({
    name: 'Mixed Campaign 1 (uses provided facts)',
    priority: 10,
    event: { type: 'campaign-enabled', params: { campaignId: 'mixed-1' } },
    conditions: {
      all: [
        {
          fact: 'storeId',
          operator: 'in',
          value: ['store-1', 'store-2', 'store-3']
        },
        {
          fact: 'time',
          operator: 'isTimeGreaterThan',
          value: '20:00'
        }
      ]
    }
  })

  const mixedRule2 = new Rule({
    name: 'Mixed Campaign 2 (doesn\'t use provided facts)',
    priority: 10,
    event: { type: 'campaign-enabled', params: { campaignId: 'mixed-2' } },
    conditions: {
      all: [
        {
          fact: 'userLocation',
          operator: 'isPointInPolygon',
          value: [
            { latitude: 12.9716, longitude: 77.5946 },
            { latitude: 12.9717, longitude: 77.5947 }
          ]
        }
      ]
    }
  })

  engine.addRule(mixedRule1)
  engine.addRule(mixedRule2)

  const facts3 = {
    storeId: 'store-2',
    time: '22:30'
  }

  console.log('Facts provided:', facts3)
  console.log('Expected: 1 fully satisfied, 1 independent')

  const result3 = await engine.findSatisfiedRules(facts3)
  console.log('Result:')
  console.log('- Fully satisfied:', result3.fullySatisfiedRules.length)
  console.log('- Partially satisfied:', result3.partiallySatisfiedRules.length)
  console.log('- Independent:', result3.independentRules.length)
  console.log('- Unsatisfied:', result3.unsatisfiedRules.length)

  if (result3.fullySatisfiedRules.length > 0) {
    console.log('- Fully satisfied rule:', result3.fullySatisfiedRules[0].name)
  }
  if (result3.independentRules.length > 0) {
    console.log('- Independent rule:', result3.independentRules[0].name)
  }
  console.log()

  // Test Case 4: Focused fact mode
  console.log('Test Case 4: Focused fact mode')
  const focusedRule = new Rule({
    name: 'Focused Campaign',
    priority: 10,
    event: { type: 'campaign-enabled', params: { campaignId: 'focused' } },
    conditions: {
      all: [
        {
          fact: 'userLocation',
          operator: 'isPointInPolygon',
          value: [
            { latitude: 12.9716, longitude: 77.5946 },
            { latitude: 12.9717, longitude: 77.5947 }
          ]
        }
      ]
    }
  })

  engine.addRule(focusedRule)

  const facts4 = {
    storeId: 'store-2',
    time: '22:30'
  }

  console.log('Facts provided:', facts4)
  console.log('Focused fact: storeId')
  console.log('Expected: Independent (rule doesn\'t use focused fact)')

  const result4 = await engine.findSatisfiedRules(facts4, 'storeId')
  console.log('Result:')
  console.log('- Fully satisfied:', result4.fullySatisfiedRules.length)
  console.log('- Partially satisfied:', result4.partiallySatisfiedRules.length)
  console.log('- Independent:', result4.independentRules.length)
  console.log('- Unsatisfied:', result4.unsatisfiedRules.length)

  if (result4.independentRules.length > 0) {
    const rule = result4.independentRules[0]
    console.log('- Rule name:', rule.name)
    console.log('- Reason:', rule.reason)
  }
  console.log()

  return {
    test1: result1,
    test2: result2,
    test3: result3,
    test4: result4
  }
}

// Run the tests
testIndependentRules()
  .then(results => {
    console.log('=== All Independent Rule Tests Completed ===')
    console.log('Summary:')
    console.log('- Test 1 (no matching facts):', results.test1.independentRules.length > 0 ? 'PASS' : 'FAIL')
    console.log('- Test 2 (no conditions):', results.test2.independentRules.length > 0 ? 'PASS' : 'FAIL')
    console.log('- Test 3 (mixed scenario):', results.test3.fullySatisfiedRules.length > 0 && results.test3.independentRules.length > 0 ? 'PASS' : 'FAIL')
    console.log('- Test 4 (focused fact):', results.test4.independentRules.length > 0 ? 'PASS' : 'FAIL')
  })
  .catch(error => {
    console.error('Test failed:', error)
  })
