const fs = require('fs');
let file = fs.readFileSync('src/pages/Submit.tsx', 'utf8');

// Remove Past Submissions section
const pastSubRegex = /\{\/\* Past Submissions \*\/\}[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*\)\s*\}\s*$/m;
file = file.replace(pastSubRegex, `    </div>\n  )\n}\n`);

// Remove myQuery
const myQueryRegex = /const myQuery = useQuery\(\{\s*queryKey: \['my-submissions'\],[\s\S]*?\}\)[\s\n]*/m;
file = file.replace(myQueryRegex, '');

// Remove StatusPill import if present
file = file.replace(/import \{ StatusPill \} from '\.\.\/components\/status\/StatusPill'\n/g, '');

fs.writeFileSync('src/pages/Submit.tsx', file);
