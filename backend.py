from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import math

app = FastAPI(title="AD-HTC Backend API")

# Allow CORS so the frontend (running on another port/file) can reach this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class CycleInput(BaseModel):
    pr: float
    tit: float
    bioRate: float
    htcTemp: float

@app.post("/analyze")
def analyze_cycle(data: CycleInput):
    """
    Calculate the thermodynamic cycle data points based on user inputs
    and return the exact JSON structure the frontend Plotly charts expect.
    """
    # 1. HTC Saturation Dome (Rough mock curve for visual clarity)
    s_liq, h_liq, s_vap, h_vap = [], [], [], []
    s_crit = 4.4
    h_crit = 2100

    for t in range(0, 105, 5):
        s1 = 1.0 + (t / 100) * (s_crit - 1.0)
        h1 = 400 + (t / 100) * (h_crit - 400) + 200 * math.sin(t / 100 * math.pi)
        s_liq.append(s1)
        h_liq.append(h1)

        s2 = 9.0 - (t / 100) * (9.0 - s_crit)
        h2 = 2500 - (t / 100) * (2500 - h_crit) + 400 * math.sin(t / 100 * math.pi)
        s_vap.insert(0, s2)
        h_vap.insert(0, h2)
        
    dome = {"s": s_liq + s_vap, "h": h_liq + h_vap}

    # 2. HTC Steam Cycle Calculation based on temp input
    tempFactor = data.htcTemp / 200.0
    s_cycle = [1.5, 1.5, 7.5 * tempFactor, 8.0 * tempFactor, 1.5]
    h_cycle = [500, 600, 2700 * tempFactor, 2700 * tempFactor, 500]
    htc_cycle = {"s": s_cycle, "h": h_cycle}

    # 3. Gas Cycle (Brayton Cycle properties mock)
    T1 = 300.0
    Cp_air = 1.005
    m_air = 50.0

    r_p = data.pr
    k = 1.4
    T2 = T1 * math.pow(r_p, (k-1)/k)

    T3 = data.tit
    m_fuel = data.bioRate * 0.5
    m_total = m_air + m_fuel
    Cp_gas = 1.15

    T4 = T3 / math.pow(r_p, (1.33-1)/1.33)

    H1 = m_air * Cp_air * T1
    H2 = m_air * Cp_air * T2
    H3 = m_total * Cp_gas * T3
    H4 = m_total * Cp_gas * T4

    processes = [
        {"name": 'Compression', "T": [T1, T2], "H": [H1, H2], "color": '#38bdf8'},
        {"name": 'Combustion (Heat Add)', "T": [T2, T3], "H": [H2, H3], "color": '#f59e0b'},
        {"name": 'Expansion (Turbine)', "T": [T3, T4], "H": [H3, H4], "color": '#f87171'},
        {"name": 'Exhaust (Heat Rej.)', "T": [T4, T1], "H": [H4, H1], "color": '#94a3b8'}
    ]

    return {
        "dome": dome,
        "htc_cycle": htc_cycle,
        "gas_cycle": processes
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8055)
