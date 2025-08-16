const sampleTexts = [
    "The cricket match was in full swing as the afternoon sun cast long shadows across the perfectly manicured pitch. Spectators in white clothing dotted the pavilion, sipping tea and enjoying cucumber sandwiches.",
    "On a glorious summer day at Lords, the players took their positions as the umpire called play. The batsman took his stance, ready to face the bowlers delivery in this quintessentially English sport.",
    "The village green was alive with the sound of cricket as families gathered for the annual match. The pavilion clock chimed four as both teams fought for supremacy in this traditional English contest.",
    "As the tea break approached, the score was delicately poised with the home team needing just twelve runs for victory. The afternoon sun filtered through the leaves of ancient elm trees."
];

let text = '';
let currentIndex = 0;
let startTime = null;
let timer = null;
let wrongChar = null; // Track if there's a wrong character at current position
let wordsTyped = 0;
let gameEnded = false;
let gameEndTimeout = null;
const GAME_DURATION_MS = 5 * 60 * 1000; // 5 minutes
let cricket = null;
let secondTickInterval = null;
let isGameRunning = false;
let selectedFlag = '';
let savedLineup = ['Tendulkar','Sehwag','Ganguly','Dravid','Kaif','Yuvraj','Pathan','Khan','Kumble','Harbhajan','Srisanth'];
selectedFlag = '🇮🇳';
let wormChart = null;

function buildThousandWordText(targetWordCount = 1000) {
    const wordPools = sampleTexts.map(t => t.split(/\s+/));
    const flatPool = [].concat(...wordPools);
    const resultWords = [];
    let i = 0;
    while (resultWords.length < targetWordCount) {
        resultWords.push(flatPool[i % flatPool.length]);
        i++;
    }
    return resultWords.join(' ');
}

function init(customPlayers) {
    text = buildThousandWordText(1000);
    currentIndex = 0;
    startTime = null;
    wrongChar = null;
    wordsTyped = 0;
    gameEnded = false;
    if (timer) clearInterval(timer);
    if (gameEndTimeout) clearTimeout(gameEndTimeout);
    if (secondTickInterval) clearInterval(secondTickInterval);
    if (!cricket) cricket = new CricketEngine({ onUpdate: onEngineUpdate, customPlayers });
    else cricket.reset(customPlayers);
    // Reset worm chart
    if (!wormChart) wormChart = new StatsWormChart('wormChart');
    wormChart.reset();
    render();
    updateStats();
}

