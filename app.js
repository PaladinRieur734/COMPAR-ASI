
'use strict';

const $ = id => document.getElementById(id);

let paymentRows = [];
let customColumns = ['Autres ressources 1', 'Autres ressources 2'];
let piBands = [];
let lastCalc = null;

const plafonds = {
  2017: { seul: 8457.77, couple: 14814.39 },
  2018: { seul: 8542.34, couple: 14962.53 },
  2019: { seul: 8679.01, couple: 15201.93 },
  2020: { seul: 9000.00, couple: 15750.00 },
  2021: { seul: 9600.00, couple: 16800.00 },
  2022: { seul: 10163.71, couple: 17786.49 },
  2023: { seul: 10320.07, couple: 18060.13 },
  2024: { seul: 10794.79, couple: 18890.89 },
  2025: { seul: 10978.30, couple: 19212.03 },
  2026: { seul: 11065.92, couple: 19365.60 }
};

const abattements = {
  2017: { seul: 1400, couple: 2400 },
  2018: { seul: 1450, couple: 2450 },
  2019: { seul: 1500, couple: 2500 },
  2020: { seul: 5541.90, couple: 9236.50 },
  2021: { seul: 5596.50, couple: 9327.50 },
  2022: { seul: 5771.22, couple: 9618.70 },
  2023: { seul: 6153.42, couple: 10255.70 },
  2024: { seul: 6360.90, couple: 10601.50 },
  2025: { seul: 6486.48, couple: 10810.80 },
  2026: { seul: 6562.92, couple: 10938.20 }
};

const euro = n =>
  Number(n || 0).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + ' €';

const num = value => {
  if (typeof value === 'number') return value;
  const cleaned = String(value ?? '')
    .replace(/\s/g, '')
    .replace(/[€]/g, '')
    .replace(',', '.');
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const esc = value =>
  String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[character]));

function parseDate(value) {
  const match = String(value || '').trim()
    .match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);

  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const result = new Date(year, month - 1, day);

  if (
    result.getFullYear() !== year ||
    result.getMonth() !== month - 1 ||
    result.getDate() !== day
  ) {
    return null;
  }

  return result;
}

function fmtDate(date) {
  if (!date) return '';
  return String(date.getDate()).padStart(2, '0') + '/' +
    String(date.getMonth() + 1).padStart(2, '0') + '/' +
    date.getFullYear();
}

function addMonths(date, number) {
  return new Date(date.getFullYear(), date.getMonth() + number, 1);
}

function monthKey(date) {
  return date.getFullYear() + '-' +
    String(date.getMonth() + 1).padStart(2, '0');
}

function monthLabel(date) {
  return date.toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric'
  });
}

function getWorkflow() {
  return document.querySelector('input[name="workflow"]:checked')?.value || 'rejet';
}

function updateWorkflow() {
  const hasIndu = getWorkflow() === 'indu';

  document.querySelectorAll('.indu-only').forEach(element => {
    element.classList.toggle('hidden', !hasIndu);
  });

  $('exportDocx').textContent = hasIndu
    ? 'Générer l’annexe de calcul de l’indu'
    : 'Générer la trame CRA REJET ASI';
}

document.querySelectorAll('input[name="workflow"]').forEach(element => {
  element.addEventListener('change', updateWorkflow);
});

$('initiale').addEventListener('input', event => {
  event.target.value = event.target.value.toLocaleUpperCase('fr-FR').slice(0, 1);
});

/* Plafond et abattement : année applicable du 1er avril au 31 mars. */
function applicableYear(date) {
  return date.getMonth() < 3
    ? date.getFullYear() - 1
    : date.getFullYear();
}

function ceilingAnnual(date) {
  const year = applicableYear(date);
  const status = $('situation').value;
  return num($('plafondOverride').value) ||
    plafonds[year]?.[status] ||
    0;
}

