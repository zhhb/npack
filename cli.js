#!/Users/yzf/.nvm/versions/node/v4.0.0/bin/node

const prog = require('commander');
const version = require('./package.json').version;
prog.version(version);
prog.command('build [dirs...]')
  .option('--clean', 'clean output dir before build')
  .option('--dev', 'build development version')
  .option('-o, --output <output>', 'set output dir [dist]', 'dist')
  .option('--verbose', 'output verbose information')
  .option('-w, --watch', 'rebuild on file change')
  .action((dirs, options) => {require('./builder').build(dirs, options);});

prog.command('unfreeze').option('-a, --aggresive').action(options => require('./updater').unfreeze(options));

prog.command('freeze').action(() => require('./updater').freeze());

prog.parse(process.argv);
