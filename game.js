// ================================================================
//  game.js — ПОЛНАЯ ЛОГИКА ИГРЫ (С КНОПКАМИ, БОНУСАМИ, ПРЕПЯТСТВИЯМИ)
// ================================================================

let grid = [];
const SIZE = 8;
const EMOJIS = ['🍎','🍐','🍊','🍋','🍇','🍉','🍓','🍑'];
let selected = null;
let score = 0;
let moves = 0;
let isProcessing = false;
let currentUser = null;
let highScore = 0;
let money = 0;
let userBonuses = { rocket: 0, bomb: 0, rainbow: 0, double: 0 };
let level = 1;
let comboCount = 0;

const BONUS_TYPES = { ROCKET: 'rocket', BOMB: 'bomb', RAINBOW: 'rainbow', DOUBLE: 'double' };

// ---- ЗАГРУЗКА ДАННЫХ ----
function loadUserData() {
    let user = getCurrentUser();
    if (!user) {
        showAuthScreen();
        return;
    }
    currentUser = user;
    let data = getUserData(user);
    if (data) {
        highScore = data.highScore || 0;
        money = data.money || 0;
        level = data.level || 1;
        userBonuses = data.bonuses || { rocket: 0, bomb: 0, rainbow: 0, double: 0 };
    }
    document.getElementById('highScore').textContent = highScore;
    document.getElementById('moneyDisplay').textContent = money;
    document.getElementById('userName').textContent = user;
}

function saveUserDataFull() {
    if (!currentUser) return;
    let data = getUserData(currentUser);
    if (data) {
        data.highScore = highScore;
        data.money = money;
        data.level = level;
        data.bonuses = userBonuses;
        saveUserData(currentUser, data);
    }
}

// ---- УРОВНИ ----
function getLevelConfig(lvl) {
    let difficulty = Math.floor((lvl - 1) / 10);
    return {
        moves: 20 + difficulty * 3 + ((lvl - 1) % 10),
        target: 30 + difficulty * 10 + ((lvl - 1) % 10) * 2,
        obstacles: Math.min(4 + Math.floor(lvl / 2), 12)
    };
}

// ---- ПРЕПЯТСТВИЯ (10 ТИПОВ) ----
const OBSTACLE_TYPES = [
    { id: 'ice', emoji: '❄️', name: 'Лёд', layers: 1 },
    { id: 'box', emoji: '📦', name: 'Ящик', layers: 2 },
    { id: 'vine', emoji: '🌿', name: 'Лоза', layers: 3 },
    { id: 'crystal', emoji: '💎', name: 'Кристалл', layers: 1 },
    { id: 'lock', emoji: '🔒', name: 'Замок', layers: 2 },
    { id: 'barrel', emoji: '🛢️', name: 'Бочка', layers: 2 },
    { id: 'web', emoji: '🕸️', name: 'Паутина', layers: 2 },
    { id: 'stone', emoji: '🪨', name: 'Камень', layers: 3 },
    { id: 'chest', emoji: '🧰', name: 'Сундук', layers: 2 },
    { id: 'spike', emoji: '⚔️', name: 'Шип', layers: 1 }
];

let obstacles = [];

function initObstacles(lvl) {
    obstacles = [];
    for (let i = 0; i < SIZE; i++) {
        obstacles[i] = [];
        for (let j = 0; j < SIZE; j++) {
            obstacles[i][j] = null;
        }
    }
    let config = getLevelConfig(lvl);
    let count = config.obstacles;
    let weights = [25, 20, 15, 10, 8, 7, 5, 4, 3, 3];
    for (let i = 0; i < count; i++) {
        let typeIdx = 0;
        let rand = Math.random() * 100;
        let cum = 0;
        for (let w = 0; w < weights.length; w++) {
            cum += weights[w];
            if (rand <= cum) { typeIdx = w; break; }
        }
        let type = OBSTACLE_TYPES[typeIdx];
        let row, col, attempts = 0;
        do {
            row = Math.floor(Math.random() * SIZE);
            col = Math.floor(Math.random() * SIZE);
            attempts++;
        } while ((obstacles[row][col] || typeof grid[row][col] !== 'number') && attempts < 100);
        if (attempts < 100) {
            obstacles[row][col] = { type: type.id, layers: type.layers, emoji: type.emoji };
        }
    }
}

