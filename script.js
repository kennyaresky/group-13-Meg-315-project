// DOM Elements
const analyzeBtn = document.getElementById('analyzeBtn');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const schematicSection = document.querySelector('.schematic-section');

// Plotly Dark Theme Config
const plotLayoutBase = {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#94a3b8', family: 'Inter, sans-serif' },
    xaxis: {
        gridcolor: 'rgba(255,255,255,0.1)',
        zerolinecolor: 'rgba(255,255,255,0.2)',
        color: '#94a3b8'
    },
    yaxis: {
        gridcolor: 'rgba(255,255,255,0.1)',
        zerolinecolor: 'rgba(255,255,255,0.2)',
        color: '#94a3b8'
    },
    margin: { t: 40, r: 20, l: 50, b: 40 },
    showlegend: true,
    legend: { x: 0, y: 1, bgcolor: 'rgba(0,0,0,0.5)' }
};

// --- Main Action Handler ---

analyzeBtn.addEventListener('click', async () => {
    // 1. Update UI Status
    statusDot.classList.remove('idle');
    statusDot.classList.add('active');
    statusText.textContent = "System Active & Analyzing...";
    statusText.style.color = "var(--primary)";
    schematicSection.classList.add('system-active');

    // 2. Fetch Inputs
    const pr = parseFloat(document.getElementById('compPressure').value);
    const tit = parseFloat(document.getElementById('turbineInletTemp').value);
    const bioRate = parseFloat(document.getElementById('biomassRate').value);
    const htcTemp = parseFloat(document.getElementById('htcTemp').value);

    // Fetch from Python Backend
    try {
        const response = await fetch('http://127.0.0.1:8055/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pr, tit, bioRate, htcTemp })
        });

        if (!response.ok) throw new Error("Backend connection failed");

        const data = await response.json();

        // Remove placeholder messages if they exist
        const placeholders = document.querySelectorAll('.placeholder-msg');
        placeholders.forEach(el => el.remove());

        // 3. Render h-s Chart (HTC Steam Cycle)
        renderHSChart(data.dome, data.htc_cycle);

        // 4. Render T-H dot Chart (Gas Cycle)
        renderTHChart(data.gas_cycle);

        statusText.textContent = "Analysis Complete";
    } catch (error) {
        console.error("Error fetching data:", error);
        statusText.textContent = "Error: Backend Offline";
        statusText.style.color = "#ef4444";
        schematicSection.classList.remove('system-active');
        statusDot.classList.remove('active');
        statusDot.classList.add('idle');
    }
});

function renderHSChart(dome, cycle) {
    const traceDome = {
        x: dome.s,
        y: dome.h,
        mode: 'lines',
        name: 'Saturation Dome',
        line: { color: 'rgba(255, 255, 255, 0.3)', width: 2, dash: 'dash' }
    };

    const traceCycle = {
        x: cycle.s,
        y: cycle.h,
        mode: 'lines+markers',
        name: 'HTC Cycle (No Turbine)',
        line: { color: '#10b981', width: 3 },
        marker: { size: 8, color: '#f59e0b' },
        fill: 'toself',
        fillcolor: 'rgba(16, 185, 129, 0.15)'
    };

    const layout = {
        ...plotLayoutBase,
        title: 'HTC Steam Cycle Enthalpy-Entropy (h-s)',
        xaxis: { ...plotLayoutBase.xaxis, title: 'Entropy, s (kJ/kg·K)' },
        yaxis: { ...plotLayoutBase.yaxis, title: 'Enthalpy, h (kJ/kg)' },
        annotations: [
            {
                x: cycle.s[2],
                y: cycle.h[2],
                xref: 'x', yref: 'y',
                text: 'Turbine Inlet (Simulated)',
                showarrow: true, arrowhead: 2, arrowcolor: '#f59e0b',
                font: { color: '#f8fafc', size: 11 }, ax: -20, ay: -30
            }
        ]
    };

    Plotly.newPlot('hsChart', [traceDome, traceCycle], layout);
}

function renderTHChart(processes) {
    const data = [];
    const annotations = [];

    // Map of colors to their transparent versions
    const fillColors = {
        '#38bdf8': 'rgba(56, 189, 248, 0.15)',
        '#f59e0b': 'rgba(245, 158, 11, 0.15)',
        '#f87171': 'rgba(248, 113, 113, 0.15)',
        '#94a3b8': 'rgba(148, 163, 184, 0.15)'
    };

    processes.forEach(proc => {
        data.push({
            x: proc.H,
            y: proc.T,
            mode: 'lines+markers',
            name: proc.name,
            line: { color: proc.color, width: 3 },
            marker: { size: 8 },
            fill: 'tozeroy',
            fillcolor: fillColors[proc.color]
        });

        // Add annotation for the start of the process
        annotations.push({
            x: proc.H[0],
            y: proc.T[0],
            xref: 'x',
            yref: 'y',
            text: proc.name.split(' ')[0],
            showarrow: true,
            arrowhead: 2,
            arrowcolor: proc.color,
            font: { color: '#f8fafc', size: 10 },
            ax: 20,
            ay: -25
        });
    });

    const layout = {
        ...plotLayoutBase,
        title: 'Gas Cycle Temp vs Enthalpy Rate (T-Ḣ)',
        xaxis: { ...plotLayoutBase.xaxis, title: 'Enthalpy Rate, Ḣ (kW)' },
        yaxis: { ...plotLayoutBase.yaxis, title: 'Temperature, T (K)' },
        annotations: annotations
    };

    Plotly.newPlot('thChart', data, layout);
}
