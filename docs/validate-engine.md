# ValidateEngine Usage Guide

## Overview

`ValidateEngine` extends the base `Engine` to classify rules as fully satisfied, partially satisfied, independent, or unsatisfied for a given set of facts. It supports both context-based evaluation and focused fact analysis.

## Key Features

- **Fully Satisfied Rules**: All conditions met with provided facts
- **Partially Satisfied Rules**: Uses some provided facts but needs additional facts (includes `missingFacts`)
- **Independent Rules**: Do not depend on the provided facts (or on a focused fact)
- **Clear Categorization**: Each rule includes `satisfactionType` and a `reason`

## Public API

- `findSatisfiedRules(facts, focusedFactId?)`
- `findPartiallySatisfiedRules(factId, factValue, contextFacts?)`
- `findPartiallySatisfiedRulesFromContext(contextFacts)`
- `registerDefaultValueProvider(operator, provider)` / `unregisterDefaultValueProvider(operator)`

## Satisfaction Types

- `fully_satisfied`
- `partially_satisfied` (includes `missingFacts`)
- `independent`
- `unsatisfied`

## Basic Usage

### 1. Import and Setup

```javascript
const { ValidateEngine, Rule } = require('@swishhq/rule-engine')

// Create your rules
const rule1 = new Rule({
  conditions: {
    all: [
      { fact: 'storeId', operator: 'equal', value: '9351527b-09fd-44cf-b7a3-2f9c5af95875' },
      { fact: 'controlService', operator: 'equal', value: 99 }
    ]
  },
  event: { type: 'campaign-1-triggered' },
  name: 'Campaign 1'
})

const rule2 = new Rule({
  conditions: {
    all: [
      { fact: 'controlService', operator: 'equal', value: 99 },
      { fact: 'date', operator: 'greaterThan', value: '2025-06-30' }
    ]
  },
  event: { type: 'campaign-2-triggered' },
  name: 'Campaign 2'
})

const engine = new ValidateEngine([rule1, rule2])
```

### 2. Find Satisfied Rules (context mode)

```javascript
const facts = { storeId: '9351527b-09fd-44cf-b7a3-2f9c5af95875' }
const result = await engine.findSatisfiedRules(facts)
```

### 3. Interpret Results

```javascript
{
  facts: { storeId: '9351527b-09fd-44cf-b7a3-2f9c5af95875' },
  timestamp: '2025-08-05T12:02:23.588Z',
  fullySatisfiedRules: [],
  partiallySatisfiedRules: [
    {
      name: 'Campaign 1',
      priority: 1,
      score: 0,
      event: null,
      satisfactionType: 'partially_satisfied',
      reason: 'partially_satisfied_missing_facts',
      missingFacts: { controlService: 99 }
    }
  ],
  independentRules: [
    {
      name: 'Campaign 2',
      priority: 1,
      score: 0,
      event: null,
      satisfactionType: 'independent',
      reason: 'independent_and_satisfied'
    }
  ],
  unsatisfiedRules: [],
  summary: {
    totalRules: 2,
    fullySatisfied: 0,
    partiallySatisfied: 1,
    independent: 1,
    totalSatisfied: 2,
    unsatisfied: 0,
    satisfactionRate: 1
  }
}
```

### 4. Focused fact mode

Mark rules that do not reference a specific fact as independent:

```javascript
const facts = { storeId: '9351527b-09fd-44cf-b7a3-2f9c5af95875', time: '22:30' }
const result = await engine.findSatisfiedRules(facts, 'storeId')
```

### 5. Partially satisfied rules helpers

```javascript
// Focus a single fact with optional context
const partial = await engine.findPartiallySatisfiedRules('storeId', '9351...', { time: '22:30' })

// Context-only variant
const partialFromContext = await engine.findPartiallySatisfiedRulesFromContext({ storeId: '9351...' })
```

## Integration with Your API

```javascript
public async validateCampaigns(facts?: Record<string, any>): Promise<SwishResponse<any>> {
  try {
    const engine = await this.getEngine();
    const result = await engine.findSatisfiedRules(facts);
    return { success: true, data: result };
  } catch (error) {
    throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
  }
}
```

The `result` contains:
- `fullySatisfiedRules`, `partiallySatisfiedRules`, `independentRules`, `unsatisfiedRules`
- Each rule has `name`, `priority`, `score`, `event`, `satisfactionType`, and `reason`
- `partiallySatisfiedRules` include `missingFacts`
- `summary` has counts per category and `satisfactionRate`

## Tips

- You can customize “satisfying defaults” for operators via `registerDefaultValueProvider(operator, provider)`.
- Rules without conditions are considered `independent` and satisfied.