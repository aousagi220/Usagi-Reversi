const test = require("node:test");
const assert = require("node:assert/strict");

const {
  BLACK,
  WHITE,
  createBoard,
  placeStone,
} = require("../Automation/reversiEngine");
const {
  FEATURE_NAMES,
  DEFAULT_MODEL,
  validateModel,
  evaluateFeatures,
  evaluateBoard,
  createModel,
} = require("./evaluator");

test("特徴量と重みの内積を評価値として返す", () => {
  const features = {
    stoneDifference: 3,
    mobilityDifference: 2,
    cornerDifference: 1,
    edgeDifference: -1,
    dangerSquareDifference: 2,
  };
  const model = {
    stoneDifference: 1,
    mobilityDifference: 10,
    cornerDifference: 100,
    edgeDifference: 5,
    dangerSquareDifference: -20,
  };

  assert.equal(evaluateFeatures(features, model), 78);
});

test("初期盤面の評価値は0になる", () => {
  assert.equal(evaluateBoard(createBoard(), BLACK), 0);
  assert.equal(evaluateBoard(createBoard(), WHITE), 0);
});

test("黒と白の評価値は符号が反転する", () => {
  const board = createBoard();
  placeStone(board, 2, 3, BLACK);

  const blackScore = evaluateBoard(board, BLACK);
  const whiteScore = evaluateBoard(board, WHITE);

  assert.equal(blackScore + whiteScore, 0);
});

test("指定した重みだけ上書きしたモデルを作成できる", () => {
  const model = createModel({
    cornerDifference: 75,
  });

  assert.equal(model.cornerDifference, 75);
  assert.equal(model.mobilityDifference, DEFAULT_MODEL.mobilityDifference);
  assert.notEqual(model, DEFAULT_MODEL);
});

test("モデルには全特徴量の有限な重みが必要", () => {
  const missingWeightModel = { ...DEFAULT_MODEL };
  delete missingWeightModel.edgeDifference;

  assert.throws(
    () => validateModel(missingWeightModel),
    /Missing model weight/,
  );
  assert.throws(
    () => validateModel({
      ...DEFAULT_MODEL,
      cornerDifference: Number.POSITIVE_INFINITY,
    }),
    /must be finite/,
  );
});

test("特徴量には有限な値が必要", () => {
  const features = Object.fromEntries(
    FEATURE_NAMES.map((featureName) => [featureName, 0]),
  );
  features.mobilityDifference = Number.NaN;

  assert.throws(
    () => evaluateFeatures(features),
    /Feature value must be finite/,
  );
});
