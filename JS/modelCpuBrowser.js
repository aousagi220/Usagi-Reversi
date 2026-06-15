const MODEL_CPU_MAX_SEARCH_DEPTH = 8;
const MODEL_CPU_TIME_LIMIT_MS = 350;
const MODEL_CPU_ENDGAME_THRESHOLD = 8;
const MODEL_CPU_WIN_SCORE = 1000000;
const MODEL_CPU_TT_EXACT = "exact";
const MODEL_CPU_TT_LOWER = "lower";
const MODEL_CPU_TT_UPPER = "upper";
const MODEL_CPU_TIMEOUT = Symbol("model-cpu-timeout");
const MODEL_FEATURE_NAMES = [
  "stoneDifference",
  "mobilityDifference",
  "cornerDifference",
  "edgeDifference",
  "frontierDifference",
  "cSquareDifference",
  "xSquareDifference",
  "stableDiscDifference",
];
const MODEL_FEATURE_SCALES = [64, 32, 4, 24, 64, 8, 4, 28];

function cloneModelBoard(board) {
  return board.map((row) => [...row]);
}

function getModelOpponent(player) {
  return player === BLACK ? WHITE : BLACK;
}

function transformModelCoordinate([x, y], transform) {
  const last = BOARD_SIZE - 1;
  switch (transform) {
    case 0: return [x, y];
    case 1: return [y, last - x];
    case 2: return [last - x, last - y];
    case 3: return [last - y, x];
    case 4: return [x, last - y];
    case 5: return [last - x, y];
    case 6: return [y, x];
    case 7: return [last - y, last - x];
    default: throw new Error("transform must be between 0 and 7");
  }
}

function inverseModelCoordinate(coordinate, transform) {
  const inverseTransforms = [0, 3, 2, 1, 4, 5, 6, 7];
  return transformModelCoordinate(coordinate, inverseTransforms[transform]);
}

function canonicalizeModelBoard(board, player) {
  const boardKey = board.flat().join("");
  let canonicalKey = null;
  let canonicalTransform = 0;

  for (let transform = 0; transform < 8; transform++) {
    const transformed = Array(boardKey.length);
    for (let x = 0; x < BOARD_SIZE; x++) {
      for (let y = 0; y < BOARD_SIZE; y++) {
        const [nextX, nextY] = transformModelCoordinate([x, y], transform);
        transformed[nextX * BOARD_SIZE + nextY] = board[x][y];
      }
    }
    const candidateKey = transformed.join("");
    if (canonicalKey === null || candidateKey < canonicalKey) {
      canonicalKey = candidateKey;
      canonicalTransform = transform;
    }
  }
  return {
    key: `${player}:${canonicalKey}`,
    transform: canonicalTransform,
  };
}

function getModelFlips(board, x, y, player) {
  if (board[x][y] !== EMPTY) return [];
  const opponent = getModelOpponent(player);
  const flips = [];

  for (const [dx, dy] of DIRECTIONS) {
    const line = [];
    let nextX = x + dx;
    let nextY = y + dy;
    while (
      nextX >= 0 && nextX < BOARD_SIZE &&
      nextY >= 0 && nextY < BOARD_SIZE &&
      board[nextX][nextY] === opponent
    ) {
      line.push([nextX, nextY]);
      nextX += dx;
      nextY += dy;
    }
    if (
      line.length > 0 &&
      nextX >= 0 && nextX < BOARD_SIZE &&
      nextY >= 0 && nextY < BOARD_SIZE &&
      board[nextX][nextY] === player
    ) {
      flips.push(...line);
    }
  }
  return flips;
}

function getModelValidMoves(board, player) {
  const moves = [];
  for (let x = 0; x < BOARD_SIZE; x++) {
    for (let y = 0; y < BOARD_SIZE; y++) {
      if (getModelFlips(board, x, y, player).length > 0) moves.push([x, y]);
    }
  }
  return moves;
}

function applyModelMove(board, x, y, player) {
  const nextBoard = cloneModelBoard(board);
  const flips = getModelFlips(nextBoard, x, y, player);
  if (flips.length === 0) return null;
  nextBoard[x][y] = player;
  for (const [flipX, flipY] of flips) nextBoard[flipX][flipY] = player;
  return nextBoard;
}

