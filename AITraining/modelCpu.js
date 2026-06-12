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
const TRANSPOSITION_EXACT = "exact";
const TRANSPOSITION_LOWER = "lower";
const TRANSPOSITION_UPPER = "upper";

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

function createBoardKey(board, player) {
  return `${player}:${board.flat().join("")}`;
}

function orderMovesByHeuristic(moves, board, player, model, preferredMove = null) {
  const orderedMoves = moves
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

  if (preferredMove !== null) {
    const preferredIndex = orderedMoves.findIndex(
      ({ x, y }) => x === preferredMove[0] && y === preferredMove[1],
    );
    if (preferredIndex > 0) {
      orderedMoves.unshift(orderedMoves.splice(preferredIndex, 1)[0]);
    }
  }

  return orderedMoves;
}

function getTranspositionScore(entry, depth, alpha, beta) {
  if (!entry || entry.depth < depth) return null;
  if (entry.flag === TRANSPOSITION_EXACT) return entry.score;
  if (entry.flag === TRANSPOSITION_LOWER && entry.score >= beta) return entry.score;
  if (entry.flag === TRANSPOSITION_UPPER && entry.score <= alpha) return entry.score;
  return null;
}

function saveTransposition(table, key, depth, score, alpha, beta, bestMove = null) {
  if (table === null) return;

  let flag = TRANSPOSITION_EXACT;
  if (score <= alpha) {
    flag = TRANSPOSITION_UPPER;
  } else if (score >= beta) {
    flag = TRANSPOSITION_LOWER;
  }

  const currentEntry = table.get(key);
  if (!currentEntry || currentEntry.depth <= depth) {
    table.set(key, { depth, score, flag, bestMove });
  }
}

function negamax(
  board,
  player,
  depth,
  alpha,
  beta,
  model,
  transpositionTable = null,
  searchStats = null,
) {
  if (searchStats !== null) {
    searchStats.nodes = (searchStats.nodes ?? 0) + 1;
  }

  const alphaStart = alpha;
  const betaStart = beta;
  const boardKey = transpositionTable === null ? null : createBoardKey(board, player);
  const cachedEntry = boardKey === null ? null : transpositionTable.get(boardKey);
  const cachedScore = getTranspositionScore(cachedEntry, depth, alpha, beta);
  if (cachedScore !== null) {
    if (searchStats !== null) {
      searchStats.cacheHits = (searchStats.cacheHits ?? 0) + 1;
    }
    return cachedScore;
  }

  if (isGameEnd(board)) {
    const score = evaluateTerminalBoard(board, player);
    saveTransposition(
      transpositionTable,
      boardKey,
      depth,
      score,
      alphaStart,
      betaStart,
    );
    return score;
  }

  if (depth === 0) {
    const score = evaluateBoard(board, player, model);
    saveTransposition(
      transpositionTable,
      boardKey,
      depth,
      score,
      alphaStart,
      betaStart,
    );
    return score;
  }

  const moves = getValidMoves(board, player);

  if (moves.length === 0) {
    const score = -negamax(
      board,
      getOpponent(player),
      depth,
      -beta,
      -alpha,
      model,
      transpositionTable,
      searchStats,
    );
    saveTransposition(
      transpositionTable,
      boardKey,
      depth,
      score,
      alphaStart,
      betaStart,
    );
    return score;
  }

  let bestScore = -Infinity;
  let bestMove = null;

  for (const move of orderMovesByHeuristic(
    moves,
    board,
    player,
    model,
    cachedEntry?.bestMove,
  )) {
    const score = -negamax(
      move.board,
      getOpponent(player),
      depth - 1,
      -beta,
      -alpha,
      model,
      transpositionTable,
      searchStats,
    );

    if (score > bestScore) {
      bestScore = score;
      bestMove = [move.x, move.y];
    }

    if (score > alpha) {
      alpha = score;
    }

    if (alpha >= beta) {
      break;
    }
  }

  saveTransposition(
    transpositionTable,
    boardKey,
    depth,
    bestScore,
    alphaStart,
    betaStart,
    bestMove,
  );
  return bestScore;
}

function selectModelMove(
  board,
  player,
  model = DEFAULT_MODEL,
  random = Math.random,
  {
    searchDepth = 1,
    endgameThreshold = 0,
    useTranspositionTable = true,
    searchStats = null,
  } = {},
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
  const transpositionTable = useTranspositionTable ? new Map() : null;
  let bestScore = -Infinity;
  let alpha = -Infinity;
  const bestMoves = [];

  for (const move of orderedMoves) {
    let score = -negamax(
      move.board,
      opponent,
      effectiveSearchDepth - 1,
      -Infinity,
      -alpha,
      model,
      transpositionTable,
      searchStats,
    );

    // A root-window cutoff can only prove that this move is no better than
    // the current best. Re-search the boundary value to preserve random ties.
    if (score === bestScore && bestMoves.length > 0) {
      score = -negamax(
        move.board,
        opponent,
        effectiveSearchDepth - 1,
        -Infinity,
        Infinity,
        model,
        transpositionTable,
        searchStats,
      );
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
  createBoardKey,
  evaluateTerminalBoard,
  negamax,
  scoreMoves,
  selectModelMove,
  validateEndgameThreshold,
};
