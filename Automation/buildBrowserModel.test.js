const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  buildBrowserModelData,
  writeBrowserModelData,
} = require("./buildBrowserModel");

test("学習結果からブラウザ用モデルを生成できる", () => {
  const data = buildBrowserModelData({
    generation: 12,
    fitness: 100,
    weights: {
      stoneDifference: 1,
      mobilityDifference: 2,
      cornerDifference: 3,
      edgeDifference: 4,
    },
  });

  assert.equal(data.generation, 12);
  assert.equal(data.model.opening.mobilityDifference, 2);
  assert.equal(data.model.endgame.cornerDifference, 3);
});

test("ブラウザ用JavaScriptを書き出せる", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "reversi-model-"));
  const outputPath = path.join(directory, "modelCpuData.js");
  const data = buildBrowserModelData({
    weights: {
      stoneDifference: 1,
      mobilityDifference: 2,
      cornerDifference: 3,
      edgeDifference: 4,
    },
  });

  writeBrowserModelData(data, outputPath);

  assert.match(
    fs.readFileSync(outputPath, "utf8"),
    /^const TRAINED_MODEL_DATA = /,
  );
});
