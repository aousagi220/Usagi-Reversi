const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { DEFAULT_MODEL } = require("./evaluator");
const { openTrainingDatabase, getTrainingCounts } = require("./modelStore");
const {
  createSourceManifest,
  resolveSourcePath,
  importRemoteResult,
  parseServerArguments,
} = require("./remoteTrainingServer");

test("Colabへ送るソース一覧からDBとテストを除外する", () => {
  const manifest = createSourceManifest();

  assert.ok(manifest.some(({ path: filePath }) => filePath === "AITraining/remoteTrainingRunner.js"));
  assert.equal(manifest.some(({ path: filePath }) => filePath.endsWith(".test.js")), false);
  assert.equal(manifest.some(({ path: filePath }) => filePath.endsWith(".db")), false);
});

test("一覧にないソースパスを拒否する", () => {
  assert.throws(
    () => resolveSourcePath("../package.json", new Set()),
    /Unknown source path/,
  );
});

test("リモート結果をSQLiteと最良モデルへ取り込む", () => {
  const database = openTrainingDatabase(":memory:");
  const outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "reversi-import-"));
  const bestModelPath = path.join(outputDirectory, "bestModel.json");
  const job = {
    jobId: "job-1",
    config: {
      generationCount: 1,
      populationSize: 2,
      gamesPerModel: 1,
      startGeneration: 1,
    },
  };
  const rankedPopulation = [
    { model: DEFAULT_MODEL, fitness: 10, stats: { modelWinRate: 1 } },
    { model: { ...DEFAULT_MODEL, stoneDifference: 2 }, fitness: 5, stats: { modelWinRate: 0 } },
  ];

  importRemoteResult({
    payload: {
      protocolVersion: 1,
      jobId: "job-1",
      result: { best: rankedPopulation[0], bestGeneration: 1 },
      generations: [{
        generation: 1,
        bestFitness: 10,
        averageFitness: 7.5,
        bestModel: DEFAULT_MODEL,
        rankedPopulation,
      }],
    },
    job,
    database,
    bestModelPath,
  });

  assert.deepEqual(getTrainingCounts(database), { runs: 1, generations: 1, models: 2 });
  assert.equal(JSON.parse(fs.readFileSync(bestModelPath, "utf8")).fitness, 10);
  database.close();
});

test("リモートサーバーの引数を解析する", () => {
  assert.deepEqual(
    parseServerArguments([
      "30",
      "24",
      "50",
      "--search-depth=3",
      "--endgame-threshold=10",
      "--local-search-elites=2",
      "--local-search-coordinates=6",
      "--local-search-strength=0.05",
      "--workers=4",
      "--model-type=nn",
      "--port=9000",
      "--resume",
    ]),
    {
      generationCount: 30,
      populationSize: 24,
      gamesPerModel: 50,
      searchDepth: 3,
      endgameThreshold: 10,
      localSearchEliteCount: 2,
      localSearchCoordinateCount: 6,
      localSearchStrength: 0.05,
      workerCount: 4,
      modelType: "nn",
      port: 9000,
      shouldResume: true,
    },
  );
});
