let cpuTimerId = null;

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
