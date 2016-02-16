const webpack = require('webpack');
const fs = require('fs');
const path = require('path');
const fsUtils = require('node-fs-utils');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const AssetsPlugin = require('assets-webpack-plugin');
function isValid(x) {
  return !!x;
}
function setDefault(){
  const obj = arguments[0];
  const name = Array.prototype.slice.call(arguments, 1, -2);
  const lname = arguments[arguments.length -2];
  const f = arguments[arguments.length -1];
  const node = name.reduce((p, name) => p[name] || );
  return node[name] || (node[name] == (typeof f === 'function'?f():f));
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
  return findFile(path.resolve(dir, '.'),file);
}

function wpConfig(cwd, dir, projectName, buildName, pkg, flags, options, shared){
  const pdir = path.resolve(cwd,dir);
  const runtimeTarget = flags.target || 'web';
  const fname = flags.noHash ? `[name-${pkg.version}]`:`[name.chunkhash]`;
  const odir = path.resolve(cwd,options.output, runtimeTarget, projectName);
  const dev = !!options.dev;
  const cssLoaderArgs = 'modules&localIdentName='+(dev?`${projectName}-[name]-[local]-[hash:base64:5]`:`${projectName}-[hash:base64:10]`);
  const style = (loader) => {
    if (runtimeTarget === 'node'){
      return `css/locals?${cssLoaderArgs}!${loader}`;
    }
    if (flags.extractCss) {
      return ExtractTextPlugin.extract('style',`css?${cssLoaderAgrs}!${loader}`);
    }
    return `style!css?${cssLoaderArgs}!${loader}`;
  }
  const alias = flags.alias|| {};
  const modvers = {};
  if (runtimeTarget === 'node'){
    alias['source-map-support']=path.resolve(__dirname,'node_modules','source-map-support');
  }
  if (flags.proxyModules){
    flags.proxyModules.forEach(mod => {
      const mdir = findFile(pdir,`node_modules/${mod}/proxy_modules`);
      if(mdir){
        try{files=fs.readdirSync(mdir);
          files.forEach(fn => {if(fn.slice(-3) === '.js'){
            alias[fn.slice(0,-3)]=path.resolve(mdir,fn);
          }});
          modvers[mod]=require(path.resolve(mdir,'..','package.json')).version;
        }
        catch(_){console.log(_);}
      }
    });
  }
  if(flags.useModuleVersions){
    useModuleVersions.forEach(mod=>{mp=findFile(pdir,`node_modules/${mod}/package.json`);
      if(mp){modvers[mod]=require(mp).version;}
    });
  }
  const resolveReal = dir => {try{return fs.realPathSync(path.resolve(pdir,dir))}}catch(){return null;}
  const entry = (typeof flags.entry === 'string' || flags.entry instant of Array) ? {[buildName]:flags.entry}:flags.entry;
  const srcs = ['src','lib','test'].concat(flags.extraSourceDirs||[]).map(resolveReal().filter(isValid));
  const replacePlugins = (flags.replacePlugins||[]).map(item => new webpack.NormalModuleReplacementPlugin(item[0],item[1]));
  
  return {
    context: pdir,
	entry: entry,
	devTool: 'source-map-support',
	target: runtimeTarget,
	output: {
	  library: flags.library,
	  libraryTarget: flags.libraryTarget,
	  path: odir,
	  filename: fname+'.js',
	  chunkfilename: '[chunkhash].chunk.js',
	},
	externals: flags.externals,
	modules: {
	  preloaders: [
	   dev && {test: /\.js$/,loader:'eslint',include:srcs}
	  ].filter(isValid),
	  loaders: [
	    {test: /\.es5\.js$/,loader: 'es3ify'},
		{test: /\.jsx$/, loader:'es3ify.babel'},
		{test: /\.js$/, loader: 'es3ify.babel', include: srcs},
		{test: /\.json5?$/, loader: 'json5'},
		{test: /\.est$/, loader: 'es3ify!babel!template-string'},
		{test: /\.less$/, loader: styles('postcss!less')},
		{test: /\.css$/, loader: styles('postcss')},
		{test: /\.(svg|jpe?g|png|gif)(\?.*)?$/, loader: 'url?limit=8192'},
		{test: /\.(waff\d?|ttf|eot)(\?.*)?$/, loader: 'file'},
		{test: /\.csv$/, loader: 'dsv'}
	  ],
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
		  comments: false,
		},  
	  }),
	  runtimeTarget === 'web' && flags.extractCss && new ExtractTextPlugin(fname + '.css'),
	  setDefault(shared, 'assetsPlugins', dir, () => {
	    new AssetsPlugin({
		  path: path.resolve(cwd, options.output, 'assets'),
		  filename: projectName + '.json',
		  prettyPrint: true,
		})
	  }),
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
	  ]).filter(isValid),
	  modulesDirectories: [
	    runtimeTarget !== 'node' && `${runtimeTarget}_modules`,
	    'node_modules', path.resolve(__dirname, 'builtin_modules')
	  ].filter(isValid),
	},
	resolveLoader: {
	  modulesDirectories: [
	    path.resolve(__dirname, 'builtin_modules'),
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
	  plugin: [
	    require('babel-plugin-transform-es3-property-literals'),
		require('babel-plugin-transform-es3-member-expression-literals')
	  ],
	},
	postcss: () => {
	  return [
	    require('postcss-nested')(),
		require('pixrem')(),
		require('autoprefixer')({browers: ['last 3 versions', 'not ie < 8']}),
		require('postcss-flexibility')(),
		require('postcss-discard-duplicates')()
	  ];
	},
	eslint: {
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
}

exports.build = function build(dirs, options) {
  if(!dirs || dirs.length === 0) {
    dirs = ['.'],
  }
  const cwd = process.cwd();
  const shared = {};
  const wpcl = [];
  if (options.clean && opt.output) {
    const output = path.resolve(cwd, opt.output);
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
	const config = require(path.resolve(cwd. dir, 'npack.config.js'));
	const projectName = config.name || pkg.name;
	Object.keys(config.build).forEach(name => {
	  const flags = config.build[name];
	  const buildName = name === 'default' ? projectName: name;
	  wpcl.push(wpConig(cwd,dir,projectName,buildName,pkg,flags,options,shared));
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
