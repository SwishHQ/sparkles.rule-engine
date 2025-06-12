
# Rules

Rules contain a set of _conditions_ and a single _event_.  When the engine is run, each rule condition is evaluated.  If the results are truthy, the rule's _event_ is triggered.

* [Methods](#methods)
    * [constructor([Object options|String json])](#constructorobject-optionsstring-json)
    * [setConditions(Array conditions)](#setconditionsarray-conditions)
    * [getConditions() -&gt; Object](#getconditions---object)
    * [setEvent(Object event)](#seteventobject-event)
    * [getEvent() -&gt; Object](#getevent---object)
    * [setPriority(Integer priority = 1)](#setpriorityinteger-priority--1)
    * [getPriority() -&gt; Integer](#getpriority---integer)
    * [toJSON(Boolean stringify = true)](#tojsonboolean-stringify--true)
* [Conditions](#conditions)
    * [Basic conditions](#basic-conditions)
    * [Boolean expressions: all, any, and not](#boolean-expressions-all-any-and-not)
    * [Condition Reference](#condition-reference)
    * [Condition helpers: params](#condition-helpers-params)
    * [Condition helpers: path](#condition-helpers-path)
    * [Condition helpers: custom path resolver](#condition-helpers-custom-path-resolver)
    * [Comparing facts](#comparing-facts)
* [Events](#events)
  * [rule.on('success', Function(Object event, Almanac almanac, RuleResult ruleResult))](#ruleonsuccess-functionobject-event-almanac-almanac-ruleresult-ruleresult)
  * [rule.on('failure', Function(Object event, Almanac almanac, RuleResult ruleResult))](#ruleonfailure-functionobject-event-almanac-almanac-ruleresult-ruleresult)
* [Operators](#operators)
    * [String and Numeric operators:](#string-and-numeric-operators)
    * [Numeric operators:](#numeric-operators)
    * [Array operators:](#array-operators)
* [Operator Decorators](#operator-decorators)
    * [Array decorators:](#array-decorators)
    * [Logical decorators:](#logical-decorators)
    * [Utility decorators:](#utility-decorators)
    * [Decorator composition:](#decorator-composition)
* [Rule Results](#rule-results)
* [Persisting](#persisting)

## Methods

### constructor([Object options|String json])

Returns a new rule instance

```js
let options = {
  conditions: {
    all: [
      {
        fact: 'my-fact',
        operator: 'equal',
        value: 'some-value'
      }
    ]
  },
  event: {
    type: 'my-event',
    params: {
      customProperty: 'customValue'
    }
  },
  name: any,                               // optional
  priority: 1,                             // optional, default: 1
  onSuccess: function (event, almanac) {}, // optional
  onFailure: function (event, almanac) {}, // optional
}
let rule = new Rule(options)
```

**options.conditions** : `[Object]` Rule conditions object

**options.event** : `[Object]` Sets the `.on('success')` and `on('failure')` event argument emitted whenever the rule passes.  Event objects must have a ```type``` property, and an optional ```params``` property.

**options.priority** : `[Number, default 1]` Dictates when rule should be run, relative to other rules.  Higher priority rules are run before lower priority rules.  Rules with the same priority are run in parallel.  Priority must be a positive, non-zero integer.

**options.onSuccess** : `[Function(Object event, Almanac almanac)]` Registers callback with the rule's `on('success')` listener.  The rule's `event` property and the current [Almanac](./almanac.md) are passed as arguments. Any promise returned by the callback will be waited on to resolve before execution continues.

**options.onFailure** : `[Function(Object event, Almanac almanac)]` Registers callback with the rule's `on('failure')` listener.  The rule's `event` property and the current [Almanac](./almanac.md) are passed as arguments. Any promise returned by the callback will be waited on to resolve before execution continues.

**options.name** : `[Any]` A way of naming your rules, allowing them to be easily identifiable in [Rule Results](#rule-results).  This is usually of type `String`, but could also be `Object`, `Array`, or `Number`. Note that the name need not be unique, and that it has no impact on execution of the rule.

### setConditions(Array conditions)

Helper for setting rule conditions. Alternative to passing the `conditions` option to the rule constructor.

### getConditions() -> Object

Retrieves rule condition set by constructor or `setCondition()`

### setEvent(Object event)

Helper for setting rule event.  Alternative to passing the `event` option to the rule constructor.

### getEvent() -> Object

Retrieves rule event set by constructor or `setEvent()`

### setPriority(Integer priority = 1)

Helper for setting rule priority. Alternative to passing the `priority` option to the rule constructor.

### getPriority() -> Integer

Retrieves rule priority set by constructor or `setPriority()`

### toJSON(Boolean stringify = true)

Serializes the rule into a JSON string.  Often used when persisting rules.

```js
let jsonString = rule.toJSON() // string: '{"conditions":{"all":[]},"priority":50 ...

let rule = new Rule(jsonString) // restored rule; same conditions, priority, event

// without stringifying
let jsonObject = rule.toJSON(false) // object: {conditions:{ all: [] }, priority: 50 ...
```

## Conditions

Rule conditions are a combination of facts, operators, and values that determine whether the rule is a `success` or a `failure`.

### Basic conditions

The simplest form of a condition consists of a `fact`, an `operator`, and a `value`.  When the engine runs, the operator is used to compare the fact against the value.

```js
// my-fact <= 1
let rule = new Rule({
  conditions: {
    all: [
      {
        fact: 'my-fact',
        operator: 'lessThanInclusive',
        value: 1
      }
    ]
  }
})
```

### Condition weights and scoring

Conditions now support optional `weight` and `priority` properties for advanced scoring:

```js
let rule = new Rule({
  conditions: {
    all: [
      {
        fact: 'performance-score',
        operator: 'greaterThan',
        value: 0.8,
        weight: 3,     // This condition is 3x more important
        priority: 10   // Higher priority conditions are evaluated first
      },
      {
        fact: 'attendance-score',
        operator: 'greaterThan',
        value: 0.9,
        weight: 1      // Normal weight (default)
      }
    ]
  }
})
```

**weight** : `[Number, default 1]` Indicates the relative importance of this condition in scoring calculations. Higher weights make the condition contribute more to the final rule score.

**priority** : `[Number, default 1 or fact priority]` Determines evaluation order. Higher priority conditions are evaluated first. If not specified, uses the fact's priority.

See the [hello-world](../examples/01-hello-world.js) and [scoring-and-weights](../examples/14-scoring-and-weights.js) examples.

### Boolean expressions: `all`, `any`, and `not`

Each rule's conditions *must* have an `all` or `any` operator containing an array of conditions at its root, a `not` operator containing a single condition, or a condition reference. The `all` operator specifies that all conditions contained within must be truthy for the rule to be considered a `success`.  The `any` operator only requires one condition to be truthy for the rule to succeed. The `not` operator will negate whatever condition it contains.

#### Scoring with boolean expressions

Boolean expressions now use weighted scoring instead of short-circuiting:

- **`all`** - Uses weighted average scoring. All conditions are evaluated and their scores are combined using their weights. Higher-weighted conditions contribute more to the final score.

- **`any`** - Uses weighted maximum scoring. All conditions are evaluated and the highest weighted score determines the result.

- **`not`** - Inverts the score of its condition. A score >= 1 becomes 0, and a score < 1 becomes 1.

```js
// all:
let rule = new Rule({
  conditions: {
    all: [
      { /* condition 1 */ },
      { /* condition 2 */ },
      { /* condition n */ },
    ]
  }
})

// any:
let rule = new Rule({
  conditions: {
    any: [
      { /* condition 1 */ },
      { /* condition 2 */ },
      { /* condition n */ },
      {
        not: {
          all: [ /* more conditions */ ]
        }
      }
    ]
  }
})

// not:
let rule = new Rule({
  conditions: {
    not: { /* condition */ }
  }
})
```

Notice in the second example how `all`, `any`, and `not` can be nested within one another to produce complex boolean expressions.  See the [nested-boolean-logic](../examples/02-nested-boolean-logic.js) example.

### Condition Reference

Rules may reference conditions based on their name.

```js
let rule = new Rule({
  conditions: {
    all: [
      { condition: 'conditionName' },
      { /* additional condition */ }
    ]
  }
})
```

Before running the rule the condition should be added to the engine.

```js
engine.setCondition('conditionName', { /* conditions */ });
```

Conditions must start with `all`, `any`, `not`, or reference a condition.

### Condition helpers: `params`

Sometimes facts require additional input to perform calculations.  For this, the `params` property is passed as an argument to the fact handler.  `params` essentially functions as fact arguments, enabling fact handlers to be more generic and reusable.

```js
// product-price retrieves any product's price based on the "productId" in "params"
engine.addFact('product-price', function (params, almanac) {
  return productLoader(params.productId) // loads the "widget" product
    .then(product => product.price)
})

// identifies whether the current widget price is above $100
let rule = new Rule({
  conditions: {
    all: [
      {
        fact: 'product-price',
        params: {
          productId: 'widget' // specifies which product to load
        },
        operator: 'greaterThan',
        value: 100
      }
    ]
  }
})
```

See the [dynamic-facts](../examples/03-dynamic-facts) example

### Condition helpers: `path`

In the `params` example above, the dynamic fact handler loads an object, then returns a specific object property. For more complex data structures, writing a separate fact handler for each object property quickly becomes verbose and unwieldy.

To address this, a `path` property may be provided to traverse fact data using [json-path](https://goessner.net/articles/JsonPath/) syntax. The example above becomes simpler, and only one fact handler must be written:

```js

// product-price retrieves any product's price based on the "productId" in "params"
engine.addFact('product-price', function (params, almanac) {
  // NOTE: `then` is not required; .price is specified via "path" below
  return productLoader(params.productId)
})

// identifies whether the current widget price is above $100
let rule = new Rule({
  conditions: {
    all: [
      {
        fact: 'product-price',
        path: '$.price',
        params: {
          productId: 'widget'
        },
        operator: 'greaterThan',
        value: 100
      }
    ]
  }
})
```

json-path support is provided by [jsonpath-plus](https://github.com/s3u/JSONPath)

For an example, see [fact-dependency](../examples/04-fact-dependency.js)

### Condition helpers: custom `path` resolver

To use a custom path resolver instead of the `json-path` default, a `pathResolver` callback option may be passed to the engine. The callback will be invoked during execution when a `path` property is encountered.

```js
const { get } = require('lodash') // to use the lodash path resolver, for example

function pathResolver (object, path) {
  // when the rule below is evaluated:
  //   "object" will be the 'fact1' value
  //   "path" will be '.price[0]'
  return get(object, path)
}
const engine = new Engine(rules, { pathResolver })
engine.addRule(new Rule({
  conditions: {
    all: [
      {
        fact: 'fact1',
        path: '.price[0]', // uses lodash path syntax
        operator: 'equal',
        value: 1
      }
    ]
  })
)
```

This feature may be useful in cases where the higher performance offered by simpler object traversal DSLs are preferable to the advanced expressions provided by `json-path`. It can also be useful for leveraging more complex DSLs ([jsonata](https://jsonata.org/), for example) that offer more advanced capabilities than `json-path`.

### Comparing facts

Sometimes it is necessary to compare facts against other facts.  This can be accomplished by nesting the second fact within the `value` property.  This second fact has access to the same `params` and `path` helpers as the primary fact.

```js
// identifies whether the current widget price is above a maximum
let rule = new Rule({
  conditions: {
    all: [
      // widget-price > budget
      {
        fact: 'product-price',
        params: {
          productId: 'widget',
          path: '$.price'
        },
        operator: 'greaterThan',
        // "value" contains a fact
        value: {
          fact: 'budget' // "params" and "path" helpers are available as well
        }
      }
    ]
  }
})
```
See the [fact-comparison](../examples/08-fact-comparison.js) example

## Events

Listen for `success` and `failure` events emitted when rule is evaluated.

#### ```rule.on('success', Function(Object event, Almanac almanac, RuleResult ruleResult))```

The callback will receive the event object, the current [Almanac](./almanac.md), and the [Rule Result](./rules.md#rule-results).

```js
// whenever rule is evaluated and the conditions pass, 'success' will trigger
rule.on('success', function(event, almanac, ruleResult) {
  console.log(event) // { type: 'my-event', params: { id: 1 }
})
```

#### ```rule.on('failure', Function(Object event, Almanac almanac, RuleResult ruleResult))```

Companion to `success`, except fires when the rule fails.  The callback will receive the event object, the current [Almanac](./almanac.md), and the [Rule Result](./rules.md#rule-results).

```js
engine.on('failure', function(event, almanac, ruleResult) {
  console.log(event) // { type: 'my-event', params: { id: 1 }
})
```

### Referencing Facts In Events

With the engine option [`replaceFactsInEventParams`](./engine.md#options) the parameters of the event may include references to facts in the same form as [Comparing Facts](#comparing-facts). These references will be replaced with the value of the fact before the event is emitted.

```js
const engine = new Engine([], { replaceFactsInEventParams: true });
engine.addRule({
    conditions: { /* ... */ },
    event: {
      type: "gameover",
      params: {
        initials: {
          fact: "currentHighScore",
          path: "$.initials",
          params: { foo: 'bar' }
        }
      }
    }
  })
```

See [11-using-facts-in-events.js](../examples/11-using-facts-in-events.js) for a complete example.

## Operators

Each rule condition must begin with a boolean operator(```all```, ```any```, or ```not```) at its root.

The ```operator``` compares the value returned by the ```fact``` to what is stored in the ```value``` property. Operators now return scores (0-1) instead of boolean values, where 1 indicates a perfect match and values closer to 0 indicate poorer matches. A condition is considered to "pass" when its score is >= 1.0.

### String and Numeric operators:

  ```equal``` - _fact_ must equal _value_

  ```notEqual```  - _fact_ must not equal _value_

  _these operators use strict equality (===) and inequality (!==)_

### Numeric operators:

  ```lessThan``` - _fact_ must be less than _value_

  ```lessThanInclusive```- _fact_ must be less than or equal to _value_

  ```greaterThan``` - _fact_ must be greater than _value_

  ```greaterThanInclusive```- _fact_ must be greater than or equal to _value_

### Array operators:

  ```in```  - _fact_ must be included in _value_ (an array)

  ```notIn```  - _fact_ must not be included in _value_ (an array)

  ```contains```  - _fact_ (an array) must include _value_

  ```doesNotContain```  - _fact_ (an array) must not include _value_

## Operator Decorators

Operator Decorators modify the behavior of an operator either by changing the input or the output. To specify one or more decorators prefix the name of the operator with them in the ```operator``` field and use the colon (```:```) symbol to separate decorators and the operator. For instance ```everyFact:greaterThan``` will produce an operator that checks that every element of the _fact_ is greater than the value.

See [12-using-operator-decorators.js](../examples/13-using-operator-decorators.js) for an example.

### Array Decorators:

  ```everyFact``` - _fact_ (an array) must have every element pass the decorated operator for _value_

  ```everyValue``` - _fact_ must pass the decorated operator for every element of _value_ (an array)

  ```someFact``` - _fact_ (an array) must have at-least one element pass the decorated operator for _value_

  ```someValue``` - _fact_ must pass the decorated operator for at-least one element of _value_ (an array)

### Logical Decorators

  ```not``` - negate the result of the decorated operator

### Utility Decorators
  ```swap``` - Swap _fact_ and _value_ for the decorated operator

### Decorator Composition

Operator Decorators can be composed by chaining them together with the colon to separate them. For example if you wanted to ensure that every number in an array was less than every number in another array you could use ```everyFact:everyValue:lessThan```.

```swap``` and ```not``` are useful when there are not symmetric or negated versions of custom operators, for instance you could check if a _value_ does not start with a letter contained in a _fact_ using the decorated custom operator ```swap:not:startsWithLetter```. This allows a single custom operator to have 4 permutations.

## Rule Results

After a rule is evaluated, a `rule result` object is provided to the `success` and `failure` events.  This argument is similar to a regular rule, and contains additional metadata about how the rule was evaluated.  Rule results can be used to extract the results of individual conditions, computed fact values, boolean logic results, and scoring information.  `name` can be used to easily identify a given rule.

Rule results are structured similar to rules, with additional pieces of metadata sprinkled throughout: `result`, `score`, and `factResult`
```js
{
  result: false,                    // denotes whether rule computed truthy or falsey
  score: 0.73,                      // denotes the weighted score (0-1) of the rule evaluation
  conditions: {
    all: [
      {
        fact: 'my-fact',
        operator: 'equal',
        value: 'some-value',
        result: false,             // denotes whether condition computed truthy or falsey
        score: 0.0,                // denotes the score (0-1) of this specific condition
        factResult: 'other-value'  // denotes what 'my-fact' was computed to be
      }
    ]
  },
  event: {
    type: 'my-event',
    params: {
      customProperty: 'customValue'
    }
  },
  priority: 1,
  name: 'someName'
}
```

The `score` property indicates how well the rule matched, with 1.0 being a perfect match and 0.0 being no match. Rules with `score >= 1.0` are considered successful (`result: true`), while rules with `score < 1.0` are considered failures (`result: false`).

A demonstration can be found in the [rule-results](../examples/09-rule-results.js) example.

## Persisting

Rules may be easily converted to JSON and persisted to a database, file system, or elsewhere.  To convert a rule to JSON, simply call the ```rule.toJSON()``` method.  Later, a rule may be restored by feeding the json into the Rule constructor.

```js
// save somewhere...
let jsonString = rule.toJSON()

// ...later:
let rule = new Rule(jsonString)
```

_Why aren't "fact" methods persistable?_  This is by design, for several reasons.  Firstly, facts are by definition business logic bespoke to your application, and therefore lie outside the scope of this library.  Secondly, many times this request indicates a design smell; try thinking of other ways to compose the rules and facts to accomplish the same objective. Finally, persisting fact methods would involve serializing javascript code, and restoring it later via ``eval()``.
