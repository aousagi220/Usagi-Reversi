const {
  BLACK,
  WHITE,
  createBoard,
  cloneBoard,
  getOpponent,
  placeStone,
  isGameEnd,
  countStones,
} = require("./reversiEngine");
const {
  WEAK,
  NORMAL,
  STRONG,
  selectCpuMove,
} = require("./cpuStrategies");

const CPU_NAMES = {
  [WEAK]: "弱CPU",
  [NORMAL]: "普通CPU",
  [STRONG]: "強CPU",
};

function getWinner(score) {
  if (score.black > score.white) return BLACK;
  if (score.white > score.black) return WHITE;
  return null;
}

function simulateGame({
  blackCpu = STRONG,
  whiteCpu = NORMAL,
  random = Math.random,
} = {}) {
  const board = createBoard();
  const moves = [];
  let currentPlayer = BLACK;
  let passCount = 0;

  while (!isGameEnd(board)) {
    const cpuType = currentPlayer === BLACK ? blackCpu : whiteCpu;
    const boardBeforeMove = cloneBoard(board);
    const move = selectCpuMove(board, currentPlayer, cpuType, random);

    if (move === null) {
      moves.push({
        turn: moves.length + 1,
        player: currentPlayer,
        board: boardBeforeMove,
        move: null,
      });
      passCount++;
      currentPlayer = getOpponent(currentPlayer);
      continue;
    }

    const [x, y] = move;
    if (!placeStone(board, x, y, currentPlayer)) {
      throw new Error(`CPU selected an invalid move: ${x}, ${y}`);
    }

    moves.push({
      turn: moves.length + 1,
      player: currentPlayer,
      board: boardBeforeMove,
      move: [x, y],
    });
    currentPlayer = getOpponent(currentPlayer);
  }

  const score = countStones(board);

  return {
    blackCpu,
    whiteCpu,
    winner: getWinner(score),
    score,
    passCount,
    moves,
    board,
  };
}

function formatWinner(winner) {
  if (winner === BLACK) return "黒";
  if (winner === WHITE) return "白";
  return "引き分け";
}

function printResult(result) {
  console.log(`黒: ${CPU_NAMES[result.blackCpu]}`);
  console.log(`白: ${CPU_NAMES[result.whiteCpu]}`);
  console.log(`結果: 黒 ${result.score.black} - ${result.score.white} 白`);
  console.log(`勝者: ${formatWinner(result.winner)}`);
  console.log(`手数: ${result.moves.length - result.passCount}`);
  console.log(`パス: ${result.passCount}`);
}

if (require.main === module) {
  printResult(simulateGame());
}

module.exports = {
  getWinner,
  simulateGame,
  formatWinner,
  printResult,
};