function hasObstacle(row, col) {
    return obstacles[row] && obstacles[row][col] !== null;
}

function getObstacle(row, col) {
    return obstacles[row]?.[col] || null;
}

function hitObstacle(row, col) {
    let obs = getObstacle(row, col);
    if (!obs) return false;
    obs.layers--;
    if (obs.layers <= 0) {
        obstacles[row][col] = null;
        if (grid[row][col] === -1) {
            grid[row][col] = Math.floor(Math.random() * EMOJIS.length);
        }
        return true;
    }
    return false;
}

// ---- БОНУСЫ НА ПОЛЕ ----
function createBonusOnField(type) {
    let empty = [];
    for (let i = 0; i < SIZE; i++) {
        for (let j = 0; j < SIZE; j++) {
            if (typeof grid[i][j] === 'number' && !hasObstacle(i, j)) {
                empty.push([i, j]);
            }
        }
    }
    if (empty.length === 0) return;
    let [r, c] = empty[Math.floor(Math.random() * empty.length)];
    grid[r][c] = type;
}

function placeStartBonus() {
    if (userBonuses.bomb > 0) {
        createBonusOnField(BONUS_TYPES.BOMB);
        userBonuses.bomb--;
        saveUserDataFull();
        showToast('💣 Бомба появилась на поле!', false);
    } else if (userBonuses.rocket > 0) {
        createBonusOnField(BONUS_TYPES.ROCKET);
        userBonuses.rocket--;
        saveUserDataFull();
        showToast('🚀 Ракета появилась на поле!', false);
    }
}

// ---- ИНИЦИАЛИЗАЦИЯ ПОЛЯ ----
function initGrid() {
    grid = [];
    for (let i = 0; i < SIZE; i++) {
        grid[i] = [];
        for (let j = 0; j < SIZE; j++) {
            grid[i][j] = Math.floor(Math.random() * EMOJIS.length);
        }
    }
    while (hasMatches()) {
        for (let i = 0; i < SIZE; i++) {
            for (let j = 0; j < SIZE; j++) {
                if (isPartOfMatch(i, j)) {
                    grid[i][j] = Math.floor(Math.random() * EMOJIS.length);
                }
            }
        }
    }
    initObstacles(level);
    placeStartBonus();
}

function renderGrid() {
    const container = document.getElementById('grid');
    container.innerHTML = '';
    for (let i = 0; i < SIZE; i++) {
        for (let j = 0; j < SIZE; j++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.dataset.row = i;
            cell.dataset.col = j;
            const val = grid[i][j];
            if (typeof val === 'number') {
                cell.textContent = EMOJIS[val];
            } else if (val === BONUS_TYPES.ROCKET) {
                cell.textContent = '🚀';
                cell.classList.add('bonus-rocket');
            } else if (val === BONUS_TYPES.BOMB) {
                cell.textContent = '💣';
                cell.classList.add('bonus-bomb');
            } else if (val === BONUS_TYPES.RAINBOW) {
                cell.textContent = '🌈';
                cell.classList.add('bonus-rainbow');
            } else if (val === BONUS_TYPES.DOUBLE) {
                cell.textContent = '⚡';
                cell.classList.add('bonus-double');
            }
            if (selected && selected[0] === i && selected[1] === j) {
                cell.classList.add('selected');
            }
            let obs = getObstacle(i, j);
            if (obs) {
                cell.textContent = obs.emoji;
                let badge = document.createElement('span');
                badge.style.cssText = 'position:absolute;top:-2px;right:-2px;font-size:10px;background:rgba(0,0,0,0.5);border-radius:50%;padding:1px 4px;pointer-events:none;';
                badge.textContent = obs.layers > 1 ? obs.layers : '';
                cell.appendChild(badge);
            }
            cell.addEventListener('click', () => onCellClick(i, j));
            cell.addEventListener('touchstart', (e) => {
                e.preventDefault();
                onCellClick(i, j);
            });
            container.appendChild(cell);
        }
    }
    updateUI();
}

// ---- DRAG & DROP ----
let dragData = null;

