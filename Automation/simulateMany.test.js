const test = require("node:test");
const assert = require("node:assert/strict");

const { NORMAL, STRONG } = require("./cpuStrategies");
const { simulateMany, formatPercent } = require("./simulateMany");

test("指定した回数の対局結果を集計できる", () => {
  const stats = simulateMany({
    cpuA: STRONG,
    cpuB: NORMAL,
    gameCount: 4,
    random: () => 0,
  });

  assert.equal(stats.gameCount, 4);
  assert.equal(stats.cpuAWins + stats.cpuBWins + stats.draws, 4);
  assert.equal(stats.cpuABlackGames, 2);
  assert.equal(stats.cpuAWhiteGames, 2);
});

test("奇数試合でも先後を交互に入れ替える", () => {
  const stats = simulateMany({
    cpuA: STRONG,
    cpuB: NORMAL,
    gameCount: 5,
    random: () => 0,
  });

  assert.equal(stats.cpuABlackGames, 3);
  assert.equal(stats.cpuAWhiteGames, 2);
});

test("勝率と引き分け率の合計は100%になる", () => {
  const stats = simulateMany({
    cpuA: STRONG,
    cpuB: NORMAL,
    gameCount: 6,
    random: () => 0,
  });

  assert.equal(stats.cpuAWinRate + stats.cpuBWinRate + stats.drawRate, 1);
});

test("対局数には正の整数だけ指定できる", () => {
  assert.throws(() => simulateMany({ gameCount: 0 }), /positive integer/);
  assert.throws(() => simulateMany({ gameCount: 1.5 }), /positive integer/);
});

test("割合を表示用文字列へ変換できる", () => {
  assert.equal(formatPercent(0.625), "62.5%");
});

test("各試合終了時にコールバックを実行する", () => {
  const results = [];

  simulateMany({
    gameCount: 3,
    random: () => 0,
    onGameComplete: (result, gameIndex) => {
      results.push({ result, gameIndex });
    },
  });

  assert.equal(results.length, 3);
  assert.deepEqual(results.map(({ gameIndex }) => gameIndex), [0, 1, 2]);
});
