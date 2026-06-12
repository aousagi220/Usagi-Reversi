const {
  BLACK,
  cloneBoard,
  getValidMoves,
  getOpponent,
  isGameEnd,
  placeStone,
  countStones,
} = require("../Automation/reversiEngine");
const {
  canonicalizeBoard,
  transformCoordinate,
  inverseTransformCoordinate,
} = require("../Automation/boardSymmetry");
const { DEFAULT_MODEL, validateModel, evaluateBoard } = require("./evaluator");

const TERMINAL_WIN_SCORE = 1_000_000;
const TRANSPOSITION_EXACT = "exact";
const TRANSPOSITION_LOWER = "lower";
const TRANSPOSITION_UPPER = "upper";
const SEARCH_TIMEOUT = Symbol("search-timeout");

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

function validateTimeLimit(timeLimitMs) {
  if (
    timeLimitMs !== null &&
    (!Number.isFinite(timeLimitMs) || timeLimitMs <= 0)
  ) {
    throw new Error("timeLimitMs must be a positive number or null");
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
  return `${player}:${canonicalizeBoard(board).key}`;
}

function createTranspositionPosition(board, player) {
  const canonical = canonicalizeBoard(board);
  return {
    key: `${player}:${canonical.key}`,
    transform: canonical.transform,
  };
}

function moveKey(player, x, y) {
  return `${player}:${x}:${y}`;
}

function isSameMove(firstMove, secondMove) {
  return firstMove !== null &&
    secondMove !== null &&
    firstMove[0] === secondMove[0] &&
    firstMove[1] === secondMove[1];
}

function orderMovesByHeuristic(
  moves,
  board,
  player,
  model,
  {
    preferredMove = null,
    killerMoves = [],
    history = null,
  } = {},
) {
  const orderedMoves = moves
    .map(([x, y]) => {
      const nextBoard = cloneBoard(board);
      placeStone(nextBoard, x, y, player);
      const killerIndex = killerMoves.findIndex((killerMove) =>
        isSameMove(killerMove, [x, y]),
      );

      return {
        x,
        y,
        board: nextBoard,
        heuristicScore: evaluateBoard(nextBoard, player, model),
        preferred: isSameMove(preferredMove, [x, y]),
        killerIndex,
        historyScore: history?.get(moveKey(player, x, y)) ?? 0,
      };
    })
    .sort((first, second) => {
      if (first.preferred !== second.preferred) return first.preferred ? -1 : 1;
      if (second.heuristicScore !== first.heuristicScore) {
        return second.heuristicScore - first.heuristicScore;
      }
      if (first.killerIndex !== second.killerIndex) {
        if (first.killerIndex === -1) return 1;
        if (second.killerIndex === -1) return -1;
        return first.killerIndex - second.killerIndex;
      }
      if (second.historyScore !== first.historyScore) {
        return second.historyScore - first.historyScore;
      }
      return 0;
    });

  return orderedMoves;
}

function recordCutoff(searchContext, ply, player, move, depth) {
  if (searchContext === null) return;

  const killers = searchContext.killers.get(ply) ?? [];
  const cutoffMove = [move.x, move.y];
  if (!killers.some((killerMove) => isSameMove(killerMove, cutoffMove))) {
    killers.unshift(cutoffMove);
    searchContext.killers.set(ply, killers.slice(0, 2));
  }

  const key = moveKey(player, move.x, move.y);
  searchContext.history.set(
    key,
    (searchContext.history.get(key) ?? 0) + depth * depth,
  );
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
  searchContext = null,
  ply = 0,
) {
  if (
    searchContext !== null &&
    searchContext.deadline !== null &&
    Date.now() >= searchContext.deadline
  ) {
    throw SEARCH_TIMEOUT;
  }
  if (searchStats !== null) {
    searchStats.nodes = (searchStats.nodes ?? 0) + 1;
  }

  const alphaStart = alpha;
  const betaStart = beta;
  const position = transpositionTable === null
    ? null
    : createTranspositionPosition(board, player);
  const boardKey = position?.key ?? null;
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
      searchContext,
      ply,
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
  const preferredMove = cachedEntry?.bestMove
    ? inverseTransformCoordinate(cachedEntry.bestMove, position.transform)
    : null;

  for (const move of orderMovesByHeuristic(
    moves,
    board,
    player,
    model,
    {
      preferredMove,
      killerMoves: searchContext?.killers.get(ply) ?? [],
      history: searchContext?.history ?? null,
    },
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
      searchContext,
      ply + 1,
    );

    if (score > bestScore) {
      bestScore = score;
      bestMove = [move.x, move.y];
    }

    if (score > alpha) {
      alpha = score;
    }

    if (alpha >= beta) {
      recordCutoff(searchContext, ply, player, move, depth);
      if (searchStats !== null) {
        searchStats.cutoffs = (searchStats.cutoffs ?? 0) + 1;
      }
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
    bestMove === null || position === null
      ? null
      : transformCoordinate(bestMove, position.transform),
  );
  return bestScore;
}

function searchRoot(
  board,
  player,
  model,
  depth,
  transpositionTable,
  searchStats,
  searchContext,
  preferredMove = null,
) {
  const validMoves = getValidMoves(board, player);
  const orderedMoves = orderMovesByHeuristic(validMoves, board, player, model, {
    preferredMove,
    killerMoves: searchContext?.killers.get(0) ?? [],
    history: searchContext?.history ?? null,
  });
  const opponent = getOpponent(player);
  let bestScore = -Infinity;
  let alpha = -Infinity;
  const bestMoves = [];

  for (const move of orderedMoves) {
    let score = -negamax(
      move.board,
      opponent,
      depth - 1,
      -Infinity,
      -alpha,
      model,
      transpositionTable,
      searchStats,
      searchContext,
      1,
    );

    if (score === bestScore && bestMoves.length > 0) {
      score = -negamax(
        move.board,
        opponent,
        depth - 1,
        -Infinity,
        Infinity,
        model,
        transpositionTable,
        searchStats,
        searchContext,
        1,
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

  return { bestScore, bestMoves };
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
    useIterativeDeepening = false,
    useSearchHeuristics = true,
    timeLimitMs = null,
    searchStats = null,
  } = {},
) {
  validateSearchDepth(searchDepth);
  validateEndgameThreshold(endgameThreshold);
  validateTimeLimit(timeLimitMs);
  validateModel(model);

  const validMoves = getValidMoves(board, player);
  if (validMoves.length === 0) return null;

  const emptyCount = countStones(board).empty;
  const isEndgameSearch = endgameThreshold > 0 && emptyCount <= endgameThreshold;
  const effectiveSearchDepth = isEndgameSearch
    ? emptyCount
    : searchDepth;
  const transpositionTable = useTranspositionTable ? new Map() : null;
  const shouldIterate = (useIterativeDeepening || timeLimitMs !== null) &&
    !isEndgameSearch;
  const searchContext = useSearchHeuristics || timeLimitMs !== null
    ? {
        killers: new Map(),
        history: new Map(),
        deadline: timeLimitMs === null ? null : Date.now() + timeLimitMs,
      }
    : null;
  const firstDepth = shouldIterate
    ? 1
    : effectiveSearchDepth;
  let result = null;
  let preferredMove = null;

  for (let depth = firstDepth; depth <= effectiveSearchDepth; depth++) {
    try {
      const iterationResult = searchRoot(
        board,
        player,
        model,
        depth,
        transpositionTable,
        searchStats,
        searchContext,
        preferredMove,
      );
      result = iterationResult;
      preferredMove = result.bestMoves[0] ?? null;
      if (searchStats !== null) {
        searchStats.completedDepth = depth;
        searchStats.iterations = (searchStats.iterations ?? 0) + 1;
      }
    } catch (error) {
      if (error !== SEARCH_TIMEOUT) throw error;
      if (searchStats !== null) searchStats.timedOut = true;
      break;
    }
  }

  if (result === null) {
    const fallbackMoves = orderMovesByHeuristic(validMoves, board, player, model);
    return [fallbackMoves[0].x, fallbackMoves[0].y];
  }

  return selectRandomMove(result.bestMoves, random);
}

module.exports = {
  createBoardKey,
  evaluateTerminalBoard,
  negamax,
  scoreMoves,
  selectModelMove,
  validateEndgameThreshold,
  validateTimeLimit,
};
