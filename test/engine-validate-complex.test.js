const { ValidateEngine, Rule } = require('../dist/rule-engine')

// Helper function to convert time to minutes
function timeToMinutes (timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number)
  return hours * 60 + minutes
}

async function testComplexValidationCases () {
  console.log('=== Complex Validation Engine Test Cases ===\n')

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

  engine.addOperator('isPointInPolygon', (userAddressPoint, servicablePolygon) => {
    // Simple mock implementation
    return servicablePolygon.some(point =>
      point.latitude === userAddressPoint.latitude &&
      point.longitude === userAddressPoint.longitude
    )
      ? 1
      : 0
  })

  engine.addOperator('noSkuWithRefIdIn', (items, blacklistedRefIds) => {
    return items.every(item =>
      item.refId.split(':').every(ref => !blacklistedRefIds.includes(ref))
    )
      ? 1
      : 0
  })

  engine.addOperator('includes', (a, b) => a.includes(b) ? 1 : 0)

  // Test Case 1: Complex rule with 5 operators, only 2 facts provided
  console.log('Test Case 1: Complex rule with 5 operators, only 2 facts provided')
  const complexRule1 = new Rule({
    name: 'Complex Campaign 1',
    priority: 10,
    event: { type: 'campaign-enabled', params: { campaignId: 'complex-1' } },
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
        },
        {
          fact: 'time',
          operator: 'isTimeLessThan',
          value: '23:59'
        },
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

  engine.addRule(complexRule1)

  const facts1 = {
    storeId: 'store-2',
    time: '22:30'
  }

  console.log('Facts provided:', facts1)
  console.log('Expected: Partially satisfied (missing userLocation, orderItems)')

  const result1 = await engine.findSatisfiedRules(facts1)
  console.log('Result:')
  console.log('- Fully satisfied:', result1.fullySatisfiedRules.length)
  console.log('- Partially satisfied:', result1.partiallySatisfiedRules.length)
  console.log('- Independent:', result1.independentRules.length)
  console.log('- Unsatisfied:', result1.unsatisfiedRules.length)

  if (result1.partiallySatisfiedRules.length > 0) {
    const rule = result1.partiallySatisfiedRules[0]
    console.log('- Missing facts:', rule.missingFacts)
    console.log('- Reason:', rule.reason)
  }
  console.log()

  // Test Case 2: Complex rule with 5 operators, only 1 fact provided
  console.log('Test Case 2: Complex rule with 5 operators, only 1 fact provided')
  const complexRule2 = new Rule({
    name: 'Complex Campaign 2',
    priority: 10,
    event: { type: 'campaign-enabled', params: { campaignId: 'complex-2' } },
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
        },
        {
          fact: 'time',
          operator: 'isTimeLessThan',
          value: '23:59'
        },
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

  engine.addRule(complexRule2)

  const facts2 = {
    storeId: 'store-2'
  }

  console.log('Facts provided:', facts2)
  console.log('Expected: Partially satisfied (missing time, userLocation, orderItems)')

  const result2 = await engine.findSatisfiedRules(facts2)
  console.log('Result:')
  console.log('- Fully satisfied:', result2.fullySatisfiedRules.length)
  console.log('- Partially satisfied:', result2.partiallySatisfiedRules.length)
  console.log('- Independent:', result2.independentRules.length)
  console.log('- Unsatisfied:', result2.unsatisfiedRules.length)

  if (result2.partiallySatisfiedRules.length > 0) {
    const rule = result2.partiallySatisfiedRules[0]
    console.log('- Missing facts:', rule.missingFacts)
    console.log('- Reason:', rule.reason)
  }
  console.log()

  // Test Case 3: Nested conditions with missing facts
  console.log('Test Case 3: Nested conditions with missing facts')
  const complexRule3 = new Rule({
    name: 'Complex Campaign 3',
    priority: 10,
    event: { type: 'campaign-enabled', params: { campaignId: 'complex-3' } },
    conditions: {
      all: [
        {
          fact: 'storeId',
          operator: 'in',
          value: ['store-1', 'store-2', 'store-3']
        },
        {
          any: [
            {
              all: [
                {
                  fact: 'time',
                  operator: 'isTimeGreaterThan',
                  value: '20:00'
                },
                {
                  fact: 'time',
                  operator: 'isTimeLessThan',
                  value: '23:59'
                }
              ]
            },
            {
              all: [
                {
                  fact: 'time',
                  operator: 'isTimeGreaterThan',
                  value: '12:00'
                },
                {
                  fact: 'time',
                  operator: 'isTimeLessThan',
                  value: '02:00'
                }
              ]
            }
          ]
        },
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

  engine.addRule(complexRule3)

  const facts3 = {
    storeId: 'store-2',
    time: '22:30'
  }

  console.log('Facts provided:', facts3)
  console.log('Expected: Partially satisfied (missing userLocation)')

  const result3 = await engine.findSatisfiedRules(facts3)
  console.log('Result:')
  console.log('- Fully satisfied:', result3.fullySatisfiedRules.length)
  console.log('- Partially satisfied:', result3.partiallySatisfiedRules.length)
  console.log('- Independent:', result3.independentRules.length)
  console.log('- Unsatisfied:', result3.unsatisfiedRules.length)

  if (result3.partiallySatisfiedRules.length > 0) {
    const rule = result3.partiallySatisfiedRules[0]
    console.log('- Missing facts:', rule.missingFacts)
    console.log('- Reason:', rule.reason)
  }
  console.log()

  // Test Case 4: Rule that should be fully satisfied
  console.log('Test Case 4: Rule that should be fully satisfied')
  const simpleRule = new Rule({
    name: 'Simple Campaign',
    priority: 10,
    event: { type: 'campaign-enabled', params: { campaignId: 'simple' } },
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

  engine.addRule(simpleRule)

  const facts4 = {
    storeId: 'store-2',
    time: '22:30'
  }

  console.log('Facts provided:', facts4)
  console.log('Expected: Fully satisfied (all facts provided and conditions met)')

  const result4 = await engine.findSatisfiedRules(facts4)
  console.log('Result:')
  console.log('- Fully satisfied:', result4.fullySatisfiedRules.length)
  console.log('- Partially satisfied:', result4.partiallySatisfiedRules.length)
  console.log('- Independent:', result4.independentRules.length)
  console.log('- Unsatisfied:', result4.unsatisfiedRules.length)

  if (result4.fullySatisfiedRules.length > 0) {
    const rule = result4.fullySatisfiedRules[0]
    console.log('- Rule name:', rule.name)
    console.log('- Score:', rule.score)
  }
  console.log()

  // Test Case 5: Rule that should be unsatisfied
  console.log('Test Case 5: Rule that should be unsatisfied')
  const unsatisfiedRule = new Rule({
    name: 'Unsatisfied Campaign',
    priority: 10,
    event: { type: 'campaign-enabled', params: { campaignId: 'unsatisfied' } },
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

  engine.addRule(unsatisfiedRule)

  const facts5 = {
    storeId: 'store-4', // Not in the allowed list
    time: '22:30'
  }

  console.log('Facts provided:', facts5)
  console.log('Expected: Unsatisfied (storeId not in allowed list)')

  const result5 = await engine.findSatisfiedRules(facts5)
  console.log('Result:')
  console.log('- Fully satisfied:', result5.fullySatisfiedRules.length)
  console.log('- Partially satisfied:', result5.partiallySatisfiedRules.length)
  console.log('- Independent:', result5.independentRules.length)
  console.log('- Unsatisfied:', result5.unsatisfiedRules.length)

  if (result5.unsatisfiedRules.length > 0) {
    const rule = result5.unsatisfiedRules[0]
    console.log('- Rule name:', rule.name)
    console.log('- Reason:', rule.reason)
  }
  console.log()

  return {
    test1: result1,
    test2: result2,
    test3: result3,
    test4: result4,
    test5: result5
  }
}

// Run the tests
testComplexValidationCases()
  .then(results => {
    console.log('=== All Tests Completed ===')
    console.log('Summary:')
    console.log('- Test 1 (2/5 facts):', results.test1.partiallySatisfiedRules.length > 0 ? 'PASS' : 'FAIL')
    console.log('- Test 2 (1/5 facts):', results.test2.partiallySatisfiedRules.length > 0 ? 'PASS' : 'FAIL')
    console.log('- Test 3 (nested, 2/3 facts):', results.test3.partiallySatisfiedRules.length > 0 ? 'PASS' : 'FAIL')
    console.log('- Test 4 (all facts):', results.test4.fullySatisfiedRules.length > 0 ? 'PASS' : 'FAIL')
    console.log('- Test 5 (unsatisfied):', results.test5.unsatisfiedRules.length > 0 ? 'PASS' : 'FAIL')
  })
  .catch(error => {
    console.error('Test failed:', error)
  })
