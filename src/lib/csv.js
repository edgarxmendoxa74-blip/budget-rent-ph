// Small CSV export helper (Excel-friendly: UTF-8 BOM + CRLF, formula-injection safe)

const escapeCell = (value) => {
  if (value === null || value === undefined) return '';
  let str = Array.isArray(value) ? value.join('; ') : String(value);
  // Neutralise spreadsheet formulas in user-supplied text
  if (/^[=+\-@\t\r]/.test(str) && Number.isNaN(Number(str))) str = `'${str}`;
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

export const toCsv = (columns, rows) => {
  const header = columns.map(c => escapeCell(c.label)).join(',');
  const body = rows.map(row => columns.map(c => escapeCell(c.value(row))).join(','));
  return [header, ...body].join('\r\n');
};

export const downloadCsv = (filename, columns, rows) => {
  const blob = new Blob(['﻿' + toCsv(columns, rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

export const fmtDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
