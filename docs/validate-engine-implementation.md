# 🎯 ValidateEngine Implementation Summary

This document describes the current ValidateEngine as implemented in `src/validate-engine.js`. It focuses on what the engine does today, its public API surface, result shapes, and key implementation details.

## ✅ Core Files

- `src/validate-engine.js` — ValidateEngine implementation (extends `Engine`)
- `src/rule-engine.js` — Exports `Engine`, `ValidateEngine`, `Rule`, etc.

Import examples:

```javascript
// From the package
const { ValidateEngine, Rule } = require('@swishhq/rule-engine')

// From source (monorepo/local)
const { ValidateEngine, Rule } = require('./src/rule-engine')
```

## 🧩 Public API (current)

- `findSatisfiedRules(facts: Record<string, any>, focusedFactId?: string): Promise<FindSatisfiedRulesResult>`
- `findPartiallySatisfiedRules(factId: string, factValue: any, contextFacts?: Record<string, any>): Promise<FactCentricResult>`
- `findPartiallySatisfiedRulesFromContext(contextFacts: Record<string, any>): Promise<ContextCentricResult>`
- `registerDefaultValueProvider(operator: string, provider: (threshold: any, condition: object) => any): void`
- `unregisterDefaultValueProvider(operator: string): void`

> Note: Earlier drafts mentioned methods like `validateFact`, `validateFacts`, `validateCondition`, `validateRule`, `validateObjectWithConditions`, and history helpers. Those are not part of the current `ValidateEngine` class. The supported API is listed above.

## 🧠 Behavior Overview

ValidateEngine evaluates rules against provided facts and classifies each rule into one of four categories:

- fully_satisfied — All conditions satisfied by the provided facts
- partially_satisfied — Some provided facts are used, additional facts are missing; if those missing facts are supplied with satisfying defaults, the rule would pass
- independent — Rule does not depend on any of the provided facts (or on the `focusedFactId` when provided). These are considered satisfied in the context of the query
- unsatisfied — All required facts are available, but conditions do not match

Independence is computed differently depending on the mode:

- Context mode (`findSatisfiedRules(facts)`): independent if the rule does not use any provided fact keys
- Focused fact mode (`findSatisfiedRules(facts, focusedFactId)`): independent if the rule does not use the focused fact

## 📦 Results

### `findSatisfiedRules`

Returns:

```ts
type FindSatisfiedRulesResult = {
  facts: Record<string, any>
  timestamp: string
  fullySatisfiedRules: Array<RuleSummary>
  partiallySatisfiedRules: Array<RuleSummary & { missingFacts: Record<string, any> }>
  independentRules: Array<RuleSummary>
  unsatisfiedRules: Array<RuleSummary>
  summary: {
    totalRules: number
    fullySatisfied: number
    partiallySatisfied: number
    independent: number
    totalSatisfied: number
    unsatisfied: number
    satisfactionRate: number
  }
}

type RuleSummary = {
  name: string
  priority: number
  score: number
  event: any
  satisfactionType: 'fully_satisfied' | 'partially_satisfied' | 'independent' | 'unsatisfied'
  reason: string
}
```

### `findPartiallySatisfiedRules`

Focused on a single fact plus optional context facts. Wraps `findSatisfiedRules` and returns a grouped structure:

```ts
type FactCentricResult = {
  factId: string
  factValue: any
  contextFacts: Record<string, any>
  timestamp: string
  summary: FindSatisfiedRulesResult['summary']
  rules: {
    partiallySatisfied: FindSatisfiedRulesResult['partiallySatisfiedRules']
    independent: FindSatisfiedRulesResult['independentRules']
    fullySatisfied: FindSatisfiedRulesResult['fullySatisfiedRules']
    unsatisfied: FindSatisfiedRulesResult['unsatisfiedRules']
  }
}
```

### `findPartiallySatisfiedRulesFromContext`

Context-only variant (no focused fact), with identical `rules` grouping as above.

## 🔍 How classification works (implementation highlights)

- `_conditionUsesFact(condition, factId)` — Recursively determines if a condition tree references a fact
- `_hasConditions(condition)` — Detects whether a rule contains any real conditions
- `_extractFactsFromCondition(condition)` — Extracts required fact keys and proposes satisfying default values
- `_getDefaultValueForCondition(condition)` — Obtains a default value via a registered provider or built‑in heuristics
- `_createTemporaryEngine(rules, { allowUndefinedFacts })` — Clones operators and default value providers onto a temporary engine to safely evaluate with different undefined‑fact policies

Evaluation strategy:

1. For rules that use provided facts but are missing others, attempt a run with `allowUndefinedFacts: true`.
2. If it fails, synthesize `completeFacts = {...facts, ...missingFacts}` and re‑evaluate with `allowUndefinedFacts: false`.
   - If it passes → classify as `partially_satisfied` and include `missingFacts`.
   - If it still fails → classify as `unsatisfied`.
3. Rules that do not use any provided facts (or the focused fact) are classified as `independent`.
4. Rules without conditions are also `independent` and considered satisfied.

## 🧰 Default value providers

You can customize how “satisfying defaults” are generated per operator:

```javascript
engine.registerDefaultValueProvider('greaterThan', (threshold, condition) => threshold + 1)
engine.unregisterDefaultValueProvider('greaterThan')
```

Built‑in defaults exist for common operators like `equal`, `notEqual`, `greaterThan`, `lessThan`, `greaterThanInclusive`, `lessThanInclusive`, `in`, `contains`, `includes`, and simple time comparisons.

## 📎 Notes

- `ValidateEngine` does not mutate the base `Engine` state when performing exploratory evaluations; it uses temporary engines instead.
- Independent rules are counted toward `totalSatisfied` in the summary.
- The full usage guide, with examples, lives in `docs/validate-engine.md`.

---

This reflects the current, production‑ready surface area of `ValidateEngine` and how it classifies rules into fully_satisfied, partially_satisfied, independent, and unsatisfied.