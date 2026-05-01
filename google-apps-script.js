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
