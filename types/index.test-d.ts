import { expectType } from "tsd";

import rulesEngine, {
  Almanac,
  EngineResult,
  Engine,
  Event,
  Fact,
  Operator,
  OperatorEvaluator,
  OperatorDecorator,
  OperatorDecoratorEvaluator,
  PathResolver,
  Rule,
  RuleProperties,
  RuleResult,
  RuleSerializable,
  TopLevelConditionResult,
  AnyConditionsResult,
  AllConditionsResult,
  NotConditionsResult,
  RuleSatisfactionResult
} from "../";

// setup basic fixture data
const ruleProps: RuleProperties = {
  conditions: {
    all: []
  },
  event: {
    type: "message"
  }
};

const complexRuleProps: RuleProperties = {
  conditions: {
    all: [
      {
        any: [
          {
            all: []
          },
          {
            fact: "foo",
            operator: "equal",
            value: "bar"
          }
        ]
      }
    ]
  },
  event: {
    type: "message"
  }
};

// path resolver
const pathResolver = function (value: object, path: string): any { }
expectType<PathResolver>(pathResolver)

// default export test
expectType<Engine>(rulesEngine([ruleProps]));
const engine = rulesEngine([complexRuleProps]);

// Rule tests
const rule: Rule = new Rule(ruleProps);
const ruleFromString: Rule = new Rule(JSON.stringify(ruleProps));
expectType<Engine>(engine.addRule(rule));
expectType<boolean>(engine.removeRule(ruleFromString));
expectType<void>(engine.updateRule(ruleFromString));

expectType<Rule>(rule.setConditions({ any: [] }));
expectType<Rule>(rule.setEvent({ type: "test" }));
expectType<Rule>(rule.setPriority(1));
expectType<string>(rule.toJSON());
expectType<string>(rule.toJSON(true));
expectType<RuleSerializable>(rule.toJSON(false));

// Operator tests
const operatorEvaluator: OperatorEvaluator<number, number> = (
  a: number,
  b: number
) => a === b ? 1 : 0;
expectType<void>(
  engine.addOperator("test", operatorEvaluator)
);
const operator: Operator = new Operator(
  "test",
  operatorEvaluator,
  (num: number) => num > 0
);
expectType<void>(engine.addOperator(operator));
expectType<boolean>(engine.removeOperator(operator));

// Operator Decorator tests
const operatorDecoratorEvaluator: OperatorDecoratorEvaluator<number[], number, number, number> = (
  a: number[],
  b: number,
  next: OperatorEvaluator<number, number>
) => next(a[0], b);
expectType<void>(
  engine.addOperatorDecorator("first", operatorDecoratorEvaluator)
);
const operatorDecorator: OperatorDecorator = new OperatorDecorator(
  "first",
  operatorDecoratorEvaluator,
  (a: number[]) => a.length > 0
);
expectType<void>(engine.addOperatorDecorator(operatorDecorator));
expectType<boolean>(engine.removeOperatorDecorator(operatorDecorator));

// Fact tests
const fact = new Fact<number>("test-fact", 3);
const dynamicFact = new Fact<number[]>("test-fact", () => [42]);
expectType<Engine>(
  engine.addFact<string>("test-fact", "value", { priority: 10 })
);
expectType<Engine>(engine.addFact(fact));
expectType<Engine>(engine.addFact(dynamicFact));
expectType<boolean>(engine.removeFact(fact));
expectType<Fact<string>>(engine.getFact<string>("test"));
engine.on('success', (event, almanac, ruleResult) => {
  expectType<Event>(event)
  expectType<Almanac>(almanac)
  expectType<RuleResult>(ruleResult)
})
engine.on<{ foo: Array<string> }>('foo', (event, almanac, ruleResult) => {
  expectType<{ foo: Array<string> }>(event)
  expectType<Almanac>(almanac)
  expectType<RuleResult>(ruleResult)
})

// Run the Engine
const result = engine.run({ displayMessage: true })
expectType<Promise<EngineResult>>(result);

