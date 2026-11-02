# Expense Tracker

This is a local personal finance dashboard built with plain HTML, CSS, and JavaScript. It starts with fictional **DEMO DATA** and does not connect to banks or send data to external services.

## Run it

1. Open this project folder in Finder.
2. Double-click `index.html` to open the app in your browser.

No installation, packages, server, or internet connection is required. The sample data is saved in the browser's local storage when available. If browser storage is unavailable, the app shows the sample data for that tab only.

## Current features

- Monthly spending, budget, transaction count, and average expense summaries.
- A six-month spending trend, category breakdown, recent activity, and largest expenses.
- A month selector to view historical sample data.
- Add, edit, and delete transactions. Deletion requires confirmation.
- Search by merchant, description, or tag; filter by category, type, and date range.
- Sort by date, amount, or merchant. Each transaction keeps its own category and tag, including when multiple transactions share a merchant.
- Interactive Reports with 3, 6, 12 month, or all-time ranges; category filters; monthly trend; category and merchant breakdowns; and month-on-month comparisons.
- Overall and per-category monthly budgets, with spending progress, remaining amounts, and over-limit indicators.
- Fictional transactions with UK merchants, GBP amounts, payment methods, categories, and tags.

Transactions and budget limits are saved in browser local storage when available. If storage is blocked, changes remain available for the current tab only. JSON backup/restore is planned for a later stage. All amounts use GBP (£), and dates use UK formatting.

## Try transaction management

1. Open **Transactions** in the left navigation and choose **Add transaction**.
2. Add a fictional transaction, then confirm it appears in the list and changes the dashboard totals for its month.
3. Use the search box, category/type filters, and date fields. Choose each sort order and check that the rows update.
4. Edit the new transaction and change its category or tag.
5. Choose **Delete** and cancel once to confirm the transaction stays. Choose it again and confirm to remove the transaction.
6. Refresh the page to check that saved changes remain in the browser.

The sample records are fictional. Avoid entering real financial account details; this app does not need them.

## Try reports

Open **Reports** in the left navigation. Change the date range and category filter to update all report summaries and charts. Select a month bar to inspect its monthly total, or select a category bar to filter the report. The comparison table shows each month against the previous month.

## Try budgets

Open **Budgets** in the left navigation, select a month, then choose **Edit budgets**. Change the overall limit or one or more category limits and save. Check the progress bars and remaining amounts; a category turns red when spending exceeds its limit. Set a category to £0 if you do not want a separate limit for it.
