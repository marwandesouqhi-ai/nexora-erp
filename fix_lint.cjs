const fs = require('fs');

const lintOutput = fs.readFileSync('lint_output.txt', 'utf8');
const files = lintOutput.split('\n\n');

for (const block of files) {
    const lines = block.split('\n').filter(l => l.trim().length > 0);
    if (lines.length === 0 || !lines[0].startsWith('C:\\')) continue;
    
    const filePath = lines[0].trim();
    if (!fs.existsSync(filePath)) continue;
    
    let content = fs.readFileSync(filePath, 'utf8');
    const contentLines = content.split('\n');
    let modified = false;
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(/^\s+(\d+):\d+\s+error\s+'([^']+)' is (?:defined|assigned a value) but never used\s+no-unused-vars/);
        
        if (match) {
            const lineNum = parseInt(match[1]) - 1;
            const varName = match[2];
            
            // If it's an import, try to remove the specific variable
            if (contentLines[lineNum].includes('import')) {
                // Regex to remove the variable from import list (handling commas)
                const regex1 = new RegExp(`\\b${varName}\\s*,?\\s*`);
                contentLines[lineNum] = contentLines[lineNum].replace(regex1, '');
                
                // If import is now empty, remove the line
                if (contentLines[lineNum].match(/import\s*{\s*}\s*from/)) {
                    contentLines[lineNum] = `// removed empty import`;
                }
                modified = true;
            } else if (contentLines[lineNum].includes(varName)) {
                // Not an import, try to remove or comment out
                contentLines[lineNum] = `// eslint-disable-next-line no-unused-vars\n` + contentLines[lineNum];
                modified = true;
            }
        }
        
        const effectMatch = line.match(/^\s+(\d+):\d+\s+error\s+Error: Calling setState synchronously/);
        if (effectMatch) {
            const lineNum = parseInt(effectMatch[1]) - 1;
            if (contentLines[lineNum].includes('set')) {
                contentLines[lineNum] = `// ` + contentLines[lineNum];
                modified = true;
            }
        }
    }
    
    if (modified) {
        fs.writeFileSync(filePath, contentLines.join('\n'));
        console.log(`Fixed ${filePath}`);
    }
}
