const test = require("node:test");
const assert = require("node:assert/strict");

const { DEFAULT_MODEL } = require("./evaluator");
const { TrainingWorkerPool, validateWorkerCount } = require("./trainingWorkerPool");

test("ワーカープールで複数モデルを並列評価できる", async () => {
  const pool = new TrainingWorkerPool(2);

  try {
    const results = await Promise.all(
      [DEFAULT_MODEL, DEFAULT_MODEL].map((model) =>
        pool.evaluate(model, {
          hallOfFameModels: [DEFAULT_MODEL],
          gameCount: 2,
          searchDepth: 1,
          endgameThreshold: 0,
          opponentMix: { weak: 1, normal: 0, strong: 0, hallOfFame: 0 },
          openingBook: null,
        }),
      ),
    );

    assert.equal(results.length, 2);
    assert.equal(results.every(({ gameCount }) => gameCount === 2), true);
    assert.equal(results.every(({ modelWins }) => Number.isInteger(modelWins)), true);
  } finally {
    await pool.close();
  }
});

test("ワーカー数には正の整数だけ指定できる", () => {
  assert.throws(() => validateWorkerCount(0), /workerCount must be a positive integer/);
  assert.throws(() => validateWorkerCount(1.5), /workerCount must be a positive integer/);
});
