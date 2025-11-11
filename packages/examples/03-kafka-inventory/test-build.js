const { exec } = require('child_process');
const path = require('path');

console.log('Testing build in:', __dirname);

exec('npx nest build', { cwd: __dirname }, (error, stdout, stderr) => {
  if (error) {
    console.error('Build failed:', error.message);
    console.error('stderr:', stderr);
    return;
  }
  console.log('Build output:', stdout);
  if (stderr) {
    console.log('Build warnings:', stderr);
  }
  console.log('Build successful!');
});