const test = require("node:test");
const assert = require("node:assert/strict");

const {
  FEATURE_NAMES,
  PHASE_NAMES,
  DEFAULT_MODEL,
  createNeuralModel,
  createModel,
} = require("./evaluator");
const {
  createRandomModel,
  crossoverModels,
  mutateModel,
  createInitialPopulation,
  evaluatePopulation,
  improveIndividualWithLocalSearch,
  improveIndividualWithLocalSearchAsync,
  getModelParameters,
  createNextGeneration,
} = require("./geneticAlgorithm");

function createUniformModel(value) {
  return createModel(Object.fromEntries(
    PHASE_NAMES.map((phaseName) => [
      phaseName,
      Object.fromEntries(FEATURE_NAMES.map((featureName) => [featureName, value])),
    ]),
  ));
}

test("基準モデルの周辺にランダム個体を生成する", () => {
  const model = createRandomModel({
    variationRate: 0.5,
    random: () => 1,
  });

  for (const phaseName of PHASE_NAMES) {
    for (const featureName of FEATURE_NAMES) {
      const baseWeight = DEFAULT_MODEL[phaseName][featureName];
      const variation = Math.max(Math.abs(baseWeight), 1) * 0.5;
      assert.equal(model[phaseName][featureName], baseWeight + variation);
    }
  }
});

test("両親の段階別重みを交叉して子を作る", () => {
  const firstParent = createUniformModel(1);
  const secondParent = createUniformModel(2);

  assert.deepEqual(crossoverModels(firstParent, secondParent, () => 0), firstParent);
  assert.deepEqual(crossoverModels(firstParent, secondParent, () => 1), secondParent);
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
  const population = [1, 3, 2].map((value) =>
    createModel({ opening: { stoneDifference: value } }),
  );
  const ranked = evaluatePopulation(population, (model) => ({
    fitness: model.opening.stoneDifference,
  }));

  assert.deepEqual(ranked.map(({ fitness }) => fitness), [3, 2, 1]);
});

test("エリートを保ったまま次世代を生成する", () => {
  const rankedPopulation = evaluatePopulation(
    [3, 2, 1].map((value) =>
      createModel({ opening: { stoneDifference: value } }),
    ),
    (model) => ({
      fitness: model.opening.stoneDifference,
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

test("座標降下で適応度が改善する方向の重みを採用する", () => {
  const model = createModel({ opening: { stoneDifference: 10 } });
  const individual = {
    model,
    fitness: -1,
  };
  const improved = improveIndividualWithLocalSearch(
    individual,
    (candidate) => ({
      fitness: -Math.abs(candidate.opening.stoneDifference - 11),
    }),
    {
      coordinateCount: 1,
      coordinateOffset: 0,
      strength: 0.1,
    },
  );

  assert.equal(improved.model.opening.stoneDifference, 11);
  assert.equal(Math.abs(improved.fitness), 0);
});

test("局所探索で改善しなければ元の個体を維持する", () => {
  const individual = {
    model: DEFAULT_MODEL,
    fitness: 100,
    stats: { source: "original" },
  };
  const improved = improveIndividualWithLocalSearch(
    individual,
    () => ({ fitness: 99 }),
    { coordinateCount: 2 },
  );

  assert.deepEqual(improved.model, DEFAULT_MODEL);
  assert.deepEqual(improved.stats, { source: "original" });
});

test("非同期局所探索で改善する方向の重みを採用する", async () => {
  const model = createModel({ opening: { stoneDifference: 10 } });
  const improved = await improveIndividualWithLocalSearchAsync(
    {
      model,
      fitness: -1,
      stats: {},
    },
    async (candidate) => ({
      fitness: -Math.abs(candidate.opening.stoneDifference - 11),
      stats: {},
    }),
    {
      coordinateCount: 1,
      strength: 0.1,
    },
  );

  assert.equal(improved.model.opening.stoneDifference, 11);
  assert.ok(improved.fitness === 0);
});

test("小規模NNの216パラメータをGAで操作できる", () => {
  const firstParent = createNeuralModel({ random: () => 0.25 });
  const secondParent = createNeuralModel({ random: () => 0.75 });

  assert.equal(getModelParameters(firstParent).length, 216);
  assert.deepEqual(
    crossoverModels(firstParent, secondParent, () => 0),
    firstParent,
  );
  assert.deepEqual(
    mutateModel(firstParent, { mutationRate: 0 }),
    firstParent,
  );
});

test("異なる評価アーキテクチャ同士は交叉しない", () => {
  assert.throws(
    () => crossoverModels(DEFAULT_MODEL, createNeuralModel()),
    /same architecture/,
  );
});
