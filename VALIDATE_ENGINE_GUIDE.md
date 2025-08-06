# ValidateEngine Usage Guide

## Overview

The `ValidateEngine` is a simplified extension of the base `Engine` class that provides specialized functionality for finding satisfied rules. It's designed to handle your specific use case where you need to identify all rules that are either fully satisfied, partially satisfied, or independent of the provided facts.

## Key Features

- **Fully Satisfied Rules**: Rules where all conditions are met with the provided facts
- **Partially Satisfied Rules**: Rules that use some provided facts but need additional facts to be satisfied
- **Independent Rules**: Rules that don't depend on any of the provided facts (these are considered satisfied)
- **Clear Categorization**: Each rule is categorized with a `satisfactionType` indicating why it was included

## Satisfaction Types

- **`fully_satisfied`**: All conditions in the rule are met with the provided facts
- **`partially_satisfied`**: Rule requires additional facts to be fully satisfied (includes `missingFacts` property)
- **`independent`**: Rule doesn't depend on any of the provided facts (includes rules with no conditions)
- **`unsatisfied`**: Rule has all required facts but conditions don't match

## Basic Usage

### 1. Import and Setup

```javascript
const { ValidateEngine, Rule } = require('@swishhq/rule-engine')

// Create your rules
const rule1 = new Rule({
  conditions: {
    all: [
      {
        fact: "storeId",
        operator: "equal",
        value: "9351527b-09fd-44cf-b7a3-2f9c5af95875"
      },
      {
        fact: "controlService",
        operator: "equal",
        value: 99
      }
    ]
  },
  event: { type: 'campaign-1-triggered' },
  name: 'Campaign 1'
})

const rule2 = new Rule({
  conditions: {
    all: [
      {
        fact: "controlService",
        operator: "equal",
        value: 99
      },
      {
        fact: "date",
        operator: "greaterThan",
        value: "2025-06-30"
      }
    ]
  },
  event: { type: 'campaign-2-triggered' },
  name: 'Campaign 2'
})

// Create the engine
const engine = new ValidateEngine([rule1, rule2])
```

### 2. Find Satisfied Rules

```javascript
// Test with facts
const facts = {
  storeId: '9351527b-09fd-44cf-b7a3-2f9c5af95875'
}

const result = await engine.findSatisfiedRules(facts)
```

### 3. Interpret Results

The `findSatisfiedRules` method returns an object with separate arrays for each satisfaction type:

```javascript
{
  facts: { storeId: '9351527b-09fd-44cf-b7a3-2f9c5af95875' },
  timestamp: "2025-08-05T12:02:23.588Z",
  fullySatisfiedRules: [],
  partiallySatisfiedRules: [
    {
      name: "Campaign 1",
      priority: 1,
      score: 0,
      event: null,
      satisfactionType: "partially_satisfied",
      missingFacts: { controlService: 99 }
    }
  ],
  independentRules: [
    {
      name: "Campaign 2",
      priority: 1,
      score: 0,
      event: null,
      satisfactionType: "independent"
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
    satisfactionRate: 1.0
  }
}
```

## Use Cases

### Case 1: Partial Facts
When you provide only some facts, rules that use those facts but need more are partially satisfied, and rules that don't use those facts are independent.

```javascript
const facts = { storeId: '9351527b-09fd-44cf-b7a3-2f9c5af95875' }
// Campaign 1 will be in partiallySatisfiedRules (uses storeId but needs controlService)
// Campaign 2 will be in independentRules (doesn't use storeId)
```

### Case 2: All Facts Provided
When you provide all required facts, rules are either fully satisfied or unsatisfied.

```javascript
const facts = {
  storeId: '9351527b-09fd-44cf-b7a3-2f9c5af95875',
  controlService: 99,
  date: '2025-07-01'
}
// Campaign 1 will be in fullySatisfiedRules
// Campaign 2 will be in fullySatisfiedRules
```

### Case 3: Facts That Don't Match
When you provide facts that don't match rule conditions, rules are unsatisfied.

```javascript
const facts = { storeId: 'wrong-id', controlService: 50 }
// Campaign 1 will be in unsatisfiedRules (storeId doesn't match)
// Campaign 2 will be in partiallySatisfiedRules (needs date)
```

## Integration with Your API

For your client-side API call:

```javascript
public async validateCampaigns(facts?: Record<string, any>, condition?: TopLevelCondition): Promise<SwishResponse<any>> {
    try {
        const engine = await this.getEngine();
        const result = await engine.findSatisfiedRules(facts);
        return {
            success: true,
            data: result
        };
    } catch (error) {
        throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
}
```

The `result` will contain:
- `fullySatisfiedRules`: Array of rules that are fully satisfied
- `partiallySatisfiedRules`: Array of rules that are partially satisfied (includes missing facts)
- `independentRules`: Array of rules that don't depend on provided facts
- `unsatisfiedRules`: Array of rules that have all required facts but conditions don't match
- `summary`: Statistics about the results including counts for each satisfaction type

## Key Benefits

1. **Clear Separation**: Each satisfaction type has its own array for easy processing
2. **Missing Facts Information**: Partially satisfied rules include information about what facts are missing
3. **Comprehensive Results**: You get all rules categorized by their satisfaction status
4. **Performance Optimized**: Uses the base engine's efficient evaluation with additional analysis

## Example Output

For your specific use case with the two campaign rules:

```javascript
// Input facts: { storeId: '9351527b-09fd-44cf-b7a3-2f9c5af95875' }

// Output:
{
  fullySatisfiedRules: [],
  partiallySatisfiedRules: [
    {
      name: "Campaign 1",
      satisfactionType: "partially_satisfied",
      missingFacts: { controlService: 99 }
    }
  ],
  independentRules: [
    {
      name: "Campaign 2", 
      satisfactionType: "independent"
    }
  ],
  unsatisfiedRules: []
}
```

This gives you exactly what you need: separate arrays for each satisfaction type, making it easy to process rules based on their satisfaction status and providing clear information about what additional facts are needed for partially satisfied rules. 