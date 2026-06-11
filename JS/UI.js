function gameUI(count) {
  renderBoard();
  renderPanel(count);
}

function renderBoard() {
  const boardDiv = document.getElementById("board");
  boardDiv.innerHTML = "";

  for (let x = 0; x < BOARD_SIZE; x++) {
    for (let y = 0; y < BOARD_SIZE; y++) {
      const cellDiv = document.createElement("div");
      cellDiv.classList.add("cell");
      cellDiv.dataset.x = x;
      cellDiv.dataset.y = y;

      if (BOARD[x][y] === BLACK) {
        cellDiv.textContent = "●";
        cellDiv.classList.add("black");
      } else if (BOARD[x][y] === WHITE) {
        cellDiv.textContent = "●";
        cellDiv.classList.add("white");
      }

      if (canPlace(x, y, currentPlayer)) {
        cellDiv.classList.add("highlight");
      }

      boardDiv.appendChild(cellDiv);
    }
  }
}

function renderPanel(count) {
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

function passTurnUi() {
  const toast = document.getElementById("pass-toast");

  toast.textContent = currentPlayer === BLACK ? "黒はパスされました！" : "白はパスされました！";

  toast.classList.remove("hide");
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
    toast.classList.add("hide");
  }, 1000);
}
