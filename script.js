document.getElementById('btc-form').addEventListener('submit', function(e) {
  e.preventDefault();

  // Get user inputs
  const currentAge = parseInt(document.getElementById('currentAge').value, 10);
  const retirementAge = parseInt(document.getElementById('retirementAge').value, 10);
  const lifeExpectancy = parseInt(document.getElementById('lifeExpectancy').value, 10);
  const btcHoldings = parseFloat(document.getElementById('btcHoldings').value);
  const btcPrice = parseFloat(document.getElementById('btcPrice').value);
  const monthlyPurchase = parseFloat(document.getElementById('monthlyPurchase').value);
  const monthlyExpenses = parseFloat(document.getElementById('monthlyExpenses').value);
  const btcGrowth = parseFloat(document.getElementById('btcGrowth').value) / 100;
  const inflationRate = parseFloat(document.getElementById('inflationRate').value) / 100;

  // Years until retirement and retirement duration
  const yearsToRetirement = retirementAge - currentAge;
  const retirementYears = lifeExpectancy - retirementAge;

  // Calculate projected BTC stack at retirement
  let btcStack = btcHoldings;
  let btcPriceFuture = btcPrice;
  for (let year = 0; year < yearsToRetirement; year++) {
    // Add DCA BTC for the year (monthlyPurchase * 12 / btcPriceFuture)
    btcStack += (monthlyPurchase * 12) / btcPriceFuture;
    // Grow BTC price
    btcPriceFuture *= (1 + btcGrowth);
  }

  // Projected BTC value at retirement
  const portfolioValueAtRetirement = btcStack * btcPriceFuture;

  // Calculate total required withdrawals (inflation-adjusted expenses)
  let totalNeeded = 0;
  let expenses = monthlyExpenses * 12;
  let btcStackDrawdown = btcStack;
  let btcPriceDrawdown = btcPriceFuture;
  let canSustain = true;

  for (let year = 0; year < retirementYears; year++) {
    // Withdraw expenses for the year (in BTC)
    const btcNeeded = expenses / btcPriceDrawdown;
    btcStackDrawdown -= btcNeeded;
    if (btcStackDrawdown < 0) {
      canSustain = false;
      break;
    }
    // Grow BTC price and expenses for next year
    btcPriceDrawdown *= (1 + btcGrowth);
    expenses *= (1 + inflationRate);
  }

  // Format results
  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = `
    <strong>At retirement (age ${retirementAge}):</strong><br>
    <ul>
      <li>Projected BTC stack: <b>${btcStack.toFixed(6)} BTC</b></li>
      <li>Projected BTC price: <b>$${btcPriceFuture.toLocaleString(undefined, {maximumFractionDigits: 0})}</b></li>
      <li>Portfolio value: <b>$${portfolioValueAtRetirement.toLocaleString(undefined, {maximumFractionDigits: 0})}</b></li>
    </ul>
    <strong>Retirement analysis:</strong><br>
    <ul>
      <li>Retirement duration: <b>${retirementYears} years</b></li>
      <li>First year retirement expenses: <b>$${(monthlyExpenses*12).toLocaleString(undefined, {maximumFractionDigits: 0})}</b></li>
      <li>Expenses grow at <b>${(inflationRate*100).toFixed(1)}%</b> per year</li>
    </ul>
    <div style="margin-top:12px;font-size:1.1em;">
      <b>${canSustain ? '✅ Your BTC stack is projected to sustain your retirement!' : '⚠️ Your BTC stack may not be enough to cover your retirement expenses.'}</b>
    </div>
  `;
});

// Chart.js colors inspired by Monorail
const chartColors = {
  base: '#ff9900',
  bullish: '#00e6b8',
  bearish: '#ff4d4d',
  bg: '#23283a',
  grid: '#2d3347',
  text: '#f3f4f6',
};

let btcChart = null;
let lastProjection = null;

