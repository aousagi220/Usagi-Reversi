let cpuTimerId = null;

function boardToOpeningKey(board) {
  return board.flat().join("");
}

function transformOpeningCoordinate([x, y], transform) {
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
    default: return [x, y];
  }
}

function inverseOpeningCoordinate(coordinate, transform) {
  const inverseTransforms = [0, 3, 2, 1, 4, 5, 6, 7];
  return transformOpeningCoordinate(coordinate, inverseTransforms[transform]);
}

function transformOpeningBoardKey(boardKey, transform) {
  const transformed = Array(boardKey.length);
  for (let x = 0; x < BOARD_SIZE; x++) {
    for (let y = 0; y < BOARD_SIZE; y++) {
      const [nextX, nextY] = transformOpeningCoordinate([x, y], transform);
      transformed[nextX * BOARD_SIZE + nextY] = boardKey[x * BOARD_SIZE + y];
    }
  }
  return transformed.join("");
}

function canonicalizeOpeningBoard(board) {
  const boardKey = boardToOpeningKey(board);
  let key = null;
  let transform = 0;

  for (let candidateTransform = 0; candidateTransform < 8; candidateTransform++) {
    const candidateKey = transformOpeningBoardKey(boardKey, candidateTransform);
    if (key === null || candidateKey < key) {
      key = candidateKey;
      transform = candidateTransform;
    }
  }
  return { key, transform };
}

function getOpeningMove(validMoves) {
  if (typeof OPENING_BOOK === "undefined") return null;

  const canonical = canonicalizeOpeningBoard(BOARD);
  const positionKey = `${currentPlayer}:${canonical.key}`;
  const legacyPositionKey = `${currentPlayer}:${boardToOpeningKey(BOARD)}`;
  const usesCanonicalPosition = OPENING_BOOK.positions[positionKey] !== undefined;
  const bookMoves = OPENING_BOOK.positions[positionKey] ??
    OPENING_BOOK.positions[legacyPositionKey];
  if (!bookMoves || bookMoves.length === 0) return null;

  const validBookMoves = bookMoves
    .map((bookMove) => {
      const [x, y] = usesCanonicalPosition
        ? inverseOpeningCoordinate([bookMove.x, bookMove.y], canonical.transform)
        : [bookMove.x, bookMove.y];
      return { ...bookMove, x, y };
    })
    .filter((bookMove) =>
      validMoves.some(([x, y]) => x === bookMove.x && y === bookMove.y),
    );
  if (validBookMoves.length === 0) return null;

  const bestScore = Math.max(...validBookMoves.map((move) => move.score));
  const bestMoves = validBookMoves.filter((move) => move.score === bestScore);
  const randomIndex = Math.floor(Math.random() * bestMoves.length);

  return bestMoves[randomIndex];
}

function playCpuMove(cpuType) {
  const validMoves = getValidMoves();
  if (validMoves.length === 0) return null;

  if (cpuType === WEAK) {
    return WeakestMove(validMoves);
  }

  if (cpuType === NORMAL) {
    return NormalMove(validMoves);
  }

  if (cpuType === STRONG) {
    return StrongMove(validMoves);
  }

  if (cpuType === TRAINED) {
    return TrainedModelMove();
  }
}

function TrainedModelMove() {
  const move = selectBrowserModelMove(BOARD, currentPlayer);
  if (move === null) return;
  placeStone(move[0], move[1], currentPlayer);
}

function WeakestMove(validMoves) {
  // ランダムに有効な手を選択
  const randomIndex = Math.floor(Math.random() * validMoves.length);
  const [x, y] = validMoves[randomIndex];
  placeStone(x, y, currentPlayer);
}

function NormalMove(validMoves) {
  let cpuflippableCount = [];

  for (const [x, y] of validMoves) {
    const flippableCount = countFlippableStones(x, y, currentPlayer);
    cpuflippableCount.push({ x, y, flippableCount });
  }

  const maxFlippable = Math.max(...cpuflippableCount.map((move) => move.flippableCount));
  const bestMoves = cpuflippableCount.filter((move) => move.flippableCount === maxFlippable);
  const randomIndex = Math.floor(Math.random() * bestMoves.length);
  const { x, y } = bestMoves[randomIndex];
  placeStone(x, y, currentPlayer);
}

