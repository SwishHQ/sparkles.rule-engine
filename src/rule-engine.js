import Engine from './engine'
import Fact from './fact'
import Rule from './rule'
import Operator from './operator'
import Almanac from './almanac'
import OperatorDecorator from './operator-decorator'
import ValidateEngine from './validate-engine'
export { Fact, Rule, Operator, Engine, Almanac, OperatorDecorator, ValidateEngine }
export default function (rules, options) {
  return new Engine(rules, options)
}