function countModelBoard(board) {
  const count = { black: 0, white: 0, empty: 0 };
  for (const row of board) {
    for (const stone of row) {
      if (stone === BLACK) count.black++;
      else if (stone === WHITE) count.white++;
      else count.empty++;
    }
  }
  return count;
}

function countModelSquares(board, squares, player) {
  return squares.reduce((count, [x, y]) => count + Number(board[x][y] === player), 0);
}

function countModelFrontier(board, player) {
  let count = 0;
  for (let x = 0; x < BOARD_SIZE; x++) {
    for (let y = 0; y < BOARD_SIZE; y++) {
      if (board[x][y] !== player) continue;
      if (DIRECTIONS.some(([dx, dy]) => {
        const nextX = x + dx;
        const nextY = y + dy;
        return (
          nextX >= 0 && nextX < BOARD_SIZE &&
          nextY >= 0 && nextY < BOARD_SIZE &&
          board[nextX][nextY] === EMPTY
        );
      })) count++;
    }
  }
  return count;
}

function countModelStableEdges(board, player) {
  const stable = new Set();
  const corners = [
    [0, 0, [[0, 1], [1, 0]]],
    [0, 7, [[0, -1], [1, 0]]],
    [7, 0, [[0, 1], [-1, 0]]],
    [7, 7, [[0, -1], [-1, 0]]],
  ];
  for (const [cornerX, cornerY, directions] of corners) {
    if (board[cornerX][cornerY] !== player) continue;
    for (const [dx, dy] of directions) {
      let x = cornerX;
      let y = cornerY;
      while (
        x >= 0 && x < BOARD_SIZE &&
        y >= 0 && y < BOARD_SIZE &&
        board[x][y] === player
      ) {
        stable.add(`${x},${y}`);
        x += dx;
        y += dy;
      }
    }
  }
  return stable.size;
}

function extractBrowserModelFeatures(board, player) {
  const opponent = getModelOpponent(player);
  const count = countModelBoard(board);
  const corners = [[0, 0], [0, 7], [7, 0], [7, 7]];
  const edges = [];
  for (let index = 1; index < 7; index++) {
    edges.push([0, index], [7, index], [index, 0], [index, 7]);
  }
  const cSquares = [[0, 1], [1, 0], [0, 6], [1, 7], [6, 0], [7, 1], [6, 7], [7, 6]];
  const xSquares = [[1, 1], [1, 6], [6, 1], [6, 6]];
  const activeSquares = (squares) => squares.filter(([x, y]) => {
    const cornerX = x < 4 ? 0 : 7;
    const cornerY = y < 4 ? 0 : 7;
    return board[cornerX][cornerY] === EMPTY;
  });
  const playerStones = player === BLACK ? count.black : count.white;
  const opponentStones = opponent === BLACK ? count.black : count.white;

  return {
    stoneDifference: playerStones - opponentStones,
    mobilityDifference:
      getModelValidMoves(board, player).length - getModelValidMoves(board, opponent).length,
    cornerDifference:
      countModelSquares(board, corners, player) - countModelSquares(board, corners, opponent),
    edgeDifference:
      countModelSquares(board, edges, player) - countModelSquares(board, edges, opponent),
    frontierDifference:
      countModelFrontier(board, player) - countModelFrontier(board, opponent),
    cSquareDifference:
      countModelSquares(board, activeSquares(cSquares), player) -
      countModelSquares(board, activeSquares(cSquares), opponent),
    xSquareDifference:
      countModelSquares(board, activeSquares(xSquares), player) -
      countModelSquares(board, activeSquares(xSquares), opponent),
    stableDiscDifference:
      countModelStableEdges(board, player) - countModelStableEdges(board, opponent),
  };
}

function getBrowserModelPhase(emptyCount) {
  if (emptyCount >= 45) return ["opening", "opening", 0];
  if (emptyCount <= 14) return ["endgame", "endgame", 0];
  if (emptyCount >= 30) return ["opening", "midgame", (45 - emptyCount) / 15];
  return ["midgame", "endgame", (30 - emptyCount) / 16];
}

