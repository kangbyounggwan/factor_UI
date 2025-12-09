const fs = require('fs');
const data = JSON.parse(fs.readFileSync('c:/Users/USER/FACTOR HIBRID/FACTOR-HIBRID-r1.0/temp_schema.json', 'utf8'));
const definitions = data.definitions || {};

let output = '# Supabase Database Schema\n';
output += '# Generated: ' + new Date().toISOString().split('T')[0] + '\n';
output += '# Total Tables: ' + Object.keys(definitions).length + '\n\n';

const tables = Object.keys(definitions).sort();
tables.forEach((tableName, idx) => {
  const table = definitions[tableName];
  output += '## ' + (idx + 1) + '. ' + tableName + '\n';
  if (table.description) {
    output += '-- ' + table.description + '\n';
  }
  output += '\n';

  const props = table.properties || {};
  const required = table.required || [];

  Object.keys(props).forEach(colName => {
    const col = props[colName];
    let type = col.type || 'unknown';
    if (col.format) type += ' (' + col.format + ')';
    const isRequired = required.includes(colName);
    const nullable = isRequired ? 'NOT NULL' : 'NULL';
    let defaultVal = '';
    if (col.default !== undefined) {
      defaultVal = ' DEFAULT ' + JSON.stringify(col.default);
    }
    const desc = col.description ? ' -- ' + col.description : '';
    output += '  ' + colName + ': ' + type + ' ' + nullable + defaultVal + desc + '\n';
  });
  output += '\n';
});

fs.writeFileSync('c:/Users/USER/FACTOR HIBRID/FACTOR-HIBRID-r1.0/temp_schema_output.txt', output);
console.log('Schema extracted successfully');
