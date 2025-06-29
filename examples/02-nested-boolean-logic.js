'use strict'
/*
 * This example demonstates nested boolean logic - e.g. (x OR y) AND (a OR b).
 *
 * Usage:
 *   node ./examples/02-nested-boolean-logic.js
 *
 * For detailed output:
 *   DEBUG=rule-engine node ./examples/02-nested-boolean-logic.js
 */

require('colors')
const { Engine } = require('@swishhq/rule-engine')

async function start () {
  /**
   * Setup a new engine
   */
  const engine = new Engine()

  // define a rule for detecting the player has exceeded foul limits.  Foul out any player who:
  // (has committed 5 fouls AND game is 40 minutes) OR (has committed 6 fouls AND game is 48 minutes)
  engine.addRule({
    conditions: {
      any: [{
        all: [{
          fact: 'gameDuration',
          operator: 'equal',
          value: 40
        }, {
          fact: 'personalFoulCount',
          operator: 'greaterThanInclusive',
          value: 5
        }],
        name: 'short foul limit'
      }, {
        all: [{
          fact: 'gameDuration',
          operator: 'equal',
          value: 48
        }, {
          not: {
            fact: 'personalFoulCount',
            operator: 'lessThan',
            value: 6
          }
        }],
        name: 'long foul limit'
      }]
    },
    event: { // define the event to fire when the conditions evaluate truthy
      type: 'fouledOut',
      params: {
        message: 'Player has fouled out!'
      }
    }
  })

  /**
   * define the facts
   * note: facts may be loaded asynchronously at runtime; see the advanced example below
   */
  const facts = {
    personalFoulCount: 6,
    gameDuration: 40
  }

  const { events } = await engine.run(facts)

  events.map(event => console.log(event.params.message.red))
}
start()
/*
 * OUTPUT:
 *
 * Player has fouled out!
 */