document.addEventListener('DOMContentLoaded', function() {
    const gridEl = document.getElementById('grid');
    if (!gridEl) return;

    gridEl.addEventListener('touchstart', (e) => {
        let touch = e.touches[0];
        let el = document.elementFromPoint(touch.clientX, touch.clientY);
        if (el && el.classList.contains('cell')) {
            let row = parseInt(el.dataset.row);
            let col = parseInt(el.dataset.col);
            if (!isProcessing && typeof grid[row][col] === 'number') {
                dragData = { startRow: row, startCol: col, currentRow: row, currentCol: col };
                el.classList.add('dragging');
            }
        }
    }, { passive: true });

    gridEl.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (!dragData) return;
        let touch = e.touches[0];
        let container = document.getElementById('grid');
        let rect = container.getBoundingClientRect();
        let cellSize = rect.width / SIZE;
        let col = Math.floor((touch.clientX - rect.left) / cellSize);
        let row = Math.floor((touch.clientY - rect.top) / cellSize);
        if (row >= 0 && row < SIZE && col >= 0 && col < SIZE) {
            if (row !== dragData.currentRow || col !== dragData.currentCol) {
                dragData.currentRow = row;
                dragData.currentCol = col;
            }
        }
    }, { passive: false });

    gridEl.addEventListener('touchend', () => {
        if (!dragData) return;
        let dr = Math.abs(dragData.currentRow - dragData.startRow);
        let dc = Math.abs(dragData.currentCol - dragData.startCol);
        if ((dr === 1 && dc === 0) || (dr === 0 && dc === 1)) {
            if (dragData.currentRow >= 0 && dragData.currentRow < SIZE &&
                dragData.currentCol >= 0 && dragData.currentCol < SIZE) {
                swapAndCheck(dragData.startRow, dragData.startCol, dragData.currentRow, dragData.currentCol);
            }
        }
        let cell = document.querySelector(`.cell[data-row="${dragData.startRow}"][data-col="${dragData.startCol}"]`);
        if (cell) cell.classList.remove('dragging');
        dragData = null;
    }, { passive: true });
});

// ---- ЛОГИКА ИГРЫ ----
function onCellClick(row, col) {
    if (isProcessing) return;
    let val = grid[row][col];
    if (typeof val !== 'number') {
        activateBonus(row, col);
        return;
    }
    if (!selected) {
        selected = [row, col];
        renderGrid();
        return;
    }
    let [sRow, sCol] = selected;
    if (sRow === row && sCol === col) {
        selected = null;
        renderGrid();
        return;
    }
    let dr = Math.abs(sRow - row);
    let dc = Math.abs(sCol - col);
    if ((dr === 1 && dc === 0) || (dr === 0 && dc === 1)) {
        swapAndCheck(sRow, sCol, row, col);
    } else {
        selected = [row, col];
        renderGrid();
    }
}

function swapAndCheck(r1, c1, r2, c2) {
    if (hasObstacle(r1, c1) || hasObstacle(r2, c2)) {
        showToast('⚠️ Здесь препятствие!', true);
        return;
    }
    isProcessing = true;
    let temp = grid[r1][c1];
    grid[r1][c1] = grid[r2][c2];
    grid[r2][c2] = temp;
    renderGrid();
    if (hasMatches()) {
        moves++;
        document.getElementById('moves').textContent = moves;
        processMatches();
    } else {
        let tempBack = grid[r1][c1];
        grid[r1][c1] = grid[r2][c2];
        grid[r2][c2] = tempBack;
        selected = null;
        renderGrid();
        isProcessing = false;
    }
}

function hasMatches() {
    for (let i = 0; i < SIZE; i++) {
        for (let j = 0; j < SIZE; j++) {
            if (isPartOfMatch(i, j)) return true;
        }
    }
    return false;
}

function isPartOfMatch(row, col) {
    let val = grid[row][col];
    if (typeof val !== 'number') return false;
    let count = 1;
    for (let j = col - 1; j >= 0 && grid[row][j] === val; j--) count++;
    for (let j = col + 1; j < SIZE && grid[row][j] === val; j++) count++;
    if (count >= 3) return true;
    count = 1;
    for (let i = row - 1; i >= 0 && grid[i][col] === val; i--) count++;
    for (let i = row + 1; i < SIZE && grid[i][col] === val; i++) count++;
    return count >= 3;
}

