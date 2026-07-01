/* ═══════════════════════════════════════════
   CONTROLPESO — MOTOR COMPLETO v3.0
   7 MEJORAS: Cupo, Gráficos, Comparativa, Alertas, Plan Semanal, Hormiga, Recomendaciones
═══════════════════════════════════════════ */

'use strict';

// ─────────────────────────────────────────
// ESTADO GLOBAL MEJORADO
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
  cuotas: [],
  cupoUsos: [],        // NUEVO: Registro de usos de cupo
  payments: [],
  moods: [],
  alerts: [],
  achievements: [],
  monthlyHistory: [],  // NUEVO: Historial mensual para comparativa
  crisisMode: false,
  racha: 0,
  recordRacha: 0,
  debtHistory: [],
  currentMonth: new Date().getMonth(),
  currentYear: new Date().getFullYear(),
  lastCheck: null,
  apoyoIdx: 0,
};

// CONSTANTES
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
// HELPERS BÁSICOS
// ─────────────────────────────────────────
function fmt(n) {
  if (!n && n !== 0) return '$0';
  return '$' + Math.round(n).toLocaleString('es-CO');
}
function today() { return new Date().toISOString().split('T')[0]; }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function getMonthlyIncome() { return (STATE.config.q1Income || 0) + (STATE.config.q2Income || 0); }
function getTotalDebt() { return (STATE.debts || []).reduce((a, d) => a + (d.saldo || 0), 0); }

// ─────────────────────────────────────────
// MEJORA 1: CUPO DISPONIBLE
// ─────────────────────────────────────────
function registrarUsoCupo() {
  const tarjetaId = document.getElementById('cupo-tarjeta').value;
  const monto = parseFloat(document.getElementById('cupo-monto').value) || 0;
  const cuotas = parseInt(document.getElementById('cupo-cuotas').value) || 1;
  
  if (!tarjetaId || !monto) { showToast('❌ Completa los campos', 'error'); return; }
  
  const tarjeta = STATE.debts.find(d => d.id === tarjetaId);
  if (!tarjeta) { showToast('❌ Tarjeta no encontrada', 'error'); return; }
  
  if (monto > (tarjeta.cupoDisponible || tarjeta.cupo - tarjeta.saldo)) {
    showToast('❌ No tienes cupo disponible', 'error');
    return;
  }
  
  tarjeta.cupoDisponible = (tarjeta.cupoDisponible || tarjeta.cupo - tarjeta.saldo) - monto;
  tarjeta.saldo += monto;
  
  const tasaMensual = (tarjeta.tasa || 0) / 100 / 12;
  const cuotaMensual = (monto / cuotas) * (1 + tasaMensual * cuotas);
  
  STATE.cupoUsos.push({
    id: uid(),
    tarjetaId: tarjetaId,
    monto: monto,
    cuotas: cuotas,
    cuotaMensual: cuotaMensual,
    fecha: today(),
    cuotasRegistradas: 0
  });
  
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
  
  saveData();
  closeModal('modal-usar-cupo');
  updateDashboard();
  showToast('✅ Uso de cupo registrado', 'success');
}

// ─────────────────────────────────────────
// MEJORA 2-3: ANÁLISIS VISUAL Y COMPARATIVA
// ─────────────────────────────────────────
function actualizarGastosGrafico() {
  const ctx = document.getElementById('gastos-chart');
  if (!ctx) return;
  
  const ahora = new Date();
  const gastosPorCat = {};
  
  (STATE.expenses || []).forEach(e => {
    const fecha = new Date(e.fecha);
    if (fecha.getMonth() === ahora.getMonth() && fecha.getFullYear() === ahora.getFullYear()) {
      gastosPorCat[e.categoria] = (gastosPorCat[e.categoria] || 0) + e.monto;
    }
  });
  
  const labels = Object.keys(gastosPorCat);
  const data = Object.values(gastosPorCat);
  const colors = labels.map(l => CAT_COLORS[l] || '#6b6b8a');
  
  if (window.chartGastos) window.chartGastos.destroy();
  
  window.chartGastos = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels.map(l => CAT_ICONS[l] + ' ' + l),
      datasets: [{
        data: data,
        backgroundColor: colors,
        borderColor: '#0f0f1a',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#eaeaf5', font: { size: 11 } } }
      }
    }
  });
}

