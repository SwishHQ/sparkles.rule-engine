# Engine

The Engine stores and executes rules, emits events, and maintains state. The engine now supports advanced scoring and weighting capabilities for more nuanced rule evaluation.

* [Methods](#methods)
    * [constructor([Array rules], Object [options])](#constructorarray-rules-object-options)
      * [Options](#options)
    * [engine.addFact(String id, Function [definitionFunc], Object [options])](#engineaddfactstring-id-function-definitionfunc-object-options)
    * [engine.removeFact(String id)](#engineremovefactstring-id)
    * [engine.addRule(Rule instance|Object options)](#engineaddrulerule-instanceobject-options)
    * [engine.updateRule(Rule instance|Object options)](#engineupdaterulerule-instanceobject-options)
    * [engine.removeRule(Rule instance | String ruleId)](#engineremoverulerule-instance)
    * [engine.addOperator(String operatorName, Function evaluateFunc(factValue, jsonValue))](#engineaddoperatorstring-operatorname-function-evaluatefuncfactvalue-jsonvalue)
    * [engine.removeOperator(String operatorName)](#engineremoveoperatorstring-operatorname)
    * [engine.addOperatorDecorator(String decoratorName, Function evaluateFunc(factValue, jsonValue, next))](#engineaddoperatordecoratorstring-decoratorname-function-evaluatefuncfactvalue-jsonvalue-next)
    * [engine.removeOperatorDecorator(String decoratorName)](#engineremoveoperatordecoratorstring-decoratorname)
    * [engine.setCondition(String name, Object conditions)](#enginesetconditionstring-name-object-conditions)
    * [engine.removeCondition(String name)](#engineremovecondtionstring-name)
    * [engine.run([Object facts], [Object options]) -&gt; Promise ({ events: [], failureEvents: [], almanac: Almanac, results: [], failureResults: []})](#enginerunobject-facts-object-options---promise--events--failureevents--almanac-almanac-results--failureresults-)
    * [engine.stop() -&gt; Engine](#enginestop---engine)
      * [engine.on('success', Function(Object event, Almanac almanac, RuleResult ruleResult))](#engineonsuccess-functionobject-event-almanac-almanac-ruleresult-ruleresult)
      * [engine.on('failure', Function(Object event, Almanac almanac, RuleResult ruleResult))](#engineonfailure-functionobject-event-almanac-almanac-ruleresult-ruleresult)
* [Scoring and Weights](#scoring-and-weights)
    * [Operator Scoring](#operator-scoring)
    * [Condition Weights](#condition-weights)
    * [Rule Scores](#rule-scores)

## Methods

### constructor([Array rules], Object [options])

```js
let Engine = require('@swishhq/rule-engine').Engine

let engine = new Engine()

// initialize with rules
let engine = new Engine([Array rules])

// initialize with options
let options = {
  allowUndefinedFacts: false,
  pathResolver: (object, path) => _.get(object, path)
};
let engine = new Engine([Array rules], options)
```

#### Options

`allowUndefinedFacts` - By default, when a running engine encounters an undefined fact,
an exception is thrown.  Turning this option on will cause the engine to treat
undefined facts as `undefined`.  (default: false)

`allowUndefinedConditions` - By default, when a running engine encounters a
condition reference that cannot be resolved an exception is thrown. Turning
this option on will cause the engine to treat unresolvable condition references
as failed conditions. (default: false)

`replaceFactsInEventParams` - By default when rules succeed or fail the events emitted are clones of the event in the rule declaration. When setting this option to true the parameters on the events will be have any fact references resolved. (default: false)

`pathResolver` - Allows a custom object path resolution library to be used. (default: `json-path` syntax). See [custom path resolver](./rules.md#condition-helpers-custom-path-resolver) docs.

### engine.addFact(String id, Function [definitionFunc], Object [options])

```js
// constant facts:
engine.addFact('speed-of-light', 299792458)

// facts computed via function
engine.addFact('account-type', function getAccountType(params, almanac) {
  // ...
})

// facts with options:
engine.addFact('account-type', function getAccountType(params, almanac) {
  // ...
}, { cache: false, priority: 500 })
```

### engine.removeFact(String id)

```js
engine.addFact('speed-of-light', 299792458)

// removes the fact
engine.removeFact('speed-of-light')
```

### engine.addRule(Rule instance|Object options)

Adds a rule to the engine.  The engine will execute the rule upon the next ```run()```

```js
let Rule = require('@swishhq/rule-engine').Rule

// via rule properties (now with optional weights):
engine.addRule({
  conditions: {
    all: [{
      fact: 'score',
      operator: 'greaterThan',
      value: 80,
      weight: 2  // This condition is twice as important
    }, {
      fact: 'attendance',
      operator: 'greaterThan', 
      value: 0.9,
      weight: 1  // Standard weight
    }]
  },
  event: {},
  priority: 1,                             // optional, default: 1
  onSuccess: function (event, almanac) {}, // optional
  onFailure: function (event, almanac) {}, // optional
})

// or rule instance:
let rule = new Rule()
engine.addRule(rule)
```

 ### engine.removeRule(Rule instance | Any ruleName) -> Boolean

 Removes a rule from the engine, either by passing a rule object or a rule name. When removing by rule name, all rules matching the provided name will be removed.

 Method returns true when rule was successfully remove, or false when not found.

```javascript
// adds a rule
let rule = new Rule()
engine.addRule(rule)

//remove it
engine.removeRule(rule)
//or
engine.removeRule(rule.name)
```

 ### engine.updateRule(Rule instance|Object options)

 Updates a rule in the engine.

```javascript
// adds a rule
let rule = new Rule()
engine.addRule(rule)

// change rule condition
rule.conditions.all = []

//update it in the engine
engine.updateRule(rule)
```

### engine.addOperator(String operatorName, Function evaluateFunc(factValue, jsonValue))

Adds a custom operator to the engine. Operators now return scores between 0 and 1 instead of boolean values, allowing for more nuanced evaluations.

```js
/*
 * operatorName - operator identifier mentioned in the rule condition
 * evaluateFunc(factValue, jsonValue) - compares fact result to the condition 'value', returning score (0-1)
 *    factValue - the value returned from the fact
 *    jsonValue - the "value" property stored in the condition itself
 *    returns: number between 0 and 1, where 1 indicates perfect match
 */

// Boolean-style operator (returns 0 or 1)
engine.addOperator('startsWithLetter', (factValue, jsonValue) => {
  if (!factValue.length) return 0
  return factValue[0].toLowerCase() === jsonValue.toLowerCase() ? 1 : 0
})

// Scoring operator (returns values between 0 and 1)
engine.addOperator('similarTo', (factValue, jsonValue) => {
  if (typeof factValue !== 'string' || typeof jsonValue !== 'string') return 0
  
  // Return similarity score based on string comparison
  const similarity = calculateStringSimilarity(factValue, jsonValue)
  return Math.max(0, Math.min(1, similarity)) // Ensure 0-1 range
})

// and to use the operator...
let rule = new Rule({
  conditions: {
    all: [
      {
        fact: 'username',
        operator: 'startsWithLetter', // reference the operator name in the rule
        value: 'a'
      }
    ]
  }
})
```

See the [operator example](../examples/06-custom-operators.js) and [scoring example](../examples/14-scoring-and-weights.js)

### engine.removeOperator(String operatorName)

Removes a operator from the engine

```javascript
engine.addOperator('startsWithLetter', (factValue, jsonValue) => {
  if (!factValue.length) return 0
  return factValue[0].toLowerCase() === jsonValue.toLowerCase() ? 1 : 0
})

engine.removeOperator('startsWithLetter');
```

### engine.addOperatorDecorator(String decoratorName, Function evaluateFunc(factValue, jsonValue, next))

Adds a custom operator decorator to the engine. Decorators can modify scoring behavior.

```js
/*
 * decoratorName - operator decorator identifier used in the rule condition
 * evaluateFunc(factValue, jsonValue, next) - uses the decorated operator to compare the fact result to the condition 'value'
 *    factValue - the value returned from the fact
 *    jsonValue - the "value" property stored in the condition itself
 *    next - the evaluateFunc of the decorated operator
 *    returns: number between 0 and 1
 */
engine.addOperatorDecorator('first', (factValue, jsonValue, next) => {
  if (!factValue.length) return 0
  return next(factValue[0], jsonValue)
})
```

### engine.removeOperatorDecorator(String decoratorName)

Removes an operator decorator from the engine

```javascript
engine.removeOperatorDecorator('first');
```

### engine.setCondition(String name, Object conditions)

Stores a named condition that can be referenced by multiple rules.

```js
engine.setCondition('highPerformer', {
  all: [{
    fact: 'performanceRating',
    operator: 'greaterThan',
    value: 4.0,
    weight: 3
  }, {
    fact: 'attendanceScore', 
    operator: 'greaterThan',
    value: 0.9,
    weight: 1
  }]
})

// Reference the condition in rules
engine.addRule({
  conditions: {
    condition: 'highPerformer'
  },
  event: {
    type: 'promotion-eligible'
  }
})
```

### engine.removeCondition(String name)

Removes a named condition from the engine

```javascript
engine.removeCondition('highPerformer');
```

### engine.run([Object facts], [Object options]) -> Promise ({ events: [], failureEvents: [], almanac: Almanac, results: [], failureResults: []})

Runs the rules engine. Results now include scores for each rule evaluation.

```js
engine
  .run(facts)
  .then(({ events, failureEvents, results, failureResults, almanac }) => {
    // Rule results now include scores
    results.forEach(result => {
      console.log(`Rule: ${result.name}`)
      console.log(`Passed: ${result.result}`)  
      console.log(`Score: ${result.score}`)    // New score property
    })
  })
```

### engine.stop() -> Engine

Stops the rules engine mid-run

```js
engine.stop()
```

#### engine.on('success', Function(Object event, Almanac almanac, RuleResult ruleResult))

```js
// whenever rule successfully fires, the 'success' event will trigger
engine.on('success', function(event, almanac, ruleResult) {
  console.log(event) // rule event
  console.log(ruleResult.score) // rule score (0-1)
})
```

#### engine.on('failure', Function(Object event, Almanac almanac, RuleResult ruleResult))

```js
// whenever rule fails to fire, the 'failure' event will trigger
engine.on('failure', function(event, almanac, ruleResult) {
  console.log(event) // rule event  
  console.log(ruleResult.score) // rule score (0-1)
})
```

## Scoring and Weights

The rule engine supports advanced scoring and weighting for more sophisticated rule evaluation:

### Operator Scoring

Operators now return scores between 0 and 1 instead of boolean values:
- `0` indicates no match
- `1` indicates perfect match  
- Values between 0 and 1 indicate partial matches

This allows for fuzzy matching and more nuanced comparisons.

### Condition Weights

Conditions can be assigned weights to indicate their relative importance:

```js
{
  conditions: {
    all: [{
      fact: 'criticalMetric',
      operator: 'greaterThan',
      value: 10,
      weight: 3  // 3x more important than other conditions
    }, {
      fact: 'normalMetric', 
      operator: 'greaterThan',
      value: 5,
      weight: 1  // Standard weight (default if omitted)
    }]
  }
}
```

### Rule Scores

Rules receive scores based on weighted condition evaluation:

- **`all` conditions**: Returns weighted average of all condition scores
- **`any` conditions**: Returns highest weighted score among conditions  
- **`not` conditions**: Returns inverted score (1 - score)

Access rule scores through the `score` property on `RuleResult`:

```js
engine.run(facts).then(({ results }) => {
  results.forEach(result => {
    console.log(`${result.name}: ${result.score}`)
  })
})
```