function render() {
    const display = document.getElementById('textDisplay');
    let html = '';

    for (let i = 0; i < text.length; i++) {
        let className = 'char';

        if (i < currentIndex) {
            className += ' correct';
        } else if (i === currentIndex) {
            if (wrongChar !== null) {
                className += ' incorrect';
            } else {
                className += ' current';
            }
        }

        html += `<span class="${className}">${text[i]}</span>`;
    }

    display.innerHTML = html;

    const currentChar = display.querySelector('.current') || display.querySelector('.char.incorrect');
    if (currentChar) {
        // Smooth scrolling to keep cursor centered
        currentChar.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function updateStats() {
    if (!startTime) {
        renderScoreboard();
        renderScoreSummaryRight();
        return;
    }

    const elapsed = (Date.now() - startTime) / 1000;
    const wpm = Math.round((wordsTyped) / (elapsed / 60)) || 0;
    const accuracy = currentIndex > 0 ? 100 : 100;

    // Left-side WPM display removed; keep computation for future use if needed

    if (cricket) {
        renderScoreboard();
        if (cricket.wickets >= 10) {
            endGame();
        }
        renderScoreSummaryRight();
    }
}

// UI handlers
function onStartInnings() {
    if (savedLineup.length !== 11) return;
    startGame(savedLineup);
}

function onDeclare() {
    if (isGameRunning) endGame(true);
}

document.addEventListener('keydown', function(e) {
    // Allow starting the innings by typing a character if not already running
    if (!isGameRunning && !gameEnded && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        onStartInnings();
    }
    if (!isGameRunning || gameEnded || currentIndex >= text.length) return;

    if (e.key === 'Backspace') {
        // Backspace disabled (like keybr)
        e.preventDefault();
        return;
    }

    if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();

        const expectedChar = text[currentIndex];

        if (e.key === expectedChar) {
            currentIndex++;
            wrongChar = null;
            // Word completed when we type a space or reach text end
            if (expectedChar === ' ' || currentIndex === text.length) {
                wordsTyped += 1;
                if (cricket) cricket.onWord();
            }
        } else {
            wrongChar = e.key;
            if (cricket) cricket.onError();
        }

        render();
        updateStats();

        if (currentIndex >= text.length) {
            endGame(true);
        }
    }
});

document.addEventListener('click', (e) => {
    // Do not steal focus from inputs or while modal is open
    const isInModal = !!(e.target && e.target.closest && e.target.closest('.modal'));
    const isInteractive = !!(e.target && e.target.closest && e.target.closest('input, textarea, select, button'));
    if (isInModal || isInteractive) return;
    if (isGameRunning) {
        document.body.focus();
    }
});
document.body.setAttribute('tabindex', '0');

// initial render and engine init with default lineup
window.addEventListener('DOMContentLoaded', () => {
    init(savedLineup);
    renderScoreSummaryRight();
    render();
    updateStats();
    const startBtn = document.getElementById('startInningsBtn');
    if (startBtn) startBtn.disabled = false;
    const flagEl = document.getElementById('teamFlag');
    if (flagEl) flagEl.textContent = selectedFlag;
});

function onEngineUpdate(snapshot) {
    renderScoreboard();
    if (wormChart) wormChart.update({
        totalRuns: cricket.totalRuns,
        wickets: cricket.wickets,
        overs: cricket.overs,
        balls: cricket.balls,
        players: cricket.players
    });
    renderScoreSummaryRight();
}

function renderScoreboard() {
    const el = document.getElementById('cricketScoreboard');
    if (!el || !cricket) return;
    el.innerHTML = cricket.buildScoreboardHTML();
    enableInlineNameEditing(el);
}

function renderScoreSummaryRight() {
    const el = document.getElementById('scoreSummaryRight');
    if (!el || !cricket) return;
    // Compute run rate by time-based method as engine does
    let elapsed = 0;
    if (startTime) elapsed = (Date.now() - startTime) / 1000;
    const rr = cricket.getRunRate(elapsed).toFixed(2);
    el.textContent = `${selectedFlag ? selectedFlag + ' ' : ''}${cricket.totalRuns}/${cricket.wickets} ${cricket.overs}.${cricket.balls} overs • RR ${rr}`;
}

function enableInlineNameEditing(root) {
    // Make batter names clickable and editable
    const rows = root.querySelectorAll('tbody tr');
    rows.forEach((row, idx) => {
        const nameCell = row.children[0];
        if (!nameCell) return;
        nameCell.style.cursor = 'text';
        nameCell.title = 'Click to edit name';
        nameCell.addEventListener('click', () => {
            const currentName = cricket.players[idx].name;
            const input = document.createElement('input');
            input.type = 'text';
            input.value = currentName;
            input.style.width = '90%';
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') input.blur();
                if (e.key === 'Escape') {
                    input.value = currentName;
                    input.blur();
                }
                e.stopPropagation();
            });
            input.addEventListener('click', (e) => e.stopPropagation());
            input.addEventListener('blur', () => {
                const newName = input.value.trim() || currentName;
                cricket.players[idx].name = newName;
                renderScoreboard();
            });
            nameCell.textContent = '';
            nameCell.appendChild(input);
            input.focus();
            input.select();
        });
    });
}

function endGame(fromCompletion = false) {
    if (gameEnded) return;
    gameEnded = true;
    if (timer) clearInterval(timer);
    if (gameEndTimeout) clearTimeout(gameEndTimeout);
    if (secondTickInterval) clearInterval(secondTickInterval);
    const display = document.getElementById('textDisplay');
    const msg = fromCompletion ? '🏏 Well played! Innings complete!' : '🏏 Time! Innings complete!';
    display.innerHTML += `<div class="completed">${msg}</div>`;
    isGameRunning = false;
    const startBtn = document.getElementById('startInningsBtn');
    const declareBtn = document.getElementById('declareBtn');
    if (startBtn) startBtn.style.display = '';
    if (declareBtn) declareBtn.style.display = 'none';
}

