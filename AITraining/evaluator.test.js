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
  normalizeModel,
  validateModel,
  getPhaseWeights,
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
    frontierDifference: 2,
    cSquareDifference: -1,
    xSquareDifference: 1,
    stableDiscDifference: 3,
  };
  const model = {
    stoneDifference: 1,
    mobilityDifference: 10,
    cornerDifference: 100,
    edgeDifference: 5,
    frontierDifference: 0,
    cSquareDifference: 0,
    xSquareDifference: -40,
    stableDiscDifference: 0,
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

  assert.equal(model.opening.cornerDifference, 75);
  assert.equal(model.midgame.cornerDifference, 75);
  assert.equal(model.endgame.cornerDifference, 75);
  assert.equal(model.opening.mobilityDifference, DEFAULT_MODEL.opening.mobilityDifference);
  assert.notEqual(model, DEFAULT_MODEL);
});

test("旧モデルの危険マス重みをCマスとXマスへ移行する", () => {
  const legacyModel = {
    stoneDifference: 1,
    mobilityDifference: 8,
    cornerDifference: 50,
    edgeDifference: 15,
    dangerSquareDifference: -25,
  };
  const normalizedModel = normalizeModel(legacyModel);

  for (const phaseName of ["opening", "midgame", "endgame"]) {
    assert.equal(normalizedModel[phaseName].cSquareDifference, -25);
    assert.equal(normalizedModel[phaseName].xSquareDifference, -25);
    assert.equal(
      normalizedModel[phaseName].frontierDifference,
      DEFAULT_MODEL[phaseName].frontierDifference,
    );
  }
});

test("モデルには全特徴量の有限な重みが必要", () => {
  const missingWeightModel = structuredClone(DEFAULT_MODEL);
  delete missingWeightModel.opening.edgeDifference;

  assert.throws(
    () => validateModel(missingWeightModel),
    /Missing model weight/,
  );
  assert.throws(
    () => validateModel({
      ...structuredClone(DEFAULT_MODEL),
      opening: {
        ...DEFAULT_MODEL.opening,
        cornerDifference: Number.POSITIVE_INFINITY,
      },
    }),
    /must be finite/,
  );
});

test("空きマス数に応じて段階別重みを線形補間する", () => {
  const model = createModel({
    opening: { stoneDifference: 10 },
    midgame: { stoneDifference: 20 },
    endgame: { stoneDifference: 40 },
  });

  assert.equal(getPhaseWeights(model, 45).stoneDifference, 10);
  assert.equal(getPhaseWeights(model, 30).stoneDifference, 20);
  assert.equal(getPhaseWeights(model, 14).stoneDifference, 40);
  assert.equal(getPhaseWeights(model, 37).stoneDifference, 10 + (10 * 8) / 15);
  assert.equal(getPhaseWeights(model, 22).stoneDifference, 30);
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
