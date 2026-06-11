const test = require("node:test");
const assert = require("node:assert/strict");

const {
  FEATURE_NAMES,
  DEFAULT_MODEL,
} = require("./evaluator");
const {
  createRandomModel,
  crossoverModels,
  mutateModel,
  createInitialPopulation,
  evaluatePopulation,
  createNextGeneration,
} = require("./geneticAlgorithm");

test("基準モデルの周辺にランダム個体を生成する", () => {
  const model = createRandomModel({
    variationRate: 0.5,
    random: () => 1,
  });

  for (const featureName of FEATURE_NAMES) {
    const baseWeight = DEFAULT_MODEL[featureName];
    const variation = Math.max(Math.abs(baseWeight), 1) * 0.5;

    assert.equal(model[featureName], baseWeight + variation);
  }
});

test("両親の重みを交叉して子を作る", () => {
  const firstParent = Object.fromEntries(
    FEATURE_NAMES.map((featureName) => [featureName, 1]),
  );
  const secondParent = Object.fromEntries(
    FEATURE_NAMES.map((featureName) => [featureName, 2]),
  );

  assert.deepEqual(
    crossoverModels(firstParent, secondParent, () => 0),
    firstParent,
  );
  assert.deepEqual(
    crossoverModels(firstParent, secondParent, () => 1),
    secondParent,
  );
});

test("突然変異率0ならモデルを変更しない", () => {
  assert.deepEqual(
    mutateModel(DEFAULT_MODEL, {
      mutationRate: 0,
      random: () => 0,
    }),
    DEFAULT_MODEL,
  );
});

test("初期集団の先頭には基準モデルを残す", () => {
  const population = createInitialPopulation({
    populationSize: 4,
    random: () => 0.5,
  });

  assert.equal(population.length, 4);
  assert.deepEqual(population[0], DEFAULT_MODEL);
  assert.notEqual(population[0], DEFAULT_MODEL);
});

test("適応度の高い順に個体を並べる", () => {
  const population = [
    { ...DEFAULT_MODEL, stoneDifference: 1 },
    { ...DEFAULT_MODEL, stoneDifference: 3 },
    { ...DEFAULT_MODEL, stoneDifference: 2 },
  ];
  const ranked = evaluatePopulation(population, (model) => ({
    fitness: model.stoneDifference,
  }));

  assert.deepEqual(
    ranked.map(({ fitness }) => fitness),
    [3, 2, 1],
  );
});

test("エリートを保ったまま次世代を生成する", () => {
  const rankedPopulation = evaluatePopulation(
    [
      { ...DEFAULT_MODEL, stoneDifference: 3 },
      { ...DEFAULT_MODEL, stoneDifference: 2 },
      { ...DEFAULT_MODEL, stoneDifference: 1 },
    ],
    (model) => ({
      fitness: model.stoneDifference,
    }),
  );
  const nextGeneration = createNextGeneration(rankedPopulation, {
    populationSize: 4,
    eliteCount: 2,
    mutationRate: 0,
    random: () => 0,
  });

  assert.equal(nextGeneration.length, 4);
  assert.deepEqual(nextGeneration[0], rankedPopulation[0].model);
  assert.deepEqual(nextGeneration[1], rankedPopulation[1].model);
});
