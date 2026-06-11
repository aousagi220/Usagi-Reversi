const { BLACK, WHITE } = require("../Automation/reversiEngine");
const { WEAK, NORMAL, STRONG } = require("../Automation/cpuStrategies");
const { DEFAULT_MODEL, validateModel } = require("./evaluator");
const { simulateModelMatches, simulateModelsMatches } = require("./trainingSimulator");

const DEFAULT_OPPONENT_MIX = Object.freeze({
  weak: 0.1,
  normal: 0.2,
  strong: 0.5,
  pastModel: 0.2,
});

function allocateOpponentGames(gameCount, opponentMix = DEFAULT_OPPONENT_MIX) {
  if (!Number.isInteger(gameCount) || gameCount <= 0) {
    throw new Error("gameCount must be a positive integer");
  }

  const entries = Object.entries(opponentMix);
  const totalWeight = entries.reduce((sum, [, weight]) => {
    if (!Number.isFinite(weight) || weight < 0) {
      throw new Error("opponent weights must be non-negative numbers");
    }
    return sum + weight;
  }, 0);

  if (totalWeight <= 0) {
    throw new Error("opponent weights must have a positive total");
  }

  const allocations = entries.map(([name, weight], index) => {
    const exactCount = (gameCount * weight) / totalWeight;
    return {
      name,
      index,
      count: Math.floor(exactCount),
      remainder: exactCount - Math.floor(exactCount),
    };
  });
  let remainingGames = gameCount - allocations.reduce((sum, entry) => sum + entry.count, 0);

  const remainderOrder = [...allocations].sort(
    (first, second) => second.remainder - first.remainder || first.index - second.index,
  );

  for (let index = 0; index < remainingGames; index++) {
    remainderOrder[index].count++;
  }

  return Object.fromEntries(allocations.map(({ name, count }) => [name, count]));
}

function combineMatchStats(gameCount, opponentMix, allocation, breakdown) {
  const totals = Object.values(breakdown).reduce(
    (combined, stats) => {
      combined.modelWins += stats.modelWins;
      combined.opponentWins += stats.opponentWins;
      combined.draws += stats.draws;
      combined.modelBlackGames += stats.modelBlackGames;
      combined.modelWhiteGames += stats.modelWhiteGames;
      combined.totalModelStones += stats.totalModelStones;
      combined.totalOpponentStones += stats.totalOpponentStones;
      return combined;
    },
    {
      modelWins: 0,
      opponentWins: 0,
      draws: 0,
      modelBlackGames: 0,
      modelWhiteGames: 0,
      totalModelStones: 0,
      totalOpponentStones: 0,
    },
  );

  return {
    gameCount,
    opponentMix: { ...opponentMix },
    allocation,
    breakdown,
    ...totals,
    modelWinRate: totals.modelWins / gameCount,
    opponentWinRate: totals.opponentWins / gameCount,
    drawRate: totals.draws / gameCount,
    averageModelStones: totals.totalModelStones / gameCount,
    averageOpponentStones: totals.totalOpponentStones / gameCount,
    averageStoneDifference: (totals.totalModelStones - totals.totalOpponentStones) / gameCount,
  };
}

function simulateMixedMatches({
  model = DEFAULT_MODEL,
  pastModel = DEFAULT_MODEL,
  gameCount = 100,
  opponentMix = DEFAULT_OPPONENT_MIX,
  random = Math.random,
  openingBook = null,
  searchDepth = 1,
} = {}) {
  validateModel(model);
  validateModel(pastModel);

  const allocation = allocateOpponentGames(gameCount, opponentMix);
  const breakdown = {};
  let scheduledGames = 0;
  const cpuTypes = {
    weak: WEAK,
    normal: NORMAL,
    strong: STRONG,
  };

  for (const [name, opponentCpu] of Object.entries(cpuTypes)) {
    const allocatedGames = allocation[name] ?? 0;
    if (allocatedGames === 0) continue;

    const startModelColor = scheduledGames % 2 === 0 ? BLACK : WHITE;
    breakdown[name] = simulateModelMatches({
      model,
      opponentCpu,
      gameCount: allocatedGames,
      startModelColor,
      random,
      openingBook,
      searchDepth,
    });
    scheduledGames += allocatedGames;
  }

  if ((allocation.pastModel ?? 0) > 0) {
    const startModelColor = scheduledGames % 2 === 0 ? BLACK : WHITE;
    breakdown.pastModel = simulateModelsMatches({
      model,
      opponentModel: pastModel,
      gameCount: allocation.pastModel,
      startModelColor,
      random,
      searchDepth,
    });
  }

  return combineMatchStats(gameCount, opponentMix, allocation, breakdown);
}

module.exports = {
  DEFAULT_OPPONENT_MIX,
  allocateOpponentGames,
  simulateMixedMatches,
};