function abatementAnnual(date) {
  const year = applicableYear(date);
  const status = $('situation').value;
  return num($('abattementOverride').value) ||
    abattements[year]?.[status] ||
    0;
}

/* Montants théoriques de pension d’invalidité. */
function initPI() {
  if (!piBands.length) {
    const date = parseDate($('dateEffet').value) || new Date();

    piBands = [{
      date: new Date(date.getFullYear(), date.getMonth(), 1),
      amount: 0
    }];
  }

  renderPI();
}

function renderPI() {
  const container = $('piBands');
  container.innerHTML = '';

  piBands
    .sort((a, b) => a.date - b.date)
    .forEach((band, index) => {
      const row = document.createElement('div');
      row.className = 'pi-row';

      row.innerHTML = `
        <div>
          <label>Date d’application</label>
          <input type="date"
                 data-pi-date="${index}"
                 value="${band.date.getFullYear()}-${String(band.date.getMonth() + 1).padStart(2, '0')}-${String(band.date.getDate()).padStart(2, '0')}">
        </div>
        <div>
          <label>Montant théorique mensuel (€)</label>
          <input inputmode="decimal"
                 data-pi-amount="${index}"
                 value="${String(band.amount).replace('.', ',')}">
        </div>
        <button type="button"
                class="remove-button"
                data-pi-remove="${index}"
                ${piBands.length === 1 ? 'disabled' : ''}>
          Supprimer
        </button>
      `;

      container.appendChild(row);
    });

  container.querySelectorAll('[data-pi-date]').forEach(element => {
    element.addEventListener('change', event => {
      const parts = event.target.value.split('-').map(Number);
      if (parts.length !== 3 || !parts.every(Number.isFinite)) return;

      piBands[Number(event.target.dataset.piDate)].date =
        new Date(parts[0], parts[1] - 1, parts[2]);
    });
  });

  container.querySelectorAll('[data-pi-amount]').forEach(element => {
    element.addEventListener('change', event => {
      const index = Number(event.target.dataset.piAmount);
      piBands[index].amount = num(event.target.value);
      event.target.value = String(piBands[index].amount).replace('.', ',');
    });
  });

  container.querySelectorAll('[data-pi-remove]').forEach(element => {
    element.addEventListener('click', event => {
      piBands.splice(Number(event.currentTarget.dataset.piRemove), 1);
      renderPI();
    });
  });
}

$('addPI').addEventListener('click', () => {
  const sorted = piBands.slice().sort((a, b) => a.date - b.date);
  const last = sorted[sorted.length - 1];
  const date = last
    ? new Date(last.date.getFullYear() + 1, 3, 1)
    : new Date();

  piBands.push({
    date,
    amount: last?.amount || 0
  });

  renderPI();
});

function piAt(date) {
  const applicable = piBands
    .filter(band => band.date <= date)
    .sort((a, b) => a.date - b.date);

  return applicable.length
    ? applicable[applicable.length - 1].amount
    : 0;
}

/* Génération automatique des trois mois précédant la date d’effet. */
function addCustomColumn() {
  const name = prompt('Nom de la nouvelle colonne de ressources :', 'Autres ressources');

  if (!name || !name.trim()) return;

  customColumns.push(name.trim());
  generateResourceTables();
}

$('addCustom').addEventListener('click', addCustomColumn);

