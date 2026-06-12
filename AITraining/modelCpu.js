const {
  BLACK,
  cloneBoard,
  getValidMoves,
  getOpponent,
  isGameEnd,
  placeStone,
  countStones,
} = require("../Automation/reversiEngine");
const { DEFAULT_MODEL, validateModel, evaluateBoard } = require("./evaluator");

const TERMINAL_WIN_SCORE = 1_000_000;

function selectRandomMove(moves, random = Math.random) {
  if (moves.length === 0) return null;

  const randomIndex = Math.floor(random() * moves.length);
  return moves[randomIndex];
}

function scoreMoves(board, player, model = DEFAULT_MODEL) {
  validateModel(model);

  return getValidMoves(board, player).map(([x, y]) => {
    const nextBoard = cloneBoard(board);
    placeStone(nextBoard, x, y, player);

    return {
      x,
      y,
      score: evaluateBoard(nextBoard, player, model),
    };
  });
}

function validateSearchDepth(searchDepth) {
  if (!Number.isInteger(searchDepth) || searchDepth < 1) {
    throw new Error("searchDepth must be an integer of at least 1");
  }
}

function validateEndgameThreshold(endgameThreshold) {
  if (!Number.isInteger(endgameThreshold) || endgameThreshold < 0 || endgameThreshold > 60) {
    throw new Error("endgameThreshold must be an integer between 0 and 60");
  }
}

function evaluateTerminalBoard(board, player) {
  const stoneCount = countStones(board);
  const playerStoneCount = player === BLACK ? stoneCount.black : stoneCount.white;
  const opponentStoneCount = player === BLACK ? stoneCount.white : stoneCount.black;
  const stoneDifference = playerStoneCount - opponentStoneCount;

  if (stoneDifference > 0) return TERMINAL_WIN_SCORE + stoneDifference;
  if (stoneDifference < 0) return -TERMINAL_WIN_SCORE + stoneDifference;
  return 0;
}

function orderMovesByHeuristic(moves, board, player, model) {
  return moves
    .map(([x, y]) => {
      const nextBoard = cloneBoard(board);
      placeStone(nextBoard, x, y, player);

      return {
        x,
        y,
        board: nextBoard,
        heuristicScore: evaluateBoard(nextBoard, player, model),
      };
    })
    .sort((first, second) => second.heuristicScore - first.heuristicScore);
}

function negamax(board, player, depth, alpha, beta, model) {
  if (isGameEnd(board)) {
    return evaluateTerminalBoard(board, player);
  }

  if (depth === 0) {
    return evaluateBoard(board, player, model);
  }

  const moves = getValidMoves(board, player);

  if (moves.length === 0) {
    return -negamax(board, getOpponent(player), depth, -beta, -alpha, model);
  }

  let bestScore = -Infinity;

  for (const move of orderMovesByHeuristic(moves, board, player, model)) {
    const score = -negamax(move.board, getOpponent(player), depth - 1, -beta, -alpha, model);

    if (score > bestScore) {
      bestScore = score;
    }

    if (score > alpha) {
      alpha = score;
    }

    if (alpha >= beta) {
      break;
    }
  }

  return bestScore;
}

function selectModelMove(
  board,
  player,
  model = DEFAULT_MODEL,
  random = Math.random,
  { searchDepth = 1, endgameThreshold = 0 } = {},
) {
  validateSearchDepth(searchDepth);
  validateEndgameThreshold(endgameThreshold);
  validateModel(model);

  const validMoves = getValidMoves(board, player);
  if (validMoves.length === 0) return null;

  const emptyCount = countStones(board).empty;
  const effectiveSearchDepth = endgameThreshold > 0 && emptyCount <= endgameThreshold
    ? emptyCount
    : searchDepth;
  const orderedMoves = orderMovesByHeuristic(validMoves, board, player, model);
  const opponent = getOpponent(player);
  let bestScore = -Infinity;
  let alpha = -Infinity;
  const bestMoves = [];

  for (const move of orderedMoves) {
    let score = -negamax(move.board, opponent, effectiveSearchDepth - 1, -Infinity, -alpha, model);

    // A root-window cutoff can only prove that this move is no better than
    // the current best. Re-search the boundary value to preserve random ties.
    if (score === bestScore && bestMoves.length > 0) {
      score = -negamax(move.board, opponent, effectiveSearchDepth - 1, -Infinity, Infinity, model);
    }

    if (score > bestScore) {
      bestScore = score;
      alpha = score;
      bestMoves.length = 0;
      bestMoves.push([move.x, move.y]);
      continue;
    }

    if (score === bestScore) {
      bestMoves.push([move.x, move.y]);
    }
  }

  if (bestMoves.length === 0) {
    return null;
  }

  return selectRandomMove(bestMoves, random);
}

module.exports = {
  evaluateTerminalBoard,
  negamax,
  scoreMoves,
  selectModelMove,
  validateEndgameThreshold,
};
