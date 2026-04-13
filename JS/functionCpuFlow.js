let cpuTimerId = null;

function clearTimeout(cpuTimerId) {
  cpuTimerId = null;
}

function playCpuMove(cpuType) {
  const validMoves = getValidMoves();
  if (validMoves.length === 0) return null;

  if (cpuType === WEAK) {
    return WeakestMove(validMoves);
  }
}

function WeakestMove(validMoves) {
  // ランダムに有効な手を選択
  const randomIndex = Math.floor(Math.random() * validMoves.length);
  const [x, y] = validMoves[randomIndex];
  placeStone(x, y, currentPlayer);
}

function cpuTurn() {
  const player = currentPlayer;
  const playerName = player === BLACK ? blackPlayerName : whitePlayerName;
  const cpuType = player === BLACK ? blackCpuType : whiteCpuType;
  if (playerName === TYPE_CPU) {
    if (cpuTimerId !== null) {
      clearTimeout(cpuTimerId);
    }
    cpuTimerId = setTimeout(() => {
      if (getValidMoves().length === 0) {
        passTurn();
        return;
      }
      playCpuMove(cpuType);
      proceedTurn();
      cpuTimerId = null;
    }, 500);
  }
}
