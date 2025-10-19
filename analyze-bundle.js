const fs = require('fs');

const html = fs.readFileSync('packages/mobile/dist/stats.html', 'utf8');

// Find the start of the data object
const dataStart = html.indexOf('const data = ');
const jsonStart = html.indexOf('{', dataStart);

// Find the end - look for the semicolon after the closing brace
let braceCount = 0;
let jsonEnd = jsonStart;
for (let i = jsonStart; i < html.length; i++) {
  if (html[i] === '{') braceCount++;
  if (html[i] === '}') braceCount--;
  if (braceCount === 0) {
    jsonEnd = i + 1;
    break;
  }
}

const jsonStr = html.substring(jsonStart, jsonEnd);
const match = [null, jsonStr];

if (match) {
  const data = JSON.parse(match[1]);
  const modules = [];

  // Collect modules from node parts
  for (const [uid, nodeData] of Object.entries(data.nodeParts)) {
    modules.push({
      uid,
      size: nodeData.renderedLength,
      gzip: nodeData.gzipLength
    });
  }

  // Create a map to find names
  const uidToName = {};

  function traverse(node, path = '') {
    if (node.uid) {
      uidToName[node.uid] = path + '/' + (node.name || '');
    }
    if (node.children) {
      node.children.forEach(child => traverse(child, path + '/' + (node.name || '')));
    }
  }

  traverse(data.tree);

  // Add names to modules
  modules.forEach(m => {
    m.name = uidToName[m.uid] || m.uid;
    m.name = m.name.replace(/^\/+/, '');
  });

  modules.sort((a, b) => b.size - a.size);

  console.log('Top 50 largest modules:');
  console.log('=====================================');
  modules.slice(0, 50).forEach((m, i) => {
    console.log(`${i + 1}. ${(m.size / 1024).toFixed(1)} KB (gzip: ${(m.gzip / 1024).toFixed(1)} KB) - ${m.name}`);
  });

  console.log('\n\nSummary by category:');
  console.log('=====================================');

  const categories = {
    'three': { size: 0, gzip: 0, count: 0 },
    'react-three': { size: 0, gzip: 0, count: 0 },
    'radix-ui': { size: 0, gzip: 0, count: 0 },
    'supabase': { size: 0, gzip: 0, count: 0 },
    'react': { size: 0, gzip: 0, count: 0 },
    'lucide': { size: 0, gzip: 0, count: 0 },
    'tanstack': { size: 0, gzip: 0, count: 0 },
    'i18next': { size: 0, gzip: 0, count: 0 },
    'mqtt': { size: 0, gzip: 0, count: 0 },
    'app': { size: 0, gzip: 0, count: 0 },
    'other': { size: 0, gzip: 0, count: 0 }
  };

  modules.forEach(m => {
    if (m.name.includes('three')) {
      categories['three'].size += m.size;
      categories['three'].gzip += m.gzip;
      categories['three'].count++;
    } else if (m.name.includes('react-three')) {
      categories['react-three'].size += m.size;
      categories['react-three'].gzip += m.gzip;
      categories['react-three'].count++;
    } else if (m.name.includes('radix-ui')) {
      categories['radix-ui'].size += m.size;
      categories['radix-ui'].gzip += m.gzip;
      categories['radix-ui'].count++;
    } else if (m.name.includes('supabase')) {
      categories['supabase'].size += m.size;
      categories['supabase'].gzip += m.gzip;
      categories['supabase'].count++;
    } else if (m.name.includes('react') && !m.name.includes('three')) {
      categories['react'].size += m.size;
      categories['react'].gzip += m.gzip;
      categories['react'].count++;
    } else if (m.name.includes('lucide')) {
      categories['lucide'].size += m.size;
      categories['lucide'].gzip += m.gzip;
      categories['lucide'].count++;
    } else if (m.name.includes('tanstack')) {
      categories['tanstack'].size += m.size;
      categories['tanstack'].gzip += m.gzip;
      categories['tanstack'].count++;
    } else if (m.name.includes('i18next')) {
      categories['i18next'].size += m.size;
      categories['i18next'].gzip += m.gzip;
      categories['i18next'].count++;
    } else if (m.name.includes('mqtt')) {
      categories['mqtt'].size += m.size;
      categories['mqtt'].gzip += m.gzip;
      categories['mqtt'].count++;
    } else if (m.name.includes('packages/mobile') || m.name.includes('packages/shared')) {
      categories['app'].size += m.size;
      categories['app'].gzip += m.gzip;
      categories['app'].count++;
    } else {
      categories['other'].size += m.size;
      categories['other'].gzip += m.gzip;
      categories['other'].count++;
    }
  });

  Object.entries(categories)
    .sort((a, b) => b[1].size - a[1].size)
    .forEach(([name, data]) => {
      if (data.count > 0) {
        console.log(`${name}: ${(data.size / 1024).toFixed(1)} KB (gzip: ${(data.gzip / 1024).toFixed(1)} KB) - ${data.count} modules`);
      }
    });

  console.log('\n\nOverall Summary:');
  console.log('=====================================');
  console.log(`Total modules: ${modules.length}`);
  console.log(`Total size: ${(modules.reduce((sum, m) => sum + m.size, 0) / 1024).toFixed(1)} KB`);
  console.log(`Total gzip: ${(modules.reduce((sum, m) => sum + m.gzip, 0) / 1024).toFixed(1)} KB`);
} else {
  console.log('Could not parse data from stats.html');
}