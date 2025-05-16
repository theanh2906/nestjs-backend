const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Source and destination paths

const foldersToCopy = ['proto', 'secrets'];

// Ensure destination folder exists

// Copy the folder
foldersToCopy.forEach((folder) => {
  fs.mkdirSync(path.resolve(__dirname, folder), { recursive: true });
  exec(
    `cp -r ${path.resolve(__dirname, folder)} ${path.resolve(__dirname, 'dist')}`,
    (err) => {
      if (err) {
        console.error('Error copying folder:', err);
      } else {
        console.log(`Folder ${folder} copied successfully to dist.`);
      }
    }
  );
});
