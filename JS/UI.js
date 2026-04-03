function gameUI(boardData, currentPlayer, boardSize, count) {
  renderBoard(boardData, currentPlayer, boardSize);
  renderPanel(count, currentPlayer);
}

function renderBoard(boardData, currentPlayer, boardSize) {
  const boardDiv = document.getElementById("board");
  boardDiv.innerHTML = "";

  for (let x = 0; x < boardSize; x++) {
    for (let y = 0; y < boardSize; y++) {
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

      if (canPlace(boardData, x, y, currentPlayer, boardSize)) {
        cellDiv.classList.add("highlight");
      }

      boardDiv.appendChild(cellDiv);
    }
  }
}

function renderPanel(count, currentPlayer) {
  document.getElementById("black-count").textContent = count.black;
  document.getElementById("white-count").textContent = count.white;
  document.getElementById("current-turn").className = currentPlayer === BLACK ? "stone-icon black" : "stone-icon white";
}

function hiddenResultModal() {
  document.getElementById("result-overlay").classList.remove("open");
}

function showResultModal(result) {
  document.getElementById("result-message").textContent = result.message;
  document.getElementById("result-black").textContent = result.black;
  document.getElementById("result-white").textContent = result.white;
  document.getElementById("result-overlay").classList.add("open");
}
