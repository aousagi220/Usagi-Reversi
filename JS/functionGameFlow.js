function resetGame() {
  currentPlayer = BLACK;
  boardReset();
  gameUI(countStone());
  hiddenResultModal();
}

function gameEnd() {
  const result = countStone();
  if (result.black > result.white) result.message = "黒の勝ち！";
  else if (result.black < result.white) result.message = "白の勝ち！";
  else result.message = "引き分け！";
  showResultModal(result);
}

function switchTurn() {
  currentPlayer = currentPlayer === BLACK ? WHITE : BLACK;
}

function proceedTurn() {
  switchTurn();

  gameUI(countStone());
  if (!hasValidMove(currentPlayer)) {
    if (isGameEnd()) {
      gameEnd();
    } else {
      passTurnUi();
      switchTurn();

      gameUI(countStone());
      console.log("パスされました！");
    }
  }
}
