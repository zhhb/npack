const webpack = require('webpack');
const fs = require('fs');
const path = require('path');
const fsUtils = require('nodejs-fs-utils');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const AssetsPlugin = require('assets-webpack-plugin');
function isValid(x) {
  return !!x;
}
function setDefault(){
  const obj = arguments[0];
  const names = Array.prototype.slice.call(arguments, 1, -2);
  const lname = arguments[arguments.length -2];
  const f = arguments[arguments.length -1];
  const node = names.reduce((p, name) => p[name] || (p[name] = {}), obj);
  return node[lname] || (node[lname] = (typeof f === 'function'?f():f));
}

function findFile(dir, file){
  const fn = path.resolve(dir, file);
  try{
    fs.statSync(fn);
    return fn;
  }
  catch(e){
    if (dir.match(/^([a-zA-Z]\:)?[\/\\]$/)){
      return null;
    }
  }
  return findFile(path.resolve(dir, '..'),file);
}

function wpConfig(cwd, dir, projectName, buildName, pkg, flags, options, shared){
  const pdir = path.resolve(cwd,dir);
  const runtimeTarget = flags.target || 'web';
  const fname = flags.noHash ? `[name]-${pkg.version}`:`[name].[chunkhash]`;
  const odir = path.resolve(cwd,options.output, runtimeTarget, projectName);
  const dev = !!options.dev;
  const cssLoaderArgs = 'modules&localIdentName='+(dev?`${projectName}-[name]-[local]-[hash:base64:5]`:`${projectName}-[hash:base64:10]`);
  const styles = (loader) => {
    if (runtimeTarget === 'node'){
      return `css/locals?${cssLoaderArgs}!${loader}`;
    }
    if (flags.extractCss) {
      return ExtractTextPlugin.extract('style',`css?${cssLoaderArgs}!${loader}`);
    }
    return `style!css?${cssLoaderArgs}!${loader}`;
  }
  const alias = flags.alias|| {};
  const modvers = {};
  if (runtimeTarget === 'node'){
    alias['source-map-support']=path.resolve(__dirname,'node_modules','source-map-support');
  }

  const proxyModuleDirs = [];
  if (flags.proxyModules){
    flags.proxyModules.forEach(mod => {
      const mdir = findFile(pdir,`node_modules/${mod}/proxy_modules`);
      if(mdir){
        proxyModuleDirs.push(mdir);
      }
    });
  }
  if(flags.useModuleVersions){
    flags.useModuleVersions.forEach(mod=>{
      const mp=findFile(pdir,`node_modules/${mod}/package.json`);
      if(mp){modvers[mod]=require(mp).version;}
    });
  }
  const resolveReal = dir => {
    try {
      return fs.realpathSync(path.resolve(pdir,dir));
    }
    catch(e) {
      console.log(e);
      return null;
    }
  };
  const entry = (typeof flags.entry === 'string' || flags.entry instanceof Array) ? {[buildName]:flags.entry}:flags.entry;
  const srcs = ['src', 'lib'].concat(flags.extraSourceDirs||[]).map(resolveReal).filter(isValid);
  const replacePlugins = (flags.replacePlugins||[]).map(item => new webpack.NormalModuleReplacementPlugin(item[0],item[1]));
  const babel = runtimeTarget === 'web' ? 'es3ify!babel' : 'babel';

  return {
    context: pdir,
	entry: entry,
	devtool: 'source-map',
	target: runtimeTarget,
	output: {
	  library: flags.library,
	  libraryTarget: flags.libraryTarget,
	  path: odir,
	  filename: fname+'.js',
	  chunkFilename: '[chunkhash].chunk.js',
	},
	externals: flags.externals,
	module: {
	  preLoaders: [
	   dev && {test: /\.js$/,loader:'eslint',include:srcs}
	  ].filter(isValid),
	  loaders: [
	    runtimeTarget === 'web' && {test: /\.es5\.js$/,loader: 'es3ify'},
		{test: /\.jsx$/, loader: babel},
		{test: /\.js$/, loader: babel, include: srcs, exclude: /\.es5\.js$/},
		{test: /\.json$/, loader: 'json'},
		{test: /\.json5$/, loader: 'json5'},
		{test: /\.est$/, loader: babel + '!template-string'},
		{test: /\.less$/, loader: styles('postcss!less')},
		{test: /\.css$/, loader: styles('postcss')},
		{test: /\.(svg|jpe?g|png|gif)(\?.*)?$/, loader: 'url?limit=8192'},
		{test: /\.(woff\d?|ttf|eot)(\?.*)?$/, loader: 'file'},
		{test: /\.csv$/, loader: 'dsv'}
	  ].filter(isValid),
	},
	plugins: replacePlugins.concat([
	  new webpack.DefinePlugin({
	    RUNTIME_TARGET: JSON.stringify(runtimeTarget),
		NDEBUG: JSON.stringify(!dev),
		VERSION: JSON.stringify(pkg.version),
		MODULE_VERSIONS: JSON.stringify(modvers),
		'process.env.NODE_ENV': JSON.stringify(dev? 'development':'production')
	  }),
	  new webpack.optimize.OccurenceOrderPlugin(true),
	  !dev && new webpack.optimize.DedupePlugin(),
	  !dev && new webpack.optimize.UglifyJsPlugin({
	    compressor: {
		  warnings: false,
		},
		comments: false,
	  }),
	  runtimeTarget === 'web' && flags.extractCss && new ExtractTextPlugin(fname + '.css'),
	  setDefault(shared, 'assetsPlugins', dir, () =>
	    new AssetsPlugin({
		  path: path.resolve(cwd, options.output, 'assets'),
		  filename: projectName + '.json',
		  prettyPrint: true,
		})
	  ),
	]).filter(isValid),
	resolve: {
	  root: pdir,
	  alias: alias,
	  extensions: [''].concat([
	    `.${runtimeTarget}.js`,
		`.${runtimeTarget}.jsx`,
		`.${runtimeTarget}.json`,
		`.${runtimeTarget}.json5`,
		'.js', '.jsx', '.json', 'json5'
	  ]),
	  modulesDirectories: proxyModuleDirs.concat([
	    runtimeTarget !== 'node' && `${runtimeTarget}_modules`,
	    'node_modules', path.resolve(__dirname, 'builtin_modules')
	  ].filter(isValid)),
	},
	resolveLoader: {
	  modulesDirectories: [
	    path.resolve(__dirname, 'builtin_loaders'),
		path.resolve(__dirname, 'node_modules'),
		'node_modules'
	  ],
	},
	babel: {
	  presets: [
	    require('babel-preset-es2015'),
		require('babel-preset-react'),
		require('babel-preset-stage-0')
	  ],
	  plugins: [
	    runtimeTarget === 'web' && require('babel-plugin-transform-es3-property-literals'),
		runtimeTarget === 'web' && require('babel-plugin-transform-es3-member-expression-literals')
	  ].filter(isValid),
	},
	postcss: () => {
	  return [
	    require('postcss-nested')(),
		require('pixrem')(),
		require('autoprefixer')({browsers: ['last 3 versions', '>1%', 'ie >= 9', 'not ie <= 8']}),
		require('postcss-flexibility')(),
		require('postcss-discard-duplicates')()
	  ];
	},
	eslint: {
	  configFile: path.resolve(__dirname, '.eslintrc'),
	  emitWarning: false,
	  failOnError: false,
	  failOnWarning: false,
	},
  };
}