function getProjection({
  currentAge, retirementAge, lifeExpectancy, btcHoldings, btcPrice, monthlyPurchase, monthlyExpenses, btcGrowth, inflationRate
}) {
  const yearsToRetirement = retirementAge - currentAge;
  const retirementYears = lifeExpectancy - retirementAge;
  let btcStack = btcHoldings;
  let btcPriceFuture = btcPrice;
  const btcStackArr = [];
  const btcValueArr = [];
  const expensesArr = [];
  let yearLabels = [];
  let expenses = monthlyExpenses * 12;
  let btcStackDrawdown = null;
  let btcPriceDrawdown = null;
  let canSustain = true;

  // Accumulation phase
  for (let year = 0; year < yearsToRetirement; year++) {
    btcStack += (monthlyPurchase * 12) / btcPriceFuture;
    btcPriceFuture *= (1 + btcGrowth);
    btcStackArr.push(btcStack);
    btcValueArr.push(btcStack * btcPriceFuture);
    expensesArr.push(0);
    yearLabels.push(currentAge + year + 1);
  }
  // Drawdown phase
  btcStackDrawdown = btcStack;
  btcPriceDrawdown = btcPriceFuture;
  for (let year = 0; year < retirementYears; year++) {
    const btcNeeded = expenses / btcPriceDrawdown;
    btcStackDrawdown -= btcNeeded;
    btcStackArr.push(Math.max(btcStackDrawdown, 0));
    btcValueArr.push(Math.max(btcStackDrawdown, 0) * btcPriceDrawdown);
    expensesArr.push(expenses);
    yearLabels.push(retirementAge + year + 1);
    btcPriceDrawdown *= (1 + btcGrowth);
    expenses *= (1 + inflationRate);
    if (btcStackDrawdown < 0 && canSustain) canSustain = false;
  }
  return {
    btcStackArr,
    btcValueArr,
    expensesArr,
    yearLabels,
    canSustain,
    portfolioValueAtRetirement: btcStack * btcPriceFuture,
    btcStackAtRetirement: btcStack,
    btcPriceAtRetirement: btcPriceFuture
  };
}

function getScenarioParams(scenario, baseParams) {
  // Adjust growth for bullish/bearish
  let params = { ...baseParams };
  if (scenario === 'bullish') params.btcGrowth += 0.07; // +7% annual
  if (scenario === 'bearish') params.btcGrowth -= 0.05; // -5% annual
  return params;
}

function renderChart(projection, scenario) {
  const ctx = document.getElementById('btcChart').getContext('2d');
  const color = chartColors[scenario];
  if (btcChart) btcChart.destroy();
  btcChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: projection.yearLabels,
      datasets: [
        {
          label: 'BTC Portfolio Value (USD)',
          data: projection.btcValueArr,
          borderColor: color,
          backgroundColor: color + '22',
          pointRadius: 2,
          fill: true,
          tension: 0.25,
        },
        {
          label: 'Annual Expenses (USD)',
          data: projection.expensesArr,
          borderColor: chartColors.grid,
          backgroundColor: chartColors.grid + '22',
          pointRadius: 0,
          borderDash: [6, 6],
          fill: false,
          tension: 0.25,
          yAxisID: 'y',
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          labels: { color: chartColors.text }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: function(context) {
              return context.dataset.label + ': $' + Number(context.parsed.y).toLocaleString(undefined, {maximumFractionDigits: 0});
            }
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'Year', color: chartColors.text },
          ticks: { color: chartColors.text },
          grid: { color: chartColors.grid }
        },
        y: {
          title: { display: true, text: 'USD', color: chartColors.text },
          ticks: { color: chartColors.text },
          grid: { color: chartColors.grid }
        }
      }
    }
  });
}

function updateScenarioButtons(active) {
  document.querySelectorAll('.scenario-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.scenario === active);
  });
}

function handleProjectionAndChart(scenario, baseParams) {
  const params = getScenarioParams(scenario, baseParams);
  const projection = getProjection(params);
  renderChart(projection, scenario);
  lastProjection = { scenario, baseParams };
  updateScenarioButtons(scenario);
}

// Track which scenarios are visible
const scenarioVisibility = {
  base: true,
  bullish: true,
  bearish: true
};

function getAllProjections(baseParams) {
  return {
    base: getProjection(getScenarioParams('base', baseParams)),
    bullish: getProjection(getScenarioParams('bullish', baseParams)),
    bearish: getProjection(getScenarioParams('bearish', baseParams)),
  };
}

