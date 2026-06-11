const fs = require("node:fs");
const path = require("node:path");
const {
  BLACK,
  WHITE,
  createBoard,
  getOpponent,
  placeStone,
  isGameEnd,
  countStones,
} = require("../Automation/reversiEngine");
const { WEAK, NORMAL, STRONG, selectCpuMove } = require("../Automation/cpuStrategies");
const { getWinner } = require("../Automation/simulate");
const { DEFAULT_MODEL, validateModel } = require("./evaluator");
const { selectModelMove } = require("./modelCpu");

const CPU_NAMES = {
  [WEAK]: "弱CPU",
  [NORMAL]: "普通CPU",
  [STRONG]: "強CPU",
};

function validateSearchDepth(searchDepth) {
  if (!Number.isInteger(searchDepth) || searchDepth < 1) {
    throw new Error("searchDepth must be a positive integer");
  }
}

function simulateGame({
  model,
  modelColor = BLACK,
  selectOpponentMove,
  random = Math.random,
  opponentDetails = {},
  searchDepth = 1,
}) {
  validateModel(model);
  validateSearchDepth(searchDepth);

  if (modelColor !== BLACK && modelColor !== WHITE) {
    throw new Error("modelColor must be BLACK or WHITE");
  }

  const board = createBoard();
  const moves = [];
  let currentPlayer = BLACK;
  let passCount = 0;

  while (!isGameEnd(board)) {
    const isModelTurn = currentPlayer === modelColor;
    const move = isModelTurn
      ? selectModelMove(board, currentPlayer, model, random, { searchDepth })
      : selectOpponentMove(board, currentPlayer);

    if (move === null) {
      moves.push({
        turn: moves.length + 1,
        player: currentPlayer,
        move: null,
        source: isModelTurn ? "model" : "opponent",
      });
      passCount++;
      currentPlayer = getOpponent(currentPlayer);
      continue;
    }

    const [x, y] = move;
    if (!placeStone(board, x, y, currentPlayer)) {
      throw new Error(`Player selected an invalid move: ${x}, ${y}`);
    }

    moves.push({
      turn: moves.length + 1,
      player: currentPlayer,
      move: [x, y],
      source: isModelTurn ? "model" : "opponent",
    });
    currentPlayer = getOpponent(currentPlayer);
  }

  const score = countStones(board);
  const winner = getWinner(score);

  return {
    modelColor,
    ...opponentDetails,
    winner,
    modelWon: winner === modelColor,
    opponentWon: winner !== null && winner !== modelColor,
    score,
    modelStoneCount: modelColor === BLACK ? score.black : score.white,
    opponentStoneCount: modelColor === BLACK ? score.white : score.black,
    passCount,
    moves,
    board,
  };
}

function simulateModelGame({
  model = DEFAULT_MODEL,
  modelColor = BLACK,
  opponentCpu = STRONG,
  random = Math.random,
  openingBook = null,
  searchDepth = 1,
} = {}) {
  return simulateGame({
    model,
    modelColor,
    selectOpponentMove: (board, player) => selectCpuMove(board, player, opponentCpu, random, openingBook),
    random,
    opponentDetails: { opponentCpu },
    searchDepth,
  });
}

function simulateModelsGame({
  model = DEFAULT_MODEL,
  opponentModel = DEFAULT_MODEL,
  modelColor = BLACK,
  random = Math.random,
  searchDepth = 1,
} = {}) {
  validateModel(opponentModel);
  validateSearchDepth(searchDepth);

  return simulateGame({
    model,
    modelColor,
    selectOpponentMove: (board, player) => selectModelMove(board, player, opponentModel, random, { searchDepth }),
    random,
    opponentDetails: { opponentType: "model" },
    searchDepth,
  });
}

function createMatchStats(gameCount, details = {}) {
  return {
    gameCount,
    ...details,
    modelWins: 0,
    opponentWins: 0,
    draws: 0,
    modelBlackGames: 0,
    modelWhiteGames: 0,
    totalModelStones: 0,
    totalOpponentStones: 0,
  };
}

function addGameResult(stats, result) {
  if (result.modelColor === BLACK) {
    stats.modelBlackGames++;
  } else {
    stats.modelWhiteGames++;
  }

  if (result.modelWon) {
    stats.modelWins++;
  } else if (result.opponentWon) {
    stats.opponentWins++;
  } else {
    stats.draws++;
  }

  stats.totalModelStones += result.modelStoneCount;
  stats.totalOpponentStones += result.opponentStoneCount;
}

