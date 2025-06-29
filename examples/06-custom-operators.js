'use strict'
/*
 * This example demonstrates using custom operators.
 *
 * A custom operator is created for detecting whether the word starts with a particular letter,
 * and a 'word' fact is defined for providing the test string
 *
 * In this example, Facts are passed to run() as constants known at runtime.  For a more
 * complex example demonstrating asynchronously computed facts, see the fact-dependency example.
 *
 * Usage:
 *   node ./examples/06-custom-operators.js
 *
 * For detailed output:
 *   DEBUG=rule-engine node ./examples/06-custom-operators.js
 */

require('colors')
const { Engine } = require('@swishhq/rule-engine')

async function start () {
  /**
   * Setup a new engine
   */
  const engine = new Engine()

  /**
   * Define a 'startsWith' custom operator, for use in later rules
   */
  engine.addOperator('startsWith', (factValue, jsonValue) => {
    if (!factValue.length) return false
    return factValue[0].toLowerCase() === jsonValue.toLowerCase()
  })

  /**
   * Add rule for detecting words that start with 'a'
   */
  const ruleA = {
    conditions: {
      all: [{
        fact: 'word',
        operator: 'startsWith',
        value: 'a'
      }]
    },
    event: {
      type: 'start-with-a'
    }
  }
  engine.addRule(ruleA)

  /*
  * Add rule for detecting words that start with 'b'
  */
  const ruleB = {
    conditions: {
      all: [{
        fact: 'word',
        operator: 'startsWith',
        value: 'b'
      }]
    },
    event: {
      type: 'start-with-b'
    }
  }
  engine.addRule(ruleB)

  // utility for printing output
  const printEventType = {
    'start-with-a': 'start with "a"',
    'start-with-b': 'start with "b"'
  }

  /**
   * Register listeners with the engine for rule success and failure
   */
  let facts
  engine
    .on('success', event => {
      console.log(facts.word + ' DID '.green + printEventType[event.type])
    })
    .on('failure', event => {
      console.log(facts.word + ' did ' + 'NOT'.red + ' ' + printEventType[event.type])
    })

  /**
   * Each run() of the engine executes on an independent set of facts.  We'll run twice, once per word
   */

  // first run, using 'bacon'
  facts = { word: 'bacon' }
  await engine.run(facts)

  // second run, using 'antelope'
  facts = { word: 'antelope' }
  await engine.run(facts)
}
start()

/*
 * OUTPUT:
 *
 * bacon did NOT start with "a"
 * bacon DID start with "b"
 * antelope DID start with "a"
 * antelope did NOT start with "b"
 */