function evaluateBrowserNeuralPhase(features, phase) {
  const inputs = MODEL_FEATURE_NAMES.map(
    (name, index) => features[name] / MODEL_FEATURE_SCALES[index],
  );
  const hidden = phase.inputWeights.map((row) =>
    Math.tanh(row.reduce((sum, weight, index) => sum + weight * inputs[index], 0)),
  );
  return hidden.reduce(
    (sum, value, index) => sum + value * phase.outputWeights[index],
    0,
  ) * 100;
}

function evaluateBrowserModel(board, player) {
  const model = TRAINED_MODEL_DATA.model;
  const count = countModelBoard(board);
  const features = extractBrowserModelFeatures(board, player);
  const [firstPhase, secondPhase, ratio] = getBrowserModelPhase(count.empty);
  const evaluatePhase = model.type === "nn"
    ? (phase) => evaluateBrowserNeuralPhase(features, phase)
    : (phase) => MODEL_FEATURE_NAMES.reduce(
        (score, name) => score + features[name] * phase[name],
        0,
      );
  const firstScore = evaluatePhase(model[firstPhase]);
  const secondScore = evaluatePhase(model[secondPhase]);
  return firstScore + (secondScore - firstScore) * ratio;
}

function evaluateBrowserTerminal(board, player) {
  const count = countModelBoard(board);
  const difference = player === BLACK
    ? count.black - count.white
    : count.white - count.black;
  if (difference > 0) return MODEL_CPU_WIN_SCORE + difference;
  if (difference < 0) return -MODEL_CPU_WIN_SCORE + difference;
  return 0;
}

function getBrowserTranspositionScore(entry, depth, alpha, beta) {
  if (!entry || entry.depth < depth) return null;
  if (entry.flag === MODEL_CPU_TT_EXACT) return entry.score;
  if (entry.flag === MODEL_CPU_TT_LOWER && entry.score >= beta) return entry.score;
  if (entry.flag === MODEL_CPU_TT_UPPER && entry.score <= alpha) return entry.score;
  return null;
}

function saveBrowserTransposition(
  table,
  position,
  depth,
  score,
  alpha,
  beta,
  bestMove,
) {
  let flag = MODEL_CPU_TT_EXACT;
  if (score <= alpha) flag = MODEL_CPU_TT_UPPER;
  else if (score >= beta) flag = MODEL_CPU_TT_LOWER;

  const current = table.get(position.key);
  if (!current || current.depth <= depth) {
    table.set(position.key, {
      depth,
      score,
      flag,
      bestMove: bestMove === null
        ? null
        : transformModelCoordinate(bestMove, position.transform),
    });
  }
}

function browserModelNegamax(
  board,
  player,
  depth,
  alpha,
  beta,
  searchContext,
) {
  if (searchContext.now() >= searchContext.deadline) throw MODEL_CPU_TIMEOUT;
  searchContext.stats.nodes++;
  const alphaStart = alpha;
  const betaStart = beta;
  const position = canonicalizeModelBoard(board, player);
  const cached = searchContext.table.get(position.key);
  const cachedScore = getBrowserTranspositionScore(cached, depth, alpha, beta);
  if (cachedScore !== null) {
    searchContext.stats.cacheHits++;
    return cachedScore;
  }

  const moves = getModelValidMoves(board, player);
  const opponent = getModelOpponent(player);
  if (moves.length === 0 && getModelValidMoves(board, opponent).length === 0) {
    const score = evaluateBrowserTerminal(board, player);
    saveBrowserTransposition(
      searchContext.table,
      position,
      depth,
      score,
      alphaStart,
      betaStart,
      null,
    );
    return score;
  }
  if (depth === 0) {
    const score = evaluateBrowserModel(board, player);
    saveBrowserTransposition(
      searchContext.table,
      position,
      depth,
      score,
      alphaStart,
      betaStart,
      null,
    );
    return score;
  }
  if (moves.length === 0) {
    const score = -browserModelNegamax(
      board,
      opponent,
      depth,
      -beta,
      -alpha,
      searchContext,
    );
    saveBrowserTransposition(
      searchContext.table,
      position,
      depth,
      score,
      alphaStart,
      betaStart,
      null,
    );
    return score;
  }

  const preferredMove = cached?.bestMove
    ? inverseModelCoordinate(cached.bestMove, position.transform)
    : null;
  const orderedMoves = moves
    .map(([x, y]) => {
      const nextBoard = applyModelMove(board, x, y, player);
      return {
        x,
        y,
        board: nextBoard,
        score: evaluateBrowserModel(nextBoard, player),
        preferred:
          preferredMove !== null &&
          preferredMove[0] === x &&
          preferredMove[1] === y,
      };
    })
    .sort((first, second) =>
      Number(second.preferred) - Number(first.preferred) ||
      second.score - first.score,
    );
  let best = -Infinity;
  let bestMove = null;
  for (const move of orderedMoves) {
    const score = -browserModelNegamax(
      move.board,
      opponent,
      depth - 1,
      -beta,
      -alpha,
      searchContext,
    );
    if (score > best) {
      best = score;
      bestMove = [move.x, move.y];
    }
    alpha = Math.max(alpha, score);
    if (alpha >= beta) {
      searchContext.stats.cutoffs++;
      break;
    }
  }
  saveBrowserTransposition(
    searchContext.table,
    position,
    depth,
    best,
    alphaStart,
    betaStart,
    bestMove,
  );
  return best;
}

