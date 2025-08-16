// Stats/Worm Chart module
// Exposes StatsWormChart class with update(engineSnapshot) and reset()

(function(global){
    class StatsWormChart {
        constructor(targetElementId) {
            this.targetElementId = targetElementId;
            this.initialOversHint = 50; // start at 50, extend dynamically
            this.width = 700;
            this.height = 180;
            this.padding = { top: 12, right: 64, bottom: 24, left: 36 };
            this.reset();
        }

        reset() {
            this.oversRunTotals = []; // cumulative runs per over end index, index = over number
            this.wickets = []; // { over, ball, totalRuns, label }
            this.currentOvers = 0;
            this.currentBalls = 0;
            this.currentTotalRuns = 0;
            this.prevOutNames = new Set();
            this.renderBase();
        }

        // engineSnapshot: { totalRuns, wickets, overs, balls, players }
        update(snapshot) {
            if (!snapshot) return;

            // Ensure overs array is long enough
            const currentOverIndex = snapshot.overs;
            if (this.oversRunTotals.length <= currentOverIndex) {
                for (let i = this.oversRunTotals.length; i <= currentOverIndex; i++) {
                    this.oversRunTotals[i] = (i === 0) ? 0 : (this.oversRunTotals[i] ?? this.oversRunTotals[i-1]);
                }
            }

            // Use totalRuns as current cumulative at this ball
            // Only set end-of-over cumulative when balls roll to 0 (new over begins)
            // But we also want an in-progress point for the current over
            this.currentTotalRuns = snapshot.totalRuns;
            this.currentOvers = snapshot.overs;
            this.currentBalls = snapshot.balls;

            // Track wickets accurately by diffing players that just turned 'out'
            const nowOut = new Set(snapshot.players.filter(p => p.out).map(p => p.name));
            snapshot.players.forEach(p => {
                if (p.out && !this.prevOutNames.has(p.name)) {
                    const label = `${p.name} ${p.runs}(${p.balls})`;
                    this.wickets.push({ over: snapshot.overs, ball: snapshot.balls, totalRuns: snapshot.totalRuns, label });
                }
            });
            this.prevOutNames = nowOut;

            // If over just completed (balls == 0) and not first over, store cumulative
            if (snapshot.balls === 0) {
                this.oversRunTotals[snapshot.overs] = snapshot.totalRuns;
            }

            this.render();
        }

        renderBase() {
            const container = document.getElementById(this.targetElementId);
            if (!container) return;
            container.innerHTML = '';
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            // Responsive width based on container
            this.width = container.clientWidth || this.width;
            svg.setAttribute('width', this.width);
            svg.setAttribute('height', this.height);
            svg.setAttribute('viewBox', `0 0 ${this.width} ${this.height}`);
            svg.style.display = 'block';

            // Axes groups
            const axes = document.createElementNS(svg.namespaceURI, 'g');
            axes.setAttribute('class', 'axes');
            svg.appendChild(axes);

            const pathGroup = document.createElementNS(svg.namespaceURI, 'g');
            pathGroup.setAttribute('class', 'series');
            svg.appendChild(pathGroup);

            const wicketGroup = document.createElementNS(svg.namespaceURI, 'g');
            wicketGroup.setAttribute('class', 'wickets');
            svg.appendChild(wicketGroup);

            container.appendChild(svg);
            this.svg = svg;
            this.axes = axes;
            this.pathGroup = pathGroup;
            this.wicketGroup = wicketGroup;
        }

        render() {
            if (!this.svg) return;

            const width = this.width - this.padding.left - this.padding.right;
            const height = this.height - this.padding.top - this.padding.bottom;

            // Dynamic X-domain: at least initialOversHint, else extend to current overs
            const xNow = (this.currentOvers || 0) + ((this.currentBalls || 0) / 6);
            const xDomainMax = Math.max(this.initialOversHint, Math.ceil(xNow + 0.001));
            // Y-axis: start at 200 and step up as totals increase (denser as runs increase)
            const currentMax = Math.max(0, this.currentTotalRuns || 0, ...this.oversRunTotals);
            const baseY = 200; // initial visible range
            const step = 50;   // grow in 50-run chunks for stability
            const maxRuns = Math.max(baseY, Math.ceil(currentMax / step) * step);

            const xScale = (over, ball = 0) => {
                const xOver = over + (ball / 6);
                return this.padding.left + (xOver / xDomainMax) * width;
            };
            const yScale = (runs) => {
                const r = Math.max(0, runs);
                return this.padding.top + height - (r / maxRuns) * height;
            };

            // Clear groups
            this.axes.innerHTML = '';
            this.pathGroup.innerHTML = '';
            this.wicketGroup.innerHTML = '';

            // Axes lines
            const xAxis = document.createElementNS(this.svg.namespaceURI, 'line');
            xAxis.setAttribute('x1', this.padding.left);
            xAxis.setAttribute('y1', this.padding.top + height);
            xAxis.setAttribute('x2', this.padding.left + width);
            xAxis.setAttribute('y2', this.padding.top + height);
            xAxis.setAttribute('stroke', '#c7d2fe');
            xAxis.setAttribute('stroke-width', '1');
            this.axes.appendChild(xAxis);

            const yAxis = document.createElementNS(this.svg.namespaceURI, 'line');
            yAxis.setAttribute('x1', this.padding.left);
            yAxis.setAttribute('y1', this.padding.top);
            yAxis.setAttribute('x2', this.padding.left);
            yAxis.setAttribute('y2', this.padding.top + height);
            yAxis.setAttribute('stroke', '#c7d2fe');
            yAxis.setAttribute('stroke-width', '1');
            this.axes.appendChild(yAxis);

            // Ticks (every 5 overs up to current domain), stop before right edge and leave padding
            for (let o = 0; o <= xDomainMax; o += 5) {
                const tx = xScale(o, 0);
                if (tx > this.padding.left + width - 4) break;
                const tick = document.createElementNS(this.svg.namespaceURI, 'line');
                tick.setAttribute('x1', tx);
                tick.setAttribute('y1', this.padding.top + height);
                tick.setAttribute('x2', tx);
                tick.setAttribute('y2', this.padding.top + height + 4);
                tick.setAttribute('stroke', '#c7d2fe');
                this.axes.appendChild(tick);

                const label = document.createElementNS(this.svg.namespaceURI, 'text');
                label.setAttribute('x', tx);
                label.setAttribute('y', this.padding.top + height + 16);
                label.setAttribute('text-anchor', 'middle');
                label.setAttribute('font-size', '10');
                label.setAttribute('fill', '#6b7280');
                label.textContent = o.toString();
                this.axes.appendChild(label);
            }

            // Y-axis run ticks every 50 runs
            for (let r = 0; r <= maxRuns; r += 50) {
                const ty = yScale(r);
                const tick = document.createElementNS(this.svg.namespaceURI, 'line');
                tick.setAttribute('x1', this.padding.left - 4);
                tick.setAttribute('y1', ty);
                tick.setAttribute('x2', this.padding.left);
                tick.setAttribute('y2', ty);
                tick.setAttribute('stroke', '#c7d2fe');
                this.axes.appendChild(tick);

                const label = document.createElementNS(this.svg.namespaceURI, 'text');
                label.setAttribute('x', this.padding.left - 8);
                label.setAttribute('y', ty + 3);
                label.setAttribute('text-anchor', 'end');
                label.setAttribute('font-size', '10');
                label.setAttribute('fill', '#6b7280');
                label.textContent = r.toString();
                this.axes.appendChild(label);
            }

            // Build path: from origin through completed overs, then in-progress point
            const d = [];
            d.push(`M ${xScale(0, 0)} ${yScale(0)}`);
            for (let o = 1; o < this.oversRunTotals.length; o++) {
                const xr = xScale(o, 0);
                const yr = yScale(this.oversRunTotals[o] ?? this.oversRunTotals[o - 1] ?? 0);
                d.push(`L ${xr} ${yr}`);
            }
            if (typeof this.currentTotalRuns === 'number') {
                const xNow2 = xScale(this.currentOvers || 0, this.currentBalls || 0);
                const yNow2 = yScale(this.currentTotalRuns);
                d.push(`L ${xNow2} ${yNow2}`);
            }

            const path = document.createElementNS(this.svg.namespaceURI, 'path');
            path.setAttribute('d', d.join(' '));
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', '#86efac');
            path.setAttribute('stroke-width', '2');
            this.pathGroup.appendChild(path);

            // Wickets with simple collision-avoidance for labels
            const placedBoxes = [];
            const fontSizePx = 10;
            const approxCharWidth = 6; // rough width at 10px font
            for (const w of this.wickets) {
                const cx = xScale(w.over, w.ball);
                const cy = yScale(w.totalRuns);
                const dot = document.createElementNS(this.svg.namespaceURI, 'circle');
                dot.setAttribute('cx', cx);
                dot.setAttribute('cy', cy);
                dot.setAttribute('r', '3');
                dot.setAttribute('fill', '#ef4444');
                this.wicketGroup.appendChild(dot);

                const labelWidth = (w.label?.length || 6) * approxCharWidth;
                const labelHeight = fontSizePx + 4;
                const rightBound = this.padding.left + width - 2;
                const leftBound = this.padding.left + 2;
                // Prefer right of dot; if not enough room, place to left
                let lx = cx + 6;
                if (lx + labelWidth > rightBound) {
                    lx = cx - 6 - labelWidth;
                }
                if (lx < leftBound) lx = leftBound;
                let ly = cy - 6;

                const overlaps = (a, b) => !(a.x2 < b.x1 || a.x1 > b.x2 || a.y2 < b.y1 || a.y1 > b.y2);

                // Nudge label vertically to avoid overlaps; try upwards first, then downwards
                const makeBox = (x, y) => ({ x1: x, y1: y - labelHeight, x2: x + labelWidth, y2: y });
                let candidate = makeBox(lx, ly);
                let attempts = 0;
                const maxAttempts = 30;
                while (placedBoxes.some(b => overlaps(candidate, b)) && attempts < maxAttempts) {
                    ly -= 12;
                    if (ly - labelHeight < this.padding.top) {
                        // flip below if we hit the top
                        ly = cy + 12;
                        break;
                    }
                    candidate = makeBox(lx, ly);
                    attempts++;
                }
                // If still overlapping (e.g., many wickets), keep nudging downward
                attempts = 0;
                while (placedBoxes.some(b => overlaps(candidate, b)) && attempts < maxAttempts) {
                    ly += 12;
                    if (ly > this.height - this.padding.bottom) break;
                    candidate = makeBox(lx, ly);
                    attempts++;
                }
                placedBoxes.push(candidate);

                const label = document.createElementNS(this.svg.namespaceURI, 'text');
                label.setAttribute('x', lx);
                label.setAttribute('y', ly);
                label.setAttribute('font-size', String(fontSizePx));
                label.setAttribute('fill', '#374151');
                label.textContent = w.label;
                this.wicketGroup.appendChild(label);
            }
        }
    }

    global.StatsWormChart = StatsWormChart;
})(window);