function getMatches() {
    let matches = [], checked = new Set();
    for (let i = 0; i < SIZE; i++) {
        for (let j = 0; j < SIZE; j++) {
            if (checked.has(i+','+j)) continue;
            let val = grid[i][j];
            if (typeof val !== 'number') continue;
            let group = [];
            let left = j, right = j;
            while (left - 1 >= 0 && grid[i][left - 1] === val) left--;
            while (right + 1 < SIZE && grid[i][right + 1] === val) right++;
            if (right - left + 1 >= 3) {
                for (let c = left; c <= right; c++) { group.push([i, c]); checked.add(i+','+c); }
            }
            let top = i, bottom = i;
            while (top - 1 >= 0 && grid[top - 1][j] === val) top--;
            while (bottom + 1 < SIZE && grid[bottom + 1][j] === val) bottom++;
            if (bottom - top + 1 >= 3) {
                for (let r = top; r <= bottom; r++) {
                    if (!checked.has(r+','+j)) { group.push([r, j]); checked.add(r+','+j); }
                }
            }
            if (group.length > 0) matches.push(group);
        }
    }
    return matches;
}

function processMatches() {
    let matches = getMatches();
    if (matches.length === 0) {
        isProcessing = false;
        selected = null;
        return;
    }

    comboCount++;
    let points = 0;
    let bonusMap = new Map();
    let cellsToRemove = new Set();

    matches.forEach(group => {
        let size = group.length;
        if (size >= 4) {
            let bonusType;
            if (size >= 6) bonusType = BONUS_TYPES.BOMB;
            else if (size >= 5) bonusType = BONUS_TYPES.RAINBOW;
            else bonusType = BONUS_TYPES.ROCKET;
            let mid = Math.floor(group.length / 2);
            let [r, c] = group[mid];
            bonusMap.set(r+','+c, bonusType);
            group.forEach(([r, c]) => {
                if (!bonusMap.has(r+','+c)) cellsToRemove.add(r+','+c);
            });
        } else {
            group.forEach(([r, c]) => cellsToRemove.add(r+','+c));
        }
        points += size;
    });

    // Комбо бонус
    if (comboCount > 1) {
        let bonusPoints = comboCount * 2;
        points += bonusPoints;
        showToast(`🔥 Комбо x${comboCount}! +${bonusPoints}`, false);
    }

    score += points;
    document.getElementById('score').textContent = score;

    if (score > highScore) {
        highScore = score;
        document.getElementById('highScore').textContent = highScore;
        saveUserDataFull();
    }

    let config = getLevelConfig(level);
    if (score >= config.target) {
        let reward = 10 + Math.floor(level / 5) * 2;
        money += reward;
        level++;
        document.getElementById('moneyDisplay').textContent = money;
        saveUserDataFull();
        showToast('🎉 Уровень пройден! +' + reward + ' монет!', false);
        setTimeout(() => {
            document.getElementById('gameOver').classList.add('active');
            document.getElementById('goText').textContent = '🏆 ПОБЕДА!';
            document.getElementById('goText').className = 'go-text win';
            document.getElementById('goScore').textContent = '🎉 Уровень ' + (level-1) + ' пройден!';
            document.getElementById('restartBtn').textContent = '▶ Следующий уровень';
        }, 300);
        isProcessing = false;
        return;
    }

    cellsToRemove.forEach(key => {
        let [r, c] = key.split(',').map(Number);
        let obs = getObstacle(r, c);
        if (obs) {
            if (hitObstacle(r, c)) {
                showToast('💥 ' + OBSTACLE_TYPES.find(o => o.id === obs.type).name + ' разрушен!', false);
            }
        } else {
            grid[r][c] = -1;
        }
    });

    bonusMap.forEach((type, key) => {
        let [r, c] = key.split(',').map(Number);
        if (!hasObstacle(r, c)) {
            grid[r][c] = type;
        }
    });

    renderGrid();

    setTimeout(() => {
        dropDown();
        renderGrid();
        setTimeout(() => {
            if (hasMatches()) {
                processMatches();
            } else {
                isProcessing = false;
                selected = null;
                checkGameOver();
            }
        }, 300);
    }, 300);
}

