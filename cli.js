const prog = require('commander');
const version = require('./package.json').version;
prog.version(version);
prog.command('build [dirs...]')
  .option('--clean', 'clean the dist files;')
  .option('-o', 'output dir', 'dist')
  .option('--dev', 'publish the development version.')
  .option('-w', 'watch the changes');