function renderChartMulti(projections, visibility) {
  const ctx = document.getElementById('btcChart').getContext('2d');
  if (btcChart) btcChart.destroy();
  const datasets = [];
  if (visibility.base) {
    datasets.push({
      label: 'BTC Value (Base)',
      data: projections.base.btcValueArr,
      borderColor: chartColors.base,
      backgroundColor: chartColors.base + '22',
      pointRadius: 2,
      fill: false,
      tension: 0.25,
    });
  }
  if (visibility.bullish) {
    datasets.push({
      label: 'BTC Value (Bullish)',
      data: projections.bullish.btcValueArr,
      borderColor: chartColors.bullish,
      backgroundColor: chartColors.bullish + '22',
      pointRadius: 2,
      fill: false,
      tension: 0.25,
    });
  }
  if (visibility.bearish) {
    datasets.push({
      label: 'BTC Value (Bearish)',
      data: projections.bearish.btcValueArr,
      borderColor: chartColors.bearish,
      backgroundColor: chartColors.bearish + '22',
      pointRadius: 2,
      fill: false,
      tension: 0.25,
    });
  }
  // Only show expenses for base scenario
  datasets.push({
    label: 'Annual Expenses (USD)',
    data: projections.base.expensesArr,
    borderColor: chartColors.grid,
    backgroundColor: chartColors.grid + '22',
    pointRadius: 0,
    borderDash: [6, 6],
    fill: false,
    tension: 0.25,
    yAxisID: 'y',
  });
  btcChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: projections.base.yearLabels,
      datasets
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          labels: { color: chartColors.text, font: { size: 16 } }
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          callbacks: {
            label: function(context) {
              return context.dataset.label + ': $' + Number(context.parsed.y).toLocaleString(undefined, {maximumFractionDigits: 0});
            }
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'Year', color: chartColors.text, font: { size: 16 } },
          ticks: { color: chartColors.text, font: { size: 14 } },
          grid: { color: chartColors.grid }
        },
        y: {
          title: { display: true, text: 'USD', color: chartColors.text, font: { size: 16 } },
          ticks: { color: chartColors.text, font: { size: 14 } },
          grid: { color: chartColors.grid }
        }
      }
    }
  });
}

function updateScenarioButtonsMulti() {
  document.querySelectorAll('.scenario-btn').forEach(btn => {
    btn.classList.toggle('active', scenarioVisibility[btn.dataset.scenario]);
  });
}

function handleProjectionAndChartMulti(baseParams) {
  const projections = getAllProjections(baseParams);
  renderChartMulti(projections, scenarioVisibility);
  lastProjection = { baseParams };
  updateScenarioButtonsMulti();
}

// Solve for selector logic
const solveForSelect = document.getElementById('solveFor');
const monthlyPurchaseInput = document.getElementById('monthlyPurchase');
const monthlyExpensesInput = document.getElementById('monthlyExpenses');

function updateSolveForUI() {
  const mode = solveForSelect.value;
  if (mode === 'expenses') {
    monthlyPurchaseInput.disabled = false;
    monthlyExpensesInput.disabled = true;
    monthlyExpensesInput.placeholder = 'Solved automatically';
  } else {
    monthlyPurchaseInput.disabled = true;
    monthlyExpensesInput.disabled = false;
    monthlyPurchaseInput.placeholder = 'Solved automatically';
  }
}
if (solveForSelect) {
  solveForSelect.addEventListener('change', updateSolveForUI);
  updateSolveForUI();
}

// Helper: Solve for max sustainable monthly expenses
function solveForMaxExpenses(params) {
  // Binary search for max expenses that can be sustained
  let low = 0, high = 1e6, best = 0;
  for (let i = 0; i < 30; i++) {
    let mid = (low + high) / 2;
    const test = getProjection({ ...params, monthlyExpenses: mid });
    if (test.canSustain) {
      best = mid;
      low = mid;
    } else {
      high = mid;
    }
  }
  return best;
}

// Helper: Solve for min monthly BTC purchase needed
function solveForMinPurchase(params) {
  // Binary search for min purchase that can sustain expenses
  let low = 0, high = 1e5, best = 0;
  for (let i = 0; i < 30; i++) {
    let mid = (low + high) / 2;
    const test = getProjection({ ...params, monthlyPurchase: mid });
    if (test.canSustain) {
      best = mid;
      high = mid;
    } else {
      low = mid;
    }
  }
  return best;
}

