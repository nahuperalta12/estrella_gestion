// Prefix text that spreadsheet applications could interpret as a formula.
export function csvCell(value:unknown):string {
  let text=value===null || value===undefined ? "" : String(value);
  if(typeof value==="string" && /^[\s\u0000-\u001f]*[=+\-@]/u.test(text)) text=`'${text}`;
  return `"${text.replace(/"/g,'""')}"`;
}
export function toCsv(headers:string[],rows:unknown[][]):string {
  return "\ufeff"+[headers,...rows].map(row=>row.map(csvCell).join(",")).join("\r\n")+"\r\n";
}
