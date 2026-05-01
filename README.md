# Gene Hit Explorer

Small pure-JavaScript dry-lab demo: a spreadsheet of gene results becomes an interactive web page.

The teaching idea is:

1. Keep the data in a spreadsheet.
2. Load that data in JavaScript.
3. Compute useful labels from the raw columns.
4. Render filters, counts, a table, a detail view, and a simple pathway summary.

## Files

- `data/gene_hits.csv` is the spreadsheet-style source data.
- `config.js` points the app at either local CSV data or a Google Sheets endpoint.
- `google-apps-script.js` is the endpoint code to paste into Google Apps Script.
- `index.html` is the page structure.
- `styles.css` is the visual design.
- `app.js` loads the data and builds the interface.

## Run Locally

Because the app uses `fetch`, open it through a local server instead of double-clicking `index.html`.

One simple option:

```bash
python -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

## Move The Data To Google Sheets

1. Create a new Google Sheet.
2. Copy the contents of `data/gene_hits.csv` into the sheet.
3. Keep the header row exactly the same:

```text
gene,condition,log2FoldChange,pValue,baseMean,pathway,description,notes
```

## Apps Script JSON Endpoint

In Google Sheets, go to `Extensions -> Apps Script` and paste this:

```javascript
function doGet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  const values = sheet.getDataRange().getValues();
  const headers = values.shift();

  const rows = values.map(function(row) {
    const item = {};

    headers.forEach(function(header, index) {
      item[header] = row[index];
    });

    return item;
  }).filter(function(item) {
    return item.gene;
  });

  return ContentService
    .createTextOutput(JSON.stringify(rows))
    .setMimeType(ContentService.MimeType.JSON);
}
```

Deploy it with:

1. `Deploy -> New deployment`
2. Type: `Web app`
3. Execute as: `Me`
4. Who has access: `Anyone`
5. Copy the web app URL

## Switch The App To Google Sheets

In `config.js`, replace:

```javascript
window.GENE_HIT_DATA_SOURCE = "data/gene_hits.csv";
```

with your Apps Script web app URL:

```javascript
window.GENE_HIT_DATA_SOURCE = "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec";
```

Now editing the Google Sheet changes what the website shows. The app auto-refreshes every 10 seconds, and the `Refresh data` button reloads it immediately.

The app can read both formats:

- Local CSV from `data/gene_hits.csv`
- JSON rows from the Apps Script endpoint

## Teaching Demo Flow

1. Start with the local CSV to explain the columns.
2. Move the CSV into Google Sheets.
3. Deploy the Apps Script endpoint.
4. Paste the endpoint URL into `config.js`.
5. Change a value in the Sheet, for example `IL6` `log2FoldChange`.
6. Watch the web app update the table, counts, selected gene chart, and pathway ranking.
