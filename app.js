const TETROMINOES = {
  I: { color: "#4dd8ff", cells: [[0,0],[1,0],[2,0],[3,0]] },
  O: { color: "#ffc83d", cells: [[0,0],[1,0],[0,1],[1,1]] },
  T: { color: "#c77dff", cells: [[0,0],[1,0],[2,0],[1,1]] },
  S: { color: "#5cff8f", cells: [[1,0],[2,0],[0,1],[1,1]] },
  Z: { color: "#ff5c7a", cells: [[0,0],[1,0],[1,1],[2,1]] },
  L: { color: "#ff9d4d", cells: [[0,0],[0,1],[1,1],[2,1]] },
  J: { color: "#4d6bff", cells: [[2,0],[0,1],[1,1],[2,1]] }
};

function renderBoard() {
  const table = document.getElementById("board");
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  headRow.appendChild(document.createElement("th"));
  SCHEDULE.groups.forEach(g => {
    const th = document.createElement("th");
    th.textContent = g;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  SCHEDULE.hours.forEach((hour, rowIndex) => {
    const tr = document.createElement("tr");
    const hourCell = document.createElement("td");
    hourCell.className = "hour-cell";
    hourCell.textContent = hour;
    tr.appendChild(hourCell);

    SCHEDULE.grid[rowIndex].forEach(state => {
      const td = document.createElement("td");
      const isOn = state === 1;
      td.className = "state " + (isOn ? "on" : "off");
      const img = document.createElement("img");
      img.src = isOn ? "assets/icons/elec-on.svg" : "assets/icons/elec-off.svg";
      img.alt = isOn ? "світло є" : "світла немає";
      td.appendChild(img);
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
}

function renderStats() {
  let offCount = 0;
  let fullOffRows = 0;
  SCHEDULE.grid.forEach(row => {
    const rowOff = row.filter(v => v === 0).length;
    offCount += rowOff;
    if (rowOff === row.length) fullOffRows += 1;
  });
  document.getElementById("score").textContent = offCount * 10;
  document.getElementById("rows").textContent = fullOffRows;
  document.getElementById("level").textContent = Math.max(1, Math.ceil(fullOffRows / 2));
}

function randomPiece() {
  const keys = Object.keys(TETROMINOES);
  return TETROMINOES[keys[Math.floor(Math.random() * keys.length)]];
}

function renderNextPiece() {
  const svg = document.getElementById("next-piece");
  svg.innerHTML = "";
  const piece = randomPiece();
  const size = 8;
  piece.cells.forEach(([x, y]) => {
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", x * size + 2);
    rect.setAttribute("y", y * size + 2);
    rect.setAttribute("width", size - 1);
    rect.setAttribute("height", size - 1);
    rect.setAttribute("fill", piece.color);
    rect.setAttribute("rx", 1);
    svg.appendChild(rect);
  });
}

function initControls() {
  const pauseBtn = document.getElementById("btn-pause");
  let paused = false;
  pauseBtn.addEventListener("click", () => {
    paused = !paused;
    pauseBtn.textContent = paused ? "▶" : "⏸";
    document.querySelector(".board-wrap").style.opacity = paused ? 0.4 : 1;
  });

  document.getElementById("btn-reset").addEventListener("click", renderNextPiece);
  document.getElementById("btn-down").addEventListener("click", () => {
    const rows = [SCHEDULE.hours.join(",")].concat(
      SCHEDULE.grid.map(row => row.join(","))
    );
    const csv = "hour," + SCHEDULE.groups.join(",") + "\n" +
      SCHEDULE.hours.map((h, i) => h + "," + SCHEDULE.grid[i].join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "schedule.csv";
    a.click();
  });

  document.getElementById("btn-prev").disabled = true;
  document.getElementById("btn-next").disabled = true;
}

document.getElementById("title").textContent = "Тетріс: графік відключень на " + SCHEDULE.date;
renderBoard();
renderStats();
renderNextPiece();
initControls();
