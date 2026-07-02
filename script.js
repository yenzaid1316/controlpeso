/* ═══════════════════════════════════════════
   CONTROLPESO — MOTOR COMPLETO v2.0
   Asesor Financiero Inteligente
═══════════════════════════════════════════ */

'use strict';

// ─────────────────────────────────────────
// ESTADO GLOBAL
// ─────────────────────────────────────────
let STATE = {
  config: {
    name: '',
    currency: 'COP',
    q1Income: 0,
    q2Income: 0,
    fixedExpenses: [],
    budgets: { comida: 0, hormiga: 0, medicinas: 0, emergencia: 0 }
  },
  debts: [],
  expenses: [],
  extras: [],
  metas: [],
  cuotas: [],        // Cuotas de cupos usados
  payments: [],      // Registro de pagos
  moods: [],
  alerts: [],
  achievements: [],
  crisisMode: false,
  racha: 0,
  recordRacha: 0,
  debtHistory: [],   // Historial mensual de deuda
  currentMonth: new Date().getMonth(),
  currentYear: new Date().getFullYear(),
  lastCheck: null,
  apoyoIdx: 0,
};

// ─────────────────────────────────────────
// CONSTANTES
// ─────────────────────────────────────────
const LOGROS_DEF = [
  { id: 'primer_pago', icon: '🥉', label: 'Primer pago', desc: 'Registraste tu primer pago' },
  { id: 'semana1', icon: '🥉', label: '1 semana', desc: 'Primera semana sin atrasos' },
  { id: 'mes1', icon: '🥈', label: '1 mes limpio', desc: '30 días sin atrasos' },
  { id: 'meses3', icon: '🥈', label: '3 meses', desc: '3 meses consecutivos sin atrasos' },
  { id: 'deuda_5k', icon: '🥈', label: '$5K pagados', desc: 'Pagaste $5,000 en total' },
  { id: 'hormiga_ok', icon: '🌿', label: 'Anti-hormiga', desc: 'Semana dentro del presupuesto hormiga' },
  { id: 'meta1', icon: '🎯', label: 'Meta 1', desc: 'Completaste tu primera meta' },
  { id: 'mitad', icon: '🥇', label: 'A la mitad', desc: 'Pagaste el 50% de tu deuda total' },
  { id: 'deuda_0', icon: '👑', label: '¡Libre!', desc: 'Eliminaste toda tu deuda' },
];

const APOYO_MSGS = [
  "Muchas personas están exactamente donde tú estás. Lo importante no es de dónde empiezas, sino la dirección en la que caminas. Hoy estás caminando en la dirección correcta. 💚",
  "Las deudas no definen tu valor como persona. Son una situación temporal que estás atacando con inteligencia. Eso habla muy bien de ti. 🌟",
  "Cada peso que pagas es un ladrillo que construye tu libertad. No lo estás tirando, lo estás invirtiendo en tu paz mental futura. 🏗️",
  "El 80% de personas que comienzan un plan como este, lo logran. Tú ya demostraste que eres de los que actúan. Sigue. 💪",
  "Los momentos difíciles no duran, las personas fuertes sí. En 2 años, mirarás atrás y te sorprenderás de lo que lograste. 🔮",
  "No tienes que ser perfecto, solo consistente. Un pago a tiempo, un gasto menos, un día más. Así se llega. 🎯",
  "Este proceso está cambiando más que tus finanzas, está cambiando tus hábitos de por vida. Eso vale más que cualquier número. 🌱",
  "Cuando salgas de esto, sabrás exactamente cómo no volver. Eso es poder real. 🔑",
];

const CAT_ICONS = { comida: '🍔', medicinas: '💊', hormiga: '🐜', servicios: '💡', transporte: '🚗', otro: '📦' };
const CAT_COLORS = { comida: '#3d91ff', medicinas: '#ff4757', hormiga: '#ffa502', servicios: '#00d68f', transporte: '#9b59b6', otro: '#6b6b8a' };

// ─────────────────────────────────────────
// PERSISTENCIA
// ─────────────────────────────────────────
function saveData() {
  try { localStorage.setItem('cp_state', JSON.stringify(STATE)); } catch(e) { console.error('Save error:', e); }
}
function loadData() {
  try {
    const raw = localStorage.getItem('cp_state');
    if (raw) { const d = JSON.parse(raw); STATE = { ...STATE, ...d }; }
  } catch(e) { console.error('Load error:', e); }
}

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────
function fmt(n) {
  if (!n && n !== 0) return '$0';
  const cur = STATE.config.currency === 'COP' ? '' : STATE.config.currency + ' ';
  return cur + '$' + Math.round(n).toLocaleString('es-CO');
}
function fmtShort(n) {
  if (n >= 1000000) return '$' + (n/1000000).toFixed(1) + 'M';
  if (n >= 1000) return '$' + (n/1000).toFixed(0) + 'K';
  return fmt(n);
}
function today() { return new Date().toISOString().split('T')[0]; }
function todayDate() { return new Date(); }
function daysUntil(dateStr) {
  if (!dateStr) return 999;
  const d = new Date(dateStr + 'T00:00:00');
  const now = new Date(); now.setHours(0,0,0,0);
  return Math.round((d - now) / (1000 * 60 * 60 * 24));
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function getCurrentQuincena() {
  const d = new Date().getDate();
  return d <= 15 ? 1 : 2;
}
function getMonthlyIncome() { return (STATE.config.q1Income || 0) + (STATE.config.q2Income || 0); }
function getQuincenaIncome() { return getCurrentQuincena() === 1 ? (STATE.config.q1Income || 0) : (STATE.config.q2Income || 0); }
function getTotalFixed() { return (STATE.config.fixedExpenses || []).reduce((a, b) => a + (b.monto || 0), 0); }
function getTotalDebt() { return (STATE.debts || []).reduce((a, d) => a + (d.saldo || 0), 0); }
function getTotalCupo() { return (STATE.debts || []).reduce((a, d) => a + (d.cupo || 0), 0); }
function getInitialDebt() {
  if (!STATE.debtHistory || STATE.debtHistory.length === 0) return getTotalDebt();
  return STATE.debtHistory[0].total || getTotalDebt();
}
function getMonthExpenses(cat) {
  const now = new Date();
  return (STATE.expenses || []).filter(e => {
    const d = new Date(e.fecha);
    const matchMonth = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    return matchMonth && (!cat || e.categoria === cat);
  }).reduce((a, e) => a + (e.monto || 0), 0);
}
function getWeekExpenses(cat) {
  const now = new Date(); const weekAgo = new Date(); weekAgo.setDate(now.getDate() - 7);
  return (STATE.expenses || []).filter(e => {
    const d = new Date(e.fecha); return d >= weekAgo && (!cat || e.categoria === cat);
  }).reduce((a, e) => a + (e.monto || 0), 0);
}
function getPendingCuotasThisQuincena() {
  const now = todayDate();
  const end = new Date(); end.setDate(getCurrentQuincena() === 1 ? 15 : 31);
  return (STATE.cuotas || []).reduce((total, cuota) => {
    const pending = (cuota.schedule || []).filter(s => !s.paid && new Date(s.date) <= end);
    return total + pending.reduce((a, s) => a + s.monto, 0);
  }, 0);
}
function getQuincenaExtras() {
  const now = new Date();
  const [start, end] = getCurrentQuincena() === 1
    ? [new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth(), 15)]
    : [new Date(now.getFullYear(), now.getMonth(), 16), new Date(now.getFullYear(), now.getMonth()+1, 0)];
  return (STATE.extras || []).filter(e => {
    const d = new Date(e.fecha);
    return d >= start && d <= end;
  }).reduce((a, e) => a + (e.monto || 0), 0);
}
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast ' + type;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 3000);
}
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }

// ─────────────────────────────────────────
// MOTOR ASESOR FINANCIERO — CEREBRO
// ─────────────────────────────────────────
function runAdvisor() {
  const income = getMonthlyIncome() + getQuincenaExtras();
  const qIncome = getQuincenaIncome() + getQuincenaExtras();
  const fixed = getTotalFixed();
  const totalDebt = getTotalDebt();
  const minPayments = (STATE.debts || []).reduce((a, d) => a + (d.cuota || 0), 0);
  const budgetComida = STATE.config.budgets?.comida || 0;
  const budgetHormiga = STATE.config.budgets?.hormiga || 0;
  const pendingCuotas = getPendingCuotasThisQuincena();
  const monthSpentComida = getMonthExpenses('comida');
  const monthSpentHormiga = getMonthExpenses('hormiga');

  const disponible = qIncome - (fixed / 2) - pendingCuotas;
  const needed = minPayments + budgetComida / 2 + budgetHormiga / 2;
  const deficit = disponible - needed;

  // Detectar deuda más urgente
  const urgentDebts = (STATE.debts || []).filter(d => daysUntil(d.fechaPago) <= 5 && d.saldo > 0);
  const soonDebts = (STATE.debts || []).filter(d => {
    const days = daysUntil(d.fechaPago);
    return days > 5 && days <= 15 && d.saldo > 0;
  });

  // Ordenar deudas por tasa (mayor primero - avalancha)
  const sorted = [...(STATE.debts || [])].filter(d => d.saldo > 0)
    .sort((a, b) => (b.tasa || 0) - (a.tasa || 0));

  let semaforo = '🟢';
  let msg = '';
  let actions = [];
  let alertas = [];

  // ── MENSAJE PRINCIPAL DEL ASESOR ──
  const userName = STATE.config.name ? `, ${STATE.config.name}` : '';

  if (totalDebt === 0) {
    semaforo = '🟢';
    msg = `🎊 ¡INCREÍBLE${userName}! Estás LIBRE de deudas.\n\nAhora enfócate en construir tu patrimonio. ¡Lo lograste!`;
  } else if (STATE.crisisMode) {
    semaforo = '🔴';
    msg = `🚨 MODO CRISIS ACTIVO\n\nHaz SOLO esto ahora mismo:\n• Paga únicamente los mínimos de deudas\n• Usa fondo de emergencia si tienes\n• No hagas ningún gasto extra\n• Llama a los bancos y pide moratoria`;
  } else if (deficit < -100000) {
    // Déficit GRANDE
    semaforo = '🔴';
    const bestCupoDebt = [...(STATE.debts || [])].filter(d => (d.cupo || 0) > 0).sort((a,b) => (a.tasa||0) - (b.tasa||0))[0];
    if (bestCupoDebt) {
      const cuotasRec = deficit < -300000 ? 3 : 2;
      const montoRec = Math.abs(deficit);
      const cuotaMens = Math.ceil(montoRec / cuotasRec);
      msg = `⚠️ Esta quincena tienes un déficit de ${fmt(Math.abs(deficit))}\n\n💡 MI RECOMENDACIÓN:\nUsa ${fmt(montoRec)} del cupo de ${bestCupoDebt.acreedor} en ${cuotasRec} cuotas de ${fmt(cuotaMens)} c/u.\n\nEsto cubre el déficit sin que dejes de pagar nada importante.\nTu deuda sube ${fmt(montoRec)} pero de forma CONTROLADA.`;
      actions.push({ label: `Usar cupo ${bestCupoDebt.acreedor}`, type: 'cupo', debtId: bestCupoDebt.id, monto: montoRec, cuotas: cuotasRec });
    } else {
      msg = `🚨 Déficit de ${fmt(Math.abs(deficit))} esta quincena y sin cupos disponibles.\n\nAcciones:\n1. Activa MODO CRISIS\n2. Solo paga lo mínimo\n3. Habla con un asesor bancario\n4. Busca ingresos extras urgentes`;
      actions.push({ label: '🆘 Activar Modo Crisis', type: 'crisis' });
    }
    alertas.push({ tipo: 'critical', msg: `Déficit detectado: ${fmt(Math.abs(deficit))}`, blink: true });
  } else if (deficit < 0) {
    // Déficit pequeño
    semaforo = '🟡';
    const bestCupo = [...(STATE.debts || [])].filter(d => (d.cupo || 0) > Math.abs(deficit)).sort((a,b) => (a.tasa||0)-(b.tasa||0))[0];
    if (bestCupo) {
      msg = `⚠️ Te faltan ${fmt(Math.abs(deficit))} esta quincena.\n\n✅ SOLUCIÓN: Usa ${fmt(Math.abs(deficit))} del cupo de ${bestCupo.acreedor} en 2 cuotas de ${fmt(Math.abs(deficit)/2)} c/u.\n\nCubre el faltante sin afectar tus pagos principales.`;
      actions.push({ label: `Cubrir con cupo ${bestCupo.acreedor}`, type: 'cupo', debtId: bestCupo.id, monto: Math.abs(deficit), cuotas: 2 });
    } else {
      msg = `⚠️ Faltante de ${fmt(Math.abs(deficit))}. Sin cupos disponibles. Reduce gastos hormiga o busca un extra pequeño.`;
    }
    alertas.push({ tipo: 'warning', msg: `Faltante de ${fmt(Math.abs(deficit))} esta quincena`, blink: false });
  } else {
    // Situación OK
    const sobrante = deficit;
    const priorityDebt = sorted[0];

    if (urgentDebts.length > 0) {
      semaforo = '🟡';
      const names = urgentDebts.map(d => d.acreedor).join(', ');
      msg = `⏰ URGENTE: ${names} vence${urgentDebts.length > 1 ? 'n' : ''} en los próximos 5 días.\n\nPlan de esta quincena:\n${sorted.slice(0,2).map((d,i) => `${i+1}. Paga ${d.acreedor}: ${fmt(d.cuota)}`).join('\n')}\n${sobrante > 50000 ? `\n✅ Sobrante de ${fmt(sobrante)} → Va a ${priorityDebt?.acreedor || 'emergencias'}` : ''}`;
      urgentDebts.forEach(d => alertas.push({ tipo: 'critical', msg: `🚨 ${d.acreedor} vence en ${daysUntil(d.fechaPago)} día(s)`, blink: true }));
    } else {
      semaforo = '🟢';
      const mesesLibertad = calcFreedomMonths();
      msg = `✅ Todo bajo control${userName}.\n\nEsta quincena:\n${sorted.slice(0,2).map((d,i) => `${i+1}. ${d.acreedor}: paga ${fmt(d.cuota)}`).join('\n')}${budgetComida > 0 ? `\n3. Comida: presupuesto ${fmt(budgetComida/2)}/quincena` : ''}\n${sobrante > 100000 ? `\n💡 Sobrante de ${fmt(sobrante)} → Súmalo a ${priorityDebt?.acreedor || 'emergencias'} para acelerar tu libertad` : ''}\n\n🗺️ A este ritmo: libertad en ${mesesLibertad} meses`;

      if (sobrante > 100000 && priorityDebt) {
        actions.push({ label: `💪 Pago extra a ${priorityDebt.acreedor}`, type: 'extra_payment', debtId: priorityDebt.id });
      }
    }
  }

  // ── ALERTAS ADICIONALES ──
  if (monthSpentHormiga > (STATE.config.budgets?.hormiga || 0) * 0.8) {
    alertas.push({ tipo: 'warning', msg: `🐜 Gastos hormiga al ${Math.round(monthSpentHormiga/(STATE.config.budgets?.hormiga||1)*100)}% del presupuesto` });
  }
  soonDebts.forEach(d => alertas.push({ tipo: 'warning', msg: `⏰ ${d.acreedor} vence en ${daysUntil(d.fechaPago)} días` }));

  // Detectar oportunidad de negociación de tasa
  const highRateDebts = (STATE.debts || []).filter(d => (d.tasa || 0) > 20 && d.saldo > 0);
  if (highRateDebts.length > 0 && !STATE.lastAltSearch) {
    actions.push({ label: '🌐 Buscar mejores tasas', type: 'buscar_alternativas' });
  }

  return { semaforo, msg, actions, alertas, deficit, disponible };
}

