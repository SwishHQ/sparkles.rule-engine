# 🚀 ValidateEngine: Advanced Rule Validation & Analysis

## 📋 Table of Contents
- [Overview](#overview)
- [Key Differences](#key-differences)
- [Implementation Guide](#implementation-guide)
- [Use Cases](#use-cases)
- [API Reference](#api-reference)
- [Examples](#examples)

---

## 🎯 Overview

The **ValidateEngine** is a specialized extension of the base Engine class that provides advanced validation and analysis capabilities for rule-based systems. It's designed specifically for scenarios where you need to:

- ✅ **Validate individual facts** against all rules
- ✅ **Analyze JSON conditions** before execution
- ✅ **Track validation history** over time
- ✅ **Understand fact dependencies** across rules
- ✅ **Test campaign conditions** comprehensively

---

## 🔄 Key Differences: Engine vs ValidateEngine

| Feature | Standard Engine | ValidateEngine |
|---------|----------------|----------------|
| **Primary Purpose** | Rule execution and event emission | Validation and analysis |
| **Input** | Runtime facts | Facts + JSON conditions |
| **Output** | Events and results | Detailed validation reports |
| **Analysis** | Basic rule evaluation | Comprehensive fact impact analysis |
| **History** | No tracking | Full validation history |
| **Use Case** | Production rule execution | Testing, debugging, analysis |

### 🎭 When to Use Each

**Use Standard Engine when:**
- Running rules in production
- Emitting events based on rule evaluation
- Simple rule execution scenarios

**Use ValidateEngine when:**
- Testing rule configurations
- Analyzing fact dependencies
- Validating campaign conditions
- Debugging rule behavior
- Understanding rule impact

---

## 🛠️ Implementation Guide

### 1. Basic Setup

```javascript
const { ValidateEngine, Rule } = require('./src/rule-engine')

// Create ValidateEngine instance
const validateEngine = new ValidateEngine()

// Add your rules
validateEngine.addRule(new Rule({
  name: 'store-campaign',
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
      }
    ]
  },
  event: {
    type: 'campaign-triggered',
    params: { campaignId: 'store-campaign' }
  }
}))
```

### 2. Core Validation Methods

#### 🔍 Validate Single Fact
```javascript
// Test how a specific fact affects all rules
const result = await validateEngine.validateFact('storeId', 'xyz', {
  time: '22:30',
  appVersion: '1.0.1'
})

console.log('Rules using storeId:', result.rulesUsingFact.passed.map(r => r.name))
console.log('Rules not using storeId:', result.rulesNotUsingFact.passed.map(r => r.name))
```

#### 📊 Validate JSON Conditions
```javascript
// Test a JSON condition object
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
    }
  ]
}

const result = await validateEngine.validateCondition(conditionJson, {
  appVersion: '1.0.1'
})

console.log('Extracted facts:', result.extractedFacts)
console.log('Passed rules:', result.results.passed.map(r => r.name))
```

#### 🎯 Validate Any Object with Conditions
```javascript
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
      }
    ]
  }
}

const campaignResult = await validateEngine.validateObjectWithConditions(campaign, {
  appVersion: '1.0.1'
})

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


```

---

## 🎪 Use Cases

### 1. **Campaign Management Systems**
```javascript
// Find all campaigns applicable to a store
async function findCampaignsForStore(storeId, contextFacts) {
  const result = await validateEngine.validateFact('storeId', storeId, contextFacts)
  
  return {
    storeSpecificCampaigns: result.rulesUsingFact.passed,
    globalCampaigns: result.rulesNotUsingFact.passed,
    totalCampaigns: result.summary.passedRules
  }
}
```

### 2. **A/B Testing Validation**
```javascript
// Validate test conditions before deployment
async function validateTestConditions(testConditions) {
  const result = await validateEngine.validateCondition(testConditions)
  
  return {
    isValid: result.summary.successRate > 0,
    affectedRules: result.results.passed.length,
    factDependencies: result.factUsage
  }
}
```

### 3. **Rule Impact Analysis**
```javascript
// Understand how a fact change affects rules
async function analyzeFactImpact(factId, oldValue, newValue) {
  const oldResult = await validateEngine.validateFact(factId, oldValue)
  const newResult = await validateEngine.validateFact(factId, newValue)
  
  return {
    newlyTriggeredRules: newResult.rulesUsingFact.passed.filter(rule => 
      !oldResult.rulesUsingFact.passed.find(r => r.name === rule.name)
    ),
    newlyFailedRules: oldResult.rulesUsingFact.passed.filter(rule => 
      !newResult.rulesUsingFact.passed.find(r => r.name === rule.name)
    )
  }
}
```

### 4. **Debugging Rule Behavior**
```javascript
// Track validation history for debugging
async function debugRuleBehavior(factId) {
  const history = validateEngine.getValidationHistory(factId)
  
  return {
    recentValidations: history.slice(0, 10),
    successRate: history.filter(h => h.summary.passedRules > 0).length / history.length,
    commonContexts: analyzeCommonContexts(history)
  }
}
```

---

## 📚 API Reference

### Core Methods

#### `validateFact(factId, factValue, contextFacts = {})`
Validates a single fact against all rules.

**Returns:**
```javascript
{
  factId: 'storeId',
  factValue: 'xyz',
  timestamp: '2025-08-04T16:07:30.493Z',
  summary: {
    totalRules: 3,
    rulesUsingFact: 1,
    rulesNotUsingFact: 2,
    passedRules: 3,
    failedRules: 0
  },
  rulesUsingFact: {
    passed: [/* rules that use the fact and passed */],
    failed: [/* rules that use the fact and failed */]
  },
  rulesNotUsingFact: {
    passed: [/* rules that don't use the fact and passed */],
    failed: [/* rules that don't use the fact and failed */]
  }
}
```

#### `validateCondition(conditionJson, contextFacts = {})`
Validates a JSON condition object against all rules.

**Returns:**
```javascript
{
  condition: conditionJson,
  extractedFacts: { storeId: 'xyz', time: '21:40' },
  contextFacts: { appVersion: '1.0.1' },
  timestamp: '2025-08-04T16:07:30.493Z',
  summary: {
    totalRules: 3,
    passedRules: 2,
    failedRules: 1,
    successRate: 0.67
  },
  results: {
    passed: [/* rules that passed */],
    failed: [/* rules that failed */]
  },
  factUsage: {
    storeId: {
      rulesUsingFact: ['store-campaign'],
      rulesNotUsingFact: ['global-campaign'],
      usageCount: 1,
      dependencyLevel: 0.33
    }
  }
}
```

#### `validateObjectWithConditions(objectWithConditions, contextFacts = {})`
Validates any object with conditions against the engine rules.



#### `findSatisfiedRules(facts)`
Finds all rules that would be satisfied by a given set of facts.

#### `getValidationHistory(factId)`
Gets validation history for a specific fact.

#### `clearValidationHistory()`
Clears all validation history.

---

## 🎨 Examples

### Example 1: Generic Object Validation
```javascript
// Validate any object with conditions
const campaign = {
  id: 'summer-sale-001',
  name: 'Summer Sale Campaign',
  type: 'campaign',
  conditions: {
    all: [
      {
        fact: 'storeId',
        value: 'store-123',
        operator: 'equal'
      },
      {
        fact: 'date',
        value: '2025-06-01',
        operator: 'greaterThanInclusive'
      },
      {
        fact: 'date',
        value: '2025-08-31',
        operator: 'lessThanInclusive'
      }
    ]
  }
}

const result = await validateEngine.validateObjectWithConditions(campaign, {
  currentDate: '2025-07-15',
  userType: 'premium'
})

console.log(`Object ${result.object.name} (${result.object.type}) would trigger ${result.summary.passedRules} rules`)

// Also works for feature flags, promotions, etc.
const featureFlag = {
  id: 'new-ui-001',
  name: 'New UI Feature',
  type: 'feature-flag',
  conditions: {
    all: [
      {
        fact: 'userRole',
        value: 'admin',
        operator: 'equal'
      }
    ]
  }
}

const featureResult = await validateEngine.validateObjectWithConditions(featureFlag, {
  userRole: 'admin'
})
```

### Example 2: Feature Flag Analysis
```javascript
// Analyze how a feature flag affects rules
const featureFlagAnalysis = await validateEngine.validateFact('featureFlag', 'new-ui', {
  userRole: 'admin',
  appVersion: '2.0.0'
})

console.log('Rules affected by new-ui feature flag:')
featureFlagAnalysis.rulesUsingFact.passed.forEach(rule => {
  console.log(`- ${rule.name}: ${rule.event.params.message}`)
})
```

### Example 3: Complex Condition Testing
```javascript
// Test complex nested conditions
const complexCondition = {
  any: [
    {
      all: [
        {
          fact: 'userType',
          value: 'premium',
          operator: 'equal'
        },
        {
          fact: 'purchaseCount',
          value: 5,
          operator: 'greaterThan'
        }
      ]
    },
    {
      all: [
        {
          fact: 'userType',
          value: 'vip',
          operator: 'equal'
        }
      ]
    }
  ]
}

const result = await validateEngine.validateCondition(complexCondition, {
  userType: 'premium',
  purchaseCount: 10
})

console.log('Complex condition validation result:', result.summary)
```

---

## 🎯 How It Helps Evaluate Conditions

### 1. **Comprehensive Condition Analysis**
- ✅ Extracts all facts from JSON conditions
- ✅ Identifies which rules depend on each fact
- ✅ Shows how facts interact with rules
- ✅ Provides success/failure rates

### 2. **Fact Dependency Mapping**
- ✅ Maps which rules use specific facts
- ✅ Shows rules that don't depend on facts
- ✅ Calculates dependency levels
- ✅ Identifies unused facts

### 3. **Validation History Tracking**
- ✅ Tracks all validation attempts
- ✅ Provides historical analysis
- ✅ Enables debugging over time
- ✅ Shows validation patterns

### 4. **Impact Analysis**
- ✅ Shows how fact changes affect rules
- ✅ Identifies newly triggered rules
- ✅ Shows rules that stop working
- ✅ Provides before/after comparisons

---

## 🚀 Getting Started

1. **Install the rule engine**
2. **Import ValidateEngine**
3. **Add your rules**
4. **Start validating!**

```javascript
const { ValidateEngine, Rule } = require('./src/rule-engine')

const validateEngine = new ValidateEngine()

// Add your rules here...

// Start validating
const result = await validateEngine.validateFact('yourFact', 'yourValue')
console.log('Validation complete:', result.summary)
```

## 🛡️ **Error Handling & Robustness**

The ValidateEngine is designed to be robust and handle edge cases gracefully:

### **Undefined Facts**
- ✅ **Graceful handling** - Uses `allowUndefinedFacts: true` for validation scenarios
- ✅ **No crashes** - Continues evaluation even when facts are missing
- ✅ **Clear reporting** - Shows which facts are missing in validation results

### **Complex Conditions**
- ✅ **Nested logic** - Handles `all`/`any`/`not` combinations
- ✅ **Deep analysis** - Extracts facts from any level of nesting
- ✅ **Condition evaluation** - Properly evaluates complex boolean logic

### **State Management**
- ✅ **Clean separation** - Uses temporary engines to avoid state pollution
- ✅ **Memory efficient** - Proper cleanup after validation operations
- ✅ **Thread safe** - Each validation operation is isolated

---

## 🎉 Summary

The **ValidateEngine** provides a powerful toolkit for:

- 🔍 **Deep analysis** of rule behavior
- 📊 **Comprehensive validation** of conditions
- 🎯 **Precise fact dependency** mapping
- 📈 **Historical tracking** of validations
- 🛠️ **Debugging support** for complex rule systems
- 🛡️ **Robust error handling** for production environments
- ⚡ **Performance optimized** for large rule sets

## 🔧 **Recent Improvements**

### **Technical Enhancements:**
- ✅ **Added missing methods** - `findRulesUsingFact()` and `_conditionUsesFact()`
- ✅ **Fixed almanac handling** - Proper fact registration and evaluation
- ✅ **Improved error resilience** - Graceful handling of undefined facts
- ✅ **Optimized performance** - Temporary engines for clean state management
- ✅ **Enhanced debugging** - Better error messages and validation reporting

### **Production Readiness:**
- ✅ **All demos working** - Complete test coverage of all features
- ✅ **Error handling** - Robust handling of edge cases
- ✅ **Memory management** - Efficient resource usage
- ✅ **API stability** - Consistent and predictable behavior

It's the perfect companion for building robust, testable rule-based systems where understanding the impact of facts and conditions is crucial for success. 