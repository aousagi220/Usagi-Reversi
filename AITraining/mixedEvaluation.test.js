const test = require("node:test");
const assert = require("node:assert/strict");

const { DEFAULT_MODEL } = require("./evaluator");
const {
  allocateOpponentGames,
  calculateSimpleElo,
  simulateMixedMatches,
} = require("./mixedEvaluation");

test("100試合の半分をHall of Fameへ割り当てる", () => {
  assert.deepEqual(allocateOpponentGames(100), {
    weak: 5,
    normal: 15,
    strong: 30,
    hallOfFame: 50,
  });
});

test("端数がある試合数でも割当の合計を一致させる", () => {
  const allocation = allocateOpponentGames(7);

  assert.equal(
    Object.values(allocation).reduce((sum, count) => sum + count, 0),
    7,
  );
});

test("各対戦相手との成績を混合して集計する", () => {
  const stats = simulateMixedMatches({
    model: DEFAULT_MODEL,
    hallOfFameModels: [DEFAULT_MODEL, DEFAULT_MODEL],
    gameCount: 10,
    random: () => 0,
  });

  assert.deepEqual(
    Object.fromEntries(
      Object.entries(stats.breakdown).map(([name, result]) => [
        name,
        result.gameCount,
      ]),
    ),
    {
      weak: 1,
      normal: 1,
      strong: 3,
      hallOfFame: 5,
    },
  );
  assert.equal(stats.modelWins + stats.opponentWins + stats.draws, 10);
  assert.equal(stats.modelBlackGames, 5);
  assert.equal(stats.modelWhiteGames, 5);
  assert.equal(Number.isFinite(stats.hallOfFameElo), true);
});

test("勝敗スコアを簡易Eloへ変換する", () => {
  assert.equal(
    calculateSimpleElo({
      gameCount: 2,
      modelWins: 1,
      draws: 0,
    }),
    1500,
  );
});