// Lineup modal and saving lineup
function openLineupModal(forceShow = false) {
    const modal = document.getElementById('setupModal');
    const saveBtn = document.getElementById('setupSaveBtn');
    const cancelBtn = document.getElementById('setupCancelBtn');
    const playersInput = document.getElementById('playerNamesInput');
    const flagSelect = document.getElementById('teamFlagSelect');
    const playerCount = document.getElementById('playerCount');
    const startBtn = document.getElementById('startInningsBtn');
    const errorEl = document.getElementById('setupError');
    if (!modal || !saveBtn || !cancelBtn) return;

    modal.classList.remove('hidden');
    // Prevent body focus stealing while modal is open
    document.removeEventListener('click', bodyFocusClickOnce, true);

    // Seed existing values
    playersInput.value = (savedLineup && savedLineup.length) ? savedLineup.join('\n') : '';
    flagSelect.value = selectedFlag || '';
    errorEl.style.display = 'none';

    function updateCountAndButton() {
        const names = (playersInput.value || '').split(/\n+/).map(s => s.trim()).filter(Boolean);
        playerCount.textContent = `Players: ${names.length}/10`;
        const valid = names.length === 10;
        startBtn.disabled = !valid;
        return { names, valid };
    }
    updateCountAndButton();
    playersInput.addEventListener('input', updateCountAndButton);

    const saveHandler = () => {
        const { names, valid } = updateCountAndButton();
        if (!valid) {
            errorEl.textContent = 'Please enter exactly 10 player names.';
            errorEl.style.display = 'block';
            return;
        }
        savedLineup = names;
        selectedFlag = flagSelect.value || '';
        document.getElementById('teamFlag').textContent = selectedFlag;
        modal.classList.add('hidden');
        // Reattach focus handler after modal closes
        document.addEventListener('click', bodyFocusClickOnce, true);
        cleanup();
    };
    const cancelHandler = () => {
        modal.classList.add('hidden');
        // Reattach focus handler after modal closes
        document.addEventListener('click', bodyFocusClickOnce, true);
        cleanup();
    };
    function cleanup() {
        saveBtn.removeEventListener('click', saveHandler);
        cancelBtn.removeEventListener('click', cancelHandler);
        playersInput.removeEventListener('input', updateCountAndButton);
    }
    saveBtn.addEventListener('click', saveHandler);
    cancelBtn.addEventListener('click', cancelHandler);
}

// Encapsulate body focus logic so we can add/remove cleanly
function bodyFocusClickOnce(e) {
    const isInModal = !!(e.target && e.target.closest && e.target.closest('.modal'));
    const isInteractive = !!(e.target && e.target.closest && e.target.closest('input, textarea, select, button'));
    if (isInModal || isInteractive) return;
    if (isGameRunning) {
        document.body.focus();
    }
}

function startGameWithDefaults() {
    startGame(null);
}

function startGame(customPlayers) {
    init(customPlayers);
    isGameRunning = true;
    gameEnded = false;
    currentIndex = 0;
    startTime = Date.now();
    wrongChar = null;
    const startBtn = document.getElementById('startInningsBtn');
    const declareBtn = document.getElementById('declareBtn');
    if (startBtn) startBtn.style.display = 'none';
    if (declareBtn) declareBtn.style.display = '';
    // Start timers immediately on innings start
    if (timer) clearInterval(timer);
    if (gameEndTimeout) clearTimeout(gameEndTimeout);
    if (secondTickInterval) clearInterval(secondTickInterval);
    timer = setInterval(updateStats, 100);
    // Align first tick to the next second boundary; stop exactly at 300 balls
    const tick = () => {
        if (!cricket) return;
        cricket.onSecondTick();
        const totalBalls = cricket.overs * 6 + cricket.balls;
        if (isGameRunning && totalBalls >= 300) {
            endGame();
        }
    };
    const now = Date.now();
    const msToNextSecond = 1000 - (now % 1000);
    setTimeout(() => {
        tick();
        secondTickInterval = setInterval(tick, 1000);
    }, msToNextSecond);
    // focus to capture keystrokes
    document.body.focus();
    // immediate UI refresh
    renderScoreboard();
    updateStats();
    renderScoreSummaryRight();
}


