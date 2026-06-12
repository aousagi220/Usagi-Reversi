const test = require("node:test");
const assert = require("node:assert/strict");

const { STRONG } = require("../Automation/cpuStrategies");
const { DEFAULT_MODEL } = require("./evaluator");
const {
  openTrainingDatabase,
  startTrainingRun,
  saveGeneration,
  completeTrainingRun,
  getLatestGenerationNumber,
  getBestStoredModel,
  getHallOfFameModels,
  getTrainingCounts,
} = require("./modelStore");

test("学習実行・世代・全個体をSQLiteへ保存できる", () => {
  const database = openTrainingDatabase(":memory:");
  const runId = startTrainingRun(database, {
    populationSize: 2,
    gamesPerModel: 4,
    opponentCpu: STRONG,
  });

  saveGeneration(database, {
    runId,
    generation: 10,
    bestFitness: 90,
    averageFitness: 80,
    rankedPopulation: [
      {
        model: DEFAULT_MODEL,
        fitness: 90,
        stats: { modelWinRate: 0.8 },
      },
      {
        model: { ...DEFAULT_MODEL, stoneDifference: 2 },
        fitness: 70,
        stats: { modelWinRate: 0.6 },
      },
    ],
  });
  completeTrainingRun(database, runId);

  assert.deepEqual(getTrainingCounts(database), {
    runs: 1,
    generations: 1,
    models: 2,
  });
  assert.equal(getLatestGenerationNumber(database), 10);
  assert.equal(getBestStoredModel(database).fitness, 90);

  database.close();
});

test("履歴がなければ最良モデルはnullを返す", () => {
  const database = openTrainingDatabase(":memory:");

  assert.equal(getBestStoredModel(database), null);
  assert.equal(getLatestGenerationNumber(database), 0);

  database.close();
});

test("各世代の優勝モデルからHall of Fameを取得する", () => {
  const database = openTrainingDatabase(":memory:");
  const runId = startTrainingRun(database, {
    populationSize: 2,
    gamesPerModel: 1,
    opponentCpu: STRONG,
  });

  for (const [generation, fitness] of [[1, 10], [2, 30], [3, 20]]) {
    saveGeneration(database, {
      runId,
      generation,
      bestFitness: fitness,
      averageFitness: fitness - 1,
      rankedPopulation: [
        { model: DEFAULT_MODEL, fitness },
        { model: DEFAULT_MODEL, fitness: fitness - 2 },
      ],
    });
  }

  assert.deepEqual(
    getHallOfFameModels(database, 2).map(({ generation }) => generation),
    [2, 3],
  );
  database.close();
});
