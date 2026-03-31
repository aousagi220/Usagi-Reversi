function renderBoard(boardData) {
  const boardDiv = document.getElementById("board");
  boardDiv.innerHTML = "";

  for (let x = 0; x < 8; x++) {
    for (let y = 0; y < 8; y++) {
      const cellDiv = document.createElement("div");
      cellDiv.classList.add("cell");
      cellDiv.dataset.x = x;
      cellDiv.dataset.y = y;

      if (boardData[x][y] === BLACK) {
        cellDiv.textContent = "●";
        cellDiv.classList.add("black");
      } else if (boardData[x][y] === WHITE) {
        cellDiv.textContent = "●";
        cellDiv.classList.add("white");
      }

      if (canPlace(boardData, x, y, PLAYER)) {
        cellDiv.classList.add("highlight");
      }

      boardDiv.appendChild(cellDiv);
    }
  }
}
