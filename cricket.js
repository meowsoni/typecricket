// Cricket scoring engine for TypeCricket (Beta)
// Exposes a CricketEngine class used by script.js

(function(global){
    const DEFAULT_PLAYERS = [
        'Tendulkar', 'Sehwag', 'Ganguly', 'Dravid', 'Kaif',
        'Yuvraj', 'Pathan', 'Khan', 'Kumble', 'Harbhajan', 'Srisanth'
    ];

    const DISMISSAL_MODES = [
        'b Steyn', 'lbw Steyn', 'c de Villiers b Steyn', 'b Anderson', 'lbw Anderson',
        'c Dhoni b Bumrah', 'b Bumrah', 'c Gilchrist b McGrath', 'b McGrath', 'st Dhoni'
    ];

    function randomChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

    class CricketEngine {
        constructor({ onUpdate, customPlayers } = {}) {
            this.onUpdate = onUpdate || (() => {});
            this.customPlayers = Array.isArray(customPlayers) && customPlayers.length ? customPlayers : null;
            this.reset(this.customPlayers);
        }

        reset(customPlayers) {
            const provided = Array.isArray(customPlayers) ? customPlayers.filter(Boolean) : [];
            const merged = provided.length ? provided.concat(DEFAULT_PLAYERS) : DEFAULT_PLAYERS;
            const basePlayers = merged.slice(0, 11); // allow XI
            this.players = basePlayers.map(name => ({
                name,
                runs: 0,
                balls: 0,
                out: false,
                dismissal: ''
            }));
            this.totalRuns = 0;
            this.wickets = 0;
            this.balls = 0; // 6 balls = 1 over
            this.overs = 0; // whole overs
            this.currentBatters = [0, 1]; // indexes of players
            this.strikerIndex = 0; // 0 or 1 within currentBatters
            this.pairErrorCount = 0; // errors accumulated for current partnership
            this.pairStartTimestampMs = Date.now(); // start time for current partnership
            this.pairErrorTimestamps = []; // rolling record of partnership error times
            this.suppressImmediateForNextPartnership = false; // skip <=18s instant rule for next 1–2 wicket if prior fell via window
            this.pendingWicketReason = ''; // 'immediate' | 'window' | ''
            this.updateCallback();
        }

        get striker() { return this.currentBatters[this.strikerIndex]; }
        get nonStriker() { return this.currentBatters[1 - this.strikerIndex]; }

        // Called when a word is typed correctly (1 run)
        onWord() {
            // 1 run added to team
            this.totalRuns += 1;
            // Randomly choose which batter gets the run, but keep a sense of strike
            // 65% chance striker scores, 35% non-striker
            const giveToStriker = Math.random() < 0.65;
            const batterIdx = giveToStriker ? this.striker : this.nonStriker;
            this.players[batterIdx].runs += 1;
            // Balls and overs are driven by real-time ticks, not per word

            // Swap strike sometimes to simulate singles/odd numbers
            if (!giveToStriker) {
                this.strikerIndex = 1 - this.strikerIndex;
            }

            this.updateCallback();
        }

        // Called when a typing error happens
        onError() {
            const currentBatterOrder = this.currentBatters.map(i => i);
            const wicketFalls = this.shouldWicketFall();
            if (wicketFalls) {
                // Randomly choose which current batter is out
                const outIdxInPair = Math.random() < 0.5 ? 0 : 1;
                const playerIndex = currentBatterOrder[outIdxInPair];
                this.dismissPlayer(playerIndex);
                // Configure suppression for next partnership based on reason
                if (this.pendingWicketReason === 'window') {
                    this.suppressImmediateForNextPartnership = true;
                } else {
                    this.suppressImmediateForNextPartnership = false;
                }
                this.pendingWicketReason = '';
            } else {
                // Accumulate errors against the partnership
                this.pairErrorCount += 1;
                this.pairErrorTimestamps.push(Date.now());
            }
            this.updateCallback();
        }

        shouldWicketFall() {
            const nextPosition = this.wickets + 1; // 1-10
            const now = Date.now();
            const elapsedPairSec = (now - this.pairStartTimestampMs) / 1000;

            if (nextPosition <= 2) {
                // If prior wicket fell via window, suppress immediate rule for first 18s of the new partnership
                if (elapsedPairSec <= 18) {
                    if (!this.suppressImmediateForNextPartnership) {
                        this.pendingWicketReason = 'immediate';
                        return true;
                    }
                    // If suppressed, allow check to move to rolling window
                } else if (this.suppressImmediateForNextPartnership) {
                    // Once beyond 18s, clear suppression
                    this.suppressImmediateForNextPartnership = false;
                }
                // >18s: rolling 36-second window — 3 partnership errors within any 36s span
                const timestamps = this.pairErrorTimestamps.slice();
                // include current error for evaluation
                timestamps.push(now);
                const cutoff = now - 36000;
                const recent = timestamps.filter(ts => ts >= cutoff).sort((a, b) => a - b);
                if (recent.length >= 3) {
                    for (let i = 0; i <= recent.length - 3; i++) {
                        if (recent[i + 2] - recent[i] <= 36000) {
                            this.pendingWicketReason = 'window';
                            return true;
                        }
                    }
                }
                return false;
            }

            const errorsIncludingThis = this.pairErrorCount + 1; // include current error

            if (nextPosition >= 3 && nextPosition <= 6) {
                return (errorsIncludingThis % 5) === 0;
            }

            if (nextPosition >= 7 && nextPosition <= 9) {
                return (errorsIncludingThis % 2) === 0;
            }

            if (nextPosition === 10) return true;

            return false;
        }

        dismissPlayer(playerIndex) {
            if (this.players[playerIndex].out) return;
            this.players[playerIndex].out = true;
            this.players[playerIndex].dismissal = randomChoice(DISMISSAL_MODES);
            this.wickets += 1;

            // Bring next player if available
            const nextPlayer = this.players.findIndex((p, idx) => !p.out && !this.currentBatters.includes(idx));
            if (nextPlayer !== -1) {
                // Replace the dismissed player in currentBatters
                const replaceIdx = this.currentBatters.indexOf(playerIndex);
                this.currentBatters[replaceIdx] = nextPlayer;
                // New batter starts non-striker to feel plausible
                this.strikerIndex = replaceIdx === 0 ? 0 : 1;
                // Reset partnership error tracking
                this.pairErrorCount = 0;
                this.pairStartTimestampMs = Date.now();
                this.pairErrorTimestamps = [];
            }
        }

        // Called externally each second to advance balls/overs and assign balls to striker
        onSecondTick() {
            const strikerPlayerIndex = this.striker;
            this.players[strikerPlayerIndex].balls += 1;
            this.balls += 1;
            if (this.balls >= 6) {
                this.balls = 0;
                this.overs += 1;
                // Swap strike at over end
                this.strikerIndex = 1 - this.strikerIndex;
            }
            this.updateCallback();
        }

        getRunRate(elapsedSeconds) {
            // 5 minutes = 50 overs metaphor; we'll compute RR as runs per over based on elapsed time
            const oversFromTime = (elapsedSeconds / 300) * 50; // scale 5 minutes -> 50 overs
            if (oversFromTime <= 0) return 0;
            return this.totalRuns / oversFromTime;
        }

        buildScoreboardHTML() {
            function formatDismissalForDisplay(text) {
                if (!text) return '';
                let d = String(text).trim();
                d = d.replace(/ b /g, ' b.');
                if (!d.endsWith('.')) d += '.';
                return d;
            }

            const battingRows = this.players.map((p, idx) => {
                const isBatting = this.currentBatters.includes(idx) && !p.out;
                const isStriker = isBatting && (this.striker === idx);
                const namePart = p.out
                    ? `${p.name} ${formatDismissalForDisplay(p.dismissal)}`
                    : `${p.name}${isStriker ? '*' : ''}`;
                const statsPart = `${p.runs}(${p.balls})`;
                const rowClass = isBatting ? ' class="current-partnership"' : '';
                return `<tr${rowClass}><td>${namePart}</td><td style="text-align:right">${statsPart}</td></tr>`;
            }).join('');

            const totalOvers = `${this.overs}.${this.balls}`;
            const totalRow = `<tr><td><strong>Total</strong></td><td style="text-align:right"><strong>${this.totalRuns}/${this.wickets} ${totalOvers} overs</strong></td></tr>`;

            return `
                <table>
                    <tbody>${battingRows}</tbody>
                    <tfoot>${totalRow}</tfoot>
                </table>
            `;
        }

        updateCallback() {
            this.onUpdate({
                totalRuns: this.totalRuns,
                wickets: this.wickets,
                overs: this.overs,
                balls: this.balls,
                players: this.players,
                striker: this.striker,
                nonStriker: this.nonStriker
            });
        }
    }

    global.CricketEngine = CricketEngine;
})(window);


