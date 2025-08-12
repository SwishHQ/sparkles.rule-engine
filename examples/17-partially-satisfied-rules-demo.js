require('babel-polyfill')
const { ValidateEngine, Rule } = require('../dist/rule-engine')

// Create ValidateEngine instance
const validateEngine = new ValidateEngine()

// Add rules for demonstration
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
        value: 21.40,
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
        value: 1.0,
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
        value: 22.00,
        operator: 'greaterThanInclusive'
      }
    ]
  },
  event: {
    type: 'campaign-triggered',
    params: { campaignId: 'time-based-campaign' }
  }
}))

validateEngine.addRule(new Rule({
  name: 'user-specific-campaign',
  conditions: {
    all: [
      {
        fact: 'userId',
        value: 'user123',
        operator: 'equal'
      },
      {
        fact: 'userType',
        value: 'premium',
        operator: 'equal'
      }
    ]
  },
  event: {
    type: 'campaign-triggered',
    params: { campaignId: 'user-specific-campaign' }
  }
}))

validateEngine.addRule(new Rule({
  name: 'location-based-campaign',
  conditions: {
    all: [
      {
        fact: 'location',
        value: 'NYC',
        operator: 'equal'
      },
      {
        fact: 'weather',
        value: 'sunny',
        operator: 'equal'
      }
    ]
  },
  event: {
    type: 'campaign-triggered',
    params: { campaignId: 'location-based-campaign' }
  }
}))

console.log('=== Partially Satisfied Rules Demo ===\n')

// Demo 1: Find partially satisfied rules for storeId
async function demoPartiallySatisfiedRules () {
  console.log('1. Finding partially satisfied rules for storeId = "xyz"')

  const result = await validateEngine.findPartiallySatisfiedRules('storeId', 'xyz', {
    time: 22.30,
    appVersion: 1.1
  })

  console.log('Result Summary:')
  console.log('- Total Rules:', result.summary.totalRules)
  console.log('- Partially Satisfied:', result.summary.partiallySatisfied)
  console.log('- Independent:', result.summary.independent)
  console.log('- Fully Satisfied:', result.summary.fullySatisfied)
  console.log('- Unsatisfied:', result.summary.unsatisfied)

  console.log('\nPartially Satisfied Rules:')
  result.rules.partiallySatisfied.forEach(rule => {
    console.log(`- ${rule.name}: ${rule.reason}`)
    if (rule.missingFacts) {
      console.log('  Missing facts:', rule.missingFacts)
    }
  })

  console.log('\nIndependent Rules:')
  result.rules.independent.forEach(rule => {
    console.log(`- ${rule.name}: ${rule.reason}`)
  })

  console.log('\nFully Satisfied Rules:')
  result.rules.fullySatisfied.forEach(rule => {
    console.log(`- ${rule.name}: ${rule.reason}`)
  })
}

// Demo 2: Find partially satisfied rules for userId with missing facts
async function demoMissingFacts () {
  console.log('\n2. Finding partially satisfied rules for userId = "user123" (missing userType)')

  const result = await validateEngine.findPartiallySatisfiedRules('userId', 'user123', {
    storeId: 'xyz',
    time: 22.30
  })

  console.log('Result Summary:')
  console.log('- Partially Satisfied:', result.summary.partiallySatisfied)
  console.log('- Independent:', result.summary.independent)
  console.log('- Fully Satisfied:', result.summary.fullySatisfied)

  console.log('\nPartially Satisfied Rules:')
  result.rules.partiallySatisfied.forEach(rule => {
    console.log(`- ${rule.name}: ${rule.reason}`)
    if (rule.missingFacts) {
      console.log('  Missing facts:', rule.missingFacts)
    }
  })
}

// Demo 3: Find partially satisfied rules for location with no context
async function demoNoContext () {
  console.log('\n3. Finding partially satisfied rules for location = "NYC" (no context)')

  const result = await validateEngine.findPartiallySatisfiedRules('location', 'NYC')

  console.log('Result Summary:')
  console.log('- Partially Satisfied:', result.summary.partiallySatisfied)
  console.log('- Independent:', result.summary.independent)
  console.log('- Fully Satisfied:', result.summary.fullySatisfied)

  console.log('\nPartially Satisfied Rules:')
  result.rules.partiallySatisfied.forEach(rule => {
    console.log(`- ${rule.name}: ${rule.reason}`)
    if (rule.missingFacts) {
      console.log('  Missing facts:', rule.missingFacts)
    }
  })
}

// Demo 4: Compare with findSatisfiedRules
async function demoComparison () {
  console.log('\n4. Comparing findPartiallySatisfiedRules vs findSatisfiedRules')

  const facts = {
    storeId: 'xyz',
    time: 22.30,
    appVersion: 1.1
  }

  const partiallySatisfiedResult = await validateEngine.findPartiallySatisfiedRules('storeId', 'xyz', {
    time: 22.30,
    appVersion: 1.1
  })

  const satisfiedResult = await validateEngine.findSatisfiedRules(facts)

  console.log('findPartiallySatisfiedRules:')
  console.log('- Partially Satisfied:', partiallySatisfiedResult.summary.partiallySatisfied)
  console.log('- Independent:', partiallySatisfiedResult.summary.independent)
  console.log('- Fully Satisfied:', partiallySatisfiedResult.summary.fullySatisfied)

  console.log('\nfindSatisfiedRules:')
  console.log('- Satisfied:', satisfiedResult.summary.satisfied)
  console.log('- Unsatisfied:', satisfiedResult.summary.unsatisfied)

  console.log('\nKey Difference:')
  console.log('- findPartiallySatisfiedRules identifies rules that would pass if missing facts were provided')
  console.log('- findSatisfiedRules only shows currently satisfied/unsatisfied rules')
}

// Demo 5: Real-world campaign scenario
async function demoCampaignScenario () {
  console.log('\n5. Real-world campaign scenario')

  // Simulate a user with partial information
  const userFacts = {
    userId: 'user123',
    storeId: 'xyz',
    time: 22.30
  }

  console.log('User Facts:', userFacts)

  // Check which campaigns are partially satisfied for this user
  const result = await validateEngine.findPartiallySatisfiedRules('userId', 'user123', {
    storeId: 'xyz',
    time: 22.30
  })

  console.log('\nCampaign Analysis:')
  console.log('✅ Fully Satisfied Campaigns:')
  result.rules.fullySatisfied.forEach(rule => {
    console.log(`  - ${rule.name}`)
  })

  console.log('\n🔄 Partially Satisfied Campaigns (need more info):')
  result.rules.partiallySatisfied.forEach(rule => {
    console.log(`  - ${rule.name}`)
    if (rule.missingFacts) {
      console.log('    Missing:', Object.keys(rule.missingFacts).join(', '))
    }
  })

  console.log('\n📊 Independent Campaigns:')
  result.rules.independent.forEach(rule => {
    console.log(`  - ${rule.name}: ${rule.reason}`)
  })

  console.log('\n❌ Unsatisfied Campaigns:')
  result.rules.unsatisfied.forEach(rule => {
    console.log(`  - ${rule.name}`)
  })
}

async function runAllDemos () {
  try {
    await demoPartiallySatisfiedRules()
    await demoMissingFacts()
    await demoNoContext()
    await demoComparison()
    await demoCampaignScenario()

    console.log('\n=== Demo Complete ===')
  } catch (error) {
    console.error('Demo error:', error)
  }
}

runAllDemos()
