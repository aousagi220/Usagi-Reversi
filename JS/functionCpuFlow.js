function playCpuMove(cpuType) {
  const validMoves = getValidMoves(currentPlayer);
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
  const player = currentPlayer
  const playerName = player === BLACK ? blackPlayerName : whitePlayerName;
  const cpuType = player === BLACK ? blackCpuType : whiteCpuType; 
    if (playerName === TYPE_CPU) {
    setTimeout(() => {
      if (getValidMoves(currentPlayer).length === 0) {
        passTurn();
        return;
      }
      playCpuMove(cpuType);
      proceedTurn();
    }, 500);
  }
}