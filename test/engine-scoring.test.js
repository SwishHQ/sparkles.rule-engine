'use strict'

/**
 * Tests for the new scoring and weighting system in the rule engine.
 *
 * This test suite covers:
 * - Custom operators that return scores (0-1) instead of boolean values
 * - Default operators that now return scores based on how well conditions match
 * - Condition weights that affect scoring calculations
 * - 'all' conditions using weighted average scoring
 * - 'any' conditions using weighted maximum scoring
 * - 'not' conditions that invert scores
 * - Rule results that include both boolean result and numeric score
 */

import sinon from 'sinon'
import engineFactory from '../src/index'

describe('Engine Scoring', () => {
  let engine
  let sandbox

  before(() => {
    sandbox = sinon.createSandbox()
  })

  afterEach(() => {
    sandbox.restore()
  })

  beforeEach(() => {
    engine = engineFactory()
  })

  describe('operator scoring', () => {
    it('custom operators return scores between 0 and 1', async () => {
      engine.addOperator('similarTo', (factValue, jsonValue) => {
        if (typeof factValue !== 'string' || typeof jsonValue !== 'string') return 0

        // Simple similarity scoring
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

      const rule = {
        name: 'similarity-test',
        conditions: {
          all: [{
            fact: 'testString',
            operator: 'similarTo',
            value: 'hello'
          }]
        },
        event: {
          type: 'similarity-match'
        }
      }

      engine.addRule(rule)

      // Perfect match should score 1.0
      const result1 = await engine.run({ testString: 'hello' })
      expect(result1.results[0].score).to.equal(1.0)
      expect(result1.results[0].result).to.be.true()

      // Partial match should score between 0 and 1
      const result2 = await engine.run({ testString: 'help' })
      expect(result2.failureResults[0].score).to.be.above(0)
      expect(result2.failureResults[0].score).to.be.below(1)
      expect(result2.failureResults[0].result).to.be.false() // < 1.0 means false

      // No match should score 0
      const result3 = await engine.run({ testString: 'xyz' })
      expect(result3.failureResults[0].score).to.equal(0)
      expect(result3.failureResults[0].result).to.be.false()
    })

    it('default operators return scores', async () => {
      const rule = {
        name: 'numeric-test',
        conditions: {
          all: [{
            fact: 'score',
            operator: 'greaterThan',
            value: 80
          }]
        },
        event: {
          type: 'high-score'
        }
      }

      engine.addRule(rule)

      // Score much higher than threshold
      const result1 = await engine.run({ score: 100 })
      expect(result1.results[0].score).to.be.above(0.9)
      expect(result1.results[0].result).to.be.true()

      // Score slightly higher than threshold
      const result2 = await engine.run({ score: 81 })
      expect(result2.results[0].score).to.be.above(0.3)
      expect(result2.results[0].score).to.be.at.most(1)
      expect(result2.results[0].result).to.be.true()

      // Score exactly at threshold - should still have high score but fail the rule
      const result3 = await engine.run({ score: 80 })
      expect(result3.failureResults[0].score).to.be.above(0.9) // greaterThan 80 vs 80 is close
      expect(result3.failureResults[0].result).to.be.false()
    })
  })

  describe('condition weights', () => {
    it('weights affect all condition scoring', async () => {
      const rule = {
        name: 'weighted-all-test',
        conditions: {
          all: [{
            fact: 'performance',
            operator: 'equal',
            value: 100,
            weight: 3 // 3x weight
          }, {
            fact: 'attendance',
            operator: 'equal',
            value: 100,
            weight: 1 // 1x weight
          }]
        },
        event: {
          type: 'promotion-eligible'
        }
      }

      engine.addRule(rule)

      // Both conditions perfect - should score 1.0
      const result1 = await engine.run({ performance: 100, attendance: 100 })
      expect(result1.results[0].score).to.equal(1.0)

      // High performance, no attendance - weighted average should favor performance
      const result2 = await engine.run({ performance: 100, attendance: 0 })
      expect(result2.failureResults[0].score).to.equal(0.75) // (3*1 + 1*0) / (3+1) = 0.75

      // No performance, high attendance - weighted average should favor performance
      const result3 = await engine.run({ performance: 0, attendance: 100 })
      expect(result3.failureResults[0].score).to.equal(0.25) // (3*0 + 1*1) / (3+1) = 0.25
    })

    it('weights affect any condition scoring', async () => {
      const rule = {
        name: 'weighted-any-test',
        conditions: {
          any: [{
            fact: 'skill1',
            operator: 'equal',
            value: 'expert',
            weight: 2
          }, {
            fact: 'skill2',
            operator: 'equal',
            value: 'expert',
            weight: 1
          }]
        },
        event: {
          type: 'qualified'
        }
      }

      engine.addRule(rule)

      // High weighted skill matches
      const result1 = await engine.run({ skill1: 'expert', skill2: 'novice' })
      expect(result1.results[0].score).to.equal(1.0) // Max weighted score = (1 * 2) / 2 = 1.0

      // Low weighted skill matches
      const result2 = await engine.run({ skill1: 'novice', skill2: 'expert' })
      expect(result2.results[0].score).to.equal(1.0) // Max weighted score = (1 * 1) / 1 = 1.0

      // Both skills match - should still be 1.0
      const result3 = await engine.run({ skill1: 'expert', skill2: 'expert' })
      expect(result3.results[0].score).to.equal(1.0)
    })

    it('conditions without weights default to weight 1', async () => {
      const rule = {
        name: 'default-weight-test',
        conditions: {
          all: [{
            fact: 'score1',
            operator: 'equal',
            value: 100
            // no weight specified - should default to 1
          }, {
            fact: 'score2',
            operator: 'equal',
            value: 100,
            weight: 1 // explicit weight 1
          }]
        },
        event: {
          type: 'equal-weights'
        }
      }

      engine.addRule(rule)

      // Half conditions met - should be 0.5 with equal weights
      const result = await engine.run({ score1: 100, score2: 0 })
      expect(result.failureResults[0].score).to.equal(0.5)
    })
  })

  describe('not operator scoring', () => {
    it('inverts condition scores', async () => {
      const rule = {
        name: 'not-test',
        conditions: {
          not: {
            fact: 'blocked',
            operator: 'equal',
            value: true
          }
        },
        event: {
          type: 'allowed'
        }
      }

      engine.addRule(rule)

      // Condition fails (blocked=true) -> not inverts to score=0
      const result1 = await engine.run({ blocked: true })
      expect(result1.failureResults[0].score).to.equal(0)
      expect(result1.failureResults[0].result).to.be.false()

      // Condition passes (blocked=false) -> not inverts to score=1
      const result2 = await engine.run({ blocked: false })
      expect(result2.results[0].score).to.equal(1)
      expect(result2.results[0].result).to.be.true()
    })
  })

  describe('rule result scoring', () => {
    it('includes score in rule results', async () => {
      const rule = {
        name: 'score-result-test',
        conditions: {
          all: [{
            fact: 'value',
            operator: 'equal',
            value: 50
          }]
        },
        event: {
          type: 'test-event'
        }
      }

      engine.addRule(rule)
      const result = await engine.run({ value: 50 })

      expect(result.results[0]).to.have.property('score')
      expect(result.results[0].score).to.be.a('number')
      expect(result.results[0].score).to.be.at.least(0)
      expect(result.results[0].score).to.be.at.most(1)
    })

    it('includes score in failure results', async () => {
      const rule = {
        name: 'failure-score-test',
        conditions: {
          all: [{
            fact: 'value',
            operator: 'equal',
            value: 100
          }]
        },
        event: {
          type: 'test-event'
        }
      }

      engine.addRule(rule)
      const result = await engine.run({ value: 50 })

      expect(result.failureResults[0]).to.have.property('score')
      expect(result.failureResults[0].score).to.be.a('number')
      expect(result.failureResults[0].score).to.equal(0)
    })
  })
})