const topLevelConditionResult = result.then(r => r.results[0].conditions);
expectType<Promise<TopLevelConditionResult>>(topLevelConditionResult)

const topLevelAnyConditionsResult = topLevelConditionResult.then(r => (r as AnyConditionsResult).result);
expectType<Promise<boolean | undefined>>(topLevelAnyConditionsResult)

const topLevelAllConditionsResult = topLevelConditionResult.then(r => (r as AllConditionsResult).result);
expectType<Promise<boolean | undefined>>(topLevelAllConditionsResult)

const topLevelNotConditionsResult = topLevelConditionResult.then(r => (r as NotConditionsResult).result);
expectType<Promise<boolean | undefined>>(topLevelNotConditionsResult)

// Alamanac tests
const almanac: Almanac = (await engine.run()).almanac;

expectType<Promise<string>>(almanac.factValue<string>("test-fact"));
expectType<void>(almanac.addRuntimeFact("test-fact", "some-value"));

// ValidateEngine tests
import {
  ValidateEngine,
  ValidationSummary,
  ValidationResult,
  FactValidationResult,
  FactsValidationResult,
  ConditionValidationResult,
  RuleValidationResult,
  SatisfiedRulesResult,
  ObjectWithConditions,
  ObjectValidationResult,
  TopLevelCondition
} from "../";

// Create ValidateEngine instance
const validateEngine = new ValidateEngine([ruleProps]);
expectType<ValidateEngine>(validateEngine);

// Test findSatisfiedRules
const satisfiedRulesPromise = validateEngine.findSatisfiedRules({ "fact1": "value1" });
expectType<Promise<SatisfiedRulesResult>>(satisfiedRulesPromise);

const satisfiedRules = await satisfiedRulesPromise;
expectType<Record<string, any>>(satisfiedRules.facts);
expectType<string>(satisfiedRules.timestamp);
expectType<RuleSatisfactionResult[]>(satisfiedRules.fullySatisfiedRules);
expectType<RuleSatisfactionResult[]>(satisfiedRules.partiallySatisfiedRules);
expectType<RuleSatisfactionResult[]>(satisfiedRules.independentRules);
expectType<RuleSatisfactionResult[]>(satisfiedRules.unsatisfiedRules);
expectType<ValidationSummary>(satisfiedRules.summary);

// Test RuleSatisfactionResult interface
const ruleSatisfactionResult: RuleSatisfactionResult = {
  name: "test-rule",
  priority: 1,
  score: 1.0,
  event: { type: "test-event" },
  satisfactionType: "fully_satisfied"
};
expectType<RuleSatisfactionResult>(ruleSatisfactionResult);

const partiallySatisfiedRule: RuleSatisfactionResult = {
  name: "test-rule",
  priority: 1,
  score: 0,
  event: null,
  satisfactionType: "partially_satisfied",
  missingFacts: { fact1: "value1" }
};
expectType<RuleSatisfactionResult>(partiallySatisfiedRule);

// Test independent rule
const independentRule: RuleSatisfactionResult = {
  name: "test-rule",
  priority: 1,
  score: 1,
  event: { type: "test-event" },
  satisfactionType: "independent"
};
expectType<RuleSatisfactionResult>(independentRule);

// Test unsatisfied rule
const unsatisfiedRule: RuleSatisfactionResult = {
  name: "test-rule",
  priority: 1,
  score: 0,
  event: null,
  satisfactionType: "unsatisfied"
};
expectType<RuleSatisfactionResult>(unsatisfiedRule);

// Test ValidationSummary interface
const summary: ValidationSummary = {
  totalRules: 10,
  rulesUsingFact: 5,
  rulesNotUsingFact: 5,
  passedRules: 8,
  failedRules: 2,
  successRate: 0.8,
  satisfactionRate: 0.8,
  satisfied: 8,
  unsatisfied: 2
};
expectType<ValidationSummary>(summary);

// Test ValidationResult interface
const validationResult: ValidationResult = {
  passed: [],
  failed: []
};
expectType<ValidationResult>(validationResult);
