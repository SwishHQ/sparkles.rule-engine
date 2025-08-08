const ValidateEngine = require('../dist/validate-engine.js').default
const Rule = require('../dist/rule.js').default
const Operator = require('../dist/operator.js').default

// Helper function to convert time string to minutes for comparison
function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number)
  return hours * 60 + minutes
}

// Test case 1: Only storeId fact provided
async function testCase1() {
  console.log('\n=== Test Case 1: Only storeId fact provided ===')
  
  const rules = [
    {
      name: 'White-1 & Tav-1 & time constraint',
      event: {
        type: 'campaign-enabled',
        params: {
          campaign: {
            id: '1978db55-8be8-4fb0-8bd0-3b88c0f27619',
            name: 'White-1 & Tav-1 & time constraint'
          }
        }
      },
      priority: 12,
      conditions: {
        any: [
          {
            all: [
              {
                fact: 'storeId',
                value: '9351527b-09fd-44cf-b7a3-2f9c5af95875',
                operator: 'equal'
              },
              {
                fact: 'time',
                value: '15:30',
                operator: 'greaterThan'
              },
              {
                fact: 'time',
                value: '18:30',
                operator: 'lessThan'
              }
            ]
          },
          {
            all: [
              {
                fact: 'storeId',
                value: '85af4105-5cb8-4e6f-b2a7-23d74ffc8e67',
                operator: 'equal'
              },
              {
                fact: 'time',
                value: '16:30',
                operator: 'greaterThan'
              },
              {
                fact: 'time',
                value: '17:30',
                operator: 'lessThan'
              }
            ]
          }
        ]
      }
    },
    {
      name: 'Store BLR_WHITE_1',
      event: {
        type: 'campaign-enabled',
        params: {
          campaign: {
            id: '365a0db2-4764-4c8c-92c8-c64c990b01a3',
            name: 'Store BLR_WHITE_1'
          }
        }
      },
      priority: 1,
      conditions: {
        all: [
          {
            fact: 'storeId',
            value: '9351527b-09fd-44cf-b7a3-2f9c5af95875',
            operator: 'equal'
          }
        ]
      }
    }
  ]

  const engine = new ValidateEngine(rules)
  
  // Add custom time operators
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
  
  const facts = {
    storeId: '9351527b-09fd-44cf-b7a3-2f9c5af95875'
  }

  console.log('Facts:', facts)
  const result = await engine.findSatisfiedRules(facts)
  
  console.log('Fully satisfied rules:', result.fullySatisfiedRules.map(r => r.name))
  console.log('Partially satisfied rules:', result.partiallySatisfiedRules.map(r => r.name))
  console.log('Independent rules:', result.independentRules.map(r => r.name))
  console.log('Unsatisfied rules:', result.unsatisfiedRules.map(r => r.name))
  
  return result
}