function calculateMatchRates(stats) {
  return {
    ...stats,
    modelWinRate: stats.modelWins / stats.gameCount,
    opponentWinRate: stats.opponentWins / stats.gameCount,
    drawRate: stats.draws / stats.gameCount,
    averageModelStones: stats.totalModelStones / stats.gameCount,
    averageOpponentStones: stats.totalOpponentStones / stats.gameCount,
    averageStoneDifference: (stats.totalModelStones - stats.totalOpponentStones) / stats.gameCount,
  };
}

function getAlternatingColor(startModelColor, gameIndex) {
  if (startModelColor !== BLACK && startModelColor !== WHITE) {
    throw new Error("startModelColor must be BLACK or WHITE");
  }

  if (gameIndex % 2 === 0) return startModelColor;
  return getOpponent(startModelColor);
}

function simulateModelMatches({
  model = DEFAULT_MODEL,
  opponentCpu = STRONG,
  gameCount = 100,
  startModelColor = BLACK,
  random = Math.random,
  openingBook = null,
  searchDepth = 1,
} = {}) {
  validateModel(model);
  validateSearchDepth(searchDepth);

  if (!Number.isInteger(gameCount) || gameCount <= 0) {
    throw new Error("gameCount must be a positive integer");
  }

  const stats = createMatchStats(gameCount, { opponentCpu });

  for (let gameIndex = 0; gameIndex < gameCount; gameIndex++) {
    const modelColor = getAlternatingColor(startModelColor, gameIndex);
    const result = simulateModelGame({
      model,
      modelColor,
      opponentCpu,
      random,
      openingBook,
      searchDepth,
    });

    addGameResult(stats, result);
  }

  return calculateMatchRates(stats);
}

function simulateModelsMatches({
  model = DEFAULT_MODEL,
  opponentModel = DEFAULT_MODEL,
  gameCount = 100,
  startModelColor = BLACK,
  random = Math.random,
  searchDepth = 1,
} = {}) {
  validateModel(model);
  validateModel(opponentModel);
  validateSearchDepth(searchDepth);

  if (!Number.isInteger(gameCount) || gameCount <= 0) {
    throw new Error("gameCount must be a positive integer");
  }

  const stats = createMatchStats(gameCount, { opponentType: "model" });

  for (let gameIndex = 0; gameIndex < gameCount; gameIndex++) {
    const modelColor = getAlternatingColor(startModelColor, gameIndex);
    const result = simulateModelsGame({
      model,
      opponentModel,
      modelColor,
      random,
      searchDepth,
    });
    addGameResult(stats, result);
  }

  return calculateMatchRates(stats);
}

function formatPercent(rate) {
  return `${(rate * 100).toFixed(1)}%`;
}

function printTrainingStats(stats) {
  console.log(`学習モデル vs ${CPU_NAMES[stats.opponentCpu]}: ${stats.gameCount}試合`);
  console.log(`学習モデル: ${stats.modelWins}勝 (${formatPercent(stats.modelWinRate)})`);
  console.log(`${CPU_NAMES[stats.opponentCpu]}: ${stats.opponentWins}勝 (${formatPercent(stats.opponentWinRate)})`);
  console.log(`引き分け: ${stats.draws} (${formatPercent(stats.drawRate)})`);
  console.log(
    `平均石数: モデル ${stats.averageModelStones.toFixed(1)} - ${stats.averageOpponentStones.toFixed(1)} 相手`,
  );
  console.log(`平均石差: ${stats.averageStoneDifference.toFixed(1)}`);
}

function loadOpeningBook() {
  const openingBookPath = path.join(__dirname, "..", "Automation", "data", "openingBook.json");

  if (!fs.existsSync(openingBookPath)) return null;
  return JSON.parse(fs.readFileSync(openingBookPath, "utf8"));
}

if (require.main === module) {
  const commandArguments = process.argv.slice(2);
  const positionalArguments = commandArguments.filter((argument) => !argument.startsWith("--"));
  const gameCount = Number(positionalArguments[0] ?? 100);
  const searchDepthArgument = commandArguments.find((argument) => argument.startsWith("--search-depth="));
  const searchDepth = searchDepthArgument ? Number(searchDepthArgument.slice("--search-depth=".length)) : 1;
  const stats = simulateModelMatches({
    gameCount,
    openingBook: loadOpeningBook(),
    searchDepth,
  });

  printTrainingStats(stats);
}

module.exports = {
  simulateModelGame,
  simulateModelMatches,
  simulateModelsGame,
  simulateModelsMatches,
  formatPercent,
  printTrainingStats,
  loadOpeningBook,
};
