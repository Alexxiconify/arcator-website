const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const exts = ['.js', '.html', '.css'];

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat && stat.isDirectory()) {
            if (file === 'node_modules' || file === '.git') return;
            results = results.concat(walk(filePath));
        } else {
            if (exts.includes(path.extname(file))) results.push(filePath);
        }
    });
    return results;
}

function stripComments(content, ext) {

    content = content.replace(/\/\*[\s\S]*?\*\//g, '');
    if (ext === '.html') {

        content = content.replace(/<!--([\s\S]*?)-->/g, '');
    }

    content = content.replace(/^[ \t]*\/\/.*$/gm, '');

    content = content.split('\n').map(l => l.replace(/[ \t]+$/, '')).join('\n');

    content = content.replace(/\n{3,}/g, '\n\n');
    return content;
}

const files = walk(ROOT);
console.log(`Stripping comments from ${files.length} files...`);

files.forEach(file => {
    try {
        const ext = path.extname(file);
        const original = fs.readFileSync(file, 'utf8');
        const stripped = stripComments(original, ext);
        if (stripped !== original) {
            fs.writeFileSync(file, stripped, 'utf8');
            console.log(`Updated ${path.relative(ROOT, file)}`);
        }
    } catch (err) {
        console.error('Failed to process', file, err.message);
    }
});

console.log('Done.');