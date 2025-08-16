// Cricket scoring engine for TypeCricket (Beta)
// Exposes a CricketEngine class used by script.js

(function(global){
    const PLAYERS = [
        'Tendulkar', 'Ponting', 'Lara', 'Dravid', 'Sangakkara',
        'Kallis', 'Jadeja', 'Akhtar', 'Warne', 'Muralitharan'
    ];

    const DISMISSAL_MODES = [
        'b Steyn', 'lbw Steyn', 'c de Villiers b Steyn', 'b Anderson', 'lbw Anderson',
        'c Dhoni b Bumrah', 'b Bumrah', 'c Gilchrist b McGrath', 'b McGrath', 'st Dhoni'
    ];

    function randomChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

    class CricketEngine {
        constructor({ onUpdate } = {}) {
            this.onUpdate = onUpdate || (() => {});
            this.reset();
        }

        reset() {
            this.players = PLAYERS.map(name => ({
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
            } else {
                // Accumulate errors against the partnership
                this.pairErrorCount += 1;
            }
            this.updateCallback();
        }

        shouldWicketFall() {
            // Pair-based error logic with time windows
            const nextPosition = this.wickets + 1; // 1-10
            const elapsedPairSec = (Date.now() - this.pairStartTimestampMs) / 1000;
            const errorsIncludingThis = this.pairErrorCount + 1; // include current error

            if (nextPosition <= 2) {
                if (elapsedPairSec <= 18) return true; // instant fall
                if (elapsedPairSec <= 36) return errorsIncludingThis >= 3; // 3 errors within 36s
                // After 36s, keep it challenging: every 3rd error
                return (errorsIncludingThis % 3) === 0;
            }

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
            const battingRows = this.players.map((p, idx) => {
                const isBatting = this.currentBatters.includes(idx) && !p.out;
                const strikerStar = isBatting && (this.striker === idx) ? ' *' : '';
                const status = p.out ? p.dismissal : (isBatting ? 'batting' : 'did not bat');
                return `<tr><td>${p.name}${strikerStar}</td><td>${p.runs}</td><td>${p.balls}</td><td>${status}</td></tr>`;
            }).join('');

            const totalOvers = `${this.overs}.${this.balls}`;
            return `
                <h3>Scorecard</h3>
                <table>
                    <thead>
                        <tr><th>Batter</th><th>R</th><th>B</th><th>How Out</th></tr>
                    </thead>
                    <tbody>${battingRows}</tbody>
                    <tfoot>
                        <tr><td>Total</td><td>${this.totalRuns}</td><td colspan="2">${this.wickets} wickets, ${totalOvers} overs</td></tr>
                    </tfoot>
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


