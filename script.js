// BTC Profile Stepper Logic
const btcProfileSteps = [
  { key: 'currentAge', question: 'What is your current age?', type: 'number', min: 18, max: 120 },
  { key: 'retirementAge', question: 'At what age do you want to retire?', type: 'number', min: 30, max: 120 },
  { key: 'btcHoldings', question: 'How much BTC do you currently own?', type: 'number', min: 0, step: 0.0001 },
  { key: 'retirementExpenses', question: 'Desired monthly retirement expenses (USD)?', type: 'number', min: 0, step: 1 }
];
let btcProfileStep = 0;
let btcProfileAnswers = {};

const questionDiv = document.getElementById('btc-profile-question');
const input = document.getElementById('btc-profile-input');
const nextBtn = document.getElementById('btc-profile-next');
const form = document.getElementById('btc-profile-form');
const progressBarInner = document.getElementById('btc-profile-progress-bar-inner');
const stepperSection = document.querySelector('.btc-profile-section');
const completeCard = document.getElementById('btc-profile-complete');
const summaryList = document.querySelector('.btc-profile-summary-list');

function renderBtcProfileStep() {
  const step = btcProfileSteps[btcProfileStep];
  // Progress bar
  const percent = Math.round((btcProfileStep) / btcProfileSteps.length * 100);
  progressBarInner.style.width = percent + '%';
  // Question and input
  questionDiv.textContent = step.question;
  input.type = step.type;
  input.min = step.min;
  input.max = step.max !== undefined ? step.max : '';
  input.step = step.step !== undefined ? step.step : '';
  input.value = btcProfileAnswers[step.key] !== undefined ? btcProfileAnswers[step.key] : '';
  // Change button label on last step
  nextBtn.textContent = (btcProfileStep === btcProfileSteps.length - 1) ? 'Complete' : 'Next';
  nextBtn.disabled = false;
  setTimeout(() => { input.focus(); }, 100);
}
input.oninput = function() {
  nextBtn.disabled = false;
};
nextBtn.onclick = function(e) {
  e.preventDefault();
  form.requestSubmit();
};
form.onsubmit = function(e) {
  e.preventDefault();
  btcProfileAnswers[btcProfileSteps[btcProfileStep].key] = input.value;
  if (btcProfileStep < btcProfileSteps.length - 1) {
    btcProfileStep++;
    renderBtcProfileStep();
  } else {
    // Show complete card
    if (stepperSection) stepperSection.style.display = 'none';
    if (completeCard) completeCard.style.display = '';
    // Populate summary
    if (summaryList) {
      summaryList.innerHTML = '<ul>' + btcProfileSteps.map(s => `<li><b>${s.question}</b> <span style="float:right;">${btcProfileAnswers[s.key]}</span></li>`).join('') + '</ul>';
    }
  }
};
renderBtcProfileStep();

// FAQ Dropdown Logic
(function() {
  const faqQuestions = document.querySelectorAll('.faq-question');
  faqQuestions.forEach(btn => {
    btn.addEventListener('click', function() {
      const item = btn.closest('.faq-item');
      const wasActive = item.classList.contains('active');
      document.querySelectorAll('.faq-item.active').forEach(i => i.classList.remove('active'));
      if (!wasActive) item.classList.add('active');
    });
  });
})();

