const test = require("node:test");
const assert = require("node:assert/strict");

const { DEFAULT_MODEL } = require("./evaluator");
const {
  allocateOpponentGames,
  simulateMixedMatches,
} = require("./mixedEvaluation");

test("100試合を弱10・中20・強50・過去モデル20へ割り当てる", () => {
  assert.deepEqual(allocateOpponentGames(100), {
    weak: 10,
    normal: 20,
    strong: 50,
    pastModel: 20,
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
    pastModel: DEFAULT_MODEL,
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
      normal: 2,
      strong: 5,
      pastModel: 2,
    },
  );
  assert.equal(stats.modelWins + stats.opponentWins + stats.draws, 10);
  assert.equal(stats.modelBlackGames, 5);
  assert.equal(stats.modelWhiteGames, 5);
});
