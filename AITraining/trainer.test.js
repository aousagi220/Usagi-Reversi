const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { createNeuralModel } = require("./evaluator");
const {
  calculateFitness,
  train,
  trainParallel,
  resolveTrainingStart,
} = require("./trainer");

test("勝率・引き分け・平均石差から適応度を計算する", () => {
  assert.equal(
    calculateFitness({
      modelWinRate: 0.6,
      drawRate: 0.1,
      averageStoneDifference: 5,
      hallOfFameElo: 1500,
    }),
    67.5,
  );
});

test("Hall of Fame Eloを適応度へ反映する", () => {
  assert.equal(
    calculateFitness({
      modelWinRate: 0,
      drawRate: 0,
      averageStoneDifference: 0,
      hallOfFameElo: 1600,
    }),
    10,
  );
});

test("複数世代を更新して最良モデルを保存する", () => {
  const outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "reversi-ai-"));
  const outputPath = path.join(outputDirectory, "bestModel.json");
  const generations = [];
  const result = train({
    populationSize: 4,
    generationCount: 2,
    random: () => 0.25,
    outputPath,
    startGeneration: 10,
    evaluateModel: (model) => ({
      fitness: model.opening.cornerDifference,
      stats: {
        modelWinRate: 0,
        drawRate: 0,
        averageStoneDifference: 0,
      },
    }),
    onGenerationComplete: (generation) => generations.push(generation),
  });

  assert.equal(result.history.length, 2);
  assert.deepEqual(
    result.history.map(({ generation }) => generation),
    [10, 11],
  );
  assert.equal(generations.length, 2);
  assert.equal(fs.existsSync(outputPath), true);
  assert.equal(JSON.parse(fs.readFileSync(outputPath, "utf8")).fitness, result.best.fitness);
});

test("通常実行は履歴があっても世代1から新規開始する", () => {
  const result = resolveTrainingStart({
    shouldResume: false,
    storedBest: {
      generation: 14,
      fitness: 100,
      model: { cornerDifference: 999 },
    },
    fileBest: null,
    latestGeneration: 14,
  });

  assert.equal(result.startGeneration, 1);
  assert.equal(result.source, "new");
  assert.equal(result.previousBest.fitness, 100);
});

test("再開指定時はDBの続きから開始する", () => {
  const storedBest = {
    generation: 11,
    fitness: 100,
    model: {
      stoneDifference: 1,
      mobilityDifference: 2,
      cornerDifference: 3,
      edgeDifference: 4,
      dangerSquareDifference: -5,
    },
  };
  const result = resolveTrainingStart({
    shouldResume: true,
    storedBest,
    fileBest: null,
    latestGeneration: 14,
  });

  assert.equal(result.startGeneration, 15);
  assert.equal(result.source, "database");
  assert.equal(result.baseModel.opening.cSquareDifference, -5);
  assert.equal(result.baseModel.midgame.xSquareDifference, -5);
  assert.equal(result.baseModel.endgame.cSquareDifference, -5);
});

test("探索深さには正の整数だけ指定できる", () => {
  assert.throws(
    () =>
      train({
        searchDepth: 0,
      }),
    /searchDepth must be a positive integer/,
  );
  assert.throws(
    () =>
      train({
        searchDepth: 1.5,
      }),
    /searchDepth must be a positive integer/,
  );
});

test("終盤完全読みの閾値は0から60の整数のみ指定できる", () => {
  assert.throws(
    () =>
      train({
        endgameThreshold: -1,
      }),
    /endgameThreshold must be an integer between 0 and 60/,
  );
  assert.throws(
    () =>
      train({
        endgameThreshold: 61,
      }),
    /endgameThreshold must be an integer between 0 and 60/,
  );
});

test("局所探索の設定値を検証する", () => {
  assert.throws(
    () => train({ populationSize: 2, localSearchEliteCount: 3 }),
    /localSearchEliteCount must be between 0 and populationSize/,
  );
  assert.throws(
    () => train({ localSearchCoordinateCount: 25 }),
    /localSearchCoordinateCount must be an integer between 0 and 24/,
  );
  assert.throws(
    () => train({ localSearchStrength: -0.1 }),
    /localSearchStrength must be a non-negative number/,
  );
});

test("小規模NNモデルでも学習できる", () => {
  const result = train({
    populationSize: 2,
    generationCount: 1,
    baseModel: createNeuralModel({ random: () => 0.5 }),
    localSearchEliteCount: 0,
    evaluateModel: (model) => ({
      fitness: model.opening.outputWeights[0],
      stats: {},
    }),
    outputPath: path.join(os.tmpdir(), "reversi-nn-best.json"),
  });

  assert.equal(result.best.model.type, "nn");
});

test("非同期評価で複数個体を学習できる", async () => {
  const result = await trainParallel({
    populationSize: 3,
    generationCount: 2,
    workerCount: 2,
    localSearchEliteCount: 0,
    random: () => 0.25,
    evaluateModel: async (model) => ({
      fitness: model.opening.cornerDifference,
      stats: {},
    }),
    outputPath: path.join(os.tmpdir(), "reversi-parallel-best.json"),
  });

  assert.equal(result.history.length, 2);
  assert.equal(Number.isFinite(result.best.fitness), true);
});

test("並列数には正の整数だけ指定できる", async () => {
  await assert.rejects(
    () => trainParallel({ workerCount: 0 }),
    /workerCount must be a positive integer/,
  );
});
