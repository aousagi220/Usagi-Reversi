const test = require("node:test");
const assert = require("node:assert/strict");

const { BLACK, WHITE, isGameEnd } = require("../Automation/reversiEngine");
const { WEAK, NORMAL, STRONG } = require("../Automation/cpuStrategies");
const { DEFAULT_MODEL } = require("./evaluator");
const {
  simulateModelGame,
  simulateModelMatches,
  simulateModelsGame,
  simulateModelsMatches,
  formatPercent,
} = require("./trainingSimulator");

test("モデルCPUと既存CPUの1試合を完走できる", () => {
  const result = simulateModelGame({
    model: DEFAULT_MODEL,
    modelColor: BLACK,
    opponentCpu: NORMAL,
    random: () => 0,
  });

  assert.equal(isGameEnd(result.board), true);
  assert.equal(result.modelColor, BLACK);
  assert.equal(result.modelStoneCount + result.opponentStoneCount + result.score.empty, 64);
  assert.ok(result.moves.some(({ source }) => source === "model"));
  assert.ok(result.moves.some(({ source }) => source === "opponent"));
});

test("モデルを黒白へ交互に配置して集計する", () => {
  const stats = simulateModelMatches({
    model: DEFAULT_MODEL,
    opponentCpu: WEAK,
    gameCount: 5,
    random: () => 0,
  });

  assert.equal(stats.modelBlackGames, 3);
  assert.equal(stats.modelWhiteGames, 2);
  assert.equal(stats.modelWins + stats.opponentWins + stats.draws, 5);
});

test("固定乱数なら同じ対局結果になる", () => {
  const settings = {
    model: DEFAULT_MODEL,
    modelColor: WHITE,
    opponentCpu: STRONG,
    random: () => 0,
  };
  const firstResult = simulateModelGame(settings);
  const secondResult = simulateModelGame(settings);

  assert.deepEqual(firstResult.moves, secondResult.moves);
  assert.deepEqual(firstResult.score, secondResult.score);
});

test("2つの学習モデル同士で1試合を完走できる", () => {
  const result = simulateModelsGame({
    model: DEFAULT_MODEL,
    opponentModel: DEFAULT_MODEL,
    modelColor: BLACK,
    random: () => 0,
  });

  assert.equal(isGameEnd(result.board), true);
  assert.equal(result.opponentType, "model");
  assert.equal(result.modelStoneCount + result.opponentStoneCount + result.score.empty, 64);
});

test("モデル同士の対局でも黒白を交互にして集計する", () => {
  const stats = simulateModelsMatches({
    model: DEFAULT_MODEL,
    opponentModel: DEFAULT_MODEL,
    gameCount: 4,
    random: () => 0,
  });

  assert.equal(stats.modelBlackGames, 2);
  assert.equal(stats.modelWhiteGames, 2);
  assert.equal(stats.modelWins + stats.opponentWins + stats.draws, 4);
});

test("対局数には正の整数だけ指定できる", () => {
  assert.throws(() => simulateModelMatches({ gameCount: 0 }), /positive integer/);
  assert.throws(() => simulateModelMatches({ gameCount: 1.5 }), /positive integer/);
});

test("モデルの色には黒か白だけ指定できる", () => {
  assert.throws(() => simulateModelGame({ modelColor: 99 }), /BLACK or WHITE/);
});

test("割合を表示用文字列へ変換できる", () => {
  assert.equal(formatPercent(0.875), "87.5%");
});

test("探索深さには正の整数だけ指定できる", () => {
  assert.throws(() => simulateModelGame({ searchDepth: 0 }), /searchDepth must be a positive integer/);
  assert.throws(() => simulateModelsMatches({ searchDepth: 1.5 }), /searchDepth must be a positive integer/);
});
