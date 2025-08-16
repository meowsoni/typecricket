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

function init() {
    text = buildThousandWordText(1000);
    currentIndex = 0;
    startTime = null;
    wrongChar = null;
    wordsTyped = 0;
    gameEnded = false;
    if (timer) clearInterval(timer);
    if (gameEndTimeout) clearTimeout(gameEndTimeout);
    if (secondTickInterval) clearInterval(secondTickInterval);
    if (!cricket) cricket = new CricketEngine({ onUpdate: renderScoreboard }); else cricket.reset();
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
        document.getElementById('wpm').textContent = '0';
        document.getElementById('time').textContent = '0';
        const rrEl = document.getElementById('rr');
        if (rrEl) rrEl.textContent = '0.00';
        return;
    }

    const elapsed = (Date.now() - startTime) / 1000;
    const wpm = Math.round((wordsTyped) / (elapsed / 60)) || 0;
    const accuracy = currentIndex > 0 ? 100 : 100;

    document.getElementById('wpm').textContent = wpm;

    if (cricket) {
        const rr = cricket.getRunRate(elapsed);
        const rrEl = document.getElementById('rr');
        if (rrEl) rrEl.textContent = rr.toFixed(2);
        renderScoreboard();
        if (cricket.wickets >= 10) {
            endGame();
        }
        // Score summary like "226/4 36.2 overs"
        const scoreEl = document.getElementById('scoreline');
        if (scoreEl) scoreEl.textContent = `${cricket.totalRuns}/${cricket.wickets} ${cricket.overs}.${cricket.balls} overs`;
    }
}

function startNew() {
    init();
}

function reset() {
    currentIndex = 0;
    startTime = null;
    wrongChar = null;
    if (timer) clearInterval(timer);
    render();
    updateStats();
}

document.addEventListener('keydown', function(e) {
    if (gameEnded || currentIndex >= text.length) return;

    // Start timer on first keystroke
    if (!startTime && e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        startTime = Date.now();
        timer = setInterval(updateStats, 100);
        gameEndTimeout = setTimeout(endGame, GAME_DURATION_MS);
        // Drive balls/overs by real seconds
        secondTickInterval = setInterval(() => cricket && cricket.onSecondTick(), 1000);
    }

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

document.addEventListener('click', () => document.body.focus());
document.body.setAttribute('tabindex', '0');

init();

function renderScoreboard() {
    const el = document.getElementById('cricketScoreboard');
    if (!el || !cricket) return;
    el.innerHTML = cricket.buildScoreboardHTML();
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
}