// Main form logic (override)
const form = document.getElementById('btc-form');
form.addEventListener('submit', function(e) {
  e.preventDefault();
  const baseParams = {
    currentAge: parseInt(document.getElementById('currentAge').value, 10),
    retirementAge: parseInt(document.getElementById('retirementAge').value, 10),
    lifeExpectancy: parseInt(document.getElementById('lifeExpectancy').value, 10),
    btcHoldings: parseFloat(document.getElementById('btcHoldings').value),
    btcPrice: parseFloat(document.getElementById('btcPrice').value),
    btcGrowth: parseFloat(document.getElementById('btcGrowth').value) / 100,
    inflationRate: parseFloat(document.getElementById('inflationRate').value) / 100,
  };
  const solveFor = solveForSelect.value;
  let monthlyPurchase = parseFloat(monthlyPurchaseInput.value);
  let monthlyExpenses = parseFloat(monthlyExpensesInput.value);
  let solvedValue = null;
  if (solveFor === 'expenses') {
    // User inputs purchase, solve for max expenses
    baseParams.monthlyPurchase = monthlyPurchase;
    solvedValue = solveForMaxExpenses(baseParams);
    baseParams.monthlyExpenses = solvedValue;
    monthlyExpensesInput.value = solvedValue.toFixed(2);
  } else {
    // User inputs expenses, solve for min purchase
    baseParams.monthlyExpenses = monthlyExpenses;
    solvedValue = solveForMinPurchase(baseParams);
    baseParams.monthlyPurchase = solvedValue;
    monthlyPurchaseInput.value = solvedValue.toFixed(2);
  }
  handleProjectionAndChartMulti(baseParams);

  // Results (as before)
  const projection = getProjection(baseParams);
  const resultsDiv = document.getElementById('results');
  let solvedLabel = solveFor === 'expenses' ? 'Max sustainable monthly retirement expenses' : 'Min required monthly BTC purchase';
  resultsDiv.innerHTML = `
    <strong>${solvedLabel}: <span style="color:#ff9900;">$${solvedValue.toLocaleString(undefined, {maximumFractionDigits: 2})}</span></strong><br>
    <strong>At retirement (age ${baseParams.retirementAge}):</strong><br>
    <ul>
      <li>Projected BTC stack: <b>${projection.btcStackAtRetirement.toFixed(6)} BTC</b></li>
      <li>Projected BTC price: <b>$${projection.btcPriceAtRetirement.toLocaleString(undefined, {maximumFractionDigits: 0})}</b></li>
      <li>Portfolio value: <b>$${projection.portfolioValueAtRetirement.toLocaleString(undefined, {maximumFractionDigits: 0})}</b></li>
    </ul>
    <strong>Retirement analysis:</strong><br>
    <ul>
      <li>Retirement duration: <b>${baseParams.lifeExpectancy - baseParams.retirementAge} years</b></li>
      <li>First year retirement expenses: <b>$${(baseParams.monthlyExpenses*12).toLocaleString(undefined, {maximumFractionDigits: 0})}</b></li>
      <li>Expenses grow at <b>${(baseParams.inflationRate*100).toFixed(1)}%</b> per year</li>
    </ul>
    <div style="margin-top:12px;font-size:1.1em;">
      <b>${projection.canSustain ? '✅ Your BTC stack is projected to sustain your retirement!' : '⚠️ Your BTC stack may not be enough to cover your retirement expenses.'}</b>
    </div>
  `;
});

// Scenario toggle logic (multi)
Array.from(document.querySelectorAll('.scenario-btn')).forEach(btn => {
  btn.addEventListener('click', function() {
    scenarioVisibility[this.dataset.scenario] = !scenarioVisibility[this.dataset.scenario];
    if (!lastProjection) return;
    handleProjectionAndChartMulti(lastProjection.baseParams);
  });
});

// Helper: Get current BTC price
const getPriceBtn = document.getElementById('getPriceBtn');
if (getPriceBtn) {
  getPriceBtn.addEventListener('click', async function() {
    getPriceBtn.disabled = true;
    getPriceBtn.textContent = 'Loading...';
    try {
      const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
      const data = await res.json();
      if (data.bitcoin && data.bitcoin.usd) {
        document.getElementById('btcPrice').value = data.bitcoin.usd;
      }
      getPriceBtn.textContent = 'Get Current Price';
    } catch (e) {
      getPriceBtn.textContent = 'Error';
      setTimeout(() => { getPriceBtn.textContent = 'Get Current Price'; }, 2000);
    }
    getPriceBtn.disabled = false;
  });
}

// Helper: Growth rate buttons
const growth5yrBtn = document.getElementById('growth5yrBtn');
const growth10yrBtn = document.getElementById('growth10yrBtn');
if (growth5yrBtn) {
  growth5yrBtn.addEventListener('click', function() {
    document.getElementById('btcGrowth').value = 44;
  });
}
if (growth10yrBtn) {
  growth10yrBtn.addEventListener('click', function() {
    document.getElementById('btcGrowth').value = 70;
  });
}

// Persistent profile state
let userProfile = null;

// Handle persistent input form
const persistentForm = document.getElementById('persistent-inputs-form');
const toolTabsSection = document.getElementById('toolTabsSection');

persistentForm.addEventListener('submit', function(e) {
  e.preventDefault();
  userProfile = {
    currentAge: parseInt(document.getElementById('profileAge').value, 10),
    retirementAge: parseInt(document.getElementById('profileRetirementAge').value, 10),
  };
  // Hide persistent form, show tool tabs
  persistentForm.style.display = 'none';
  toolTabsSection.style.display = '';
  renderRetirementTab();
  switchTab('retirement');
});

