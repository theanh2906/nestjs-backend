const fs = require('fs');
const path = require('path');

// List of file extensions to normalize
const textExtensions = [
  '.js',
  '.ts',
  '.json',
  '.md',
  '.yml',
  '.yaml',
  '.xml',
  '.html',
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.sql',
  '.sh',
  '.dockerfile',
  '.proto',
  '.txt',
  '.log',
  '.gitignore',
  '.gitattribute',
  '.eslintrc',
  '.prettierrc',
];

// List of specific filenames to normalize (without extension)
const specificFiles = [
  'Dockerfile',
  'Procfile',
  'README',
  'LICENSE',
  'CHANGELOG',
];

// Directories to skip
const skipDirectories = ['.git', 'node_modules', 'dist', 'build', '.husky'];

function shouldNormalizeFile(filePath, stats) {
  if (stats.isDirectory()) {
    return false;
  }

  const fileName = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const _nameWithoutExt = path.basename(filePath, ext);

  // Check if it's a text extension
  if (textExtensions.includes(ext)) {
    return true;
  }

  // Check if it's a specific file we want to normalize
  if (specificFiles.some((name) => fileName.startsWith(name))) {
    return true;
  }

  // Check if file has no extension but is likely a text file
  if (!ext && stats.size < 1024 * 1024) {
    // Less than 1MB
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      // Simple heuristic: if we can read it as UTF-8 and it doesn't contain null bytes, it's text
      return !content.includes('\0');
    } catch {
      return false;
    }
  }

  return false;
}

function normalizeLineEndings(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const normalizedContent = content
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n');

    if (content !== normalizedContent) {
      fs.writeFileSync(filePath, normalizedContent, 'utf8');
      console.log(`Normalized: ${filePath}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Error normalizing ${filePath}:`, error.message);
    return false;
  }
}

function walkDirectory(dir, callback) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!skipDirectories.includes(entry.name)) {
        walkDirectory(fullPath, callback);
      }
    } else {
      callback(fullPath, entry);
    }
  }
}

function main() {
  const rootDir = process.cwd();
  let normalizedCount = 0;
  let totalFiles = 0;

  console.log('Starting line ending normalization...');
  console.log(`Root directory: ${rootDir}`);

  walkDirectory(rootDir, (filePath, stats) => {
    if (shouldNormalizeFile(filePath, stats)) {
      totalFiles++;
      if (normalizeLineEndings(filePath)) {
        normalizedCount++;
      }
    }
  });

  console.log(`\nNormalization complete!`);
  console.log(`Files processed: ${totalFiles}`);
  console.log(`Files normalized: ${normalizedCount}`);
  console.log(`Files already normalized: ${totalFiles - normalizedCount}`);
}

if (require.main === module) {
  main();
}

module.exports = { normalizeLineEndings, shouldNormalizeFile };
