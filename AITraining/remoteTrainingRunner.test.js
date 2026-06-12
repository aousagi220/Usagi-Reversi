const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { FEATURE_NAMES, PHASE_NAMES } = require("./evaluator");
const { normalizeRemoteJob, runRemoteTraining } = require("./remoteTrainingRunner");

test("リモート学習ジョブに既定値を設定する", () => {
  const job = normalizeRemoteJob({ jobId: "job-1", config: {} });

  assert.equal(job.jobId, "job-1");
  assert.equal(job.config.populationSize, 16);
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