function actualizarComparativaGrafico() {
  const ctx = document.getElementById('comparativa-chart');
  if (!ctx) return;
  
  const ahora = new Date();
  const meses = [];
  const gastos = [];
  
  for (let i = 5; i >= 0; i--) {
    const fecha = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
    const mes = fecha.getMonth();
    const año = fecha.getFullYear();
    
    const total = (STATE.expenses || [])
      .filter(e => {
        const d = new Date(e.fecha);
        return d.getMonth() === mes && d.getFullYear() === año;
      })
      .reduce((a, e) => a + e.monto, 0);
    
    meses.push(fecha.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' }));
    gastos.push(total);
  }
  
  if (window.chartComparativa) window.chartComparativa.destroy();
  
  window.chartComparativa = new Chart(ctx, {
    type: 'line',
    data: {
      labels: meses,
      datasets: [{
        label: 'Gasto mensual',
        data: gastos,
        borderColor: '#00d68f',
        backgroundColor: 'rgba(0, 214, 143, 0.1)',
        tension: 0.4,
        fill: true,
        borderWidth: 3,
        pointRadius: 5,
        pointBackgroundColor: '#00d68f'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#eaeaf5' } }
      },
      scales: {
        y: { ticks: { color: '#a0a0c0' }, grid: { color: '#252540' } },
        x: { ticks: { color: '#a0a0c0' }, grid: { color: '#252540' } }
      }
    }
  });
}

// ─────────────────────────────────────────
// MEJORA 4: ALERTAS INTELIGENTES
// ─────────────────────────────────────────
function generarAlertasInteligentes() {
  STATE.alerts = [];
  
  const mesActual = new Date().getMonth();
  const añoActual = new Date().getFullYear();
  
  // Alerta: Presupuesto excedido
  const budgetComida = STATE.config.budgets.comida || 0;
  const gastoComida = (STATE.expenses || [])
    .filter(e => e.categoria === 'comida' && 
      new Date(e.fecha).getMonth() === mesActual && 
      new Date(e.fecha).getFullYear() === añoActual)
    .reduce((a, e) => a + e.monto, 0);
  
  if (budgetComida > 0 && gastoComida > budgetComida * 1.1) {
    STATE.alerts.push({
      id: uid(),
      tipo: 'presupuesto',
      titulo: '⚠️ Presupuesto de Comida Excedido',
      desc: `Gastaste ${fmt(gastoComida)} de ${fmt(budgetComida)}`,
      urgencia: 'alta'
    });
  }
  
  // Alerta: Cuota vencida pronto
  const hoy = new Date();
  (STATE.cuotas || []).forEach(c => {
    if (!c.pagada) {
      const fechaCuota = new Date(c.fecha);
      const diasRestantes = Math.round((fechaCuota - hoy) / (1000 * 60 * 60 * 24));
      
      if (diasRestantes <= 7 && diasRestantes > 0) {
        STATE.alerts.push({
          id: uid(),
          tipo: 'cuota',
          titulo: '📅 Cuota vencida en ' + diasRestantes + ' días',
          desc: 'Monto: ' + fmt(c.monto),
          urgencia: 'media'
        });
      }
    }
  });
  
  // Alerta: Ratio deuda/ingreso
  const ingreso = getMonthlyIncome();
  const deuda = getTotalDebt();
  if (ingreso > 0 && deuda / ingreso > 1) {
    STATE.alerts.push({
      id: uid(),
      tipo: 'deuda',
      titulo: '🔴 Ratio deuda/ingreso muy alto',
      desc: 'Deuda es ' + (deuda / ingreso).toFixed(1) + 'x tu ingreso',
      urgencia: 'alta'
    });
  }
  
  saveData();
  actualizarAlertas();
}

function actualizarAlertas() {
  const container = document.getElementById('alertas-container');
  if (!container) return;
  
  if (!STATE.alerts || STATE.alerts.length === 0) {
    container.innerHTML = '<p style="color:#a0a0c0;text-align:center;padding:2rem;">Sin alertas ✅</p>';
    return;
  }
  
  container.innerHTML = (STATE.alerts || []).map(a => `
    <div class="alert-item urgencia-${a.urgencia}">
      <div class="alert-title">${a.titulo}</div>
      <div class="alert-desc">${a.desc}</div>
    </div>
  `).join('');
}

// ─────────────────────────────────────────
// MEJORA 5: PLAN SEMANAL AUTOMÁTICO
// ─────────────────────────────────────────
function generarPlanSemanal() {
  const hoy = new Date();
  const proximaSemana = new Date(hoy.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  let plan = {
    obligatorio: [],
    recomendado: [],
    evitar: []
  };
  
  (STATE.cuotas || []).forEach(c => {
    const fechaCuota = new Date(c.fecha);
    if (fechaCuota >= hoy && fechaCuota <= proximaSemana && !c.pagada) {
      plan.obligatorio.push({
        tipo: 'cuota',
        desc: 'Pagar cuota de ' + fmt(c.monto),
        fecha: c.fecha
      });
    }
  });
  
  const ingresosSemanal = (STATE.config.q1Income + STATE.config.q2Income) / 4;
  const gastosSemanal = (STATE.expenses || [])
    .filter(e => {
      const d = new Date(e.fecha);
      return d >= new Date(hoy.getTime() - 7 * 24 * 60 * 60 * 1000);
    })
    .reduce((a, e) => a + e.monto, 0);
  
  if (ingresosSemanal - gastosSemanal > 100000) {
    plan.recomendado.push({
      tipo: 'ahorro',
      desc: 'Intenta ahorrar ' + fmt((ingresosSemanal - gastosSemanal) * 0.2),
      fecha: today()
    });
  }
  
  if (gastosSemanal > ingresosSemanal * 0.8) {
    plan.evitar.push({
      tipo: 'gastos',
      desc: 'Evita gastos no esenciales (presupuesto al 80%)',
      fecha: today()
    });
  }
  
  mostrarPlanSemanal(plan);
}

function mostrarPlanSemanal(plan) {
  const container = document.getElementById('plan-semanal-container');
  if (!container) return;
  
  let html = '';
  
  if (plan.obligatorio.length > 0) {
    html += '<div class="plan-section"><h4>📌 OBLIGATORIO ESTA SEMANA:</h4>';
    plan.obligatorio.forEach(p => {
      html += `<div class="plan-item">${p.desc} (${p.fecha})</div>`;
    });
    html += '</div>';
  }
  
  if (plan.recomendado.length > 0) {
    html += '<div class="plan-section"><h4>💡 RECOMENDADO:</h4>';
    plan.recomendado.forEach(p => {
      html += `<div class="plan-item">${p.desc}</div>`;
    });
    html += '</div>';
  }
  
  if (plan.evitar.length > 0) {
    html += '<div class="plan-section"><h4>⚠️ EVITA:</h4>';
    plan.evitar.forEach(p => {
      html += `<div class="plan-item plan-danger">${p.desc}</div>`;
    });
    html += '</div>';
  }
  
  container.innerHTML = html || '<p style="color:#a0a0c0;">Sin plan para esta semana</p>';
}

// ─────────────────────────────────────────
// MEJORA 6: ANÁLISIS GASTOS HORMIGA
// ─────────────────────────────────────────
function analizarGastosHormiga() {
  const ahora = new Date();
  const gastosHormiga = (STATE.expenses || [])
    .filter(e => {
      const d = new Date(e.fecha);
      return d.getMonth() === ahora.getMonth() && 
             d.getFullYear() === ahora.getFullYear() &&
             e.monto < 50000;
    });
  
  const totalHormiga = gastosHormiga.reduce((a, e) => a + e.monto, 0);
  const totalGastos = (STATE.expenses || [])
    .filter(e => {
      const d = new Date(e.fecha);
      return d.getMonth() === ahora.getMonth() && d.getFullYear() === ahora.getFullYear();
    })
    .reduce((a, e) => a + e.monto, 0);
  
  const porcentaje = totalGastos > 0 ? (totalHormiga / totalGastos * 100).toFixed(1) : 0;
  const ahorrosPotencial = Math.round(totalHormiga * 0.3);
  
  const container = document.getElementById('hormiga-container');
  if (!container) return;
  
  container.innerHTML = `
    <div class="hormiga-stat">
      <div class="hormiga-number">${fmt(totalHormiga)}</div>
      <div class="hormiga-label">Gastos menores a $50K</div>
    </div>
    
    <div class="hormiga-stat">
      <div class="hormiga-number">${porcentaje}%</div>
      <div class="hormiga-label">De tus gastos totales</div>
    </div>
    
    <div class="hormiga-alert">
      💡 Si reduces 30% de estos gastos:
      <div style="font-size:1.3rem;font-weight:700;color:#00d68f;margin-top:0.5rem;">
        Ahorrarías ${fmt(ahorrosPotencial)}/mes
      </div>
      <div style="font-size:0.9rem;color:#a0a0c0;margin-top:0.5rem;">
        = ${fmt(ahorrosPotencial * 12)}/año
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────
// MEJORA 7: RECOMENDACIONES AUTOMÁTICAS
// ─────────────────────────────────────────
function generarRecomendaciones() {
  const recomendaciones = [];
  
  const ingreso = getMonthlyIncome();
  const deuda = getTotalDebt();
  const gastos = (STATE.expenses || [])
    .filter(e => {
      const d = new Date(e.fecha);
      const ahora = new Date();
      return d.getMonth() === ahora.getMonth() && d.getFullYear() === ahora.getFullYear();
    })
    .reduce((a, e) => a + e.monto, 0);
  
  const tasaAhorro = ingreso > 0 ? ((ingreso - gastos) / ingreso * 100).toFixed(1) : 0;
  if (tasaAhorro < 10) {
    recomendaciones.push({
      icono: '💰',
      titulo: 'Aumenta tu tasa de ahorro',
      desc: `Estás ahorrando ${tasaAhorro}%. Intenta llegar a 15%`,
      accion: 'Reduce gastos no esenciales'
    });
  }
  
  const deudasAltas = (STATE.debts || []).filter(d => (d.tasa || 0) > 2.5);
  if (deudasAltas.length > 0) {
    recomendaciones.push({
      icono: '📉',
      titulo: 'Busca consolidar tus deudas',
      desc: `Tienes ${deudasAltas.length} deudas con tasa > 2.5%`,
      accion: 'Contacta tu banco para refinanciar'
    });
  }
  
  const deudasPequeñas = (STATE.debts || []).filter(d => d.saldo < 500000).sort((a, b) => a.saldo - b.saldo);
  if (deudasPequeñas.length > 1) {
    recomendaciones.push({
      icono: '🎯',
      titulo: 'Liquida primero tu deuda más pequeña',
      desc: `${deudasPequeñas[0].acreedor}: ${fmt(deudasPequeñas[0].saldo)}`,
      accion: 'Victoria psicológica = motivación'
    });
  }
  
  if (ingreso > 0 && deuda / ingreso > 0.5) {
    recomendaciones.push({
      icono: '⚠️',
      titulo: 'Tu ratio deuda/ingreso es alto',
      desc: `Deuda es ${(deuda / ingreso).toFixed(1)}x tu ingreso mensual`,
      accion: 'Enfócate en pagar deuda + reducir gastos'
    });
  }
  
  mostrarRecomendaciones(recomendaciones);
}

function mostrarRecomendaciones(recomendaciones) {
  const container = document.getElementById('recomendaciones-container');
  if (!container) return;
  
  if (recomendaciones.length === 0) {
    container.innerHTML = '<p style="color:#a0a0c0;text-align:center;padding:2rem;">¡Vas muy bien! Sin recomendaciones por ahora 👍</p>';
    return;
  }
  
  container.innerHTML = recomendaciones.map(r => `
    <div class="recomendacion-card">
      <div class="rec-icono">${r.icono}</div>
      <div class="rec-content">
        <div class="rec-titulo">${r.titulo}</div>
        <div class="rec-desc">${r.desc}</div>
        <div class="rec-accion">💡 ${r.accion}</div>
      </div>
    </div>
  `).join('');
}

// ─────────────────────────────────────────
// FUNCIONES DE INTERFAZ
// ─────────────────────────────────────────
function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + type;
  t.style.display = 'block';
  setTimeout(() => t.style.display = 'none', 3000);
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('hidden');
}

function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('hidden');
}

// ─────────────────────────────────────────
// ACTUALIZAR DASHBOARD
// ─────────────────────────────────────────
function updateDashboard() {
  generarAlertasInteligentes();
  generarPlanSemanal();
  analizarGastosHormiga();
  generarRecomendaciones();
  actualizarGastosGrafico();
  actualizarComparativaGrafico();
  
  saveData();
}

// ─────────────────────────────────────────
// INICIALIZACIÓN
// ─────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  loadData();
  updateDashboard();
});
