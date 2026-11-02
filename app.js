/* Ledger: local dashboard, transaction management, and reporting. */
(() => {
  'use strict';

  const STORAGE_KEY = 'ledger-expense-tracker-stage1-v1';
  const CATEGORIES = ['Restaurants & Dining', 'Drinks & Bars', 'Groceries', 'Shopping', 'Transport', 'Travel & Holidays', 'Entertainment', 'Fitness & Health', 'Subscriptions', 'Housing & Bills', 'Other'];
  const CATEGORY_COLORS = ['#367b58', '#74a98a', '#b7d2bf', '#d7e5da', '#eaf0eb', '#a6c6ae', '#83ad90', '#c4d9c8'];
  const CATEGORY_BUDGETS = { 'Restaurants & Dining': 420, 'Drinks & Bars': 150, Groceries: 360, Shopping: 300, Transport: 180, 'Travel & Holidays': 450, Entertainment: 140, 'Fitness & Health': 110, Subscriptions: 75, 'Housing & Bills': 620, Other: 120 };
  const OVERALL_BUDGET = 2800;
  const money = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
  const monthFormat = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });
  const shortMonthFormat = new Intl.DateTimeFormat('en-GB', { month: 'short' });
  const compactMonthYearFormat = new Intl.DateTimeFormat('en-GB', { month: 'short', year: '2-digit' });
  const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const samples = [
    ['Soho House', 'Dinner with friends', 86.50, 'Restaurants & Dining', 'Dinner', 'Credit card', 2],
    ['Northstar Coffee', 'Coffee and pastry', 9.80, 'Drinks & Bars', 'Coffee', 'Debit card', 3],
    ['Morrisons', 'Weekly food shop', 64.27, 'Groceries', 'Food shop', 'Debit card', 5],
    ['TfL', 'Travel within London', 8.70, 'Transport', 'Commute', 'Debit card', 6],
    ['The Everyman', 'Cinema tickets', 28.00, 'Entertainment', 'Cinema', 'Credit card', 8],
    ['Spotify', 'Premium subscription', 11.99, 'Subscriptions', 'Music', 'Direct debit', 9],
    ['John Lewis', 'Home and personal items', 73.00, 'Shopping', 'Home', 'Credit card', 11],
    ['Soho House', 'Drinks after work', 42.00, 'Drinks & Bars', 'Drinks', 'Credit card', 12],
    ['Octopus Energy', 'Monthly energy bill', 92.00, 'Housing & Bills', 'Electricity', 'Direct debit', 14],
    ['PureGym', 'Monthly membership', 29.99, 'Fitness & Health', 'Membership', 'Direct debit', 15],
    ['Dishoom', 'Lunch', 24.50, 'Restaurants & Dining', 'Lunch', 'Debit card', 17],
    ['National Rail', 'Weekend train to Brighton', 38.40, 'Travel & Holidays', 'Rail', 'Debit card', 19],
    ['Sainsbury’s', 'Groceries top-up', 27.85, 'Groceries', 'Food shop', 'Debit card', 21],
    ['H&M', 'Clothing', 48.00, 'Shopping', 'Clothing', 'Credit card', 23],
    ['Salary', 'Monthly salary', 3250.00, 'Other', 'Income', 'Bank transfer', 25, 'income'],
    ['Waterstones', 'Book', 16.99, 'Entertainment', 'Books', 'Debit card', 27],
    ['Pret A Manger', 'Breakfast on the way in', 7.45, 'Restaurants & Dining', 'Breakfast', 'Debit card', 28]
  ];

  function buildDemoData() {
    const transactions = [];
    for (let offset = 5; offset >= 0; offset -= 1) {
      const base = new Date(monthStart.getFullYear(), monthStart.getMonth() - offset, 1);
      samples.forEach((sample, index) => {
        // The sample template includes 17 entries; omit a few entries each month
        // so the history feels naturally varied while remaining deterministic.
        if (offset > 0 && ((index * 3 + offset) % 7 === 0)) return;
        const day = Math.min(sample[6], new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate());
        const date = new Date(base.getFullYear(), base.getMonth(), day);
        let amount = sample[2];
        if (sample[7] !== 'income') amount = Math.round(amount * (0.88 + ((index + offset * 2) % 7) * 0.045) * 100) / 100;
        transactions.push({
          id: `demo-${offset}-${index}`,
          date: toISODate(date), merchant: sample[0], description: sample[1], amount,
          category: sample[3], tag: sample[4], payment: sample[5], type: sample[7] || 'expense', demo: true
        });
      });
    }
    return { version: 1, transactions, budgets: { overall: OVERALL_BUDGET, categories: CATEGORY_BUDGETS }, demoData: true };
  }

  function toISODate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  function monthKey(value) { return value.slice(0, 7); }
  function parseDate(value) { return new Date(`${value}T12:00:00`); }
  function escapeHtml(value) { return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  let storageAvailable = true;
  let data;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    data = stored ? JSON.parse(stored) : buildDemoData();
    if (!data || data.version !== 1 || !Array.isArray(data.transactions)) throw new Error('Saved data did not have the expected format.');
    if (!stored) localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    storageAvailable = false;
    data = buildDemoData();
    console.warn('Ledger could not use browser storage; showing the demo data for this session.', error);
  }

  if (!data.budgets || typeof data.budgets !== 'object') data.budgets = { overall: OVERALL_BUDGET, categories: { ...CATEGORY_BUDGETS } };
  const storedCategoryBudgets = data.budgets.categories && typeof data.budgets.categories === 'object' ? data.budgets.categories : {};
  data.budgets.overall = Number.isFinite(Number(data.budgets.overall)) && Number(data.budgets.overall) >= 0 ? Number(data.budgets.overall) : OVERALL_BUDGET;
  data.budgets.categories = Object.fromEntries(CATEGORIES.map(category => {
    const amount = Number(storedCategoryBudgets[category]);
    return [category, Number.isFinite(amount) && amount >= 0 ? amount : CATEGORY_BUDGETS[category]];
  }));

  // Keep fictional records in the current month from appearing in the future.
  // Edited records have demo=false and are deliberately left untouched.
  let demoDatesAdjusted = false;
  const currentMonthKey = toISODate(monthStart).slice(0, 7);
  const todayKey = toISODate(now);
  data.transactions.forEach((transaction, index) => {
    if (transaction.demo === true && monthKey(transaction.date) === currentMonthKey && transaction.date > todayKey) {
      const day = (index % now.getDate()) + 1;
      transaction.date = toISODate(new Date(now.getFullYear(), now.getMonth(), day));
      demoDatesAdjusted = true;
    }
  });
  if (demoDatesAdjusted && storageAvailable) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      storageAvailable = false;
      console.warn('Ledger could not save adjusted demo dates; using them for this session.', error);
    }
  }

  const $ = (id) => document.getElementById(id);
  const monthSelect = $('monthSelect');

  function setMonthOptions() {
    const keys = [...new Set(data.transactions.map(t => monthKey(t.date)))].sort().reverse();
    monthSelect.innerHTML = keys.map(key => {
      const date = parseDate(`${key}-01`);
      return `<option value="${key}">${monthFormat.format(date)}</option>`;
    }).join('');
    monthSelect.value = keys.includes(toISODate(monthStart).slice(0, 7)) ? toISODate(monthStart).slice(0, 7) : keys[0];
  }

  function getMonthTransactions(key) { return data.transactions.filter(t => monthKey(t.date) === key); }
  function getExpenses(items) { return items.filter(t => t.type === 'expense'); }
  function sum(items) { return items.reduce((total, t) => total + Number(t.amount), 0); }
  function renderSummary(key) {
    const selected = getMonthTransactions(key);
    const expenses = getExpenses(selected);
    const total = sum(expenses);
    const selectedMonth = parseDate(`${key}-01`);
    const previousMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1, 1);
    const previousKey = toISODate(previousMonth).slice(0, 7);
    const previous = sum(getExpenses(getMonthTransactions(previousKey)));
    const delta = previous ? ((total - previous) / previous) * 100 : 0;
    $('monthlySpend').textContent = money.format(total);
    $('transactionCount').textContent = String(selected.length);
    $('averageAmount').textContent = money.format(expenses.length ? total / expenses.length : 0);
    $('budgetAmount').textContent = money.format(data.budgets.overall);
    const budgetLeft = data.budgets.overall - total;
    $('budgetRemaining').textContent = budgetLeft >= 0 ? `${money.format(budgetLeft)} remaining` : `${money.format(Math.abs(budgetLeft))} over budget`;
    $('budgetProgress').style.width = `${Math.min(100, data.budgets.overall ? (total / data.budgets.overall) * 100 : 0)}%`;
    $('budgetProgress').classList.toggle('over-budget', total > data.budgets.overall);
    $('budgetRemaining').classList.toggle('over-budget-text', total > data.budgets.overall);
    const change = $('spendChange');
    change.textContent = previous ? `${delta > 0 ? '↑' : delta < 0 ? '↓' : '•'} ${Math.abs(delta).toFixed(1)}%` : 'First month';
    change.classList.toggle('down', delta > 0);
  }

  function renderTrend(key) {
    const chart = $('trendChart');
    const series = Array.from({ length: 6 }, (_, i) => {
      const date = new Date(parseDate(`${key}-01`).getFullYear(), parseDate(`${key}-01`).getMonth() - 5 + i, 1);
      const k = toISODate(date).slice(0, 7);
      return { key: k, label: shortMonthFormat.format(date), total: sum(getExpenses(getMonthTransactions(k))) };
    });
    const max = Math.max(data.budgets.overall, ...series.map(x => x.total), 500);
    const w = 600, h = 196, left = 42, right = 12, top = 12, bottom = 25;
    const plotW = w - left - right, plotH = h - top - bottom;
    const ticks = [0, .25, .5, .75, 1];
    const grid = ticks.map(t => {
      const y = top + plotH * (1 - t);
      return `<line class="grid-line" x1="${left}" x2="${w - right}" y1="${y}" y2="${y}"/><text class="axis-label" x="0" y="${y + 3}">${Math.round(max * t / 100) * 100}</text>`;
    }).join('');
    const budgetY = top + plotH * (1 - Math.min(1, data.budgets.overall / max));
    const bars = series.map((item, i) => {
      const barW = 37, gap = (plotW - series.length * barW) / (series.length * 2);
      const x = left + gap + i * (barW + gap * 2);
      const barH = Math.max(2, plotH * item.total / max);
      const y = top + plotH - barH;
      const selected = item.key === key ? ' selected' : '';
      return `<rect class="trend-bar${selected}" x="${x}" y="${y}" width="${barW}" height="${barH}" rx="5"><title>${escapeHtml(item.label)}: ${money.format(item.total)}</title></rect><text class="axis-label" text-anchor="middle" x="${x + barW / 2}" y="${h - 5}">${escapeHtml(item.label)}</text>`;
    }).join('');
    chart.innerHTML = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">${grid}<line class="budget-line" x1="${left}" x2="${w - right}" y1="${budgetY}" y2="${budgetY}"/>${bars}</svg>`;
  }

  function renderCategories(key) {
    const expenses = getExpenses(getMonthTransactions(key));
    const totals = new Map();
    expenses.forEach(t => totals.set(t.category, (totals.get(t.category) || 0) + Number(t.amount)));
    const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
    const total = sum(expenses);
    $('donutTotal').textContent = money.format(total);
    let cursor = 0;
    const stops = sorted.map(([_, amount], i) => {
      const start = cursor;
      cursor += total ? amount / total * 100 : 0;
      return `${CATEGORY_COLORS[i % CATEGORY_COLORS.length]} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`;
    });
    $('categoryDonut').style.background = stops.length ? `conic-gradient(${stops.join(',')})` : '#edf1ee';
    $('categoryLegend').innerHTML = sorted.slice(0, 6).map(([name, amount], i) => `<div class="legend-row"><i class="legend-swatch" style="background:${CATEGORY_COLORS[i % CATEGORY_COLORS.length]}"></i><span class="legend-name">${escapeHtml(name)}</span><span class="legend-value">${money.format(amount)}</span></div>`).join('') || '<p class="empty-message">No expenses for this month.</p>';
  }

  function initials(name) { return name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase(); }
  const merchantColors = ['#e9f2ec', '#f4eee9', '#eef0f7', '#f6f1e5', '#e9f1f2', '#f2ebf4'];
  function renderTransactions(key) {
    const selected = getMonthTransactions(key);
    const recent = [...selected].sort((a, b) => b.date.localeCompare(a.date));
    const expenses = getExpenses(selected);
    $('recentTransactions').innerHTML = recent.slice(0, 6).map((t, i) => `<div class="transaction-row"><div class="merchant-wrap"><span class="merchant-logo" style="background:${merchantColors[i % merchantColors.length]};color:#557265">${escapeHtml(initials(t.merchant))}</span><div class="merchant-info"><strong>${escapeHtml(t.merchant)}</strong><small>${escapeHtml(t.description)}</small></div></div><span class="row-category">${escapeHtml(t.category)}</span><span class="row-amount ${t.type === 'income' ? 'income' : ''}">${t.type === 'income' ? '+' : '−'}${money.format(t.amount)}</span></div>`).join('') || '<p class="empty-message">No transactions for this month.</p>';
    $('largestTransactions').innerHTML = [...expenses].sort((a, b) => b.amount - a.amount).slice(0, 4).map((t, i) => `<div class="largest-row"><div class="largest-left"><span class="rank">0${i + 1}</span><div><strong>${escapeHtml(t.merchant)}</strong><small>${escapeHtml(t.tag)} · ${dateFormat.format(parseDate(t.date))}</small></div></div><span class="largest-amount">${money.format(t.amount)}</span></div>`).join('') || '<p class="empty-message">No expenses for this month.</p>';
  }

  function render() {
    const key = monthSelect.value;
    if (!key) return;
    renderSummary(key);
    renderTrend(key);
    renderCategories(key);
    renderTransactions(key);
  }

  function setBudgetMonthOptions() {
    const keys = [...new Set([...data.transactions.map(t => monthKey(t.date)), toISODate(monthStart).slice(0, 7)])].sort().reverse();
    $('budgetMonthSelect').innerHTML = keys.map(key => `<option value="${key}">${monthFormat.format(parseDate(`${key}-01`))}</option>`).join('');
    $('budgetMonthSelect').value = keys.includes(toISODate(monthStart).slice(0, 7)) ? toISODate(monthStart).slice(0, 7) : keys[0];
  }

  function renderBudgets() {
    const key = $('budgetMonthSelect').value;
    const expenses = getExpenses(getMonthTransactions(key));
    const totalSpent = sum(expenses);
    const overall = Number(data.budgets.overall) || 0;
    const remaining = overall - totalSpent;
    const percent = overall > 0 ? totalSpent / overall * 100 : 0;
    const byCategory = new Map();
    expenses.forEach(t => byCategory.set(t.category, (byCategory.get(t.category) || 0) + Number(t.amount)));
    $('budgetPageLimit').textContent = money.format(overall);
    $('budgetPageSpent').textContent = money.format(totalSpent);
    $('budgetPageCount').textContent = `${expenses.length} ${expenses.length === 1 ? 'expense' : 'expenses'} in ${monthFormat.format(parseDate(`${key}-01`))}`;
    $('budgetPageRemaining').textContent = money.format(Math.abs(remaining));
    $('budgetPageRemaining').classList.toggle('over-budget-text', remaining < 0);
    $('budgetPageStatus').textContent = remaining < 0 ? `${money.format(Math.abs(remaining))} over your overall limit` : 'Available within your overall limit';
    $('budgetPagePercent').textContent = `${percent.toFixed(0)}%${percent > 100 ? ' · over limit' : ''}`;
    $('budgetPagePercent').classList.toggle('over-budget-text', percent > 100);
    $('overallBudgetProgress').style.width = `${Math.min(100, percent)}%`;
    $('overallBudgetProgress').classList.toggle('over-budget', percent > 100);
    $('categoryBudgetRows').innerHTML = CATEGORIES.map((category, index) => {
      const spent = byCategory.get(category) || 0;
      const limit = Number(data.budgets.categories[category]) || 0;
      const ratio = limit > 0 ? spent / limit * 100 : 0;
      const exceeded = limit > 0 && spent > limit;
      const left = limit - spent;
      const status = limit === 0 ? 'No limit set' : exceeded ? `${money.format(Math.abs(left))} over limit` : `${money.format(left)} remaining`;
      return `<article class="category-budget-row${exceeded ? ' exceeded' : ''}"><span class="category-budget-swatch" style="background:${CATEGORY_COLORS[index % CATEGORY_COLORS.length]}"></span><div class="category-budget-name"><strong>${escapeHtml(category)}</strong><small>${money.format(spent)} spent${limit > 0 ? ` of ${money.format(limit)}` : ''}</small></div><div class="category-budget-progress"><div class="budget-progress-track"><i class="${exceeded ? 'over-budget' : ''}" style="width:${Math.min(100, ratio).toFixed(1)}%;background:${exceeded ? '' : CATEGORY_COLORS[index % CATEGORY_COLORS.length]}"></i></div><small>${limit > 0 ? `${ratio.toFixed(0)}% used` : 'No limit'}</small></div><div class="category-budget-status${exceeded ? ' over-budget-text' : ''}"><strong>${status}</strong><small>${limit === 0 ? 'Set a monthly limit' : exceeded ? 'Please review this category' : 'Monthly category limit'}</small></div></article>`;
    }).join('');
  }

  function openBudgetDialog() {
    $('budgetFormError').textContent = '';
    $('overallBudgetInput').value = Number(data.budgets.overall).toFixed(2);
    $('categoryBudgetInputs').innerHTML = CATEGORIES.map(category => `<label class="budget-input-row"><span>${escapeHtml(category)}</span><span class="budget-input-wrap"><b>£</b><input type="number" min="0" step="0.01" data-category-budget="${escapeHtml(category)}" value="${Number(data.budgets.categories[category] || 0).toFixed(2)}" aria-label="${escapeHtml(category)} monthly budget"></span></label>`).join('');
    $('budgetDialog').showModal();
  }

  function reportMonthKeys() {
    const range = $('reportRange').value;
    const category = $('reportCategoryFilter').value;
    const matching = data.transactions.filter(t => t.type === 'expense' && (!category || t.category === category));
    if (range === 'all') {
      if (!matching.length) return [];
      const keys = matching.map(t => monthKey(t.date)).sort();
      const first = parseDate(`${keys[0]}-01`);
      const last = parseDate(`${keys[keys.length - 1]}-01`);
      const months = [];
      for (let cursor = new Date(first.getFullYear(), first.getMonth(), 1); cursor <= last; cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)) {
        months.push(toISODate(cursor).slice(0, 7));
      }
      return months;
    }
    const count = Number(range);
    return Array.from({ length: count }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - count + index + 1, 1);
      return toISODate(date).slice(0, 7);
    });
  }

  function reportExpenses(key, category = $('reportCategoryFilter').value) {
    return data.transactions.filter(t => t.type === 'expense' && monthKey(t.date) === key && (!category || t.category === category));
  }

  function changeLabel(current, previous) {
    if (!previous) return current ? 'New' : '—';
    const delta = ((current - previous) / previous) * 100;
    return `${delta > 0 ? '↑' : delta < 0 ? '↓' : '•'} ${Math.abs(delta).toFixed(1)}%`;
  }

  function renderReportTrend(months, selectedMonth, totals) {
    const container = $('reportTrendChart');
    if (!months.length) {
      container.innerHTML = '<p class="report-empty">There is no spending in this date range.</p>';
      return;
    }
    const max = Math.max(500, ...months.map(key => totals.get(key) || 0));
    const w = Math.max(540, months.length * 70 + 54), h = 225;
    const left = 50, right = 12, top = 16, bottom = 31;
    const plotH = h - top - bottom;
    const plotW = w - left - right;
    const grid = [0, .25, .5, .75, 1].map(tick => {
      const y = top + plotH * (1 - tick);
      return `<line class="report-grid-line" x1="${left}" x2="${w - right}" y1="${y}" y2="${y}"/><text class="report-axis-label" x="0" y="${y + 3}">${escapeHtml(money.format(max * tick).replace(/\.00$/, ''))}</text>`;
    }).join('');
    const groupW = plotW / months.length;
    const barW = Math.min(40, groupW * .58);
    const bars = months.map((key, index) => {
      const amount = totals.get(key) || 0;
      const barH = amount ? Math.max(3, plotH * amount / max) : 2;
      const x = left + index * groupW + (groupW - barW) / 2;
      const y = top + plotH - barH;
      const date = parseDate(`${key}-01`);
      const label = months.length > 12 ? compactMonthYearFormat.format(date) : shortMonthFormat.format(date);
      return `<rect class="report-bar${key === selectedMonth ? ' selected' : ''}" x="${x}" y="${y}" width="${barW}" height="${barH}" rx="5" tabindex="0" role="button" data-report-month="${key}" aria-label="${escapeHtml(monthFormat.format(date))}: ${money.format(amount)}"><title>${escapeHtml(monthFormat.format(date))}: ${money.format(amount)}</title></rect><text class="report-axis-label" text-anchor="middle" x="${x + barW / 2}" y="${h - 7}">${escapeHtml(label)}</text>`;
    }).join('');
    container.innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="Monthly spending bar chart">${grid}${bars}</svg>`;
  }

  function renderReportCategories(categoryTotals, total) {
    const rows = [...categoryTotals.entries()].filter(([, amount]) => amount > 0).sort((a, b) => b[1] - a[1]);
    $('reportCategoryChart').innerHTML = rows.length ? rows.map(([category, amount], index) => {
      const share = total ? amount / total * 100 : 0;
      return `<button class="report-category-row${$('reportCategoryFilter').value === category ? ' selected' : ''}" data-report-category="${escapeHtml(category)}" aria-label="Filter reports to ${escapeHtml(category)}: ${money.format(amount)}, ${share.toFixed(1)} percent"><span class="report-category-top"><strong>${escapeHtml(category)}</strong><span>${money.format(amount)}</span></span><span class="report-category-track"><i style="width:${share.toFixed(1)}%;background:${CATEGORY_COLORS[index % CATEGORY_COLORS.length]}"></i></span><small>${share.toFixed(1)}% of spending</small></button>`;
    }).join('') : '<p class="report-empty">No category spending for this date range.</p>';
  }

  function renderReportMerchants(expenses, total) {
    const merchants = new Map();
    expenses.forEach(t => {
      const record = merchants.get(t.merchant) || { amount: 0, tags: new Set(), count: 0 };
      record.amount += Number(t.amount);
      record.count += 1;
      if (t.tag) record.tags.add(t.tag);
      merchants.set(t.merchant, record);
    });
    const rows = [...merchants.entries()].sort((a, b) => b[1].amount - a[1].amount).slice(0, 6);
    $('reportMerchantList').innerHTML = rows.length ? rows.map(([merchant, record], index) => {
      const tags = [...record.tags].slice(0, 3).join(', ') || 'No tags';
      const share = total ? record.amount / total * 100 : 0;
      return `<div class="report-merchant-row"><span class="report-rank">0${index + 1}</span><span class="report-merchant-name"><strong>${escapeHtml(merchant)}</strong><small>${record.count} ${record.count === 1 ? 'transaction' : 'transactions'} · ${escapeHtml(tags)}</small></span><span class="report-merchant-amount"><strong>${money.format(record.amount)}</strong><small>${share.toFixed(1)}%</small></span></div>`;
    }).join('') : '<p class="report-empty">No merchant spending for this date range.</p>';
  }

  function renderReportComparison(months, totals) {
    const rows = [...months].reverse();
    $('reportComparison').innerHTML = rows.length ? rows.map(key => {
      const date = parseDate(`${key}-01`);
      const previous = new Date(date.getFullYear(), date.getMonth() - 1, 1);
      const previousKey = toISODate(previous).slice(0, 7);
      const amount = totals.get(key) || 0;
      const previousAmount = sum(reportExpenses(previousKey));
      const change = previousAmount ? changeLabel(amount, previousAmount) : (amount ? 'New' : '—');
      const delta = previousAmount ? amount - previousAmount : 0;
      const className = delta > 0 ? 'increase' : delta < 0 ? 'decrease' : '';
      return `<tr><td>${escapeHtml(monthFormat.format(date))}</td><td>${money.format(amount)}</td><td class="${className}">${escapeHtml(change)}</td></tr>`;
    }).join('') : '<tr><td colspan="3" class="report-empty-cell">No months to compare.</td></tr>';
  }

  function renderReports() {
    const months = reportMonthKeys();
    const totals = new Map(months.map(key => [key, sum(reportExpenses(key))]));
    const expenses = months.flatMap(key => reportExpenses(key));
    const total = sum(expenses);
    const categoryTotals = new Map();
    expenses.forEach(t => categoryTotals.set(t.category, (categoryTotals.get(t.category) || 0) + Number(t.amount)));
    const categoryRows = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1]);
    const topCategory = categoryRows[0];
    $('reportTotal').textContent = money.format(total);
    $('reportAverage').textContent = money.format(expenses.length ? total / expenses.length : 0);
    $('reportTransactionCount').textContent = `${expenses.length} ${expenses.length === 1 ? 'expense' : 'expenses'}`;
    $('reportTopCategory').textContent = topCategory ? topCategory[0] : '—';
    $('reportTopCategoryAmount').textContent = topCategory ? money.format(topCategory[1]) : 'No spending recorded';
    if (months.length) {
      const first = parseDate(`${months[0]}-01`);
      const last = parseDate(`${months[months.length - 1]}-01`);
      $('reportPeriod').textContent = months.length === 1 ? monthFormat.format(first) : `${shortMonthFormat.format(first)} – ${monthFormat.format(last)}`;
    } else {
      $('reportPeriod').textContent = 'No transactions in this range';
    }
    const previousSelection = months.length ? months[months.length - 1] : '';
    if (!months.includes(selectedReportMonth)) selectedReportMonth = previousSelection;
    const pickedMonth = selectedReportMonth;
    const pickedTotal = pickedMonth ? (totals.get(pickedMonth) || 0) : 0;
    const pickedDate = pickedMonth ? parseDate(`${pickedMonth}-01`) : null;
    const pickedPreviousKey = pickedDate ? toISODate(new Date(pickedDate.getFullYear(), pickedDate.getMonth() - 1, 1)).slice(0, 7) : '';
    const pickedPreviousTotal = pickedPreviousKey ? sum(reportExpenses(pickedPreviousKey)) : 0;
    $('reportMonthChange').textContent = pickedMonth ? changeLabel(pickedTotal, pickedPreviousTotal) : '—';
    $('reportMonthChange').className = `report-change${pickedPreviousTotal && pickedTotal > pickedPreviousTotal ? ' increase' : pickedPreviousTotal && pickedTotal < pickedPreviousTotal ? ' decrease' : ''}`;
    $('reportMonthChangeNote').textContent = pickedMonth ? `${monthFormat.format(pickedDate)} vs previous month` : 'No month selected';
    $('reportMonthDetail').textContent = pickedMonth ? `${monthFormat.format(pickedDate)} · ${money.format(pickedTotal)} across ${reportExpenses(pickedMonth).length} expenses` : 'Select a month in the chart to see its total.';
    renderReportTrend(months, pickedMonth, totals);
    renderReportCategories(categoryTotals, total);
    renderReportMerchants(expenses, total);
    renderReportComparison(months, totals);
  }

  const transactionDialog = $('transactionDialog');
  const transactionForm = $('transactionForm');
  const filterCategory = $('categoryFilter');
  const sortSelect = $('sortSelect');
  let selectedReportMonth = '';
  let toastTimer;

  function showToast(message) {
    const toast = $('toast');
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 2500);
  }

  function persistData() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (error) {
      storageAvailable = false;
      const localStatus = document.querySelector('.local-badge');
      if (localStatus) {
        localStatus.textContent = '◉  Session only';
        localStatus.title = 'Browser storage is unavailable; changes will be lost when this tab closes.';
      }
      console.warn('Ledger could not save changes to browser storage.', error);
      return false;
    }
  }

  function updateDemoLabel() {
    const badge = document.querySelector('.demo-badge');
    if (!badge) return;
    badge.innerHTML = data.demoData ? '<i></i> DEMO DATA' : '<i></i> DEMO + LOCAL CHANGES';
    badge.title = data.demoData ? 'Fictional demonstration transactions' : 'Fictional demo records and your local changes';
  }

  function populateCategoryOptions() {
    const options = CATEGORIES.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('');
    $('formCategory').innerHTML = options;
    filterCategory.insertAdjacentHTML('beforeend', options);
    $('reportCategoryFilter').insertAdjacentHTML('beforeend', options);
  }

  function openTransactionDialog(transaction) {
    $('formError').textContent = '';
    $('dialogTitle').textContent = transaction ? 'Edit transaction' : 'Add transaction';
    $('formId').value = transaction ? transaction.id : '';
    $('formType').value = transaction ? transaction.type : 'expense';
    $('formAmount').value = transaction ? Number(transaction.amount).toFixed(2) : '';
    $('formDate').value = transaction ? transaction.date : toISODate(new Date());
    $('formMerchant').value = transaction ? transaction.merchant : '';
    $('formCategory').value = transaction ? transaction.category : CATEGORIES[0];
    $('formTag').value = transaction ? transaction.tag || '' : '';
    $('formPayment').value = transaction ? transaction.payment || 'Debit card' : 'Debit card';
    $('formDescription').value = transaction ? transaction.description || '' : '';
    transactionDialog.showModal();
    $('formMerchant').focus();
  }

  function visibleTransactions() {
    const query = $('searchInput').value.trim().toLocaleLowerCase('en-GB');
    const category = filterCategory.value;
    const type = $('typeFilter').value;
    const from = $('dateFrom').value;
    const to = $('dateTo').value;
    let rows = data.transactions.filter(t => {
      const text = `${t.merchant} ${t.description || ''} ${t.tag || ''}`.toLocaleLowerCase('en-GB');
      return (!query || text.includes(query)) && (!category || t.category === category) && (!type || t.type === type) && (!from || t.date >= from) && (!to || t.date <= to);
    });
    const sorting = sortSelect.value;
    rows.sort((a, b) => {
      if (sorting === 'date-asc') return a.date.localeCompare(b.date) || a.merchant.localeCompare(b.merchant);
      if (sorting === 'amount-desc') return Number(b.amount) - Number(a.amount) || b.date.localeCompare(a.date);
      if (sorting === 'amount-asc') return Number(a.amount) - Number(b.amount) || b.date.localeCompare(a.date);
      if (sorting === 'merchant-asc') return a.merchant.localeCompare(b.merchant, 'en-GB') || a.date.localeCompare(b.date);
      return b.date.localeCompare(a.date) || b.merchant.localeCompare(a.merchant);
    });
    return rows;
  }

  function renderTransactionTable() {
    const rows = visibleTransactions();
    $('transactionRows').innerHTML = rows.map(t => `<tr>
      <td>${dateFormat.format(parseDate(t.date))}</td>
      <td><span class="table-merchant">${escapeHtml(t.merchant)}</span><span class="table-description">${escapeHtml(t.description || '—')}</span></td>
      <td class="category-cell"><strong>${escapeHtml(t.category)}</strong><small>${escapeHtml(t.tag || 'No tag')}</small></td>
      <td>${escapeHtml(t.payment || 'Other')}</td>
      <td><span class="type-pill ${t.type === 'income' ? 'income' : ''}">${t.type === 'income' ? 'Income' : 'Expense'}</span></td>
      <td class="amount-cell ${t.type === 'income' ? 'income' : ''}">${t.type === 'income' ? '+' : '−'}${money.format(t.amount)}</td>
      <td><div class="row-actions"><button class="row-action" data-action="edit" data-id="${escapeHtml(t.id)}" aria-label="Edit ${escapeHtml(t.merchant)}">Edit</button><button class="row-action delete" data-action="delete" data-id="${escapeHtml(t.id)}" aria-label="Delete ${escapeHtml(t.merchant)}">Delete</button></div></td>
    </tr>`).join('') || '<tr><td class="empty-table" colspan="7">No transactions match these filters.</td></tr>';
    $('resultCount').textContent = `${rows.length} ${rows.length === 1 ? 'transaction' : 'transactions'}`;
  }

  function refreshAfterChange(selectedDate) {
    data.demoData = false;
    updateDemoLabel();
    const saved = persistData();
    setMonthOptions();
    if (selectedDate) monthSelect.value = monthKey(selectedDate);
    render();
    renderTransactionTable();
    if (!$('budgetsPage').hidden) renderBudgets();
    showToast(saved ? 'Transaction saved' : 'Saved for this tab only');
  }

  document.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => {
    const page = button.dataset.page;
    $('dashboard').hidden = page !== 'dashboard';
    $('transactionsPage').hidden = page !== 'transactions';
    $('budgetsPage').hidden = page !== 'budgets';
    $('reportsPage').hidden = page !== 'reports';
    document.querySelectorAll('[data-page]').forEach(item => item.classList.toggle('active', item === button));
    document.querySelector('.crumb strong').textContent = page === 'transactions' ? 'Transactions' : page === 'reports' ? 'Reports' : page === 'budgets' ? 'Budgets' : 'Overview';
    if (page === 'transactions') renderTransactionTable();
    if (page === 'budgets') renderBudgets();
    if (page === 'reports') renderReports();
    window.scrollTo({ top: 0 });
  }));

  $('addTransaction').addEventListener('click', () => openTransactionDialog(null));
  $('addFromDashboard').addEventListener('click', () => openTransactionDialog(null));
  document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => transactionDialog.close()));
  transactionDialog.addEventListener('click', event => { if (event.target === transactionDialog) transactionDialog.close(); });

  transactionForm.addEventListener('submit', event => {
    event.preventDefault();
    const amount = Number($('formAmount').value);
    const date = $('formDate').value;
    const merchant = $('formMerchant').value.trim();
    if (!Number.isFinite(amount) || amount <= 0 || !date || Number.isNaN(parseDate(date).getTime()) || !merchant) {
      $('formError').textContent = 'Enter a valid date, merchant, and amount greater than £0.';
      return;
    }
    const id = $('formId').value;
    const existing = id ? data.transactions.find(t => t.id === id) : null;
    const transaction = {
      id: id || (globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : `local-${Date.now()}-${Math.random().toString(16).slice(2)}`),
      date, merchant, description: $('formDescription').value.trim(), amount: Math.round(amount * 100) / 100,
      category: $('formCategory').value, tag: $('formTag').value.trim(), payment: $('formPayment').value,
      type: $('formType').value, demo: false
    };
    if (existing) Object.assign(existing, transaction);
    else data.transactions.push(transaction);
    transactionDialog.close();
    refreshAfterChange(date);
  });

  $('transactionRows').addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const transaction = data.transactions.find(t => t.id === button.dataset.id);
    if (!transaction) return;
    if (button.dataset.action === 'edit') openTransactionDialog(transaction);
    if (button.dataset.action === 'delete' && window.confirm(`Delete the transaction “${transaction.merchant}” for ${money.format(transaction.amount)}?`)) {
      data.transactions = data.transactions.filter(t => t.id !== transaction.id);
      refreshAfterChange();
    }
  });

  ['searchInput', 'categoryFilter', 'typeFilter', 'dateFrom', 'dateTo', 'sortSelect'].forEach(id => {
    $(id).addEventListener(id === 'searchInput' ? 'input' : 'change', renderTransactionTable);
  });
  $('clearFilters').addEventListener('click', () => {
    $('searchInput').value = '';
    filterCategory.value = '';
    $('typeFilter').value = '';
    $('dateFrom').value = '';
    $('dateTo').value = '';
    sortSelect.value = 'date-desc';
    renderTransactionTable();
  });
  document.querySelector('[data-sort="date"]').addEventListener('click', () => {
    sortSelect.value = sortSelect.value === 'date-asc' ? 'date-desc' : 'date-asc';
    renderTransactionTable();
  });
  $('reportRange').addEventListener('change', renderReports);
  $('reportCategoryFilter').addEventListener('change', renderReports);
  $('reportTrendChart').addEventListener('click', event => {
    const bar = event.target.closest('[data-report-month]');
    if (!bar) return;
    selectedReportMonth = bar.dataset.reportMonth;
    renderReports();
    $('reportTrendChart').querySelector(`[data-report-month="${selectedReportMonth}"]`)?.focus();
  });
  $('reportTrendChart').addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-report-month]')) {
      event.preventDefault();
      selectedReportMonth = event.target.dataset.reportMonth;
      renderReports();
      $('reportTrendChart').querySelector(`[data-report-month="${selectedReportMonth}"]`)?.focus();
    }
  });
  $('reportCategoryChart').addEventListener('click', event => {
    const categoryButton = event.target.closest('[data-report-category]');
    if (!categoryButton) return;
    const current = $('reportCategoryFilter').value;
    $('reportCategoryFilter').value = current === categoryButton.dataset.reportCategory ? '' : categoryButton.dataset.reportCategory;
    renderReports();
    [...$('reportCategoryChart').querySelectorAll('[data-report-category]')].find(item => item.dataset.reportCategory === categoryButton.dataset.reportCategory)?.focus();
  });
  $('budgetMonthSelect').addEventListener('change', renderBudgets);
  $('editBudgets').addEventListener('click', openBudgetDialog);
  document.querySelectorAll('[data-close-budget-dialog]').forEach(button => button.addEventListener('click', () => $('budgetDialog').close()));
  $('budgetForm').addEventListener('submit', event => {
    event.preventDefault();
    const overall = Number($('overallBudgetInput').value);
    const inputs = [...$('categoryBudgetInputs').querySelectorAll('[data-category-budget]')];
    const categoryBudgets = Object.fromEntries(inputs.map(input => [input.dataset.categoryBudget, Number(input.value)]));
    if (!Number.isFinite(overall) || overall <= 0 || inputs.some(input => !Number.isFinite(categoryBudgets[input.dataset.categoryBudget]) || categoryBudgets[input.dataset.categoryBudget] < 0)) {
      $('budgetFormError').textContent = 'Enter an overall limit greater than £0 and category limits of £0 or more.';
      return;
    }
    data.budgets = { overall, categories: categoryBudgets };
    data.demoData = false;
    updateDemoLabel();
    const saved = persistData();
    $('budgetDialog').close();
    renderBudgets();
    render();
    showToast(saved ? 'Budget limits saved' : 'Saved for this tab only');
  });
  populateCategoryOptions();
  updateDemoLabel();

  setMonthOptions();
  setBudgetMonthOptions();
  monthSelect.addEventListener('change', render);
  if (!storageAvailable) {
    document.querySelector('.local-badge').textContent = '◉  Session only';
    document.querySelector('.local-badge').title = 'Browser storage is unavailable; demo data will reset when this tab closes.';
  }
  render();
})();