function StrongMove(validMoves) {
  const openingMove = getOpeningMove(validMoves);
  if (openingMove !== null) {
    placeStone(openingMove.x, openingMove.y, currentPlayer);
    return;
  }

  // 強いCPUのロジックを実装（例: 角を優先的に取る）
  let cpuflippableCount = [];
  const CORNER = [
    [0, 0],
    [0, BOARD_SIZE - 1],
    [BOARD_SIZE - 1, 0],
    [BOARD_SIZE - 1, BOARD_SIZE - 1],
  ];

  const CORNER_AREAS = [
    {
      corner: [0, 0],
      edgeSquares: [
        [0, 1],
        [1, 0],
      ],
      crossSquare: [1, 1],
    },
    {
      corner: [0, BOARD_SIZE - 1],
      edgeSquares: [
        [0, BOARD_SIZE - 2],
        [1, BOARD_SIZE - 1],
      ],
      crossSquare: [1, BOARD_SIZE - 2],
    },
    {
      corner: [BOARD_SIZE - 1, 0],
      edgeSquares: [
        [BOARD_SIZE - 2, 0],
        [BOARD_SIZE - 1, 1],
      ],
      crossSquare: [BOARD_SIZE - 2, 1],
    },
    {
      corner: [BOARD_SIZE - 1, BOARD_SIZE - 1],
      edgeSquares: [
        [BOARD_SIZE - 2, BOARD_SIZE - 1],
        [BOARD_SIZE - 1, BOARD_SIZE - 2],
      ],
      crossSquare: [BOARD_SIZE - 2, BOARD_SIZE - 2],
    },
  ];

  const CORNER_NEAR_PENALTY = -20;
  const CORNER_NEAR_CROSS_PENALTY = -30;
  const ONE_STONE_BONUS = 5;
  const EDGE_BONUS = 15;
  const CORNER_BONUS = 50;

  for (const [x, y] of validMoves) {
    const flippableCount = countFlippableStones(x, y, currentPlayer);
    cpuflippableCount.push({ x, y, flippableCount, score: flippableCount });
  }

  const currentCount = countStone();

  if (currentCount.black + currentCount.white <= 15) {
    cpuflippableCount.forEach((move) => {
      if (move.flippableCount === 1) {
        move.score += ONE_STONE_BONUS;
      }
    });
  }

  cpuflippableCount.forEach((move) => {
    if (move.x === 0 || move.x === BOARD_SIZE - 1 || move.y === 0 || move.y === BOARD_SIZE - 1) {
      move.score += EDGE_BONUS;
    }
  });

  cpuflippableCount.forEach((move) => {
    if (CORNER.some(([cx, cy]) => cx === move.x && cy === move.y)) {
      move.score += CORNER_BONUS;
    }
  });

  cpuflippableCount.forEach((move) => {
    for (const area of CORNER_AREAS) {
      const [cornerX, cornerY] = area.corner;
      if (BOARD[cornerX][cornerY] !== EMPTY) continue;

      if (area.edgeSquares.some(([x, y]) => x === move.x && y === move.y)) {
        move.score += CORNER_NEAR_PENALTY;
      }

      const [crossX, crossY] = area.crossSquare;
      if (crossX === move.x && crossY === move.y) {
        move.score += CORNER_NEAR_CROSS_PENALTY;
      }
    }
  });

  const maxFlippable = Math.max(...cpuflippableCount.map((move) => move.score));
  const bestMoves = cpuflippableCount.filter((move) => move.score === maxFlippable);
  const randomIndex = Math.floor(Math.random() * bestMoves.length);
  const { x, y } = bestMoves[randomIndex];
  placeStone(x, y, currentPlayer);
}

function cpuTurn() {
  const player = currentPlayer;
  const playerName = player === BLACK ? blackPlayerName : whitePlayerName;
  const cpuType = player === BLACK ? blackCpuType : whiteCpuType;
  if (playerName === TYPE_CPU) {
    if (cpuTimerId !== null) {
      window.clearTimeout(cpuTimerId);
    }
    cpuTimerId = setTimeout(() => {
      cpuTimerId = null;
      if (getValidMoves().length === 0) {
        passTurn();
        return;
      }
      playCpuMove(cpuType);
      proceedTurn();
    }, 1000);
  }
}