function calcFreedomMonths() {
  const totalDebt = getTotalDebt();
  if (totalDebt <= 0) return 0;
  const monthlyPayment = (STATE.debts || []).reduce((a, d) => a + (d.cuota || 0), 0);
  if (monthlyPayment <= 0) return 99;
  const avgRate = (STATE.debts || []).reduce((a, d, _, arr) => a + (d.tasa || 0) / arr.length, 0) / 100 / 12;
  if (avgRate <= 0) return Math.ceil(totalDebt / monthlyPayment);
  const months = Math.ceil(-Math.log(1 - (totalDebt * avgRate) / monthlyPayment) / Math.log(1 + avgRate));
  return isFinite(months) && months > 0 ? months : Math.ceil(totalDebt / monthlyPayment);
}

function calcScore() {
  let score = 100;
  const items = [];
  const debt = getTotalDebt();
  const income = getMonthlyIncome();
  const urgentDebts = (STATE.debts || []).filter(d => daysUntil(d.fechaPago) <= 3);
  const debtRatio = income > 0 ? (debt / income) : 0;
  const hormigaSpent = getMonthExpenses('hormiga');
  const hormigaBudget = STATE.config.budgets?.hormiga || 1;

  if (debtRatio > 12) { score -= 25; items.push({ label: 'Deuda muy alta vs ingreso', pct: 15, bad: true }); }
  else if (debtRatio > 6) { score -= 15; items.push({ label: 'Deuda moderada-alta', pct: 30, bad: true }); }
  else { items.push({ label: 'Deuda controlable', pct: 70, bad: false }); }

  if (urgentDebts.length > 0) { score -= 20; items.push({ label: 'Pagos urgentes pendientes', pct: 5, bad: true }); }
  else { items.push({ label: 'Pagos al día', pct: 90, bad: false }); }

  if (STATE.racha >= 30) { score += 10; items.push({ label: `Racha: ${STATE.racha} días`, pct: 100, bad: false }); }
  else if (STATE.racha >= 7) { score += 5; items.push({ label: `Racha: ${STATE.racha} días`, pct: 60, bad: false }); }

  if (hormigaSpent > hormigaBudget * 1.2) { score -= 10; items.push({ label: 'Gastos hormiga elevados', pct: 20, bad: true }); }
  else if (hormigaBudget > 0) { items.push({ label: 'Hormiga controlada', pct: 80, bad: false }); }

  if (getTotalDebt() < getInitialDebt() * 0.5) { score += 10; items.push({ label: 'Avance excelente', pct: 100, bad: false }); }

  return { score: Math.max(10, Math.min(100, score)), items };
}

// ─────────────────────────────────────────
// INICIALIZACIÓN
// ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadData();

  // Guardar fecha actual en gasto form
  const gastoFecha = document.getElementById('gasto-fecha');
  const extraFecha = document.getElementById('extra-fecha');
  const pagarFecha = document.getElementById('pagar-fecha');
  if (gastoFecha) gastoFecha.value = today();
  if (extraFecha) extraFecha.value = today();
  if (pagarFecha) pagarFecha.value = today();

  // Splash → App
  setTimeout(() => {
    document.getElementById('splash').classList.add('fade-out');
    setTimeout(() => {
      document.getElementById('splash').classList.add('hidden');
      if (!STATE.config.name) {
        openModal('onboarding');
      } else {
        showApp();
      }
    }, 500);
  }, 2000);
});

function showApp() {
  document.getElementById('app').classList.remove('hidden');
  renderGreeting();
  renderDashboard();
  checkAchievements();
  updateNotifBadge();
  checkDailyMood();
  // Snapshot mensual de deuda
  snapshotDebtHistory();
}

function checkDailyMood() {
  const lastMood = (STATE.moods || []).slice(-1)[0];
  const todayStr = today();
  if (!lastMood || lastMood.fecha !== todayStr) {
    setTimeout(() => openModal('modal-mood'), 1500);
  }
}

function snapshotDebtHistory() {
  const total = getTotalDebt();
  if (total <= 0) return;
  const nowKey = new Date().toISOString().slice(0,7);
  const last = (STATE.debtHistory || []).slice(-1)[0];
  if (!last || last.key !== nowKey) {
    if (!STATE.debtHistory) STATE.debtHistory = [];
    STATE.debtHistory.push({ key: nowKey, total, fecha: today() });
    saveData();
  }
}

// ─────────────────────────────────────────
// NAVEGACIÓN
// ─────────────────────────────────────────
function openSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const sec = document.getElementById('sec-' + name);
  if (sec) sec.classList.add('active');
  const btn = document.querySelector(`[data-sec="${name}"]`);
  if (btn) btn.classList.add('active');
  // Render section-specific content
  const renders = {
    dashboard: renderDashboard,
    deudas: renderDeudas,
    gastos: renderGastos,
    calendario: renderCalendario,
    metas: renderMetas,
    progreso: renderProgreso,
    alertas: renderAlertasSection,
    bienestar: renderBienestar,
    alternativas: renderAlternativas,
    crisis: renderCrisis,
    config: renderConfig,
  };
  if (renders[name]) renders[name]();
}

// ─────────────────────────────────────────
// RENDER: DASHBOARD
// ─────────────────────────────────────────
function renderGreeting() {
  const h = new Date().getHours();
  const greet = h < 12 ? 'Buenos días' : h < 18 ? 'Buenas tardes' : 'Buenas noches';
  const name = STATE.config.name ? `, ${STATE.config.name}` : '';
  document.getElementById('greeting-text').textContent = greet + name;
  document.getElementById('greeting-sub').textContent = 'Aquí está tu resumen de hoy 👇';
}

function renderDashboard() {
  renderGreeting();
  const advisor = runAdvisor();
  const totalDebt = getTotalDebt();
  const income = getMonthlyIncome() + getQuincenaExtras();
  const initialDebt = getInitialDebt();
  const freedomMonths = calcFreedomMonths();
  const pct = initialDebt > 0 ? Math.round(((initialDebt - totalDebt) / initialDebt) * 100) : 0;
  const { score } = calcScore();

  // Score pill
  const pill = document.getElementById('health-pill');
  const scoreEl = document.getElementById('health-score');
  if (scoreEl) scoreEl.textContent = score;
  if (pill) pill.style.color = score >= 70 ? 'var(--green)' : score >= 40 ? 'var(--yellow)' : 'var(--red)';

  // Semaforo
  const sem = document.getElementById('semaforo-main');
  if (sem) { sem.textContent = advisor.semaforo; sem.className = 'semaforo' + (advisor.semaforo === '🔴' ? ' blink' : ''); }

  // Asesor msg
  const msgEl = document.getElementById('asesor-msg');
  if (msgEl) msgEl.textContent = advisor.msg;
  const actEl = document.getElementById('asesor-actions');
  if (actEl) {
    actEl.innerHTML = '';
    (advisor.actions || []).forEach(a => {
      const btn = document.createElement('button');
      btn.className = 'btn-micro primary';
      btn.textContent = a.label;
      btn.onclick = () => handleAdvisorAction(a);
      actEl.appendChild(btn);
    });
  }

  // Mini cards
  const el = id => document.getElementById(id);
  if (el('dash-income')) el('dash-income').textContent = fmtShort(income);
  if (el('dash-total-debt')) el('dash-total-debt').textContent = fmtShort(totalDebt);
  if (el('dash-available')) el('dash-available').textContent = fmtShort(advisor.disponible);

  const nextDebt = [...(STATE.debts || [])].filter(d => d.saldo > 0 && d.fechaPago)
    .sort((a, b) => daysUntil(a.fechaPago) - daysUntil(b.fechaPago))[0];
  if (el('dash-next-payment')) {
    if (nextDebt) {
      const days = daysUntil(nextDebt.fechaPago);
      el('dash-next-payment').textContent = days === 0 ? 'HOY 🚨' : days < 0 ? 'VENCIDO 🔴' : `${days}d`;
      el('dash-next-payment').style.color = days <= 3 ? 'var(--red)' : days <= 7 ? 'var(--yellow)' : 'var(--green)';
    } else el('dash-next-payment').textContent = '--';
  }

  // Freedom bar
  if (el('freedom-bar')) el('freedom-bar').style.width = pct + '%';
  if (el('freedom-pct')) el('freedom-pct').textContent = pct + '% pagado';
  if (el('freedom-months')) el('freedom-months').textContent = freedomMonths > 0 ? `${freedomMonths} meses` : '¡Libre!';

  // Alerts
  const alertsEl = el('dash-alerts');
  if (alertsEl) {
    alertsEl.innerHTML = '';
    advisor.alertas.forEach(a => {
      const div = document.createElement('div');
      div.className = `alert-item ${a.tipo}`;
      div.innerHTML = `<span ${a.blink ? 'class="alert-blink"' : ''}>${a.tipo === 'critical' ? '🚨' : a.tipo === 'warning' ? '⚠️' : 'ℹ️'}</span><span>${a.msg}</span>`;
      alertsEl.appendChild(div);
    });
    // Déficit alert
    if (advisor.deficit < 0) {
      const div = document.createElement('div');
      div.className = 'alert-item critical';
      div.innerHTML = `<span class="alert-blink">🔴</span><span>Déficit de ${fmt(Math.abs(advisor.deficit))} — el asesor tiene un plan</span>`;
      alertsEl.appendChild(div);
    }
  }

  // Quincena grid
  renderQuincenaGrid(advisor);
  renderAcciones(advisor);
}

function renderQuincenaGrid(advisor) {
  const grid = document.getElementById('quincena-grid');
  if (!grid) return;
  const qIncome = getQuincenaIncome() + getQuincenaExtras();
  const fixed2 = getTotalFixed() / 2;
  const debtPayments = (STATE.debts || []).reduce((a, d) => a + (d.cuota || 0), 0) / 2;
  const comidaBudget = (STATE.config.budgets?.comida || 0) / 2;
  const hormigaBudget = (STATE.config.budgets?.hormiga || 0) / 2;
  const cuotas = getPendingCuotasThisQuincena();

  const rows = [
    { label: '💵 Ingresos', val: qIncome, color: 'var(--green)', pct: 100 },
    { label: '🏠 Gastos fijos', val: -fixed2, color: 'var(--red)', pct: fixed2 / qIncome * 100 },
    { label: '💳 Deudas (cuota)', val: -debtPayments, color: 'var(--orange)', pct: debtPayments / qIncome * 100 },
  ];
  if (cuotas > 0) rows.push({ label: '📋 Cuotas activas', val: -cuotas, color: 'var(--blue)', pct: cuotas / qIncome * 100 });
  if (comidaBudget > 0) rows.push({ label: '🍔 Comida presup.', val: -comidaBudget, color: 'var(--blue)', pct: comidaBudget / qIncome * 100 });
  if (hormigaBudget > 0) rows.push({ label: '🐜 Hormiga presup.', val: -hormigaBudget, color: 'var(--yellow)', pct: hormigaBudget / qIncome * 100 });

  const total = qIncome - fixed2 - debtPayments - cuotas - comidaBudget - hormigaBudget;
  grid.innerHTML = rows.map(r => `
    <div class="qcard-row">
      <span class="qr-label">${r.label}</span>
      <span class="qr-val" style="color:${r.color}">${fmt(Math.abs(r.val))}</span>
    </div>
    <div class="qcard-bar"><div class="qcard-bar-fill" style="width:${Math.min(100,r.pct||0)}%;background:${r.color}"></div></div>
  `).join('') + `
    <div class="qcard-divider"></div>
    <div class="qcard-row qcard-total">
      <span class="qr-label">💰 Disponible neto</span>
      <span class="qr-val" style="color:${total >= 0 ? 'var(--green)' : 'var(--red)'}">${fmt(total)}</span>
    </div>
  `;
}

