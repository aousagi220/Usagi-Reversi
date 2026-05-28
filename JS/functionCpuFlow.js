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
  const rundomIndex = Math.floor(Math.random() * bestMoves.length);
  const { x, y } = bestMoves[rundomIndex];
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
    }, 500);
  }
}