// Wealth Card Logic
let btcWealthPrice = 30000;
let btcWealthPriceSource = 'CoinGecko';
function fetchBtcPriceAndShowWealthCard() {
  fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd')
    .then(r => r.json())
    .then(data => {
      if (data.bitcoin && data.bitcoin.usd) {
        btcWealthPrice = data.bitcoin.usd;
        btcWealthPriceSource = `CoinGecko ($${btcWealthPrice.toLocaleString()})`;
      } else {
        btcWealthPrice = 30000;
        btcWealthPriceSource = 'CoinGecko (unavailable, using $30,000)';
      }
    })
    .catch(() => {
      btcWealthPrice = 30000;
      btcWealthPriceSource = 'CoinGecko (unavailable, using $30,000)';
    })
    .finally(() => {
      document.getElementById('btc-wealth-price-source').textContent = btcWealthPriceSource;
      showWealthCard();
    });
}
function renderWealthChart() {
  const ctx = document.getElementById('btc-wealth-chart').getContext('2d');
  if (window.btcWealthChart) window.btcWealthChart.destroy();
  // Projection parameters
  const years = 20;
  const btc = Number(btcProfileAnswers.btcHoldings || 0);
  const btcPrice = btcWealthPrice;
  // Read toggle and CAGR values
  const scenarios = [
    {
      key: 'bear',
      label: 'Bear',
      color: '#ff4d4d',
      bg: 'rgba(255,77,77,0.10)',
      checked: document.querySelector('.btc-wealth-scenario-checkbox[data-scenario="bear"]').checked,
      cagr: Number(document.querySelector('.btc-wealth-cagr-input[data-scenario="bear"]').value) / 100
    },
    {
      key: 'base',
      label: 'Base',
      color: '#ff9900',
      bg: 'rgba(255,153,0,0.10)',
      checked: document.querySelector('.btc-wealth-scenario-checkbox[data-scenario="base"]').checked,
      cagr: Number(document.querySelector('.btc-wealth-cagr-input[data-scenario="base"]').value) / 100
    },
    {
      key: 'bull',
      label: 'Bull',
      color: '#00e6b8',
      bg: 'rgba(0,230,184,0.10)',
      checked: document.querySelector('.btc-wealth-scenario-checkbox[data-scenario="bull"]').checked,
      cagr: Number(document.querySelector('.btc-wealth-cagr-input[data-scenario="bull"]').value) / 100
    }
  ];
  const labels = Array.from({length: years}, (_, i) => `Year ${i+1}`);
  function project(cagr) {
    let price = btcPrice;
    const arr = [];
    for (let i = 0; i < years; i++) {
      arr.push(btc * price);
      price *= (1 + cagr);
    }
    return arr;
  }
  const datasets = scenarios.filter(s => s.checked).map(s => ({
    label: `${s.label} Case (${(s.cagr*100).toFixed(1)}% CAGR)`,
    data: project(s.cagr),
    borderColor: s.color,
    backgroundColor: s.bg,
    pointRadius: 2,
    fill: false,
    tension: 0.25,
  }));
  window.btcWealthChart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: false,
      plugins: { legend: { labels: { color: '#ff9900' } } },
      scales: {
        x: { ticks: { color: '#f3f4f6' }, grid: { color: '#2d3347' } },
        y: {
          ticks: { color: '#f3f4f6' }, grid: { color: '#2d3347' },
          title: { display: true, text: 'Portfolio Value (USD)', color: '#ff9900', font: { weight: 'bold' } }
        }
      }
    }
  });
}
// Add event listeners to CAGR inputs and checkboxes to update chart on change
function setupCagrInputListeners() {
  document.querySelectorAll('.btc-wealth-cagr-input').forEach(input => {
    input.addEventListener('input', () => {
      renderWealthChart();
    });
  });
  document.querySelectorAll('.btc-wealth-scenario-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      renderWealthChart();
    });
  });
}
// Call setupCagrInputListeners when showing the wealth card
function showWealthCard() {
  document.getElementById('btc-profile-complete').style.display = 'none';
  document.getElementById('btc-wealth-card').style.display = '';
  document.getElementById('btc-wealth-price-source').textContent = btcWealthPriceSource;
  setupCagrInputListeners();
  // Chart.js chart
  if (!window.Chart) {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
    script.onload = renderWealthChart;
    document.body.appendChild(script);
  } else {
    renderWealthChart();
  }
}
document.querySelectorAll('.btc-profile-next-btn[data-next="wealth"]').forEach(btn => {
  btn.addEventListener('click', fetchBtcPriceAndShowWealthCard);
});
document.getElementById('btc-wealth-back').onclick = function() {
  document.getElementById('btc-wealth-card').style.display = 'none';
  document.getElementById('btc-profile-complete').style.display = '';
}; 