function searchBrowserModelRoot(board, player, depth, searchContext, preferredMove) {
  const moves = getModelValidMoves(board, player);
  const orderedMoves = moves
    .map(([x, y]) => {
      const nextBoard = applyModelMove(board, x, y, player);
      return {
        x,
        y,
        board: nextBoard,
        score: evaluateBrowserModel(nextBoard, player),
        preferred:
          preferredMove !== null &&
          preferredMove[0] === x &&
          preferredMove[1] === y,
      };
    })
    .sort((first, second) =>
      Number(second.preferred) - Number(first.preferred) ||
      second.score - first.score,
    );
  let bestScore = -Infinity;
  const bestMoves = [];

  for (const move of orderedMoves) {
    const score = -browserModelNegamax(
      move.board,
      getModelOpponent(player),
      depth - 1,
      -Infinity,
      Infinity,
      searchContext,
    );
    if (score > bestScore) {
      bestScore = score;
      bestMoves.length = 0;
      bestMoves.push([move.x, move.y]);
    } else if (score === bestScore) {
      bestMoves.push([move.x, move.y]);
    }
  }
  return { bestScore, bestMoves };
}

function selectBrowserModelMove(
  board,
  player,
  {
    maxDepth = MODEL_CPU_MAX_SEARCH_DEPTH,
    timeLimitMs = MODEL_CPU_TIME_LIMIT_MS,
    random = Math.random,
    now = Date.now,
    stats = null,
  } = {},
) {
  const moves = getModelValidMoves(board, player);
  if (moves.length === 0) return null;
  const emptyCount = countModelBoard(board).empty;
  const targetDepth = emptyCount <= MODEL_CPU_ENDGAME_THRESHOLD
    ? emptyCount
    : Math.min(maxDepth, emptyCount);
  const searchStats = stats ?? {};
  searchStats.nodes = 0;
  searchStats.cacheHits = 0;
  searchStats.cutoffs = 0;
  searchStats.iterations = 0;
  const searchContext = {
    table: new Map(),
    deadline: now() + timeLimitMs,
    now,
    stats: searchStats,
  };
  let completedResult = null;
  let preferredMove = null;

  for (let depth = 1; depth <= targetDepth; depth++) {
    try {
      const result = searchBrowserModelRoot(
        board,
        player,
        depth,
        searchContext,
        preferredMove,
      );
      completedResult = result;
      preferredMove = result.bestMoves[0] ?? null;
      searchStats.completedDepth = depth;
      searchStats.iterations++;
    } catch (error) {
      if (error !== MODEL_CPU_TIMEOUT) throw error;
      searchStats.timedOut = true;
      break;
    }
  }

  if (completedResult === null) {
    const fallbackMoves = moves
      .map(([x, y]) => ({
        x,
        y,
        score: evaluateBrowserModel(applyModelMove(board, x, y, player), player),
      }))
      .sort((first, second) => second.score - first.score);
    return [fallbackMoves[0].x, fallbackMoves[0].y];
  }
  return completedResult.bestMoves[
    Math.floor(random() * completedResult.bestMoves.length)
  ];
}
