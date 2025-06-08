'use strict'
/*
 * This example demonstrates the new scoring and weights functionality
 *
 * Usage:
 *   node ./examples/14-scoring-and-weights.js
 *
 * For detailed output:
 *   DEBUG=rule-engine node ./examples/14-scoring-and-weights.js
 */

require('colors')
const { Engine } = require('@swishhq/rule-engine')

async function start () {
  /**
     * Setup a new engine
     */
  const engine = new Engine()

  /**
     * Create a custom scoring operator for similarity matching
     * This operator returns a score between 0 and 1 based on string similarity
     */
  engine.addOperator('similarTo', (factValue, jsonValue) => {
    if (typeof factValue !== 'string' || typeof jsonValue !== 'string') return 0

    // Simple similarity based on common characters
    const maxLength = Math.max(factValue.length, jsonValue.length)
    if (maxLength === 0) return 1

    let matches = 0
    const minLength = Math.min(factValue.length, jsonValue.length)

    for (let i = 0; i < minLength; i++) {
      if (factValue[i].toLowerCase() === jsonValue[i].toLowerCase()) {
        matches++
      }
    }

    return matches / maxLength
  })

  /**
     * Rule for employee evaluation with weighted conditions
     * This demonstrates how different criteria can have different importance levels
     *
     * Scoring mechanics for 'all' conditions:
     * - Each condition gets a score (0-1) from its operator
     * - Final score = weighted average of all condition scores
     * - Formula: (score1*weight1 + score2*weight2 + ...) / (weight1 + weight2 + ...)
     * - Rule passes (result: true) only if final score >= 1.0
     */
  engine.addRule({
    name: 'employee-promotion-candidate',
    conditions: {
      all: [{
        fact: 'performanceRating',
        operator: 'greaterThanInclusive',
        value: 4.0,
        weight: 3 // Performance is 3x more important than attendance
      }, {
        fact: 'attendanceScore',
        operator: 'greaterThanInclusive',
        value: 0.85,
        weight: 1 // Standard weight
      }, {
        fact: 'teamworkRating',
        operator: 'greaterThanInclusive',
        value: 3.5,
        weight: 2 // Teamwork is 2x more important than attendance
      }]
    },
    event: {
      type: 'promotion-eligible',
      params: {
        level: 'senior',
        message: 'Employee is eligible for promotion'
      }
    }
  })

  /**
     * Rule demonstrating fuzzy matching with scoring
     *
     * Scoring mechanics for 'any' conditions:
     * - Each condition gets a score (0-1) from its operator
     * - Final score = highest weighted score among all conditions
     * - Formula: max(score1*weight1, score2*weight2, ...) / max_weight
     * - Rule passes (result: true) only if final score >= 1.0
     */
  engine.addRule({
    name: 'skill-match',
    conditions: {
      any: [{
        fact: 'primarySkill',
        operator: 'similarTo',
        value: 'javascript',
        weight: 2
      }, {
        fact: 'secondarySkill',
        operator: 'similarTo',
        value: 'python',
        weight: 1
      }]
    },
    event: {
      type: 'skill-matched',
      params: {
        message: 'Skills match job requirements'
      }
    }
  })

  /**
     * Define facts for different employee scenarios
     */
  const employees = [
    {
      name: 'Alice',
      performanceRating: 4.5,
      attendanceScore: 0.95,
      teamworkRating: 4.0,
      primarySkill: 'javascript',
      secondarySkill: 'react'
    },
    {
      name: 'Bob',
      performanceRating: 3.8,
      attendanceScore: 0.88,
      teamworkRating: 3.2,
      primarySkill: 'javescript', // deliberate typo to test similarity
      secondarySkill: 'python'
    },
    {
      name: 'Carol',
      performanceRating: 4.2,
      attendanceScore: 0.75, // low attendance
      teamworkRating: 4.5,
      primarySkill: 'typescript',
      secondarySkill: 'node'
    }
  ]

  console.log('Employee Evaluation Results:\n'.cyan.bold)

  for (const employee of employees) {
    console.log(`${employee.name}:`.yellow.bold)

    const { results, failureResults } = await engine.run(employee)

    // Show successful results
    results.forEach(result => {
      console.log(`  Rule: ${result.name}`)
      console.log(`  Passed: ${result.result ? 'YES'.green : 'NO'.red}`)
      console.log(`  Score: ${result.score.toFixed(3)}`.blue)

      if (result.result) {
        console.log(`  Event: ${result.event.type}`.green)
        console.log(`  Message: ${result.event.params.message}`.green)
      }
      console.log()
    })

    // Show failed results
    failureResults.forEach(result => {
      console.log(`  Rule: ${result.name}`)
      console.log(`  Passed: ${result.result ? 'YES'.green : 'NO'.red}`)
      console.log(`  Score: ${result.score.toFixed(3)}`.blue)
      console.log()
    })

    console.log('---'.gray)
  }
}

start()

/*
 * Expected Output:
 *
 * Employee Evaluation Results:
 *
 * Alice:
 *   Rule: employee-promotion-candidate
 *   Passed: YES
 *   Score: 1.000
 *   Event: promotion-eligible
 *   Message: Employee is eligible for promotion
 *
 *   Rule: skill-match
 *   Passed: YES
 *   Score: 1.000
 *   Event: skill-matched
 *   Message: Skills match job requirements
 *
 * Bob:
 *   Rule: employee-promotion-candidate
 *   Passed: NO
 *   Score: 0.823
 *
 *   Rule: skill-match
 *   Passed: NO
 *   Score: 0.900
 *
 * Carol:
 *   Rule: employee-promotion-candidate
 *   Passed: NO
 *   Score: 0.984
 *
 *   Rule: skill-match
 *   Passed: NO
 *   Score: 0.600
 */