// Helper for Get Current Price in persistent form
const profileGetPriceBtn = document.getElementById('profileGetPriceBtn');
if (profileGetPriceBtn) {
  profileGetPriceBtn.addEventListener('click', async function() {
    profileGetPriceBtn.disabled = true;
    profileGetPriceBtn.textContent = 'Loading...';
    try {
      const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
      const data = await res.json();
      if (data.bitcoin && data.bitcoin.usd) {
        document.getElementById('profileBtcPrice').value = data.bitcoin.usd;
      }
      profileGetPriceBtn.textContent = 'Get Current Price';
    } catch (e) {
      profileGetPriceBtn.textContent = 'Error';
      setTimeout(() => { profileGetPriceBtn.textContent = 'Get Current Price'; }, 2000);
    }
    profileGetPriceBtn.disabled = false;
  });
}

// Tab switching logic
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = {
  retirement: document.getElementById('tab-retirement'),
  goal: document.getElementById('tab-goal'),
  withdrawal: document.getElementById('tab-withdrawal'),
};
function switchTab(tab) {
  tabBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
  Object.keys(tabContents).forEach(key => {
    tabContents[key].style.display = (key === tab) ? 'block' : 'none';
  });
}
tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    switchTab(btn.dataset.tab);
    if (btn.dataset.tab === 'retirement') renderRetirementTab();
    if (btn.dataset.tab === 'goal') renderGoalPlannerTab();
    if (btn.dataset.tab === 'withdrawal') renderWithdrawalTab();
  });
});

// Render Retirement Calculator tab
function renderRetirementTab() {
  if (!userProfile) return;
  const el = tabContents.retirement;
  el.innerHTML = `
    <form id="btc-form">
      <div class="form-group">
        <label for="solveFor">Solve for</label>
        <select id="solveFor" class="solve-for-select">
          <option value="expenses">Monthly Retirement Expenses</option>
          <option value="purchase">Monthly BTC Purchase</option>
        </select>
      </div>
      <div class="form-group">
        <label for="monthlyPurchase">Monthly BTC Purchase (USD)</label>
        <div class="input-row">
          <input type="number" id="monthlyPurchase" min="0" step="any" required>
        </div>
      </div>
      <div class="form-group">
        <label for="monthlyExpenses">Ideal Monthly Retirement Expenses (USD)</label>
        <div class="input-row">
          <input type="number" id="monthlyExpenses" min="0" step="any" required>
        </div>
      </div>
      <div class="form-group">
        <label for="btcGrowth">Expected BTC Annual Growth Rate (%)</label>
        <div class="input-row">
          <input type="number" id="btcGrowth" min="0" step="any" value="10" required>
          <button type="button" class="helper-btn" id="growth5yrBtn">Assume last 5yr</button>
          <button type="button" class="helper-btn" id="growth10yrBtn">Assume last 10yr</button>
        </div>
        <small class="helper-desc">BTC 5yr CAGR ≈ 44%, 10yr CAGR ≈ 70%</small>
      </div>
      <div class="form-group">
        <label for="inflationRate">Expected Inflation Rate (%)</label>
        <input type="number" id="inflationRate" min="0" step="any" value="2" required>
      </div>
      <button type="submit">Calculate</button>
    </form>
    <div id="results" class="results"></div>
    <div class="graph-controls">
      <button type="button" class="scenario-btn" data-scenario="base">Base</button>
      <button type="button" class="scenario-btn" data-scenario="bullish">Bullish</button>
      <button type="button" class="scenario-btn" data-scenario="bearish">Bearish</button>
    </div>
    <div class="graph-section">
      <canvas id="btcChart" width="100%" height="40"></canvas>
    </div>
  `;
  // Prefill with profile data if available
  document.getElementById('monthlyPurchase').value = 0;
  document.getElementById('monthlyExpenses').value = 0;
  document.getElementById('btcGrowth').value = 10;
  document.getElementById('inflationRate').value = 2;
  // Re-attach all event listeners and logic for this form (reuse/refactor existing logic as needed)
  attachRetirementCalculatorLogic();
}

function attachRetirementCalculatorLogic() {
  // (Copy and adapt the logic from the previous btc-form, scenario toggles, helpers, etc.)
  // ...
}

