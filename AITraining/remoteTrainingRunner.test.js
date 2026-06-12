const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { FEATURE_NAMES, PHASE_NAMES, createNeuralModel } = require("./evaluator");
const { normalizeRemoteJob, runRemoteTraining } = require("./remoteTrainingRunner");

test("リモート学習ジョブに既定値を設定する", () => {
  const job = normalizeRemoteJob({ jobId: "job-1", config: {} });

  assert.equal(job.jobId, "job-1");
  assert.equal(job.config.populationSize, 16);
  assert.equal(job.config.localSearchEliteCount, 1);
  assert.equal(job.config.localSearchCoordinateCount, 4);
  assert.equal(job.config.localSearchStrength, 0.1);
  assert.deepEqual(Object.keys(job.config.baseModel), PHASE_NAMES);
  assert.deepEqual(Object.keys(job.config.baseModel.opening), FEATURE_NAMES);
});

test("リモート学習結果に世代ごとの全個体を含める", () => {
  const outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "reversi-remote-"));
  const payload = runRemoteTraining(
    {
      jobId: "job-2",
      config: {
        populationSize: 2,
        generationCount: 1,
        gamesPerModel: 1,
        searchDepth: 1,
        endgameThreshold: 0,
      },
    },
    { outputPath: path.join(outputDirectory, "bestModel.json") },
  );

  assert.equal(payload.jobId, "job-2");
  assert.equal(payload.generations.length, 1);
  assert.equal(payload.generations[0].rankedPopulation.length, 2);
});

test("リモートジョブで小規模NNを新規生成できる", () => {
  const job = normalizeRemoteJob({
    jobId: "job-nn",
    config: { modelType: "nn" },
  });

  assert.equal(job.config.baseModel.type, "nn");
});

test("リモートNN学習は216座標まで局所探索できる", () => {
  const baseModel = createNeuralModel({ random: () => 0.5 });
  const job = normalizeRemoteJob({
    jobId: "job-nn-coordinates",
    config: {
      baseModel,
      localSearchCoordinateCount: 216,
    },
  });

  assert.equal(job.config.localSearchCoordinateCount, 216);
  assert.throws(
    () =>
      normalizeRemoteJob({
        jobId: "job-nn-too-many-coordinates",
        config: {
          baseModel,
          localSearchCoordinateCount: 217,
        },
      }),
    /localSearchCoordinateCount must be an integer between 0 and 216/,
  );
});
