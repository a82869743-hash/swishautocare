const XLSX = require('xlsx');

/**
 * Creates and sends an Excel file response.
 * @param {object} res - Express response object
 * @param {string} filename - Download filename (e.g. "report.xlsx")
 * @param {Array<{sheetName: string, data: Array<object>}>} sheetsData
 */
function createExcelResponse(res, filename, sheetsData) {
  const wb = XLSX.utils.book_new();

  for (const sheet of sheetsData) {
    const ws = XLSX.utils.json_to_sheet(sheet.data);

    // Auto-size columns
    const colWidths = [];
    if (sheet.data.length > 0) {
      const keys = Object.keys(sheet.data[0]);
      for (const key of keys) {
        let maxLen = key.length;
        for (const row of sheet.data) {
          const val = row[key] != null ? String(row[key]) : '';
          if (val.length > maxLen) maxLen = val.length;
        }
        colWidths.push({ wch: Math.min(maxLen + 2, 40) });
      }
      ws['!cols'] = colWidths;
    }

    XLSX.utils.book_append_sheet(wb, ws, sheet.sheetName.slice(0, 31));
  }

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}

module.exports = { createExcelResponse };