// Render BTC Goal Planner tab
function renderGoalPlannerTab() {
  if (!userProfile) return;
  const el = tabContents.goal;
  el.innerHTML = `
    <form id="goal-form">
      <div class="form-group">
        <label for="goalSolveFor">Solve for</label>
        <select id="goalSolveFor" class="solve-for-select">
          <option value="target">Target Net Worth at Retirement</option>
          <option value="purchase">Monthly BTC Purchase Needed</option>
        </select>
      </div>
      <div class="form-group">
        <label for="goalMonthlyPurchase">Monthly BTC Purchase (USD)</label>
        <input type="number" id="goalMonthlyPurchase" min="0" step="any" required>
      </div>
      <div class="form-group">
        <label for="goalTargetNetWorth">Target Net Worth at Retirement (USD)</label>
        <input type="number" id="goalTargetNetWorth" min="0" step="any" required>
      </div>
      <div class="form-group">
        <label for="goalBtcHoldings">Current BTC Holdings</label>
        <input type="number" id="goalBtcHoldings" min="0" step="any" required>
      </div>
      <div class="form-group">
        <label for="goalBtcPrice">Current BTC Price (USD)</label>
        <div class="input-row">
          <input type="number" id="goalBtcPrice" min="0" step="any" required>
          <button type="button" class="helper-btn" id="goalGetPriceBtn">Get Current Price</button>
        </div>
      </div>
      <div class="form-group">
        <label for="goalBtcGrowth">Expected BTC Annual Growth Rate (%)</label>
        <div class="input-row">
          <input type="number" id="goalBtcGrowth" min="0" step="any" value="10" required>
          <button type="button" class="helper-btn" id="goalGrowth5yrBtn">Assume last 5yr</button>
          <button type="button" class="helper-btn" id="goalGrowth10yrBtn">Assume last 10yr</button>
        </div>
        <small class="helper-desc">BTC 5yr CAGR ≈ 44%, 10yr CAGR ≈ 70%</small>
      </div>
      <button type="submit">Calculate</button>
    </form>
    <div id="goalResults" class="results"></div>
    <div class="graph-section">
      <canvas id="goalChart" width="100%" height="40"></canvas>
    </div>
  `;
  // Prefill with reasonable defaults
  document.getElementById('goalMonthlyPurchase').value = 500;
  document.getElementById('goalTargetNetWorth').value = 1000000;
  document.getElementById('goalBtcHoldings').value = 0;
  document.getElementById('goalBtcPrice').value = 60000;
  document.getElementById('goalBtcGrowth').value = 10;
  // Attach logic
  attachGoalPlannerLogic();
}