function renderAcciones(advisor) {
  const list = document.getElementById('acciones-list');
  if (!list) return;
  const acciones = [];
  const urgentDebts = (STATE.debts || []).filter(d => daysUntil(d.fechaPago) <= 5 && d.saldo > 0);
  urgentDebts.forEach(d => acciones.push({ level: 'urgent', msg: `Paga ${d.acreedor}: ${fmt(d.cuota)} (vence en ${Math.max(0, daysUntil(d.fechaPago))} días)` }));
  if (getMonthExpenses('hormiga') > (STATE.config.budgets?.hormiga || 0) * 0.7) {
    acciones.push({ level: 'warning', msg: `Reduce gastos hormiga — ya usaste el ${Math.round(getMonthExpenses('hormiga')/(STATE.config.budgets?.hormiga||1)*100)}% del presupuesto` });
  }
  const highRate = [...(STATE.debts || [])].filter(d => (d.tasa||0)>20 && d.saldo>0).sort((a,b)=>b.tasa-a.tasa)[0];
  if (highRate) acciones.push({ level: 'warning', msg: `${highRate.acreedor} al ${highRate.tasa}% anual — considera negociar o buscar alternativa` });
  acciones.push({ level: 'ok', msg: 'Registra tus gastos de hoy — 1 minuto mantiene el control' });
  if (advisor.deficit >= 0 && advisor.deficit > 100000) {
    const priority = [...(STATE.debts||[])].filter(d=>d.saldo>0).sort((a,b)=>(b.tasa||0)-(a.tasa||0))[0];
    if (priority) acciones.push({ level: 'ok', msg: `Sobrante disponible → agrega pago extra a ${priority.acreedor}` });
  }

  list.innerHTML = acciones.slice(0,5).map((a, i) => `
    <div class="accion-item ${a.level === 'urgent' ? 'urgent' : a.level === 'warning' ? 'warning' : ''}">
      <span class="ai-num">${i+1}</span>
      <span>${a.msg}</span>
    </div>
  `).join('') || '<div class="empty-msg">Sin acciones pendientes ✅</div>';
}

// ─────────────────────────────────────────
// RENDER: DEUDAS
// ─────────────────────────────────────────
function renderDeudas() {
  const total = getTotalDebt();
  const cupo = getTotalCupo();
  const debts = STATE.debts || [];

  // Summary
  const sumEl = document.getElementById('debt-summary');
  if (sumEl) sumEl.innerHTML = `
    <div class="ds-item main"><div class="ds-val">${fmtShort(total)}</div><div class="ds-label">Deuda Total</div></div>
    <div class="ds-item"><div class="ds-val">${debts.length}</div><div class="ds-label">Deudas</div></div>
    <div class="ds-item cupo"><div class="ds-val">${fmtShort(cupo)}</div><div class="ds-label">Cupo Total</div></div>
  `;

  const urgent = debts.filter(d => daysUntil(d.fechaPago) <= 5 && d.saldo > 0);
  const soon = debts.filter(d => { const x = daysUntil(d.fechaPago); return x > 5 && x <= 15 && d.saldo > 0; });
  const ok = debts.filter(d => daysUntil(d.fechaPago) > 15 || !d.fechaPago);

  renderDebtGroup('list-urgent', urgent, 'urgent');
  renderDebtGroup('list-soon', soon, 'soon');
  renderDebtGroup('list-ok', ok, 'ok');
  renderCuotasActivas();

  document.getElementById('debts-urgent').style.display = urgent.length ? '' : 'none';
  document.getElementById('debts-soon').style.display = soon.length ? '' : 'none';
  document.getElementById('debts-ok').style.display = ok.length ? '' : 'none';
}

