const test = require("node:test");
const assert = require("node:assert/strict");

const {
  BOARD_SIZE,
  BLACK,
  WHITE,
  isGameEnd,
  countStones,
} = require("./reversiEngine");
const {
  WEAK,
  NORMAL,
  STRONG,
} = require("./cpuStrategies");
const {
  getWinner,
  simulateGame,
  formatWinner,
} = require("./simulate");

test("CPU同士の1試合を最後まで進行できる", () => {
  const result = simulateGame({
    blackCpu: STRONG,
    whiteCpu: NORMAL,
    random: () => 0,
  });

  assert.equal(isGameEnd(result.board), true);
  assert.deepEqual(countStones(result.board), result.score);
  assert.equal(result.score.black + result.score.white + result.score.empty, BOARD_SIZE ** 2);
  assert.ok(result.moves.length > 0);
});

test("棋譜には着手前の盤面と選択した手が保存される", () => {
  const result = simulateGame({
    blackCpu: WEAK,
    whiteCpu: WEAK,
    random: () => 0,
  });
  const firstMove = result.moves[0];

  assert.equal(firstMove.player, BLACK);
  assert.deepEqual(firstMove.move, [2, 3]);
  assert.equal(firstMove.board[2][3], 0);
  assert.equal(result.board[2][3] === BLACK || result.board[2][3] === WHITE, true);
});

test("同じ固定乱数なら同じ対局結果になる", () => {
  const firstResult = simulateGame({
    blackCpu: STRONG,
    whiteCpu: NORMAL,
    random: () => 0,
  });
  const secondResult = simulateGame({
    blackCpu: STRONG,
    whiteCpu: NORMAL,
    random: () => 0,
  });

  assert.deepEqual(firstResult.moves, secondResult.moves);
  assert.deepEqual(firstResult.score, secondResult.score);
});

test("勝者を得点から判定できる", () => {
  assert.equal(getWinner({ black: 40, white: 24 }), BLACK);
  assert.equal(getWinner({ black: 20, white: 44 }), WHITE);
  assert.equal(getWinner({ black: 32, white: 32 }), null);
});

test("勝者を表示用文字列へ変換できる", () => {
  assert.equal(formatWinner(BLACK), "黒");
  assert.equal(formatWinner(WHITE), "白");
  assert.equal(formatWinner(null), "引き分け");
});