function attachGoalPlannerLogic() {
  // Helper: Get current BTC price
  const getPriceBtn = document.getElementById('goalGetPriceBtn');
  if (getPriceBtn) {
    getPriceBtn.addEventListener('click', async function() {
      getPriceBtn.disabled = true;
      getPriceBtn.textContent = 'Loading...';
      try {
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
        const data = await res.json();
        if (data.bitcoin && data.bitcoin.usd) {
          document.getElementById('goalBtcPrice').value = data.bitcoin.usd;
        }
        getPriceBtn.textContent = 'Get Current Price';
      } catch (e) {
        getPriceBtn.textContent = 'Error';
        setTimeout(() => { getPriceBtn.textContent = 'Get Current Price'; }, 2000);
      }
      getPriceBtn.disabled = false;
    });
  }
  // Growth rate helpers
  const growth5yrBtn = document.getElementById('goalGrowth5yrBtn');
  const growth10yrBtn = document.getElementById('goalGrowth10yrBtn');
  if (growth5yrBtn) {
    growth5yrBtn.addEventListener('click', function() {
      document.getElementById('goalBtcGrowth').value = 44;
    });
  }
  if (growth10yrBtn) {
    growth10yrBtn.addEventListener('click', function() {
      document.getElementById('goalBtcGrowth').value = 70;
    });
  }
  // Solve for logic
  const solveForSelect = document.getElementById('goalSolveFor');
  const monthlyPurchaseInput = document.getElementById('goalMonthlyPurchase');
  const targetNetWorthInput = document.getElementById('goalTargetNetWorth');
  function updateSolveForUI() {
    const mode = solveForSelect.value;
    if (mode === 'target') {
      monthlyPurchaseInput.disabled = false;
      targetNetWorthInput.disabled = true;
      targetNetWorthInput.placeholder = 'Solved automatically';
    } else {
      monthlyPurchaseInput.disabled = true;
      targetNetWorthInput.disabled = false;
      monthlyPurchaseInput.placeholder = 'Solved automatically';
    }
  }
  solveForSelect.addEventListener('change', updateSolveForUI);
  updateSolveForUI();
  // Calculation logic
  document.getElementById('goal-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const years = userProfile.retirementAge - userProfile.currentAge;
    const btcHoldings = parseFloat(document.getElementById('goalBtcHoldings').value);
    const btcPrice = parseFloat(document.getElementById('goalBtcPrice').value);
    const btcGrowth = parseFloat(document.getElementById('goalBtcGrowth').value) / 100;
    const solveFor = solveForSelect.value;
    let monthlyPurchase = parseFloat(monthlyPurchaseInput.value);
    let targetNetWorth = parseFloat(targetNetWorthInput.value);
    let solvedValue = null;
    // Project function
    function projectNetWorth(monthlyPurchase) {
      let stack = btcHoldings;
      let price = btcPrice;
      for (let y = 0; y < years; y++) {
        stack += (monthlyPurchase * 12) / price;
        price *= (1 + btcGrowth);
      }
      return stack * price;
    }
    if (solveFor === 'target') {
      // User inputs purchase, solve for max net worth
      solvedValue = projectNetWorth(monthlyPurchase);
      targetNetWorthInput.value = solvedValue.toFixed(2);
    } else {
      // User inputs target, solve for min purchase
      // Binary search
      let low = 0, high = 1e5, best = 0;
      for (let i = 0; i < 30; i++) {
        let mid = (low + high) / 2;
        let netWorth = projectNetWorth(mid);
        if (netWorth >= targetNetWorth) {
          best = mid;
          high = mid;
        } else {
          low = mid;
        }
      }
      solvedValue = best;
      monthlyPurchaseInput.value = solvedValue.toFixed(2);
    }
    // Results
    const resultsDiv = document.getElementById('goalResults');
    let solvedLabel = solveFor === 'target' ? 'Projected net worth at retirement' : 'Required monthly BTC purchase';
    resultsDiv.innerHTML = `
      <strong>${solvedLabel}: <span style="color:#ff9900;">$${solvedValue.toLocaleString(undefined, {maximumFractionDigits: 2})}</span></strong><br>
      <ul>
        <li>Years to retirement: <b>${years}</b></li>
        <li>BTC price at retirement: <b>$${(btcPrice * Math.pow(1 + btcGrowth, years)).toLocaleString(undefined, {maximumFractionDigits: 0})}</b></li>
      </ul>
    `;
    // Chart
    let stack = btcHoldings;
    let price = btcPrice;
    let stackArr = [];
    let valueArr = [];
    let yearLabels = [];
    for (let y = 0; y < years; y++) {
      stack += (monthlyPurchaseInput.disabled ? solvedValue : monthlyPurchase) * 12 / price;
      price *= (1 + btcGrowth);
      stackArr.push(stack);
      valueArr.push(stack * price);
      yearLabels.push(userProfile.currentAge + y + 1);
    }
    const ctx = document.getElementById('goalChart').getContext('2d');
    if (window.goalChartObj) window.goalChartObj.destroy();
    window.goalChartObj = new Chart(ctx, {
      type: 'line',
      data: {
        labels: yearLabels,
        datasets: [
          {
            label: 'Projected Net Worth (USD)',
            data: valueArr,
            borderColor: chartColors.base,
            backgroundColor: chartColors.base + '22',
            pointRadius: 2,
            fill: true,
            tension: 0.25,
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            labels: { color: chartColors.text }
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: function(context) {
                return context.dataset.label + ': $' + Number(context.parsed.y).toLocaleString(undefined, {maximumFractionDigits: 0});
              }
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: 'Year', color: chartColors.text },
            ticks: { color: chartColors.text },
            grid: { color: chartColors.grid }
          },
          y: {
            title: { display: true, text: 'USD', color: chartColors.text },
            ticks: { color: chartColors.text },
            grid: { color: chartColors.grid }
          }
        }
      }
    });
  });
}

// Render Withdrawal Strategy Simulator tab
function renderWithdrawalTab() {
  if (!userProfile) return;
  const el = tabContents.withdrawal;
  el.innerHTML = `
    <form id="withdrawal-form">
      <div class="form-group">
        <label for="withdrawalBtcHoldings">Initial BTC Stack</label>
        <input type="number" id="withdrawalBtcHoldings" min="0" step="any" required>
      </div>
      <div class="form-group">
        <label for="withdrawalBtcPrice">Current BTC Price (USD)</label>
        <div class="input-row">
          <input type="number" id="withdrawalBtcPrice" min="0" step="any" required>
          <button type="button" class="helper-btn" id="withdrawalGetPriceBtn">Get Current Price</button>
        </div>
      </div>
      <div class="form-group">
        <label for="withdrawalBtcGrowth">Expected BTC Annual Growth Rate (%)</label>
        <div class="input-row">
          <input type="number" id="withdrawalBtcGrowth" min="0" step="any" value="10" required>
          <button type="button" class="helper-btn" id="withdrawalGrowth5yrBtn">Assume last 5yr</button>
          <button type="button" class="helper-btn" id="withdrawalGrowth10yrBtn">Assume last 10yr</button>
        </div>
        <small class="helper-desc">BTC 5yr CAGR ≈ 44%, 10yr CAGR ≈ 70%</small>
      </div>
      <div class="form-group">
        <label for="withdrawalAnnual">Annual Withdrawal (USD)</label>
        <input type="number" id="withdrawalAnnual" min="0" step="any" required>
      </div>
      <button type="submit">Simulate</button>
    </form>
    <div id="withdrawalResults" class="results"></div>
    <div class="graph-section">
      <canvas id="withdrawalChart" width="100%" height="40"></canvas>
    </div>
  `;
  // Prefill with reasonable defaults
  document.getElementById('withdrawalBtcHoldings').value = 2;
  document.getElementById('withdrawalBtcPrice').value = 60000;
  document.getElementById('withdrawalBtcGrowth').value = 10;
  document.getElementById('withdrawalAnnual').value = 40000;
  // Attach logic
  attachWithdrawalLogic();
}