function dropDown() {
    for (let c = 0; c < SIZE; c++) {
        let writeRow = SIZE - 1;
        for (let r = SIZE - 1; r >= 0; r--) {
            if (grid[r][c] !== -1) {
                grid[writeRow][c] = grid[r][c];
                if (writeRow !== r) grid[r][c] = -1;
                writeRow--;
            }
        }
        for (let r = writeRow; r >= 0; r--) {
            grid[r][c] = Math.floor(Math.random() * EMOJIS.length);
            if (Math.random() < 0.03 && r > 1 && !hasObstacle(r, c)) {
                grid[r][c] = [BONUS_TYPES.ROCKET, BONUS_TYPES.BOMB][Math.floor(Math.random()*2)];
            }
        }
    }
}

function checkGameOver() {
    let config = getLevelConfig(level);
    if (moves >= config.moves && score < config.target) {
        document.getElementById('gameOver').classList.add('active');
        document.getElementById('goText').textContent = '💀 ПОРАЖЕНИЕ';
        document.getElementById('goText').className = 'go-text';
        document.getElementById('goScore').textContent = 'Очки: ' + score + ' / ' + config.target;
        document.getElementById('restartBtn').textContent = '🔄 Попробовать снова';
        return;
    }
    // Проверка возможных ходов
    for (let i = 0; i < SIZE; i++) {
        for (let j = 0; j < SIZE; j++) {
            if (typeof grid[i][j] !== 'number') continue;
            let neighbors = [[0,1],[0,-1],[1,0],[-1,0]];
            for (let [di, dj] of neighbors) {
                let ni = i + di, nj = j + dj;
                if (ni >= 0 && ni < SIZE && nj >= 0 && nj < SIZE) {
                    if (typeof grid[ni][nj] !== 'number') continue;
                    let temp = grid[i][j];
                    grid[i][j] = grid[ni][nj];
                    grid[ni][nj] = temp;
                    if (hasMatches()) {
                        grid[ni][nj] = grid[i][j];
                        grid[i][j] = temp;
                        return;
                    }
                    grid[ni][nj] = grid[i][j];
                    grid[i][j] = temp;
                }
            }
        }
    }
    showToast('🔄 Перемешивание...', false);
    setTimeout(() => {
        let flat = [];
        for (let i = 0; i < SIZE; i++) {
            for (let j = 0; j < SIZE; j++) {
                if (typeof grid[i][j] === 'number') flat.push(grid[i][j]);
            }
        }
        for (let i = flat.length - 1; i > 0; i--) {
            let j = Math.floor(Math.random() * (i + 1));
            [flat[i], flat[j]] = [flat[j], flat[i]];
        }
        let idx = 0;
        for (let i = 0; i < SIZE; i++) {
            for (let j = 0; j < SIZE; j++) {
                if (typeof grid[i][j] === 'number') {
                    grid[i][j] = flat[idx++];
                }
            }
        }
        for (let i = 0; i < SIZE; i++) {
            for (let j = 0; j < SIZE; j++) {
                if (typeof grid[i][j] !== 'number') grid[i][j] = Math.floor(Math.random() * EMOJIS.length);
            }
        }
        renderGrid();
        isProcessing = false;
        selected = null;
        showToast('🔄 Перемешано!', false);
    }, 600);
}

function activateBonus(row, col) {
    let bonus = grid[row][col];
    if (bonus === BONUS_TYPES.ROCKET) {
        showToast('🚀 Ракета!', false);
        for (let i = 0; i < SIZE; i++) {
            if (typeof grid[row][i] === 'number') { grid[row][i] = -1; score += 2; }
            if (hasObstacle(row, i)) hitObstacle(row, i);
        }
        grid[row][col] = -1;
        document.getElementById('score').textContent = score;
        afterBonus();
    } else if (bonus === BONUS_TYPES.BOMB) {
        showToast('💣 Бомба!', false);
        for (let i = -2; i <= 2; i++) {
            for (let j = -2; j <= 2; j++) {
                let nr = row + i, nc = col + j;
                if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) {
                    if (typeof grid[nr][nc] === 'number') { grid[nr][nc] = -1; score +=