function generateResourceTables() {
  const date = parseDate($('dateEffet').value);
  const status = $('situation').value;
  const container = $('quarterTables');

  if (!date) {
    container.innerHTML =
      '<p class="notice">Saisis une date d’effet valide pour générer les trois mois précédents.</p>';
    return;
  }

  const months = [3, 2, 1].map(number =>
    new Date(date.getFullYear(), date.getMonth() - number, 1)
  );

  const roles = status === 'couple'
    ? ['Demandeur', 'Conjoint']
    : ['Demandeur'];

  const previousValues = {};

  container.querySelectorAll('input[data-resource]').forEach(element => {
    previousValues[element.dataset.resource] = element.value;
  });

  container.innerHTML = '';

  roles.forEach(role => {
    const wrapper = document.createElement('div');
    wrapper.className = 'table-wrap';

    let html = `
      <h3>Ressources du ${role.toLowerCase()}</h3>
      <table>
        <thead>
          <tr>
            <th>Mois</th>
            <th>Pension d’invalidité (€)</th>
            <th>Salaires (€)</th>
            <th>Indemnités journalières (€)</th>
            <th>Chômage (€)</th>
            ${customColumns.map(column => `<th>${esc(column)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
    `;

    months.forEach(month => {
      html += `<tr><td>${esc(monthLabel(month))}</td>`;

      const types = [
        'invalidite',
        'salaires',
        'indemnites',
        'chomage',
        ...customColumns.map((column, index) => 'custom' + index)
      ];

      types.forEach(type => {
        const key = role.toLowerCase() + '_' + monthKey(month) + '_' + type;

        html += `
          <td>
            <input data-resource="${key}"
                   inputmode="decimal"
                   aria-label="${esc(role + ' ' + monthLabel(month) + ' ' + type)}"
                   placeholder="0,00"
                   value="${esc(previousValues[key] || '')}">
          </td>
        `;
      });

      html += '</tr>';
    });

    html += '</tbody></table>';
    wrapper.innerHTML = html;
    container.appendChild(wrapper);
  });
}

$('dateEffet').addEventListener('change', () => {
  generateResourceTables();

  const date = parseDate($('dateEffet').value);

  if (!piBands.length) {
    initPI();
  } else {
    if (date && piBands.length === 1 && piBands[0].amount === 0) {
      piBands[0].date = new Date(date.getFullYear(), date.getMonth(), 1);
    }

    renderPI();
  }
});

$('situation').addEventListener('change', generateResourceTables);

/* Calcul des ressources du trimestre. */
function resourceValues() {
  const date = parseDate($('dateEffet').value);

  if (!date) {
    throw Error('Renseigne une date d’effet valide.');
  }

  const months = [3, 2, 1].map(number =>
    new Date(date.getFullYear(), date.getMonth() - number, 1)
  );

  const roles = $('situation').value === 'couple'
    ? ['demandeur', 'conjoint']
    : ['demandeur'];

  let total = 0;
  let salaries = 0;
  const details = [];

  roles.forEach(role => {
    months.forEach(month => {
      const get = type => {
        const input = document.querySelector(
          `[data-resource="${role}_${monthKey(month)}_${type}"]`
        );

        return input ? num(input.value) : 0;
      };

      const invalidite = get('invalidite');
      const salaires = get('salaires');
      const indemnites = get('indemnites');
      const chomage = get('chomage');
      const customs = {};

      customColumns.forEach((column, index) => {
        customs['custom' + index] = get('custom' + index);
      });

      const customTotal = Object.values(customs).reduce((sum, value) => sum + value, 0);
      const sum = invalidite + salaires + indemnites + chomage + customTotal;

      total += sum;
      salaries += salaires;

      details.push({
        role,
        month,
        invalidite,
        salaires,
        indemnites,
        chomage,
        customs,
        total: sum
      });
    });
  });

  return { total, salaries, details, months };
}

/* Calcul ASI : ressources trimestrielles, BIM, abattement et plafond. */
function calculateASI() {
  try {
    const date = parseDate($('dateEffet').value);

    if (!date) {
      throw Error('Renseigne une date d’effet valide.');
    }

    const resources = resourceValues();
    const bim = num($('bimN1').value) * 0.03 / 4;
    const resourcesBefore = resources.total + bim;

    const annualAbatement = abatementAnnual(date);
    const quarterAbatement = Math.min(resources.salaries, annualAbatement / 4);
    const resourcesAfter = Math.max(0, resourcesBefore - quarterAbatement);

    const annualCeiling = ceilingAnnual(date);
    const quarterCeiling = annualCeiling / 4;
    const quarterRight = Math.max(0, quarterCeiling - resourcesAfter);
    const monthlyRight = quarterRight / 3;

    lastCalc = {
      dateEffet: date,
      resources,
      bim,
      resourcesBefore,
      annualAb: annualAbatement,
      quarterAb: quarterAbatement,
      after: resourcesAfter,
      annualCeiling,
      quarterCeiling,
      quarterRight,
      monthlyRight
    };

    $('error').classList.add('hidden');

    $('asiResult').innerHTML = `
      <div class="result-card">
        <h3>Résultat du calcul ASI</h3>
        <div class="metric">
          <div><strong>Plafond annuel applicable</strong><span>${euro(annualCeiling)}</span></div>
          <div><strong>Plafond trimestriel</strong><span>${euro(quarterCeiling)}</span></div>
          <div><strong>Ressources avant abattement (BIM inclus)</strong><span>${euro(resourcesBefore)}</span></div>
          <div><strong>Abattement trimestriel retenu</strong><span>${euro(quarterAbatement)}</span></div>
          <div><strong>Ressources après abattement</strong><span>${euro(resourcesAfter)}</span></div>
          <div><strong>Droit ASI mensuel théorique</strong><span>${euro(monthlyRight)}</span></div>
        </div>

        <h3>Détail des ressources</h3>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Personne</th><th>Mois</th><th>PI</th><th>Salaires</th>
                <th>IJ</th><th>Chômage</th><th>Autres ressources</th><th>Total</th>
              </tr>
            </thead>
            <tbody>
              ${resources.details.map(item => `
                <tr>
                  <td>${esc(item.role)}</td>
                  <td>${esc(monthLabel(item.month))}</td>
                  <td>${euro(item.invalidite)}</td>
                  <td>${euro(item.salaires)}</td>
                  <td>${euro(item.indemnites)}</td>
                  <td>${euro(item.chomage)}</td>
                  <td>${euro(Object.values(item.customs).reduce((sum, value) => sum + value, 0))}</td>
                  <td>${euro(item.total)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <p>
          Les ressources trimestrielles après abattement sont de
          <strong>${euro(resourcesAfter)}</strong>, pour un plafond trimestriel de
          <strong>${euro(quarterCeiling)}</strong>. Le droit théorique est donc de
          <strong>${euro(quarterRight)}</strong> par trimestre, soit
          <strong>${euro(monthlyRight)}</strong> par mois.
        </p>
        <p class="small">
          Le calcul applique le plafond et l’abattement annuels correspondant à la période
          du 1er avril au 31 mars. Le BIM trimestriel est calculé à 3 % du montant déclaré
          au 31 décembre de N-1, divisé par quatre.
        </p>
      </div>
    `;

    if (getWorkflow() === 'indu') {
      paymentRows.forEach(payment => {
        if (payment.right == null) payment.right = monthlyRight;
      });
      renderPayments();
      updateSummaryIndu();
    }

    $('summary').innerHTML = `
      <div class="result-card">
        <strong>Droit ASI mensuel théorique : ${euro(monthlyRight)}</strong><br>
        Ressources après abattement : ${euro(resourcesAfter)} /
        plafond trimestriel : ${euro(quarterCeiling)}.
      </div>
    `;

    if (getWorkflow() === 'indu') updateSummaryIndu();

    $('exportDocx').disabled = false;
    $('exportCsv').disabled = false;
  } catch (error) {
    $('error').textContent = error.message;
    $('error').classList.remove('hidden');
  }
}

$('calculate').addEventListener('click', calculateASI);

/* Glisser-déposer et sélection classique des fichiers. */
function setupDrop(dropId, inputId, nameId) {
  const drop = $(dropId);
  const input = $(inputId);
  const name = $(nameId);

  const refresh = () => {
    name.textContent = input.files[0]?.name || 'Aucun fichier sélectionné';
  };

  drop.addEventListener('click', () => input.click());

  drop.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      input.click();
    }
  });

  input.addEventListener('change', refresh);

  ['dragenter', 'dragover'].forEach(eventName => {
    drop.addEventListener(eventName, event => {
      event.preventDefault();
      drop.classList.add('dragging');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    drop.addEventListener(eventName, event => {
      event.preventDefault();
      drop.classList.remove('dragging');
    });
  });

  drop.addEventListener('drop', event => {
    const file = event.dataTransfer.files[0];
    if (!file) return;

    const extension = file.name.split('.').pop().toLowerCase();

    if (inputId === 'resourcesFile' && !['docx', 'pdf'].includes(extension)) {
      alert('Le SCAPIN doit être au format .docx ou PDF.');
      return;
    }

    if (inputId === 'noticeFile' && extension !== 'pdf') {
      alert('La notification doit être au format PDF.');
      return;
    }

    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    refresh();
  });
}

setupDrop('resourcesDrop', 'resourcesFile', 'resourcesName');
setupDrop('noticeDrop', 'noticeFile', 'noticeName');

async function pdfText(file) {
  if (!window.pdfjsLib) {
    throw Error('La bibliothèque PDF n’a pas pu être chargée. Vérifie la connexion Internet.');
  }

  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  const pdf = await pdfjsLib.getDocument({
    data: await file.arrayBuffer()
  }).promise;

  const output = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    output.push(content.items.map(item => item.str).join(' '));
  }

  return output.join('\n');
}

async function docxText(file) {
  if (!window.mammoth) {
    throw Error('La bibliothèque Word n’a pas pu être chargée. Vérifie la connexion Internet.');
  }

  const result = await mammoth.extractRawText({
    arrayBuffer: await file.arrayBuffer()
  });

  return result.value;
}

$('readFiles').addEventListener('click', async () => {
  try {
    const resourcesFile = $('resourcesFile').files[0];
    const noticeFile = $('noticeFile').files[0];

    if (!resourcesFile && !noticeFile) {
      throw Error('Dépose ou sélectionne au moins un document.');
    }

    $('fileStatus').textContent = 'Lecture locale en cours…';

    if (resourcesFile) {
      $('resourceText').value = resourcesFile.name.toLowerCase().endsWith('.pdf')
        ? await pdfText(resourcesFile)
        : await docxText(resourcesFile);
    }

    if (noticeFile) {
      $('noticeText').value = await pdfText(noticeFile);
    }

    $('extractArea').classList.remove('hidden');
    $('fileStatus').textContent =
      'Lecture terminée. Vérifie les extractions avec les documents originaux.';
  } catch (error) {
    $('fileStatus').textContent = error.message;
  }
});

$('clearFiles').addEventListener('click', () => {
  ['resourcesFile', 'noticeFile', 'resourceText', 'noticeText'].forEach(id => {
    $(id).value = '';
  });

  $('resourcesName').textContent = 'Aucun fichier sélectionné';
  $('noticeName').textContent = 'Aucun fichier sélectionné';
  $('extractArea').classList.add('hidden');
  $('fileStatus').textContent = 'Aucun document lu.';

  paymentRows = [];
  renderPayments();
});

function readPaymentRows(text) {
  const output = [];
  const regex = /(?:ASI\s+)?(\d{1,2}\/\d{4})\s+(-?[\d.,]+)\s+(-?[\d.,]+)\s+(-?[\d.,]+)/gi;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const parts = match[1].split('/');

    output.push({
      month: new Date(Number(parts[1]), Number(parts[0]) - 1, 1),
      newAmount: num(match[2]),
      paid: num(match[3]),
      sourceDiff: num(match[4]),
      right: null,
      indu: null,
      checked: false
    });
  }

  const unique = new Map();

  output.forEach(item => {
    unique.set(monthKey(item.month), item);
  });

  return [...unique.values()].sort((a, b) => a.month - b.month);
}

$('parseNotice').addEventListener('click', () => {
  paymentRows = readPaymentRows($('noticeText').value);
  renderPayments();

  $('fileStatus').textContent = paymentRows.length
    ? `${paymentRows.length} mensualité(s) reconnue(s). Compare les données à la notification originale.`
    : 'Aucune ligne reconnue automatiquement. Le format du document peut être différent.';
});

function renderPayments() {
  const body = $('payments').querySelector('tbody');
  body.innerHTML = '';

  paymentRows.forEach((payment, index) => {
    const row = document.createElement('tr');

    row.innerHTML = `
      <td>${esc(monthLabel(payment.month))}</td>
      <td><input data-pay="newAmount" data-i="${index}" value="${esc(String(payment.newAmount).replace('.', ','))}"></td>
      <td><input data-pay="paid" data-i="${index}" value="${esc(String(payment.paid).replace('.', ','))}"></td>
      <td><input data-pay="right" data-i="${index}" value="${payment.right == null ? '' : esc(String(payment.right).replace('.', ','))}"></td>
      <td>${payment.indu == null ? '—' : euro(payment.indu)}</td>
      <td><label><input type="checkbox" data-check="${index}" ${payment.checked ? 'checked' : ''}> Vérifié</label></td>
    `;

    body.appendChild(row);
  });

  body.querySelectorAll('[data-pay]').forEach(element => {
    element.addEventListener('change', event => {
      const payment = paymentRows[Number(event.target.dataset.i)];
      payment[event.target.dataset.pay] = num(event.target.value);
      payment.indu = Math.max(0, payment.paid - (payment.right || 0));

      renderPayments();
      updateSummaryIndu();
    });
  });

  body.querySelectorAll('[data-check]').forEach(element => {
    element.addEventListener('change', event => {
      paymentRows[Number(event.target.dataset.check)].checked = event.target.checked;
    });
  });
}

function updateSummaryIndu() {
  const total = paymentRows.reduce(
    (sum, payment) => sum + Math.max(0, (payment.paid || 0) - (payment.right || 0)),
    0
  );

  $('summary').dataset.indu = String(total);

  if (getWorkflow() === 'indu') {
    const previous = $('summary').querySelector('.indu-total');
    if (previous) previous.remove();

    const paragraph = document.createElement('p');
    paragraph.className = 'indu-total';
    paragraph.innerHTML = `<strong>Trop-perçu total calculé à titre indicatif : ${euro(total)}</strong>`;
    $('summary').appendChild(paragraph);
  }
}

function csvEscape(value) {
  return '"' + String(value ?? '').replace(/"/g, '""') + '"';
}

function exportCSV() {
  const rows = [
    ['Mensualité', 'Nouveau montant', 'Déjà payé', 'Droit théorique', 'Trop-perçu calculé']
  ];

  paymentRows.forEach(payment => {
    rows.push([
      monthLabel(payment.month),
      payment.newAmount,
      payment.paid,
      payment.right ?? '',
      Math.max(0, (payment.paid || 0) - (payment.right || 0))
    ]);
  });

  if (!paymentRows.length && lastCalc) {
    rows.push(['Droit ASI mensuel théorique', lastCalc.monthlyRight]);
  }

  const csv = '\ufeff' +
    rows.map(row => row.map(csvEscape).join(';')).join('\r\n');

  download(
    new Blob([csv], { type: 'text/csv;charset=utf-8;' }),
    'calcul_CRA_ASI.csv'
  );
}

$('exportCsv').addEventListener('click', exportCSV);

function annexText() {
  const initiale = $('initiale').value || '[initiale]';
  const date = parseDate($('dateEffet').value);

  const lines = [
    `CALCULETTE CRA ASI — ${getWorkflow() === 'indu' ? 'TROP-PERÇU' : 'REJET ASI'}`,
    `Dossier : ${$('civilite').value} ${initiale}.`,
    `Référence CRA : ${$('ref').value || 'Non renseignée'}`,
    `Situation : ${$('situation').selectedOptions[0].text}`,
    `Date d’effet : ${fmtDate(date) || 'Non renseignée'}`,
    `Date de demande : ${$('dateDemande').value || 'Non renseignée'}`,
    `Décision contestée : ${$('dateDecision').value || 'Non renseignée'}`
  ];

  if (lastCalc) {
    lines.push(
      '',
      `Ressources trimestrielles avant abattement, BIM inclus : ${euro(lastCalc.resourcesBefore)}`,
      `Abattement appliqué : ${euro(lastCalc.quarterAb)}`,
      `Ressources après abattement : ${euro(lastCalc.after)}`,
      `Plafond trimestriel : ${euro(lastCalc.quarterCeiling)}`,
      `Droit ASI trimestriel théorique : ${euro(lastCalc.quarterRight)}`,
      `Droit ASI mensuel théorique : ${euro(lastCalc.monthlyRight)}`
    );
  }

  if (getWorkflow() === 'indu') {
    const total = paymentRows.reduce(
      (sum, payment) => sum + Math.max(0, (payment.paid || 0) - (payment.right || 0)),
      0
    );

    lines.push(
      '',
      `Période de trop-perçu : ${$('debut').value || 'Non renseignée'} au ${$('fin').value || 'Non renseignée'}`,
      `Motif : ${$('motif').value || 'Non renseigné'}`,
      `Total indicatif du trop-perçu : ${euro(total)}`
    );

    paymentRows.forEach(payment => {
      lines.push(
        `${monthLabel(payment.month)} : payé ${euro(payment.paid)}, droit théorique ${
          payment.right == null ? 'non renseigné' : euro(payment.right)
        }, trop-perçu ${euro(Math.max(0, (payment.paid || 0) - (payment.right || 0)))}.`
      );
    });
  }

  return lines.join('\n');
}

$('exportDocx').addEventListener('click', () => {
  const text = annexText();

  const html = `
    <!doctype html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; font-size: 11pt; }
        h1 { font-size: 14pt; color: #1e90ff; }
        p { margin: 0 0 8pt; white-space: pre-wrap; }
      </style>
    </head>
    <body>
      <h1>${esc(getWorkflow() === 'indu' ? 'Annexe de calcul du trop-perçu ASI' : 'Trame CRA — rejet ASI')}</h1>
      ${text.split('\n').map(line => `<p>${esc(line) || '&nbsp;'}</p>`).join('')}
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff', html], { type: 'application/msword' });

  download(
    blob,
    `CRA_ASI_${$('initiale').value || 'dossier'}.doc`
  );
});

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

$('downloadJson').addEventListener('click', () => {
  const data = {
    workflow: getWorkflow(),
    identification: Object.fromEntries([
      'ref',
      'civilite',
      'initiale',
      'situation',
      'dateDemande',
      'dateDecision',
      'dateEffet',
      'dateControle',
      'dateCRA',
      'gestionnaire',
      'mesure',
      'debut',
      'fin',
      'motif',
      'bimN1',
      'plafondOverride',
      'abattementOverride'
    ].map(key => [key, $(key)?.value ?? ''])),
    resourcesText: $('resourceText').value,
    noticeText: $('noticeText').value,
    payments: paymentRows,
    piBands: piBands.map(item => ({
      date: fmtDate(item.date),
      amount: item.amount
    })),
    calculation: lastCalc ? {
      resourcesBefore: lastCalc.resourcesBefore,
      quarterAb: lastCalc.quarterAb,
      after: lastCalc.after,
      quarterCeiling: lastCalc.quarterCeiling,
      quarterRight: lastCalc.quarterRight,
      monthlyRight: lastCalc.monthlyRight
    } : null
  };

  download(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
    `CRA_ASI_${$('initiale').value || 'dossier'}.json`
  );
});

updateWorkflow();
initPI();
generateResourceTables();
