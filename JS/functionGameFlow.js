function resetGame(board, boardSize, currentPlayer, black) {
  currentPlayer = black;
  boardReset(board, boardSize);
  gameUI(board, currentPlayer, boardSize, countStone(board, boardSize));
  hiddenResultModal();
  return currentPlayer;
}

function gameEnd(board, boardSize) {
  const result = countStone(board, boardSize);
  if (result.black > result.white) result.message = "黒の勝ち！";
  else if (result.black < result.white) result.message = "白の勝ち！";
  else result.message = "引き分け！";
  showResultModal(result);
}

function switchTurn(currentPlayer, black, white) {
  return currentPlayer === black ? white : black;
}

function proceedTurn(board, boardSize, currentPlayer, black, white) {
  currentPlayer = switchTurn(currentPlayer, black, white);

  gameUI(board, currentPlayer, boardSize, countStone(board, boardSize));
  if (!hasValidMove(board, currentPlayer, boardSize)) {
    if (isGameEnd(board, boardSize)) {
      gameEnd(board, boardSize);
      return currentPlayer;
    } else {
      currentPlayer = switchTurn(currentPlayer, black, white);

      gameUI(board, currentPlayer, boardSize, countStone(board, boardSize));
      console.log("パスされました！");
    }
  }

  return currentPlayer;
}