const STATS_OPTIONS = {
  colors: true,
  hash: false,
  version: false,
  timings: false,
  assets: true,
  chunks: false,
  chunkModules: false,
  modules: false,
  reasons: false,
  source: false,
  errorDetails: false,
  chunkOrigins: false,
};

exports.build = function build(dirs, options) {
  if(!dirs || dirs.length === 0) {
    dirs = ['.'];
  }
  const cwd = process.cwd();
  const shared = {};
  const wpcl = [];
  if (options.clean && options.output) {
    const output = path.resolve(cwd, options.output);
	try {
	  console.log('cleaning up', output);
	  fsUtils.rmdirsSync(path.resolve(cwd, output));
	}
	catch(_) {
	  console.log(_);
	}
  }
  dirs.forEach(dir => {
    const pkg = require(path.resolve(cwd, dir, 'package.json'));
    const configName = path.resolve(cwd, dir, 'npack.config.js');
	  const config = require(configName);
  	if (!config.build) {
  		console.error(`No build attribute on ${configName}, ignored.`);
  		return;
  	}
  	const projectName = config.name || pkg.name;
  	Object.keys(config.build).forEach(name => {
  	  const flags = config.build[name];
  	  const buildName = name === 'default' ? projectName: name;
  	  wpcl.push(wpConfig(cwd,dir,projectName,buildName,pkg,flags,options,shared));
  	});
  });
  const finished = (err, stats) => {
    if (err) throw err;
	const result = options.verbose? stats.toString({colors:true}): stats.toString(STATS_OPTIONS);
	process.stdout.write(`\n${result}\n === BUILD finished at ${new Date().toLocaleString()} === \n`);
  };
  const compiler = webpack(wpcl);
  if (options.watch) {
    compiler.watch({}, finished);
  } else {
    compiler.run(finished);
  }
}