// Test case 2: storeId and time facts provided
async function testCase2() {
  console.log('\n=== Test Case 2: storeId and time facts provided ===')
  
  const rules = [
    {
      name: 'White-1 & Tav-1 & time constraint',
      event: {
        type: 'campaign-enabled',
        params: {
          campaign: {
            id: '1978db55-8be8-4fb0-8bd0-3b88c0f27619',
            name: 'White-1 & Tav-1 & time constraint'
          }
        }
      },
      priority: 12,
      conditions: {
        any: [
          {
            all: [
              {
                fact: 'storeId',
                value: '9351527b-09fd-44cf-b7a3-2f9c5af95875',
                operator: 'equal'
              },
              {
                fact: 'time',
                value: '15:30',
                operator: 'isTimeGreaterThan'
              },
              {
                fact: 'time',
                value: '18:30',
                operator: 'isTimeLessThan'
              }
            ]
          },
          {
            all: [
              {
                fact: 'storeId',
                value: '85af4105-5cb8-4e6f-b2a7-23d74ffc8e67',
                operator: 'equal'
              },
              {
                fact: 'time',
                value: '16:30',
                operator: 'isTimeGreaterThan'
              },
              {
                fact: 'time',
                value: '17:30',
                operator: 'isTimeLessThan'
              }
            ]
          }
        ]
      }
    },
    {
      name: 'Store BLR_WHITE_1',
      event: {
        type: 'campaign-enabled',
        params: {
          campaign: {
            id: '365a0db2-4764-4c8c-92c8-c64c990b01a3',
            name: 'Store BLR_WHITE_1'
          }
        }
      },
      priority: 1,
      conditions: {
        all: [
          {
            fact: 'storeId',
            value: '9351527b-09fd-44cf-b7a3-2f9c5af95875',
            operator: 'equal'
          }
        ]
      }
    }
  ]

  const engine = new ValidateEngine(rules)
  
  // Add custom time operators
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
  
  const facts = {
    storeId: '9351527b-09fd-44cf-b7a3-2f9c5af95875',
    time: '17:38'
  }

  console.log('Facts:', facts)
  const result = await engine.findSatisfiedRules(facts)
  
  console.log('Fully satisfied rules:', result.fullySatisfiedRules.map(r => r.name))
  console.log('Partially satisfied rules:', result.partiallySatisfiedRules.map(r => r.name))
  console.log('Independent rules:', result.independentRules.map(r => r.name))
  console.log('Unsatisfied rules:', result.unsatisfiedRules.map(r => r.name))
  
  return result
}

// Test case 3: Different storeId fact provided
async function testCase3() {
  console.log('\n=== Test Case 3: Different storeId fact provided ===')
  
  const rules = [
    {
      name: 'White-1 & Tav-1 & time constraint',
      event: {
        type: 'campaign-enabled',
        params: {
          campaign: {
            id: '1978db55-8be8-4fb0-8bd0-3b88c0f27619',
            name: 'White-1 & Tav-1 & time constraint'
          }
        }
      },
      priority: 12,
      conditions: {
        any: [
          {
            all: [
              {
                fact: 'storeId',
                value: '9351527b-09fd-44cf-b7a3-2f9c5af95875',
                operator: 'equal'
              },
              {
                fact: 'time',
                value: '15:30',
                operator: 'isTimeGreaterThan'
              },
              {
                fact: 'time',
                value: '18:30',
                operator: 'isTimeLessThan'
              }
            ]
          },
          {
            all: [
              {
                fact: 'storeId',
                value: '85af4105-5cb8-4e6f-b2a7-23d74ffc8e67',
                operator: 'equal'
              },
              {
                fact: 'time',
                value: '16:30',
                operator: 'isTimeGreaterThan'
              },
              {
                fact: 'time',
                value: '17:30',
                operator: 'isTimeLessThan'
              }
            ]
          }
        ]
      }
    },
    {
      name: 'Store BLR_WHITE_1',
      event: {
        type: 'campaign-enabled',
        params: {
          campaign: {
            id: '365a0db2-4764-4c8c-92c8-c64c990b01a3',
            name: 'Store BLR_WHITE_1'
          }
        }
      },
      priority: 1,
      conditions: {
        all: [
          {
            fact: 'storeId',
            value: '9351527b-09fd-44cf-b7a3-2f9c5af95875',
            operator: 'equal'
          }
        ]
      }
    }
  ]

  const engine = new ValidateEngine(rules)
  
  // Add custom time operators
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
  
  const facts = {
    storeId: '85af4105-5cb8-4e6f-b2a7-23d74ffc8e67'
  }

  console.log('Facts:', facts)
  const result = await engine.findSatisfiedRules(facts)
  
  console.log('Fully satisfied rules:', result.fullySatisfiedRules.map(r => r.name))
  console.log('Partially satisfied rules:', result.partiallySatisfiedRules.map(r => r.name))
  console.log('Independent rules:', result.independentRules.map(r => r.name))
  console.log('Unsatisfied rules:', result.unsatisfiedRules.map(r => r.name))
  
  return result
}

// Run all test cases
async function runTests() {
  try {
    await testCase1()
    await testCase2()
    await testCase3()
  } catch (error) {
    console.error('Test error:', error)
  }
}

runTests() 