function attachWithdrawalLogic() {
  // Helper: Get current BTC price
  const getPriceBtn = document.getElementById('withdrawalGetPriceBtn');
  if (getPriceBtn) {
    getPriceBtn.addEventListener('click', async function() {
      getPriceBtn.disabled = true;
      getPriceBtn.textContent = 'Loading...';
      try {
        const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
        const data = await res.json();
        if (data.bitcoin && data.bitcoin.usd) {
          document.getElementById('withdrawalBtcPrice').value = data.bitcoin.usd;
        }
        getPriceBtn.textContent = 'Get Current Price';
      } catch (e) {
        getPriceBtn.textContent = 'Error';
        setTimeout(() => { getPriceBtn.textContent = 'Get Current Price'; }, 2000);
      }
      getPriceBtn.disabled = false;
    });
  }
  // Growth rate helpers
  const growth5yrBtn = document.getElementById('withdrawalGrowth5yrBtn');
  const growth10yrBtn = document.getElementById('withdrawalGrowth10yrBtn');
  if (growth5yrBtn) {
    growth5yrBtn.addEventListener('click', function() {
      document.getElementById('withdrawalBtcGrowth').value = 44;
    });
  }
  if (growth10yrBtn) {
    growth10yrBtn.addEventListener('click', function() {
      document.getElementById('withdrawalBtcGrowth').value = 70;
    });
  }
  // Simulation logic
  document.getElementById('withdrawal-form').addEventListener('submit', function(e) {
    e.preventDefault();
    const years = Math.max(1, userProfile.retirementAge - userProfile.currentAge);
    let btcStack = parseFloat(document.getElementById('withdrawalBtcHoldings').value);
    let btcPrice = parseFloat(document.getElementById('withdrawalBtcPrice').value);
    const btcGrowth = parseFloat(document.getElementById('withdrawalBtcGrowth').value) / 100;
    const annualWithdrawal = parseFloat(document.getElementById('withdrawalAnnual').value);
    let btcStackArr = [];
    let valueArr = [];
    let yearLabels = [];
    let depletedYear = null;
    for (let y = 0; y < years; y++) {
      // Withdraw for the year
      const btcNeeded = annualWithdrawal / btcPrice;
      btcStack -= btcNeeded;
      if (btcStack < 0 && !depletedYear) {
        btcStack = 0;
        depletedYear = y + 1;
      }
      btcStackArr.push(btcStack);
      valueArr.push(btcStack * btcPrice);
      yearLabels.push(userProfile.currentAge + y + 1);
      btcPrice *= (1 + btcGrowth);
      if (btcStack <= 0) break;
    }
    // Results
    const resultsDiv = document.getElementById('withdrawalResults');
    if (depletedYear) {
      resultsDiv.innerHTML = `<b style='color:#ff4d4d;'>Portfolio depleted after ${depletedYear} years.</b>`;
    } else {
      resultsDiv.innerHTML = `<b style='color:#00e6b8;'>Portfolio lasts full retirement period (${years} years).</b>`;
    }
    // Chart
    const ctx = document.getElementById('withdrawalChart').getContext('2d');
    if (window.withdrawalChartObj) window.withdrawalChartObj.destroy();
    window.withdrawalChartObj = new Chart(ctx, {
      type: 'line',
      data: {
        labels: yearLabels,
        datasets: [
          {
            label: 'BTC Portfolio Value (USD)',
            data: valueArr,
            borderColor: chartColors.base,
            backgroundColor: chartColors.base + '22',
            pointRadius: 2,
            fill: true,
            tension: 0.25,
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            labels: { color: chartColors.text }
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: function(context) {
                return context.dataset.label + ': $' + Number(context.parsed.y).toLocaleString(undefined, {maximumFractionDigits: 0});
              }
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: 'Year', color: chartColors.text },
            ticks: { color: chartColors.text },
            grid: { color: chartColors.grid }
          },
          y: {
            title: { display: true, text: 'USD', color: chartColors.text },
            ticks: { color: chartColors.text },
            grid: { color: chartColors.grid }
          }
        }
      }
    });
  });
} 