const { BLACK, WHITE } = require("./reversiEngine");
const { WEAK, NORMAL, STRONG } = require("./cpuStrategies");
const { simulateGame } = require("./simulate");

const CPU_NAMES = {
  [WEAK]: "弱CPU",
  [NORMAL]: "普通CPU",
  [STRONG]: "強CPU",
};

function createStats(cpuA, cpuB, gameCount) {
  return {
    cpuA,
    cpuB,
    gameCount,
    cpuAWins: 0,
    cpuBWins: 0,
    draws: 0,
    blackWins: 0,
    whiteWins: 0,
    cpuABlackGames: 0,
    cpuAWhiteGames: 0,
    totalBlackScore: 0,
    totalWhiteScore: 0,
  };
}

function recordResult(stats, result, cpuAColor) {
  stats.totalBlackScore += result.score.black;
  stats.totalWhiteScore += result.score.white;

  if (cpuAColor === BLACK) {
    stats.cpuABlackGames++;
  } else {
    stats.cpuAWhiteGames++;
  }

  if (result.winner === null) {
    stats.draws++;
    return;
  }

  if (result.winner === BLACK) {
    stats.blackWins++;
  } else {
    stats.whiteWins++;
  }

  if (result.winner === cpuAColor) {
    stats.cpuAWins++;
  } else {
    stats.cpuBWins++;
  }
}

function simulateMany({
  cpuA = STRONG,
  cpuB = NORMAL,
  gameCount = 100,
  random = Math.random,
  onGameComplete = null,
} = {}) {
  if (!Number.isInteger(gameCount) || gameCount <= 0) {
    throw new Error("gameCount must be a positive integer");
  }

  const stats = createStats(cpuA, cpuB, gameCount);

  for (let gameIndex = 0; gameIndex < gameCount; gameIndex++) {
    const cpuAColor = gameIndex % 2 === 0 ? BLACK : WHITE;
    const result = simulateGame({
      blackCpu: cpuAColor === BLACK ? cpuA : cpuB,
      whiteCpu: cpuAColor === WHITE ? cpuA : cpuB,
      random,
    });

    recordResult(stats, result, cpuAColor);

    if (onGameComplete !== null) {
      onGameComplete(result, gameIndex);
    }
  }

  return {
    ...stats,
    cpuAWinRate: stats.cpuAWins / gameCount,
    cpuBWinRate: stats.cpuBWins / gameCount,
    drawRate: stats.draws / gameCount,
    blackWinRate: stats.blackWins / gameCount,
    whiteWinRate: stats.whiteWins / gameCount,
    averageBlackScore: stats.totalBlackScore / gameCount,
    averageWhiteScore: stats.totalWhiteScore / gameCount,
  };
}

function formatPercent(rate) {
  return `${(rate * 100).toFixed(1)}%`;
}

function printStats(stats) {
  console.log(`${CPU_NAMES[stats.cpuA]} vs ${CPU_NAMES[stats.cpuB]}: ${stats.gameCount}試合`);
  console.log(
    `${CPU_NAMES[stats.cpuA]}: ${stats.cpuAWins}勝 (${formatPercent(stats.cpuAWinRate)})`,
  );
  console.log(
    `${CPU_NAMES[stats.cpuB]}: ${stats.cpuBWins}勝 (${formatPercent(stats.cpuBWinRate)})`,
  );
  console.log(`引き分け: ${stats.draws} (${formatPercent(stats.drawRate)})`);
  console.log(
    `黒勝ち: ${stats.blackWins} / 白勝ち: ${stats.whiteWins}`,
  );
  console.log(
    `平均得点: 黒 ${stats.averageBlackScore.toFixed(1)} - ${stats.averageWhiteScore.toFixed(1)} 白`,
  );
}

if (require.main === module) {
  const gameCount = Number(process.argv[2] ?? 100);
  const shouldSave = process.argv.includes("--save");
  let database = null;
  let onGameComplete = null;

  if (shouldSave) {
    const {
      DEFAULT_DATABASE_PATH,
      openDatabase,
      saveGame,
    } = require("./database");

    database = openDatabase();
    onGameComplete = (result) => saveGame(database, result);
    console.log(`保存先: ${DEFAULT_DATABASE_PATH}`);
  }

  const stats = simulateMany({ gameCount, onGameComplete });
  printStats(stats);
  database?.close();
}

module.exports = {
  simulateMany,
  formatPercent,
  printStats,
};