function renderDebtGroup(containerId, debts, cls) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!debts.length) { el.innerHTML = '<div class="empty-msg">Ninguna en esta categoría</div>'; return; }
  el.innerHTML = debts.map(d => {
    const days = daysUntil(d.fechaPago);
    const daysLabel = d.fechaPago ? (days < 0 ? '🔴 Vencida' : days === 0 ? '🚨 HOY' : `📅 ${days}d`) : 'Sin fecha';
    const interestMonthly = (d.saldo * (d.tasa || 0) / 100 / 12);
    return `
    <div class="debt-card ${cls}" id="dc-${d.id}">
      <div class="debt-top">
        <div class="debt-name">${d.tipo === 'tarjeta' ? '💳' : d.tipo === 'prestamo' ? '🏦' : d.tipo === 'persona' ? '👤' : '📦'} ${d.acreedor}</div>
        <span class="debt-badge ${cls}">${daysLabel}</span>
      </div>
      <div class="debt-info">
        <span>Saldo:</span><strong>${fmt(d.saldo)}</strong>
        <span>Tasa:</span><strong>${d.tasa || 0}% anual</strong>
        <span>Cuota mín:</span><strong>${fmt(d.cuota)}</strong>
        <span>Interés/mes:</span><strong style="color:var(--red)">${fmt(interestMonthly)}</strong>
        ${d.cupo > 0 ? `<span>Cupo disp:</span><strong style="color:var(--green)">${fmt(d.cupo)}</strong>` : ''}
      </div>
      ${d.notas ? `<div class="de-analysis">📝 ${d.notas}</div>` : ''}
      <div class="debt-actions">
        <button class="btn-micro primary" onclick="openPagarModal('${d.id}')">✅ Pagar</button>
        ${d.cupo > 0 ? `<button class="btn-micro blue" onclick="openCupoModal('${d.id}')">💳 Usar Cupo</button>` : ''}
        <button class="btn-micro" onclick="openDebtModal('${d.id}')">✏️ Editar</button>
        <button class="btn-micro danger" onclick="deleteDebt('${d.id}')">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

function renderCuotasActivas() {
  const el = document.getElementById('cuotas-activas-list');
  if (!el) return;
  const active = (STATE.cuotas || []).filter(c => (c.schedule || []).some(s => !s.paid));
  if (!active.length) { el.innerHTML = '<div class="empty-msg">Sin cuotas activas de cupos usados</div>'; return; }
  el.innerHTML = active.map(c => {
    const debt = (STATE.debts || []).find(d => d.id === c.debtId);
    const pending = (c.schedule || []).filter(s => !s.paid);
    return `
    <div class="cuota-item">
      <div class="cuota-header">
        <span class="cuota-name">💳 ${debt?.acreedor || 'Deuda'} — ${fmt(c.monto)} (${c.destino})</span>
        <span style="font-size:0.75rem;color:var(--text3)">${c.fecha}</span>
      </div>
      <div class="cuota-dates">
        ${(c.schedule || []).map(s => `
          <div class="cuota-date-row ${s.paid ? 'paid' : ''}">
            <span>${s.paid ? '✅' : '⏳'} Cuota ${s.num}: ${s.date}</span>
            <span>${fmt(s.monto)}</span>
          </div>
        `).join('')}
      </div>
      <div style="margin-top:6px">
        ${pending.map(s => `<button class="btn-micro primary" onclick="pagarCuota('${c.id}','${s.num}')">Pagar cuota ${s.num}</button>`).join(' ')}
      </div>
    </div>`;
  }).join('');
}

// ─────────────────────────────────────────
// RENDER: GASTOS
// ─────────────────────────────────────────
function renderGastos() {
  const todayStr = today();
  const todayExp = (STATE.expenses || []).filter(e => e.fecha === todayStr)
    .concat((STATE.extras || []).filter(e => e.fecha === todayStr).map(e => ({ ...e, type: 'ingreso' })));

  const list = document.getElementById('historial-hoy-list');
  if (list) {
    if (!todayExp.length) { list.innerHTML = '<div class="empty-msg">No hay registros hoy</div>'; return; }
    list.innerHTML = todayExp.map(e => `
      <div class="historial-item">
        <div class="hi-left">
          <span class="hi-cat">${e.type === 'ingreso' ? '💵' : CAT_ICONS[e.categoria] || '📦'}</span>
          <div>
            <div>${e.descripcion || e.categoria || 'Extra'}</div>
            <div class="hi-desc">${e.fecha}</div>
          </div>
        </div>
        <span class="hi-amount ${e.type === 'ingreso' ? 'ingreso' : 'gasto'}">${e.type === 'ingreso' ? '+' : '-'}${fmt(e.monto)}</span>
      </div>
    `).join('');
  }

  // Hormiga bar
  const usado = getWeekExpenses('hormiga');
  const presup = (STATE.config.budgets?.hormiga || 0);
  const pct = presup > 0 ? Math.min(100, (usado / presup) * 100) : 0;
  const bar = document.getElementById('horm-bar');
  const usadoEl = document.getElementById('horm-usado');
  const presupEl = document.getElementById('horm-presup');
  const insightEl = document.getElementById('horm-insight');
  if (bar) { bar.style.width = pct + '%'; bar.className = 'horm-bar-fill' + (pct > 100 ? ' over' : ''); }
  if (usadoEl) usadoEl.textContent = fmt(usado) + ' usado';
  if (presupEl) presupEl.textContent = 'de ' + fmt(presup) + '/mes';
  if (insightEl) {
    if (pct > 80) {
      insightEl.textContent = `⚠️ Ya usaste el ${Math.round(pct)}% del presupuesto hormiga. Toma control esta semana.`;
      insightEl.classList.add('show');
    } else if (pct > 50) {
      insightEl.textContent = `💡 Vas al ${Math.round(pct)}%. Si reduces comidas fuera, liberas dinero para deudas.`;
      insightEl.classList.add('show');
    } else { insightEl.classList.remove('show'); }
  }
}

// ─────────────────────────────────────────
// RENDER: CALENDARIO
// ─────────────────────────────────────────
function renderCalendario() {
  const year = STATE.currentYear;
  const month = STATE.currentMonth;
  const label = new Date(year, month, 1).toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });
  const labelEl = document.getElementById('cal-month-label');
  if (labelEl) labelEl.textContent = label.charAt(0).toUpperCase() + label.slice(1);

  const grid = document.getElementById('calendar-grid');
  if (!grid) return;

  const days = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];
  let html = days.map(d => `<div class="cal-day-label">${d}</div>`).join('');

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayD = new Date();

  // Eventos del mes
  const events = getMonthEvents(year, month);

  for (let i = 0; i < firstDay; i++) html += '<div class="cal-day other-month"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const isToday = todayD.getDate()===d && todayD.getMonth()===month && todayD.getFullYear()===year;
    const evs = events.filter(e => e.date === dateStr);
    const hasPayment = evs.some(e => e.type === 'pay');
    const hasIncome = evs.some(e => e.type === 'income');
    html += `<div class="cal-day ${isToday ? 'today' : ''} ${hasPayment ? 'has-event' : ''} ${hasIncome && !hasPayment ? 'has-income' : ''}" onclick="showDayEvents('${dateStr}')">${d}</div>`;
  }
  grid.innerHTML = html;
  renderMonthEvents(events);
}

function getMonthEvents(year, month) {
  const events = [];
  (STATE.debts || []).forEach(d => {
    if (d.fechaPago) {
      const dd = new Date(d.fechaPago + 'T00:00:00');
      if (dd.getMonth() === month && dd.getFullYear() === year) {
        events.push({ date: d.fechaPago, type: 'pay', title: `Pago ${d.acreedor}`, amount: d.cuota, priority: daysUntil(d.fechaPago) <= 5 });
      }
    }
  });
  (STATE.extras || []).forEach(e => {
    const dd = new Date(e.fecha);
    if (dd.getMonth() === month && dd.getFullYear() === year) {
      events.push({ date: e.fecha, type: 'income', title: e.descripcion || 'Ingreso extra', amount: e.monto });
    }
  });
  (STATE.metas || []).forEach(m => {
    if (m.fecha) {
      const dd = new Date(m.fecha);
      if (dd.getMonth() === month && dd.getFullYear() === year) {
        events.push({ date: m.fecha, type: 'meta', title: `Meta: ${m.nombre}`, amount: m.target });
      }
    }
  });
  // Cuotas
  (STATE.cuotas || []).forEach(c => {
    (c.schedule || []).forEach(s => {
      if (!s.paid) {
        const dd = new Date(s.date);
        if (dd.getMonth() === month && dd.getFullYear() === year) {
          const debt = (STATE.debts || []).find(d => d.id === c.debtId);
          events.push({ date: s.date, type: 'pay', title: `Cuota ${debt?.acreedor || ''}: ${s.num}/${c.cuotas}`, amount: s.monto });
        }
      }
    });
  });
  return events.sort((a, b) => a.date.localeCompare(b.date));
}

function renderMonthEvents(events) {
  const el = document.getElementById('cal-events-list');
  if (!el) return;
  if (!events.length) { el.innerHTML = '<div class="empty-msg">Sin eventos este mes</div>'; return; }
  el.innerHTML = events.map(e => `
    <div class="cal-event ${e.type}">
      <div class="cal-event-date">${new Date(e.date + 'T00:00:00').toLocaleDateString('es-CO', { weekday:'long', day:'numeric', month:'long' })}</div>
      <div class="cal-event-title">${e.type === 'pay' ? '💸' : e.type === 'income' ? '💵' : '🎯'} ${e.title}</div>
      ${e.amount ? `<div class="cal-event-amount">${e.type === 'income' ? '+' : '-'}${fmt(e.amount)}</div>` : ''}
    </div>
  `).join('');
}

function showDayEvents(dateStr) {
  const year = new Date(dateStr).getFullYear();
  const month = new Date(dateStr).getMonth();
  const events = getMonthEvents(year, month).filter(e => e.date === dateStr);
  if (!events.length) return;
  const el = document.getElementById('cal-events-list');
  if (el) {
    el.innerHTML = `<div class="dg-label">Eventos del ${dateStr}</div>` + events.map(e => `
      <div class="cal-event ${e.type}">
        <div class="cal-event-title">${e.type === 'pay' ? '💸' : '💵'} ${e.title}</div>
        ${e.amount ? `<div class="cal-event-amount">${e.type==='income'?'+':'-'}${fmt(e.amount)}</div>` : ''}
      </div>
    `).join('');
  }
}

function changeMonth(dir) {
  STATE.currentMonth += dir;
  if (STATE.currentMonth > 11) { STATE.currentMonth = 0; STATE.currentYear++; }
  if (STATE.currentMonth < 0) { STATE.currentMonth = 11; STATE.currentYear--; }
  renderCalendario();
}

// ─────────────────────────────────────────
// RENDER: METAS
// ─────────────────────────────────────────
function renderMetas() {
  const el = document.getElementById('metas-list');
  if (!el) return;
  if (!STATE.metas || !STATE.metas.length) {
    el.innerHTML = '<div class="empty-msg">Sin metas. ¡Agrega una! 🎯</div>';
  } else {
    el.innerHTML = STATE.metas.map(m => {
      const pct = m.target > 0 ? Math.min(100, Math.round((m.actual / m.target) * 100)) : 0;
      const done = pct >= 100;
      const dias = m.fecha ? daysUntil(m.fecha) : null;
      return `
      <div class="meta-card ${done ? 'done' : ''}">
        <div class="meta-top">
          <div class="meta-name">${m.emoji || '🎯'} ${m.nombre}</div>
          ${dias !== null ? `<span class="meta-date" style="color:${dias<0?'var(--red)':dias<7?'var(--yellow)':'var(--text3)'}">${dias<0?'Vencida':dias===0?'Hoy':dias+' días'}</span>` : ''}
        </div>
        <div class="meta-bar-bg"><div class="meta-bar-fill" style="width:${pct}%"></div></div>
        <div class="meta-stats">
          <span>${fmt(m.actual)} de ${fmt(m.target)}</span>
          <span class="meta-pct" style="color:var(--green)">${pct}%</span>
        </div>
        ${done ? '<div style="color:var(--green);text-align:center;margin-top:8px;font-weight:700">🎊 ¡META ALCANZADA!</div>' : ''}
        <div class="meta-actions">
          <button class="btn-micro primary" onclick="updateMetaProgress('${m.id}')">+ Progreso</button>
          <button class="btn-micro" onclick="openMetaModal('${m.id}')">✏️</button>
          <button class="btn-micro danger" onclick="deleteMeta('${m.id}')">🗑️</button>
        </div>
      </div>`;
    }).join('');
  }
  renderTimeline();
}

function renderTimeline() {
  const el = document.getElementById('timeline-list');
  if (!el) return;
  const totalDebt = getTotalDebt();
  if (totalDebt <= 0) { el.innerHTML = '<div style="text-align:center;color:var(--green);padding:20px">🎊 ¡Sin deudas!</div>'; return; }
  const months = calcFreedomMonths();
  const monthly = (STATE.debts || []).reduce((a, d) => a + (d.cuota || 0), 0);
  const now = new Date();

  const milestones = [3, 6, 9, 12, Math.floor(months * 0.5), months];
  const unique = [...new Set(milestones.filter(m => m > 0 && m <= months + 2))].sort((a,b)=>a-b);

  el.innerHTML = `
  <div class="timeline-item">
    <div class="tl-dot current">HOY</div>
    <div class="tl-content">
      <div class="tl-month">Hoy</div>
      <div class="tl-debt">${fmt(totalDebt)} de deuda</div>
      <div class="tl-animo">Comienza el viaje. Ya estás actuando 🚀</div>
    </div>
  </div>
  ` + unique.map(m => {
    const futureDate = new Date(now.getFullYear(), now.getMonth() + m, 1);
    const futureDebt = Math.max(0, totalDebt - (monthly * m));
    const pct = Math.round(((totalDebt - futureDebt) / totalDebt) * 100);
    const isFree = m >= months;
    const label = futureDate.toLocaleDateString('es-CO', { month:'long', year:'numeric' });
    const hitos = [
      m === 3 ? '¡Ya ves progreso!' : '',
      m === 6 ? '6 meses de disciplina 💪' : '',
      pct >= 50 ? '¡Más de la mitad pagada! 🎉' : '',
      isFree ? '🎊 ¡LIBERTAD FINANCIERA!' : '',
    ].filter(Boolean).join(' ');
    return `
    <div class="timeline-item">
      <div class="tl-dot future" style="${isFree?'background:var(--green);border-color:var(--green);color:white':''}">
        ${isFree ? '🎊' : `+${m}m`}
      </div>
      <div class="tl-content" style="${isFree?'border:1px solid rgba(0,214,143,0.3);background:var(--green-soft)':''}">
        <div class="tl-month" style="${isFree?'color:var(--green)':''}">${label.charAt(0).toUpperCase()+label.slice(1)}</div>
        <div class="tl-debt">${isFree ? '¡Deuda: $0!' : fmt(futureDebt) + ' de deuda'}</div>
        <div class="tl-hito">${pct}% pagado${hitos ? ' • ' + hitos : ''}</div>
      </div>
    </div>`;
  }).join('');
}

// ─────────────────────────────────────────
// RENDER: PROGRESO
// ─────────────────────────────────────────
function renderProgreso() {
  renderScoreCard();
  renderDebtChart();
  renderGastosChart();
  renderLogros();
  renderResumenMes();

  const rachaEl = document.getElementById('racha-num');
  const recordEl = document.getElementById('racha-record');
  if (rachaEl) rachaEl.textContent = `${STATE.racha || 0} días`;
  if (recordEl) recordEl.textContent = `Récord: ${STATE.recordRacha || 0}`;
}

function renderScoreCard() {
  const { score, items } = calcScore();
  const ring = document.getElementById('score-ring');
  const numEl = document.getElementById('score-num');
  const breakdown = document.getElementById('score-breakdown');

  if (numEl) { numEl.textContent = score; numEl.style.color = score>=70?'var(--green)':score>=40?'var(--yellow)':'var(--red)'; }

  if (ring) {
    const circumference = 314;
    const offset = circumference - (circumference * score / 100);
    ring.style.strokeDashoffset = offset;
    ring.style.stroke = score>=70?'var(--green)':score>=40?'var(--yellow)':'var(--red)';
  }

  if (breakdown) {
    breakdown.innerHTML = items.slice(0,4).map(item => `
      <div class="sb-item">
        <div>
          <div style="font-size:0.82rem;font-weight:600">${item.label}</div>
          <div class="sb-bar"><div class="sb-fill ${item.bad?'red':''}" style="width:${item.pct}%"></div></div>
        </div>
      </div>
    `).join('');
  }
}

function renderDebtChart() {
  const canvas = document.getElementById('debt-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const history = (STATE.debtHistory || []).slice(-8);
  if (history.length < 2) {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = 'rgba(160,160,192,0.5)';
    ctx.font = '14px DM Sans';
    ctx.textAlign = 'center';
    ctx.fillText('Más datos disponibles en próximos meses', canvas.width/2, canvas.height/2);
    return;
  }
  const W = canvas.width = canvas.offsetWidth; const H = canvas.height = 180;
  ctx.clearRect(0,0,W,H);
  const max = Math.max(...history.map(h=>h.total)) * 1.1;
  const pts = history.map((h,i) => ({ x: 40 + i*(W-60)/(history.length-1), y: 20 + (1 - h.total/max)*(H-40) }));

  // Grid
  ctx.strokeStyle = 'rgba(46,46,74,0.8)'; ctx.lineWidth = 1;
  for (let i=0;i<4;i++) { const y=20+i*(H-40)/3; ctx.beginPath(); ctx.moveTo(30,y); ctx.lineTo(W-10,y); ctx.stroke(); }

  // Gradient fill
  const grad = ctx.createLinearGradient(0,0,0,H);
  grad.addColorStop(0,'rgba(255,71,87,0.25)'); grad.addColorStop(1,'rgba(255,71,87,0)');
  ctx.beginPath(); ctx.moveTo(pts[0].x, H-20);
  pts.forEach(p => ctx.lineTo(p.x,p.y));
  ctx.lineTo(pts[pts.length-1].x, H-20); ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();

  // Line
  ctx.beginPath(); ctx.strokeStyle = 'var(--red)' || '#ff4757'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  pts.forEach((p,i) => i===0 ? ctx.moveTo(p.x,p.y) : ctx.lineTo(p.x,p.y));
  ctx.stroke();

  // Dots
  pts.forEach((p,i) => {
    ctx.beginPath(); ctx.arc(p.x,p.y,4,0,Math.PI*2);
    ctx.fillStyle = '#ff4757'; ctx.fill();
    ctx.fillStyle = 'rgba(160,160,192,0.6)'; ctx.font = '9px DM Sans'; ctx.textAlign = 'center';
    ctx.fillText(fmtShort(history[i].total), p.x, p.y-10);
    if (i%2===0) ctx.fillText(history[i].key?.slice(5)||'', p.x, H-5);
  });
}

function renderGastosChart() {
  const canvas = document.getElementById('gastos-chart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const cats = ['comida','medicinas','hormiga','servicios','transporte','otro'];
  const data = cats.map(c => ({ cat: c, val: getMonthExpenses(c) })).filter(d=>d.val>0);
  if (!data.length) {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle='rgba(160,160,192,0.5)'; ctx.font='14px DM Sans'; ctx.textAlign='center';
    ctx.fillText('Sin gastos registrados este mes', canvas.width/2, canvas.height/2); return;
  }
  const W = canvas.width = canvas.offsetWidth; const H = canvas.height = 180;
  ctx.clearRect(0,0,W,H);
  const total = data.reduce((a,d)=>a+d.val,0);
  const cx=W/2-30, cy=H/2, r=Math.min(cx,cy)*0.85;
  let angle = -Math.PI/2;
  const colors = ['#3d91ff','#ff4757','#ffa502','#00d68f','#9b59b6','#6b6b8a'];

  data.forEach((d,i) => {
    const slice = (d.val/total)*Math.PI*2;
    ctx.beginPath(); ctx.moveTo(cx,cy);
    ctx.arc(cx,cy,r,angle,angle+slice);
    ctx.closePath(); ctx.fillStyle = colors[i%colors.length]; ctx.fill();
    angle += slice;
  });

  // Center
  ctx.beginPath(); ctx.arc(cx,cy,r*0.5,0,Math.PI*2);
  ctx.fillStyle='#161626'; ctx.fill();
  ctx.fillStyle='rgba(234,234,245,0.9)'; ctx.font='bold 11px DM Sans'; ctx.textAlign='center';
  ctx.fillText('Este mes', cx, cy-6);
  ctx.font='10px DM Sans'; ctx.fillStyle='rgba(160,160,192,0.7)';
  ctx.fillText(fmtShort(total), cx, cy+8);

  // Legend
  const lx = W-110, ly = 20;
  data.slice(0,5).forEach((d,i) => {
    ctx.fillStyle=colors[i%colors.length]; ctx.fillRect(lx,ly+i*20,10,10);
    ctx.fillStyle='rgba(160,160,192,0.8)'; ctx.font='9px DM Sans'; ctx.textAlign='left';
    ctx.fillText(`${CAT_ICONS[d.cat]} ${fmtShort(d.val)}`, lx+14, ly+i*20+9);
  });
}

function renderLogros() {
  const el = document.getElementById('logros-grid');
  if (!el) return;
  el.innerHTML = LOGROS_DEF.map(l => {
    const unlocked = (STATE.achievements || []).includes(l.id);
    return `<div class="logro-item ${unlocked?'unlocked':'locked'}" title="${l.desc}">
      <span class="logro-icon">${l.icon}</span>
      <div class="logro-label">${l.label}</div>
    </div>`;
  }).join('');
}

function renderResumenMes() {
  const el = document.getElementById('resumen-mes');
  if (!el) return;
  const income = getMonthlyIncome() + getQuincenaExtras();
  const totalGastos = ['comida','medicinas','hormiga','servicios','transporte','otro'].reduce((a,c)=>a+getMonthExpenses(c),0);
  const debtPaid = (STATE.payments||[]).filter(p=>{const d=new Date(p.fecha);const n=new Date();return d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear();}).reduce((a,p)=>a+p.monto,0);
  const fixed = getTotalFixed();

  el.innerHTML = `
    <div class="rm-title">📊 Resumen de ${new Date().toLocaleDateString('es-CO',{month:'long',year:'numeric'})}</div>
    <div class="rm-row"><span>💵 Ingresos</span><span style="color:var(--green)">${fmt(income)}</span></div>
    <div class="rm-row"><span>🏠 Gastos fijos</span><span style="color:var(--red)">${fmt(fixed)}</span></div>
    <div class="rm-row"><span>💳 Deudas pagadas</span><span style="color:var(--orange)">${fmt(debtPaid)}</span></div>
    <div class="rm-row"><span>🛒 Gastos variables</span><span style="color:var(--yellow)">${fmt(totalGastos)}</span></div>
    <div class="rm-row total"><span>💰 Resultado neto</span><span style="color:${income-fixed-debtPaid-totalGastos>=0?'var(--green)':'var(--red)'}">${fmt(income-fixed-debtPaid-totalGastos)}</span></div>
    <div style="margin-top:12px;font-size:0.82rem;color:var(--text3)">
      El asesor dice: ${income-fixed-debtPaid-totalGastos>=0?'✅ Mes positivo. Aplica el sobrante a tu deuda prioritaria.':'⚠️ Mes con déficit. Revisa dónde se fue el dinero.'}
    </div>
  `;
}

// ─────────────────────────────────────────
// RENDER: ALERTAS SECTION
// ─────────────────────────────────────────
function renderAlertasSection() {
  const el = document.getElementById('alertas-list');
  if (!el) return;
  const all = buildAllAlerts();
  if (!all.length) { el.innerHTML = '<div class="empty-msg">Sin alertas pendientes ✅</div>'; return; }
  el.innerHTML = all.map(a => `
    <div class="alert-item ${a.tipo}" style="margin-bottom:8px">
      <span ${a.blink?'class="alert-blink"':''}>${a.tipo==='critical'?'🚨':a.tipo==='warning'?'⚠️':a.tipo==='success'?'✅':'ℹ️'}</span>
      <div>
        <div>${a.msg}</div>
        <div class="alert-meta">${a.meta||''}</div>
      </div>
    </div>
  `).join('');
  updateNotifBadge(all.filter(a=>a.tipo==='critical').length);
}

function buildAllAlerts() {
  const alerts = [];
  (STATE.debts||[]).forEach(d => {
    const days = daysUntil(d.fechaPago);
    if (d.saldo > 0 && days <= 0) alerts.push({ tipo:'critical', msg:`🚨 ${d.acreedor} VENCIDA — paga ${fmt(d.cuota)} HOY`, meta:`Deuda: ${fmt(d.saldo)}`, blink:true });
    else if (d.saldo > 0 && days <= 3) alerts.push({ tipo:'critical', msg:`${d.acreedor} vence en ${days} día(s)`, meta:`Paga: ${fmt(d.cuota)}`, blink:true });
    else if (d.saldo > 0 && days <= 7) alerts.push({ tipo:'warning', msg:`${d.acreedor} vence en ${days} días`, meta:`Paga: ${fmt(d.cuota)}` });
  });
  const hormiga = getMonthExpenses('hormiga');
  const hormigaB = STATE.config.budgets?.hormiga||0;
  if (hormiga > hormigaB*0.8 && hormigaB>0) alerts.push({ tipo:'warning', msg:`Gastos hormiga al ${Math.round(hormiga/hormigaB*100)}% del presupuesto`, meta:`Gastado: ${fmt(hormiga)} de ${fmt(hormigaB)}` });
  (STATE.cuotas||[]).forEach(c => {
    (c.schedule||[]).filter(s=>!s.paid).forEach(s => {
      const days = daysUntil(s.date);
      const debt = (STATE.debts||[]).find(d=>d.id===c.debtId);
      if (days<=3) alerts.push({ tipo:'warning', msg:`Cuota ${s.num} de ${debt?.acreedor||'deuda'}: ${fmt(s.monto)}`, meta:`Vence en ${days} días` });
    });
  });
  const { deficit } = runAdvisor();
  if (deficit < -50000) alerts.push({ tipo:'warning', msg:`Déficit de ${fmt(Math.abs(deficit))} esta quincena`, meta:'El asesor tiene un plan' });
  if (alerts.length===0) alerts.push({ tipo:'success', msg:'Todo bajo control ✅', meta:'Sin pagos urgentes' });
  return alerts;
}

function updateNotifBadge(count) {
  const critical = count !== undefined ? count : buildAllAlerts().filter(a=>a.tipo==='critical').length;
  const badge = document.getElementById('notif-count');
  if (badge) { badge.textContent = critical; badge.style.display = critical>0?'':'none'; }
}

// ─────────────────────────────────────────
// RENDER: BIENESTAR
// ─────────────────────────────────────────
function renderBienestar() {
  const moodEl = document.getElementById('mood-history');
  if (moodEl) {
    const last14 = (STATE.moods||[]).slice(-14);
    if (!last14.length) { moodEl.innerHTML = '<div class="empty-msg">Sin registros de ánimo</div>'; return; }
    const emojis = ['','😰','😟','😐','😊','🎉'];
    moodEl.innerHTML = last14.map(m => `
      <div class="mood-dot" title="${m.fecha}" style="border-color:${m.val>=4?'var(--green)':m.val>=3?'var(--yellow)':'var(--red)'}">
        ${emojis[m.val]||'😐'}
      </div>
    `).join('');
  }
  const apoyo = document.getElementById('apoyo-msg');
  if (apoyo) apoyo.textContent = APOYO_MSGS[STATE.apoyoIdx % APOYO_MSGS.length];

  const grid = document.getElementById('sc-grid');
  if (grid) {
    grid.innerHTML = `
      <div class="sc-stat"><div class="sc-val">42%</div><div class="sc-label">Con deuda > $10M</div></div>
      <div class="sc-stat"><div class="sc-val">78%</div><div class="sc-label">Logran el plan</div></div>
      <div class="sc-stat"><div class="sc-val">28</div><div class="sc-label">Edad promedio</div></div>
      <div class="sc-stat"><div class="sc-val">20m</div><div class="sc-label">Meses promedio</div></div>
    `;
  }
}

function nextApoyoMsg() {
  STATE.apoyoIdx = ((STATE.apoyoIdx||0) + 1) % APOYO_MSGS.length;
  const apoyo = document.getElementById('apoyo-msg');
  if (apoyo) apoyo.textContent = APOYO_MSGS[STATE.apoyoIdx];
  saveData();
}

// ─────────────────────────────────────────
// RENDER: ALTERNATIVAS
// ─────────────────────────────────────────
function renderAlternativas() {
  const highRateDebts = (STATE.debts||[]).filter(d=>(d.tasa||0)>18 && d.saldo>0).sort((a,b)=>b.tasa-a.tasa);
  const descEl = document.getElementById('alt-perm-desc');
  if (descEl) {
    if (highRateDebts.length>0) {
      descEl.textContent = `Detecté ${highRateDebts.length} deuda(s) con tasas altas: ${highRateDebts.map(d=>`${d.acreedor} al ${d.tasa}%`).join(', ')}. Puedo buscar opciones más baratas en Colombia.`;
    } else {
      descEl.textContent = 'Tus tasas están en rango aceptable, pero puedo buscar si hay mejores opciones disponibles.';
    }
  }
}

async function iniciarBusquedaAlternativas() {
  const card = document.getElementById('alt-permission-card');
  const results = document.getElementById('alt-results');
  if (card) card.classList.add('hidden');
  if (results) {
    results.innerHTML = `<div class="searching-indicator">
      <div class="search-spinner"></div>
      <div>Consultando tasas actuales en Colombia...</div>
      <div style="font-size:0.78rem;color:var(--text3);margin-top:8px">Esto puede tomar unos segundos</div>
    </div>`;
    results.classList.remove('hidden');
  }

  // Usar la API de Claude para obtener información real de alternativas
  try {
    const highRateDebt = (STATE.debts||[]).filter(d=>(d.tasa||0)>0 && d.saldo>0).sort((a,b)=>b.tasa-a.tasa)[0];
    const totalDebt = getTotalDebt();
    const income = getMonthlyIncome();

    const prompt = `Eres un experto financiero colombiano. El usuario tiene:
- Deuda total: ${fmt(totalDebt)}
- Ingreso mensual: ${fmt(income)}
- Deuda más cara: ${highRateDebt?.acreedor || 'N/A'} al ${highRateDebt?.tasa || 0}% anual con saldo ${fmt(highRateDebt?.saldo || 0)}

Lista 4 alternativas reales y actuales para refinanciar o consolidar deuda en Colombia (2024-2025). Para cada una incluye:
1. Nombre del banco/entidad
2. Tipo de producto
3. Tasa aproximada anual (EA)
4. Requisito principal
5. Ahorro estimado vs tasa actual
6. Tiempo de trámite

Sé específico con entidades colombianas reales: Bancolombia, Davivienda, BBVA, Banco de Bogotá, Nequi/Bancolombia, Addi, Rapicredit, cooperativas, etc. 
Responde SOLO en JSON array sin markdown, con campos: banco, tipo, tasa, requisito, ahorro, tramite, recomendado(bool)`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    const text = (data.content||[]).map(c=>c.text||'').join('');
    let options = [];
    try {
      const clean = text.replace(/```json?/g,'').replace(/```/g,'').trim();
      options = JSON.parse(clean);
    } catch(e) { options = []; }

    if (options.length > 0) {
      renderAlternativasResults(options, highRateDebt);
    } else {
      renderAlternativasFallback(highRateDebt);
    }
    STATE.lastAltSearch = today();
    saveData();
  } catch(err) {
    renderAlternativasFallback();
  }
}

function renderAlternativasResults(options, currentDebt) {
  const results = document.getElementById('alt-results');
  if (!results) return;
  const saldo = currentDebt?.saldo || getTotalDebt();
  const tasaActual = currentDebt?.tasa || 24;

  results.innerHTML = `
    <div class="dg-label" style="margin-bottom:12px">✅ Alternativas encontradas en Colombia</div>
    ${options.map(o => {
      const ahorroMensual = saldo * ((tasaActual - o.tasa) / 100) / 12;
      const ahorroAnual = ahorroMensual * 12;
      return `
      <div class="alt-card">
        ${o.recomendado ? '<div class="alt-recommended">⭐ Recomendada por asesor</div>' : ''}
        <div class="alt-bank-name">🏦 ${o.banco}</div>
        <div class="alt-detail">📋 ${o.tipo}</div>
        <div class="alt-detail">📊 Tasa: <strong>${o.tasa}% EA</strong> vs tu ${tasaActual}% actual</div>
        <div class="alt-detail">⏱️ Trámite: ${o.tramite}</div>
        <div class="alt-detail">✅ Requisito: ${o.requisito}</div>
        ${ahorroAnual > 0 ? `<div class="alt-savings">💰 Ahorro estimado: ${fmt(ahorroAnual)}/año</div>` : ''}
        <div class="alt-savings-detail">
          <div class="asd-row"><span>Interés actual (${tasaActual}%)</span><span>${fmt(saldo * tasaActual/100/12)}/mes</span></div>
          <div class="asd-row"><span>Interés nuevo (${o.tasa}%)</span><span>${fmt(saldo * o.tasa/100/12)}/mes</span></div>
          <div class="asd-row highlight"><span>Ahorro mensual</span><span>${fmt(ahorroMensual)}</span></div>
        </div>
        <div class="alt-cta-row">
          <button class="btn-primary sm" onclick="showToast('Ve al sitio web de ${o.banco} o llama a su línea de atención ✅')">Ver más info</button>
          <button class="btn-ghost sm" onclick="aplicarAlternativa('${o.banco}', ${o.tasa}, ${saldo})">Aplicar al plan</button>
        </div>
      </div>`;
    }).join('')}
    <div style="font-size:0.78rem;color:var(--text3);padding:8px;line-height:1.6">
      ⚠️ Tasas son aproximadas. Consulta directamente con cada entidad. El asesor recomienda comparar antes de decidir.
    </div>
  `;
}

function renderAlternativasFallback(currentDebt) {
  const results = document.getElementById('alt-results');
  if (!results) return;
  const tasaActual = currentDebt?.tasa || 24;
  const saldo = currentDebt?.saldo || getTotalDebt();
  const options = [
    { banco: 'Bancolombia', tipo: 'Libranza o Crédito Personal', tasa: 18, tramite: '2-3 días', requisito: 'Extractos 3 meses', recomendado: true },
    { banco: 'Davivienda', tipo: 'Crédito Libre Inversión', tasa: 19, tramite: '1-2 días', requisito: 'Ingresos demostrables', recomendado: false },
    { banco: 'BBVA Colombia', tipo: 'Préstamo Personal', tasa: 20, tramite: '3-5 días', requisito: 'Buen historial crediticio', recomendado: false },
    { banco: 'Cooperativa/Fintech', tipo: 'Crédito Cooperativo', tasa: 14, tramite: '5-7 días', requisito: 'Afiliación cooperativa', recomendado: false },
  ];
  renderAlternativasResults(options, currentDebt);
}

function cancelarBusqueda() {
  const card = document.getElementById('alt-permission-card');
  if (card) card.classList.remove('hidden');
  const results = document.getElementById('alt-results');
  if (results) { results.innerHTML = ''; }
  showToast('Búsqueda cancelada. Puedes hacerla cuando quieras.');
}

function aplicarAlternativa(banco, nuevaTasa, saldo) {
  showToast(`✅ Plan actualizado simulando refinanciación con ${banco} al ${nuevaTasa}%`);
}

// ─────────────────────────────────────────
// RENDER: CRISIS
// ─────────────────────────────────────────
function renderCrisis() {
  const statusEl = document.getElementById('crisis-status');
  const activeEl = document.getElementById('crisis-active');
  if (!statusEl || !activeEl) return;

  if (STATE.crisisMode) {
    statusEl.classList.add('hidden');
    activeEl.classList.remove('hidden');
    const planEl = document.getElementById('crisis-plan');
    if (planEl) {
      const income = getMonthlyIncome();
      const minPayments = (STATE.debts||[]).reduce((a,d)=>a+Math.round(d.cuota*0.6),0);
      planEl.innerHTML = `
        <div class="cp-step"><span>1️⃣</span><span>Paga SOLO los mínimos reducidos: ${fmt(minPayments)}/mes</span></div>
        <div class="cp-step"><span>2️⃣</span><span>Suspende ahorro y metas temporalmente</span></div>
        <div class="cp-step"><span>3️⃣</span><span>Prioriza: comida → medicinas → servicios → deudas mínimas</span></div>
        <div class="cp-step"><span>4️⃣</span><span>Llama a cada banco y pide moratoria (30-90 días, muchos la dan)</span></div>
        <div class="cp-step"><span>5️⃣</span><span>Busca ingresos adicionales urgentes (cualquier monto ayuda)</span></div>
        <div class="cp-step"><span>6️⃣</span><span>No contraigas más deuda nueva salvo emergencia vital</span></div>
        <div style="margin-top:12px;font-size:0.82rem;color:var(--text2);font-style:italic">
          💚 Esto es SUPERVIVENCIA, no fracaso. Cuando mejore tu situación, retomamos el plan completo.
        </div>`;
    }
  } else {
    statusEl.classList.remove('hidden');
    activeEl.classList.add('hidden');
  }
}

// ─────────────────────────────────────────
// RENDER: CONFIGURACIÓN
// ─────────────────────────────────────────
function renderConfig() {
  const s = STATE.config;
  const set = (id, v) => { const el=document.getElementById(id); if(el) el.value=v||''; };
  set('cfg-name', s.name);
  set('cfg-currency', s.currency);
  set('cfg-q1', s.q1Income);
  set('cfg-q2', s.q2Income);
  set('cfg-budget-comida', s.budgets?.comida);
  set('cfg-budget-hormiga', s.budgets?.hormiga);
  set('cfg-budget-medicinas', s.budgets?.medicinas);
  set('cfg-budget-emergencia', s.budgets?.emergencia);

  const fixedEl = document.getElementById('cfg-fixed-list');
  if (fixedEl) {
    if (!(s.fixedExpenses||[]).length) {
      fixedEl.innerHTML = '<div class="empty-msg">Sin gastos fijos</div>';
    } else {
      fixedEl.innerHTML = (s.fixedExpenses||[]).map((f,i) => `
        <div class="cfg-fixed-row">
          <input type="text" class="form-input" value="${f.nombre}" onchange="updateFixed(${i},'nombre',this.value)" placeholder="Nombre" />
          <input type="number" class="form-input" value="${f.monto}" onchange="updateFixed(${i},'monto',+this.value)" placeholder="Monto" />
          <button class="cfg-remove" onclick="removeFixed(${i})">✕</button>
        </div>
      `).join('');
    }
  }
}

// ─────────────────────────────────────────
// ACCIONES DE DATOS — DEUDAS
// ─────────────────────────────────────────
function openDebtModal(id) {
  document.getElementById('debt-modal-title').textContent = id ? '✏️ Editar Deuda' : '💳 Nueva Deuda';
  const fields = ['debt-edit-id','debt-acreedor','debt-tipo','debt-tasa','debt-saldo','debt-cupo','debt-cuota','debt-fecha','debt-notas'];
  fields.forEach(f => { const el=document.getElementById(f); if(el) el.value=''; });
  if (id) {
    const d = (STATE.debts||[]).find(d=>d.id===id);
    if (d) {
      document.getElementById('debt-edit-id').value = d.id;
      document.getElementById('debt-acreedor').value = d.acreedor||'';
      document.getElementById('debt-tipo').value = d.tipo||'tarjeta';
      document.getElementById('debt-tasa').value = d.tasa||'';
      document.getElementById('debt-saldo').value = d.saldo||'';
      document.getElementById('debt-cupo').value = d.cupo||'';
      document.getElementById('debt-cuota').value = d.cuota||'';
      document.getElementById('debt-fecha').value = d.fechaPago||'';
      document.getElementById('debt-notas').value = d.notas||'';
    }
  }
  openModal('modal-deuda');
}

function saveDebt() {
  const get = id => document.getElementById(id)?.value;
  const acreedor = get('debt-acreedor')?.trim();
  if (!acreedor) { showToast('El nombre del acreedor es requerido','error'); return; }
  const saldo = parseFloat(get('debt-saldo')||0);
  if (saldo <= 0) { showToast('Ingresa el saldo de la deuda','error'); return; }

  const editId = get('debt-edit-id');
  const debt = {
    id: editId || uid(),
    acreedor, tipo: get('debt-tipo'),
    tasa: parseFloat(get('debt-tasa')||0),
    saldo, cupo: parseFloat(get('debt-cupo')||0),
    cuota: parseFloat(get('debt-cuota')||0),
    fechaPago: get('debt-fecha'),
    notas: get('debt-notas'),
    createdAt: editId ? undefined : today(),
  };

  if (!STATE.debts) STATE.debts = [];
  if (editId) {
    const idx = STATE.debts.findIndex(d=>d.id===editId);
    if (idx>=0) { const old=STATE.debts[idx]; STATE.debts[idx]={...old,...debt,createdAt:old.createdAt}; }
  } else {
    STATE.debts.push(debt);
    if (!STATE.debtHistory || STATE.debtHistory.length===0) snapshotDebtHistory();
  }

  saveData(); closeModal('modal-deuda'); renderDeudas();
  showToast(`${editId?'Deuda actualizada':'Deuda agregada'} ✅`, 'success');
  checkAchievements();
}

function deleteDebt(id) {
  if (!confirm('¿Eliminar esta deuda?')) return;
  STATE.debts = (STATE.debts||[]).filter(d=>d.id!==id);
  saveData(); renderDeudas(); renderDashboard();
  showToast('Deuda eliminada');
}

function openPagarModal(debtId) {
  const d = (STATE.debts||[]).find(d=>d.id===debtId);
  if (!d) return;
  document.getElementById('pagar-debt-id').value = debtId;
  document.getElementById('pagar-monto').value = d.cuota || '';
  document.getElementById('pagar-fecha').value = today();
  document.getElementById('pagar-info').innerHTML = `
    <strong>${d.acreedor}</strong><br>
    Saldo: ${fmt(d.saldo)}<br>
    Cuota mínima: ${fmt(d.cuota)}<br>
    ${d.tasa > 0 ? `Interés mensual: ${fmt(d.saldo * d.tasa / 100 / 12)}` : ''}
  `;
  openModal('modal-pagar');
}

function confirmarPago() {
  const debtId = document.getElementById('pagar-debt-id').value;
  const monto = parseFloat(document.getElementById('pagar-monto').value||0);
  const fecha = document.getElementById('pagar-fecha').value;
  if (!monto||monto<=0) { showToast('Ingresa el monto pagado','error'); return; }

  const debtIdx = (STATE.debts||[]).findIndex(d=>d.id===debtId);
  if (debtIdx < 0) return;

  STATE.debts[debtIdx].saldo = Math.max(0, STATE.debts[debtIdx].saldo - monto);

  if (!STATE.payments) STATE.payments = [];
  STATE.payments.push({ id: uid(), debtId, monto, fecha, acreedor: STATE.debts[debtIdx].acreedor });

  STATE.racha = (STATE.racha||0) + 1;
  if (STATE.racha > (STATE.recordRacha||0)) STATE.recordRacha = STATE.racha;

  // Update debt history
  snapshotDebtHistory();
  saveData(); closeModal('modal-pagar'); renderDeudas(); renderDashboard();
  showToast(`✅ Pago de ${fmt(monto)} registrado`, 'success');
  checkAchievements();
}

// ─────────────────────────────────────────
// USO DE CUPOS
// ─────────────────────────────────────────
function openCupoModal(debtId) {
  const d = (STATE.debts||[]).find(d=>d.id===debtId);
  if (!d) return;
  document.getElementById('cupo-debt-id').value = debtId;
  document.getElementById('cupo-monto').value = '';
  const asesorMsg = document.getElementById('cupo-asesor-msg');
  if (asesorMsg) asesorMsg.textContent = `El asesor recomienda usar este cupo SOLO cuando sea necesario. Cada uso aumenta tu deuda con ${d.acreedor} al ${d.tasa||0}% anual. Úsalo estratégicamente.`;
  document.getElementById('cupo-preview').textContent = '';
  openModal('modal-cupo');
}

function recalcCupo() {
  const debtId = document.getElementById('cupo-debt-id').value;
  const monto = parseFloat(document.getElementById('cupo-monto').value||0);
  const numCuotas = parseInt(document.getElementById('cupo-cuotas').value||2);
  const d = (STATE.debts||[]).find(d=>d.id===debtId);
  if (!d || !monto) return;
  const cuotaMensual = Math.ceil(monto / numCuotas);
  const interesTotal = monto * (d.tasa||0) / 100 / 12 * numCuotas;
  const preview = document.getElementById('cupo-preview');
  if (preview) {
    preview.innerHTML = `
      <strong>Resumen del plan:</strong><br>
      💳 Monto a usar: ${fmt(monto)}<br>
      📅 ${numCuotas} cuota(s) de ${fmt(cuotaMensual)} c/u (quincenal)<br>
      📈 Interés estimado: ${fmt(interesTotal)}<br>
      💸 Deuda ${d.acreedor} sube: ${fmt(d.saldo)} → ${fmt(d.saldo + monto)}<br>
      ⏱️ Tu libertad se aplaza: ~${(monto/((STATE.debts||[]).reduce((a,dd)=>a+(dd.cuota||0),0)||1)).toFixed(1)} quincenas<br>
      <span style="color:var(--green)">✅ Pero cubre tu necesidad inmediata sin colapsar el plan.</span>
    `;
  }
}

function confirmarUsoCupo() {
  const debtId = document.getElementById('cupo-debt-id').value;
  const monto = parseFloat(document.getElementById('cupo-monto').value||0);
  const numCuotas = parseInt(document.getElementById('cupo-cuotas').value||2);
  const destino = document.getElementById('cupo-destino').value;
  if (!monto||monto<=0) { showToast('Ingresa el monto','error'); return; }

  const debtIdx = (STATE.debts||[]).findIndex(d=>d.id===debtId);
  if (debtIdx<0) return;

  const d = STATE.debts[debtIdx];
  if (d.cupo < monto) { showToast(`Cupo insuficiente. Disponible: ${fmt(d.cupo)}`,'error'); return; }

  STATE.debts[debtIdx].saldo += monto;
  STATE.debts[debtIdx].cupo -= monto;

  const cuotaMonto = Math.ceil(monto / numCuotas);
  const now = new Date();
  const schedule = Array.from({length: numCuotas}, (_, i) => {
    const date = new Date(now);
    date.setDate(date.getDate() + (i+1)*15);
    return { num: i+1, date: date.toISOString().split('T')[0], monto: cuotaMonto, paid: false };
  });

  if (!STATE.cuotas) STATE.cuotas = [];
  STATE.cuotas.push({ id: uid(), debtId, monto, cuotas: numCuotas, destino, fecha: today(), schedule });

  saveData(); closeModal('modal-cupo'); renderDeudas(); renderDashboard();
  showToast(`✅ Cupo registrado: ${fmt(monto)} en ${numCuotas} cuotas`, 'success');
}

function pagarCuota(cuotaId, numCuota) {
  const idx = (STATE.cuotas||[]).findIndex(c=>c.id===cuotaId);
  if (idx<0) return;
  const sIdx = STATE.cuotas[idx].schedule.findIndex(s=>s.num===parseInt(numCuota));
  if (sIdx<0) return;
  STATE.cuotas[idx].schedule[sIdx].paid = true;
  saveData(); renderDeudas(); renderDashboard();
  showToast('✅ Cuota marcada como pagada', 'success');
}

// ─────────────────────────────────────────
// GASTOS Y EXTRAS
// ─────────────────────────────────────────
let selectedCat = 'comida';
function selectCat(btn) {
  document.querySelectorAll('.cat-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  selectedCat = btn.dataset.cat;
}

function registrarGasto() {
  const monto = parseFloat(document.getElementById('gasto-monto').value||0);
  const fecha = document.getElementById('gasto-fecha').value || today();
  const desc = document.getElementById('gasto-desc').value.trim();
  if (!monto||monto<=0) { showToast('Ingresa el monto','error'); return; }
  if (!STATE.expenses) STATE.expenses=[];
  STATE.expenses.push({ id:uid(), categoria:selectedCat, monto, fecha, descripcion:desc });
  document.getElementById('gasto-monto').value='';
  document.getElementById('gasto-desc').value='';
  saveData(); renderGastos(); renderDashboard();
  showToast(`${CAT_ICONS[selectedCat]} Gasto de ${fmt(monto)} registrado`, 'success');
}

function toggleGastoType(type) {
  document.getElementById('form-gasto').classList.toggle('hidden', type!=='gasto');
  document.getElementById('form-ingreso').classList.toggle('hidden', type!=='ingreso');
  document.getElementById('tog-gasto').classList.toggle('active', type==='gasto');
  document.getElementById('tog-ingreso').classList.toggle('active', type==='ingreso');
}

function registrarExtra() {
  const monto = parseFloat(document.getElementById('extra-monto').value||0);
  const fecha = document.getElementById('extra-fecha').value || today();
  const desc = document.getElementById('extra-desc').value.trim();
  const uso = document.getElementById('extra-uso').value;
  if (!monto||monto<=0) { showToast('Ingresa el monto','error'); return; }
  if (!STATE.extras) STATE.extras=[];
  STATE.extras.push({ id:uid(), monto, fecha, descripcion:desc||'Ingreso extra', uso });
  document.getElementById('extra-monto').value='';
  document.getElementById('extra-desc').value='';
  saveData(); renderDashboard(); renderGastos();

  let msg = `💵 ${fmt(monto)} registrado`;
  if (uso==='asesor') {
    const priority = [...(STATE.debts||[])].filter(d=>d.saldo>0).sort((a,b)=>(b.tasa||0)-(a.tasa||0))[0];
    if (priority) msg += ` → El asesor recomienda: Aplícalo a ${priority.acreedor} (${priority.tasa}% anual)`;
  }
  showToast(msg, 'success');
}

// ─────────────────────────────────────────
// METAS
// ─────────────────────────────────────────
function openMetaModal(id) {
  const fields = ['meta-edit-id','meta-nombre','meta-tipo','meta-target','meta-actual','meta-fecha','meta-emoji'];
  fields.forEach(f => { const el=document.getElementById(f); if(el) el.value=''; });
  document.getElementById('meta-emoji').value='🎯';
  if (id) {
    const m = (STATE.metas||[]).find(m=>m.id===id);
    if (m) {
      document.getElementById('meta-edit-id').value=m.id;
      document.getElementById('meta-nombre').value=m.nombre||'';
      document.getElementById('meta-tipo').value=m.tipo||'otro';
      document.getElementById('meta-target').value=m.target||'';
      document.getElementById('meta-actual').value=m.actual||'';
      document.getElementById('meta-fecha').value=m.fecha||'';
      document.getElementById('meta-emoji').value=m.emoji||'🎯';
    }
  }
  openModal('modal-meta');
}

function saveMeta() {
  const get = id => document.getElementById(id)?.value;
  const nombre = get('meta-nombre')?.trim();
  if (!nombre) { showToast('Nombre requerido','error'); return; }
  const editId = get('meta-edit-id');
  const meta = {
    id: editId||uid(), nombre, tipo: get('meta-tipo'),
    target: parseFloat(get('meta-target')||0),
    actual: parseFloat(get('meta-actual')||0),
    fecha: get('meta-fecha'), emoji: get('meta-emoji')||'🎯'
  };
  if (!STATE.metas) STATE.metas=[];
  if (editId) { const i=STATE.metas.findIndex(m=>m.id===editId); if(i>=0) STATE.metas[i]=meta; }
  else STATE.metas.push(meta);
  saveData(); closeModal('modal-meta'); renderMetas();
  showToast('Meta guardada ✅','success');
}

function updateMetaProgress(id) {
  const val = prompt('¿Cuánto llevas de progreso en esta meta? (monto actual)');
  if (val===null) return;
  const n = parseFloat(val);
  if (isNaN(n)) { showToast('Valor inválido','error'); return; }
  const idx = (STATE.metas||[]).findIndex(m=>m.id===id);
  if (idx>=0) { STATE.metas[idx].actual=n; saveData(); renderMetas(); }
  checkAchievements();
}

function deleteMeta(id) {
  if (!confirm('¿Eliminar meta?')) return;
  STATE.metas=(STATE.metas||[]).filter(m=>m.id!==id);
  saveData(); renderMetas();
}

// ─────────────────────────────────────────
// ÁNIMO
// ─────────────────────────────────────────
function toggleMoodModal() { openModal('modal-mood'); }

function registerMood(val) {
  if (!STATE.moods) STATE.moods=[];
  STATE.moods.push({ val, fecha: today(), hora: new Date().toLocaleTimeString('es-CO') });
  closeModal('modal-mood');
  const msgs = {1:'💚 Entiende que esto es temporal. Hoy haz solo lo mínimo.', 2:'💚 Normal sentirte así. Cada pequeño paso cuenta.', 3:'✅ Día normal, sigue el plan.', 4:'🌟 Buen día. Aprovecha para hacer un pago extra.', 5:'🎉 ¡Excelente! Este es el ánimo que construye libertad.'};
  showToast(msgs[val]||'Ánimo registrado ✅','success');
  saveData();
  if (val<=2) setTimeout(()=>openSection('bienestar'), 500);
}

// ─────────────────────────────────────────
// SIMULADOR
// ─────────────────────────────────────────
function runScenario(type) {
  const el = document.getElementById('sim-result');
  if (!el) return;
  el.classList.remove('hidden'); el.classList.add('show');
  const income = getMonthlyIncome();
  const debt = getTotalDebt();
  const months = calcFreedomMonths();
  const monthly = (STATE.debts||[]).reduce((a,d)=>a+(d.cuota||0),0);
  const priority = [...(STATE.debts||[])].filter(d=>d.saldo>0).sort((a,b)=>(b.tasa||0)-(a.tasa||0))[0];

  const scenarios = {
    income_drop: `📉 Si tu ingreso cae 50% (a ${fmt(income*0.5)}):
• Solo paga mínimos de deudas
• Pausa ahorro y metas
• Llama a bancos pidiendo moratoria
• Libertad se aplaza: ${months + 12} meses (antes ${months})
• No es fracaso, es supervivencia

✅ ACCIÓN: Activa Modo Crisis arriba.`,
    expense_hit: `💸 Si tienes un imprevisto de ${fmt(500000)}:
${priority?.cupo >= 500000 ? `• Usa ${fmt(500000)} del cupo de ${priority?.acreedor} en 2 cuotas de ${fmt(250000)}
• Tu deuda sube temporalmente pero de forma controlada
• Libertad se aplaza: +1 mes aproximado` : `• Reduce pagos este mes al mínimo
• Usa fondo de emergencia si tienes
• Recuperas el ritmo el mes siguiente`}

✅ Plan: No te paralices, actúa con el recurso disponible.`,
    bonus: `🎁 Si recibes un bono de ${fmt(1000000)}:
• Aplica ${fmt(700000)} al pago de ${priority?.acreedor || 'la deuda más cara'} (eliminas interés)
• ${fmt(200000)} al fondo de emergencia
• ${fmt(100000)} para ti (celebra el logro 🎉)

✅ Resultado: Libertad en ${Math.max(1, months-3)} meses (antes ${months})
💡 Cada ${fmt(1000000)} extra ≈ 2-3 meses menos de deuda`,
    extra_payment: `⚡ Si haces un pago extra de ${fmt(monthly * 0.5)} este mes:
• Deuda baja ${fmt(monthly * 1.5)} este mes (vs ${fmt(monthly)} normal)
• Interés de próximo mes: ${fmt(debt * (priority?.tasa||15)/100/12 * 0.95)} (ahorras ${fmt(debt * (priority?.tasa||15)/100/12 * 0.05)})
• Libertad: ${Math.max(1, months-1)} meses (antes ${months})

✅ Impacto: 2 horas extra de trabajo = 1 mes menos de deuda`,
  };

  el.innerHTML = `<strong>Resultado del simulador:</strong><br><br>${(scenarios[type]||'Escenario no disponible').replace(/\n/g,'<br>')}`;
}

// ─────────────────────────────────────────
// MODO CRISIS
// ─────────────────────────────────────────
function activateCrisisMode() {
  if (!confirm('¿Activar Modo Crisis? Esto ajustará tu plan al mínimo vital.')) return;
  STATE.crisisMode = true;
  saveData(); renderCrisis(); renderDashboard();
  showToast('🆘 Modo Crisis activado. El plan se ajustó al mínimo.','error');
}

function deactivateCrisisMode() {
  STATE.crisisMode = false;
  saveData(); renderCrisis(); renderDashboard();
  showToast('✅ Modo Crisis desactivado. Retomando plan normal.','success');
}

// ─────────────────────────────────────────
// ASESOR ACTION HANDLER
// ─────────────────────────────────────────
function handleAdvisorAction(action) {
  if (action.type === 'cupo') {
    openCupoModal(action.debtId);
    setTimeout(() => {
      document.getElementById('cupo-monto').value = action.monto;
      document.getElementById('cupo-cuotas').value = action.cuotas;
      recalcCupo();
    }, 200);
  } else if (action.type === 'crisis') {
    openSection('crisis');
  } else if (action.type === 'buscar_alternativas') {
    openSection('alternativas');
  } else if (action.type === 'extra_payment') {
    openPagarModal(action.debtId);
  }
}

// ─────────────────────────────────────────
// CONFIGURACIÓN
// ─────────────────────────────────────────
function saveConfig() {
  if (!STATE.config) STATE.config={};
  STATE.config.name = document.getElementById('cfg-name')?.value?.trim()||'';
  STATE.config.currency = document.getElementById('cfg-currency')?.value||'COP';
  STATE.config.q1Income = parseFloat(document.getElementById('cfg-q1')?.value||0);
  STATE.config.q2Income = parseFloat(document.getElementById('cfg-q2')?.value||0);
  if (!STATE.config.budgets) STATE.config.budgets={};
  STATE.config.budgets.comida = parseFloat(document.getElementById('cfg-budget-comida')?.value||0);
  STATE.config.budgets.hormiga = parseFloat(document.getElementById('cfg-budget-hormiga')?.value||0);
  STATE.config.budgets.medicinas = parseFloat(document.getElementById('cfg-budget-medicinas')?.value||0);
  STATE.config.budgets.emergencia = parseFloat(document.getElementById('cfg-budget-emergencia')?.value||0);
  saveData(); renderDashboard();
  showToast('✅ Configuración guardada','success');
}

function addCfgFixed() {
  if (!STATE.config.fixedExpenses) STATE.config.fixedExpenses=[];
  STATE.config.fixedExpenses.push({ nombre:'', monto:0 });
  renderConfig();
}
function updateFixed(idx, field, val) {
  if (STATE.config.fixedExpenses?.[idx]) STATE.config.fixedExpenses[idx][field]=val;
  saveData();
}
function removeFixed(idx) {
  STATE.config.fixedExpenses = (STATE.config.fixedExpenses||[]).filter((_,i)=>i!==idx);
  renderConfig(); saveData();
}

// ─────────────────────────────────────────
// ONBOARDING
// ─────────────────────────────────────────
let obStep = 1;
function nextStep(step) {
  document.querySelector(`.onboarding-step[data-step="${obStep}"]`)?.classList.remove('active');
  document.querySelector(`.ob-dot[data-s="${obStep}"]`)?.classList.remove('active');
  // Save step data
  if (obStep===2) { STATE.config.name = document.getElementById('ob-name')?.value?.trim()||''; }
  if (obStep===3) {
    STATE.config.q1Income = parseFloat(document.getElementById('ob-q1')?.value||0);
    STATE.config.q2Income = parseFloat(document.getElementById('ob-q2')?.value||0);
  }
  if (obStep===4) {
    const names = document.querySelectorAll('.ob-fx-name');
    const vals = document.querySelectorAll('.ob-fx-val');
    STATE.config.fixedExpenses = [...names].map((n,i)=>({ nombre:n.value, monto:parseFloat(vals[i]?.value||0) })).filter(f=>f.nombre);
  }
  obStep = step;
  document.querySelector(`.onboarding-step[data-step="${step}"]`)?.classList.add('active');
  document.querySelector(`.ob-dot[data-s="${step}"]`)?.classList.add('active');
}

function addFixedRow() {
  const list = document.getElementById('ob-fixed-list');
  if (!list) return;
  const div = document.createElement('div'); div.className = 'ob-fixed-row';
  div.innerHTML = `<input type="text" class="form-input ob-fx-name" placeholder="Ej: Servicios" /><input type="number" class="form-input ob-fx-val" placeholder="Monto" />`;
  list.appendChild(div);
}

function finishOnboarding() {
  if (!STATE.config.budgets) STATE.config.budgets = { comida: STATE.config.q1Income*0.1, hormiga: STATE.config.q1Income*0.05, medicinas: 50000, emergencia: 50000 };
  saveData(); closeModal('onboarding'); showApp();
}

// ─────────────────────────────────────────
// LOGROS / ACHIEVEMENTS
// ─────────────────────────────────────────
function checkAchievements() {
  if (!STATE.achievements) STATE.achievements = [];
  const totalPaid = (STATE.payments||[]).reduce((a,p)=>a+p.monto,0);
  const initialDebt = getInitialDebt();
  const checks = [
    { id:'primer_pago', cond: (STATE.payments||[]).length>=1 },
    { id:'semana1', cond: (STATE.racha||0)>=7 },
    { id:'mes1', cond: (STATE.racha||0)>=30 },
    { id:'meses3', cond: (STATE.racha||0)>=90 },
    { id:'deuda_5k', cond: totalPaid>=5000000 },
    { id:'hormiga_ok', cond: getWeekExpenses('hormiga')<=(STATE.config.budgets?.hormiga||0) && (STATE.config.budgets?.hormiga||0)>0 },
    { id:'meta1', cond: (STATE.metas||[]).some(m=>m.actual>=m.target&&m.target>0) },
    { id:'mitad', cond: initialDebt>0 && getTotalDebt()<=initialDebt*0.5 },
    { id:'deuda_0', cond: getTotalDebt()===0 },
  ];
  checks.forEach(c => {
    if (c.cond && !STATE.achievements.includes(c.id)) {
      STATE.achievements.push(c.id);
      const def = LOGROS_DEF.find(l=>l.id===c.id);
      if (def) setTimeout(()=>showAchievement(def), 500);
    }
  });
  saveData();
}

function showAchievement(def) {
  document.getElementById('logro-name').textContent = def.label;
  document.getElementById('logro-desc').textContent = def.desc;
  openModal('modal-logro');
}

// ─────────────────────────────────────────
// EXPORTAR / IMPORTAR
// ─────────────────────────────────────────
function exportData() {
  const json = JSON.stringify(STATE, null, 2);
  const blob = new Blob([json], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url;
  a.download=`controlpeso_backup_${today()}.json`; a.click();
  URL.revokeObjectURL(url);
  showToast('📥 Datos exportados','success');
}

function importData() {
  const input = document.createElement('input'); input.type='file'; input.accept='.json';
  input.onchange = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        STATE = {...STATE,...data};
        saveData(); location.reload();
      } catch { showToast('Error importando datos','error'); }
    };
    reader.readAsText(file);
  };
  input.click();
}

function resetApp() {
  if (!confirm('¿Resetear TODA la app? Esto eliminará todos tus datos permanentemente.')) return;
  if (!confirm('⚠️ ¿ESTÁS SEGURO? No hay vuelta atrás.')) return;
  localStorage.removeItem('cp_state'); location.reload();
}

// ─────────────────────────────────────────
// UTILIDADES ADICIONALES
// ─────────────────────────────────────────
function handleAdvisorAction(action) {
  if (action.type==='cupo') {
    openSection('deudas');
    setTimeout(()=>openCupoModal(action.debtId), 300);
  } else if (action.type==='crisis') {
    openSection('crisis');
  } else if (action.type==='buscar_alternativas') {
    openSection('alternativas');
  } else if (action.type==='extra_payment') {
    openSection('deudas');
    setTimeout(()=>openPagarModal(action.debtId), 300);
  }
}

// Actualizar asesor cada 30 segundos si la app está activa
setInterval(() => {
  if (!document.getElementById('sec-dashboard')?.classList.contains('active')) return;
  updateNotifBadge();
}, 30000);

console.log('💰 ControlPeso v2.0 — Motor financiero listo');

// ═══════════════════════════════════════════
// 7 MEJORAS - FUNCIONES AUXILIARES
// ═══════════════════════════════════════════

function openCupoModal() {
  const select = document.getElementById('cupo-tarjeta-sel');
  select.innerHTML = '<option value="">-- Selecciona --</option>';
  (STATE.debts || []).forEach(d => {
    select.innerHTML += `<option value="${d.id}">${d.acreedor}</option>`;
  });
  openModal('modal-cupo');
}

function registrarUsoCupo() {
  const tarjetaId = document.getElementById('cupo-tarjeta-sel').value;
  const monto = parseFloat(document.getElementById('cupo-monto-val').value) || 0;
  const cuotas = parseInt(document.getElementById('cupo-cuotas-sel').value) || 1;
  
  if (!tarjetaId || !monto) { showToast('❌ Completa los campos'); return; }
  
  const tarjeta = STATE.debts.find(d => d.id === tarjetaId);
  if (!tarjeta) { showToast('❌ Tarjeta no encontrada'); return; }
  
  const cupoDisp = (tarjeta.cupo || 0) - (tarjeta.saldo || 0);
  if (monto > cupoDisp) { showToast('❌ No tienes cupo disponible'); return; }
  
  tarjeta.saldo = (tarjeta.saldo || 0) + monto;
  
  const tasaMensual = (tarjeta.tasa || 0) / 100 / 12;
  const cuotaMensual = (monto / cuotas) * (1 + tasaMensual * cuotas);
  
  for (let i = 1; i <= cuotas; i++) {
    const fechaPago = new Date();
    fechaPago.setMonth(fechaPago.getMonth() + i);
    STATE.cuotas.push({
      id: uid(),
      tarjetaId: tarjetaId,
      monto: cuotaMensual,
      numero: i,
      total: cuotas,
      fecha: fechaPago.toISOString().split('T')[0],
      pagada: false
    });
  }
  
  saveState();
  closeModal('modal-cupo');
  updateCupoDisplay();
  showToast('✅ Uso de cupo registrado');
}

function updateCupoDisplay() {
  const container = document.getElementById('tarjetas-cupo-container');
  if (!container) return;
  
  let html = '';
  (STATE.debts || []).forEach(d => {
    const cupoDisp = (d.cupo || 0) - (d.saldo || 0);
    const pct = d.cupo > 0 ? ((d.saldo / d.cupo) * 100).toFixed(0) : 0;
    
    html += `<div class="cupo-card"><div class="cupo-header"><div class="cupo-nombre">${d.acreedor}</div><div class="cupo-disponible">${fmt(cupoDisp)}</div></div><div class="cupo-bar"><div class="cupo-fill" style="width:${pct}%"></div></div><div class="cupo-info">Usado: ${pct}% | Disponible: ${fmt(cupoDisp)} de ${fmt(d.cupo || 0)}</div></div>`;
  });
  
  container.innerHTML = html || '<p style="color:#a0a0c0;">Sin tarjetas</p>';
}

function updateGastosGrafico() {
  const ctx = document.getElementById('gastos-chart');
  if (!ctx || !window.Chart) return;
  
  const ahora = new Date();
  const gastosPorCat = {};
  
  (STATE.expenses || []).forEach(e => {
    const fecha = new Date(e.fecha);
    if (fecha.getMonth() === ahora.getMonth() && fecha.getFullYear() === ahora.getFullYear()) {
      const cat = e.categoria || 'otro';
      gastosPorCat[cat] = (gastosPorCat[cat] || 0) + e.monto;
    }
  });
  
  const labels = Object.keys(gastosPorCat);
  const data = Object.values(gastosPorCat);
  const colors = ['#3d91ff', '#ff4757', '#ffa502', '#00d68f', '#9b59b6', '#6b6b8a'];
  
  if (window.chartGastos) window.chartGastos.destroy();
  window.chartGastos = new Chart(ctx, {
    type: 'doughnut',
    data: { labels: labels, datasets: [{ data: data, backgroundColor: colors.slice(0, labels.length), borderColor: '#0f0f1a', borderWidth: 2 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#eaeaf5' } } } }
  });
}

function updateComparativaGrafico() {
  const ctx = document.getElementById('comparativa-chart');
  if (!ctx || !window.Chart) return;
  
  const ahora = new Date();
  const meses = [];
  const gastos = [];
  
  for (let i = 5; i >= 0; i--) {
    const fecha = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
    const mes = fecha.getMonth();
    const año = fecha.getFullYear();
    
    const total = (STATE.expenses || []).filter(e => {
      const d = new Date(e.fecha);
      return d.getMonth() === mes && d.getFullYear() === año;
    }).reduce((a, e) => a + e.monto, 0);
    
    meses.push(fecha.toLocaleDateString('es-CO', { month: 'short' }));
    gastos.push(total);
  }
  
  if (window.chartComparativa) window.chartComparativa.destroy();
  window.chartComparativa = new Chart(ctx, {
    type: 'line',
    data: { labels: meses, datasets: [{ label: 'Gasto mensual', data: gastos, borderColor: '#00d68f', backgroundColor: 'rgba(0, 214, 143, 0.1)', tension: 0.4, fill: true, borderWidth: 3, pointRadius: 5, pointBackgroundColor: '#00d68f' }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#eaeaf5' } } }, scales: { y: { ticks: { color: '#a0a0c0' }, grid: { color: '#252540' } }, x: { ticks: { color: '#a0a0c0' }, grid: { color: '#252540' } } } }
  });
}

function analizarGastosHormiga() {
  const ahora = new Date();
  const gastoHormiga = (STATE.expenses || []).filter(e => {
    const d = new Date(e.fecha);
    return d.getMonth() === ahora.getMonth() && d.getFullYear() === ahora.getFullYear() && e.monto < 50000;
  });
  
  const totalH = gastoHormiga.reduce((a, e) => a + e.monto, 0);
  const totalG = (STATE.expenses || []).filter(e => {
    const d = new Date(e.fecha);
    return d.getMonth() === ahora.getMonth() && d.getFullYear() === ahora.getFullYear();
  }).reduce((a, e) => a + e.monto, 0);
  
  const pct = totalG > 0 ? (totalH / totalG * 100).toFixed(1) : 0;
  const ahorroP = Math.round(totalH * 0.3);
  
  const container = document.getElementById('hormiga-container');
  if (!container) return;
  
  container.innerHTML = `<div class="hormiga-stat"><div class="hormiga-number">${fmt(totalH)}</div><div class="hormiga-label">Gastos < $50K</div></div><div class="hormiga-stat"><div class="hormiga-number">${pct}%</div><div class="hormiga-label">De tus gastos</div></div><div class="hormiga-alert">💡 Si reduces 30%:<div style="font-size:1.3rem;font-weight:700;color:#00d68f;margin-top:0.5rem;">Ahorrarías ${fmt(ahorroP)}/mes</div><div style="font-size:0.9rem;color:#a0a0c0;margin-top:0.5rem;">= ${fmt(ahorroP * 12)}/año</div></div>`;
}

function generarRecomendaciones() {
  const recomendaciones = [];
  const ingreso = (STATE.config.q1Income || 0) + (STATE.config.q2Income || 0);
  const deuda = getTotalDebt();
  const gastos = getMonthExpenses();
  
  const tasaA = ingreso > 0 ? ((ingreso - gastos) / ingreso * 100).toFixed(1) : 0;
  if (tasaA < 10) recomendaciones.push({ icono: '💰', titulo: 'Aumenta ahorro', desc: `Ahorras ${tasaA}%. Intenta 15%`, accion: 'Reduce gastos no esenciales' });
  
  const deudasA = (STATE.debts || []).filter(d => (d.tasa || 0) > 2.5);
  if (deudasA.length > 0) recomendaciones.push({ icono: '📉', titulo: 'Consolidar deudas', desc: `${deudasA.length} deudas > 2.5%`, accion: 'Contacta tu banco' });
  
  const deudasP = (STATE.debts || []).filter(d => d.saldo < 500000).sort((a, b) => a.saldo - b.saldo);
  if (deudasP.length > 1) recomendaciones.push({ icono: '🎯', titulo: 'Liquida primero la pequeña', desc: `${deudasP[0].acreedor}: ${fmt(deudasP[0].saldo)}`, accion: 'Victoria psicológica' });
  
  if (ingreso > 0 && deuda / ingreso > 0.5) recomendaciones.push({ icono: '⚠️', titulo: 'Ratio alto', desc: `${(deuda / ingreso).toFixed(1)}x tu ingreso`, accion: 'Enfócate en pagar' });
  
  mostrarRecomendaciones(recomendaciones);
}

function mostrarRecomendaciones(recs) {
  const container = document.getElementById('recomendaciones-container');
  if (!container) return;
  
  if (recs.length === 0) {
    container.innerHTML = '<p style="color:#a0a0c0;text-align:center;padding:2rem;">¡Vas muy bien! 👍</p>';
    return;
  }
  
  container.innerHTML = recs.map(r => `<div class="recomendacion-card"><div class="rec-icono">${r.icono}</div><div class="rec-content"><div class="rec-titulo">${r.titulo}</div><div class="rec-desc">${r.desc}</div><div class="rec-accion">💡 ${r.accion}</div></div></div>`).join('');
}

// ═══════════════════════════════════════════
// MÁS MENU - TOGGLE Y FUNCIONES
// ═══════════════════════════════════════════

function toggleMasMenu() {
  const menu = document.getElementById('mas-menu');
  if (menu) {
    menu.classList.toggle('hidden');
  }
}

function closeMasMenu() {
  const menu = document.getElementById('mas-menu');
  if (menu) {
    menu.classList.add('hidden');
  }
}

// Cerrar el menú cuando haces click fuera
document.addEventListener('click', (e) => {
  const menu = document.getElementById('mas-menu');
  const masBtn = document.querySelector('[onclick="toggleMasMenu()"]');
  
  if (menu && masBtn && !menu.contains(e.target) && !masBtn.contains(e.target)) {
    closeMasMenu();
  }
});

// ═══════════════════════════════════════════
// FIX CRÍTICO: GUARDADO AUTOMÁTICO DE DATOS
// ═══════════════════════════════════════════

// GUARDADO AUTOMÁTICO CADA 5 SEGUNDOS
setInterval(() => {
  try {
    localStorage.setItem('cp_state', JSON.stringify(STATE));
  } catch(e) {
    console.error('Auto-save failed:', e);
  }
}, 5000);

// GUARDADO AL CERRAR PÁGINA/NAVEGADOR
window.addEventListener('beforeunload', () => {
  try {
    localStorage.setItem('cp_state', JSON.stringify(STATE));
    localStorage.setItem('cp_last_save', new Date().toISOString());
  } catch(e) {
    console.error('Final save failed:', e);
  }
});

// VERIFICAR MODO INCÓGNITO/PRIVADO
function checkPrivateMode() {
  const test = '__ls_test__';
  try {
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return false; // No es privado, localStorage funciona
  } catch(e) {
    console.warn('⚠️ ADVERTENCIA: Estás en Modo Incógnito/Privado');
    console.warn('Los datos NO se guardarán cuando cierres el navegador');
    return true; // Es privado, localStorage no funciona
  }
}

// VERIFICAR AL CARGAR
window.addEventListener('load', () => {
  const isPrivate = checkPrivateMode();
  if (isPrivate) {
    setTimeout(() => {
      showToast('⚠️ MODO PRIVADO: Datos no se guardarán al cerrar');
    }, 2000);
  }
});

// GUARDAR DESPUÉS DE CADA ACCIÓN IMPORTANTE
// Wrapper para saveState que guarda CON CONFIRMACIÓN
const originalSaveState = saveState;
window.saveState = function() {
  try {
    localStorage.setItem('cp_state', JSON.stringify(STATE));
    localStorage.setItem('cp_last_save', new Date().toISOString());
    return true;
  } catch(e) {
    console.error('Save error:', e);
    showToast('❌ Error al guardar datos');
    return false;
  }
};

// CARGAR CON VALIDACIÓN
const originalLoadData = loadData;
window.loadData = function() {
  try {
    const raw = localStorage.getItem('cp_state');
    if (raw) {
      const d = JSON.parse(raw);
      STATE = { ...STATE, ...d };
      console.log('✅ Datos cargados correctamente');
      return true;
    } else {
      console.log('ℹ️ Sin datos guardados (primera vez)');
      return false;
    }
  } catch(e) {
    console.error('Load error:', e);
    showToast('❌ Error al cargar datos guardados');
    return false;
  }
};

// VERIFICAR INTEGRIDAD DE DATOS
function verifyDataIntegrity() {
  if (!STATE) {
    console.error('❌ STATE está undefined');
    return false;
  }
  if (!STATE.debts) STATE.debts = [];
  if (!STATE.expenses) STATE.expenses = [];
  if (!STATE.cuotas) STATE.cuotas = [];
  if (!STATE.config) STATE.config = {};
  console.log('✅ Integridad de datos verificada');
  return true;
}

// EXPORTAR DATOS (PARA BACKUP MANUAL)
function exportData() {
  const data = JSON.stringify(STATE, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ControlPeso_Backup_${today()}.json`;
  a.click();
  showToast('📥 Datos exportados correctamente');
}

// IMPORTAR DATOS (PARA RESTAURAR BACKUP)
function importData(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      STATE = { ...STATE, ...data };
      saveState();
      showToast('✅ Datos importados correctamente');
      location.reload();
    } catch(err) {
      showToast('❌ Error al importar datos');
      console.error('Import error:', err);
    }
  };
  reader.readAsText(file);
}

// INICIALIZAR CORRECTAMENTE AL CARGAR
document.addEventListener('DOMContentLoaded', () => {
  console.log('🔄 Inicializando ControlPeso...');
  verifyDataIntegrity();
  loadData();
  console.log('✅ Carga completada');
});

console.log('✅ Sistema de guardado automático ACTIVADO');

