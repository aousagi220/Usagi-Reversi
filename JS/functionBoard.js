function printBoard(boardData) {
  const displayBoard = boardData
    .map((row) =>
      row
        .map((cell) => {
          if (cell === WHITE) return "○";
          if (cell === BLACK) return "●";
          return "・";
        })
        .join(" "),
    )
    .join("\n");

  console.log(displayBoard);
}

function startGame(boardData) {
  boardData[3][3] = WHITE;
  boardData[3][4] = BLACK;
  boardData[4][3] = BLACK;
  boardData[4][4] = WHITE;

  renderBoard(boardData)
  PLAYER = BLACK;
}