#!/usr/local/bin/node

var fs = require("fs");
var path = require('path');
var execSync = require('child_process').execSync;
var fsUtils = require('nodejs-fs-utils');

function getNodeModules(cwd) {
  var mods = {};
  fs.readdirSync(path.resolve(cwd, 'node_modules'))
    .filter(function(name) {
      return ['.bin'].indexOf(name) === -1;
    }).forEach(function(name) {
      mods[name] = 'commonjs2' + name;
    });

  return mods;
}

function isValid(x) {
  return !!x;
}

function template(webpack, cwd, package, entry, flags) {
  var ExtractTextPlugin = flags.extractCss && require("extract-text-webpack-plugin");
  var CompressionPlugin = flags.compress && require("compression-webpack-plugin");
  var packagePrefix = flags.packagePrefix || package.name;
  var buildPath = flags.output ? path.resolve(process.cwd(), flags.output, packagePrefix) : path.resolve(cwd, 'dist');

  var styles = function(loader) {
    var cssLoaderArgs = '?module&localIdentName=' + packagePrefix + (flags.noDebug ? '-[hash:base64:10]' : '-[name]-[local]-[hash:base64:5]') + '!';
    return flags.isServer ? ('css/locals' + cssLoaderArgs + loader) :
      (flags.extractCss ? ExtractTextPlugin.extract('style', 'css' + cssLoaderArgs + loader) : ('style!css' + cssLoaderArgs + loader));
  };

  var loaderModules = ["web_loaders", "web_modules", "node_loaders", "node_modules", ];
  loaderModules = loaderModules.concat(loaderModules.map(function(name) {
    return path.resolve(__dirname, name);
  }));

  var entryBase = [];
  var prepend = function(item) {
    var v = entryBase.concat(item).filter(isValid);
    return (v.length > 0 ? v : null);
  };
  var single = false;
  if (typeof entry === 'object') {
    var n = {};
    Object.keys(entry).forEach(function(name) {
      var item = prepend(entry[name]);
      if (item) n[name] = item;
    });
    entry = n;
  } else {
    single = true;
    var n = {};
    n[packagePrefix] = entryBase.concat(entry).filter(isValid);
    entry = n;
  }

  var name = ['name', flags.rev ? (flags.rev === 'auto' ? package.version : flags.rev) : 'dev', ].filter(isValid).join('-');
  if (!flags.isServer) {
    name += '.client';
  }

  var defines = {
    IS_SERVER: JSON.stringify(!!flags.isServer),
    NDEBUG: JSON.stringify(!!flags.noDebug),
    VERSION: JSON.stringify(package.version),
  };

  if (flags.noDebug) {
    defines['process.env'] = {
      NODE_ENV: JSON.stringify("production")
    };
  }

  var externals = (flags.externals || []);

  if (flags.isServer) {
    externals = externals.concat(getNodeModules(cwd));
  }

  return {
    context: cwd,
    entry: entry,
    devtool: flags.noSourceMap ? null : (flags.devtool || 'source-map'),
    output: {
      library: flags.library,
      libraryTarget: flags.libraryTarget || 'umd',
      path: buildPath,
      filename: name + '.js',
      chunkFilename: 'chunk.[id].[chunkhash].js',
    },
    target: flags.isServer ? 'node' : 'web',
    module: {
      loaders: [!!flags.babel && {
        test: /\.jsx?$/,
        loader: 'babel?stage=0',
        exclude: /(vender|respond\.js|whatwd-fetch|html5shiv|es5-shim|xdomain)/
      }, {
        test: /\.json$/,
        loader: 'json'
      }, {
        test: /\.less$/,
        loader: styles('postcss!less')
      }, {
        test: /\.css$/,
        loader: styles('postcss')
      }, {
        test: /\.eot(\?.+)$/,
        loader: 'file'
      }, {
        test: /\.(woff\d?|ttf|svg|jpe?g|png|gif)(\?.+)$/,
        loader: 'url?limit=10240'
      }, ].filter(isValid),
    },
    postcss: function() {
      return [
        require('postcss-nested')(),
        require('pixrem')(),
        require('postcss-color-function')(),
        require('postcss-color-rgba-fallback')(),
        require('postcss-media-minmax')(),
        require('postcss-custom-media')(),
        require('postcss-custom-properties')(),
        require('postcss-custom-selectors')(),
        require('postcss-pseudo-class-any-link')(),
        require('postcss-pseudoelements')(),
        require('autoprefixer')({
          browsers: ['> 2%', 'ie >= 8']
        }),
      ];
    },
    plugins: [
      new webpack.DefinePlugin(defines),
      new webpack.optimize.OccurenceOrderPlugin(true), !!flags.maxChunks && new webpack.optimize.LimitChunkCountPlugin({
        maxChunks: flags.maxChunks,
      }), !!flags.minChunkSize && new webpack.optimize.MinChunkSizePlugin({
        minChunkSize: flags.minChunkSize,
      }), !!flags.minify && new webpack.optimize.UglifyJsPlugin({
        compressor: {
          warning: false
        },
        comments: false,
      }), !!flags.minify && new webpack.optimize.DedupePlugin(), !!flags.banner && !flags.isServer && new webpack.BannerPlugin(flags, banner, {
        entryOnly: true
      }), !!flags.isServer && new webpack.BannerPlugin('require("source-map-support").install();', {
        raw: true,
        entryOnly: false,
      }), !flags.isServer && flags.extractCss && new ExtractTextPlugin(name + '.css'), !flags.isServer && flags.compress && new CompressionPlugin({
        asset: "{file}.gz",
        regExp: /\.(js|css|html|svg)$/,
      }), !!flags.statsFile && new AssetsPlugin({
        filename: flags.statsFile,
        path: path.resolve(cwd, 'stats'),
      }),
    ].filter(isValid),
    resolve: {
      root: cwd,
      alias: flags.alias || {},
      extentions: [''].concat([!flags.isServer && '.client.js' && '.js'].filter(isValid)),
    },
    externals: externals,
    resolveLoader: {
      modulesDirectories: loaderModules,
    },
  };
}

var eh = function(err, stats) {
  if (err) throw err;
  process.stderr.write(stats.toString({
    colors: true
  }));
  process.stderr.write('\nDONE at ' + new Date().toLocaleString() + '.\n');
};

function commandBuild(options) {
  var cwd = process.cwd();
  var dirs = options._.length > 0 ? options._.map(function(dir) {
    return path.resolve(cwd, dir);
  }) : [cwd];
  var webpack = require('webpack');
  var xflags = {
    rev: options.rev,
    compress: options.compress,
    minify: options.minify,
    noDebug: options['no-debug'],
    noSourceMap: options['no-source-map'],
    output: options.output,
  };
  dirs.forEach(function(cwd) {
    var package = require(path.join(cwd, 'package.json'));
    var config = require(path.join(cwd, 'npack.config.js'));
    var build = function() {
      var targets = Object.keys(config.flags).filter(function(name) {
        return name[0] !== '_';
      });
      var flags = config.flags || {};
      targets.forEach(function(target) {
        var cflags = Object.assign({}, flags._common);
        Object.assign(cflags, flags[target]);
        Object.assign(cflags, xflags);
        var wpConfig = template(webpack, cwd, package, cflags.entry, cflags);

        if (config.copy) {
          fsUtils.mkdirs(wpConfig.output.path, function(err) {
            if (err) throw err;
            Object.keys(config.copy).forEach(function(name) {
              var src = path.join(cwd, config.copy[name]);
              var dist = path.join(wpConfig.output.path, name);
              fsUtils.copySync(src, dist, function(err) {
                if (err) throw err;
              });
            });
          });
        }

        var compiler = webpack(wpConfig);
        if (options.watch) {
          compiler.watch({}, eh);
        } else {
          compiler.run(eh);
        }
      });
    };

    var prebuild = config.prebuild || [];
    var pi = 0;
    var next = function() {
      if (pi < prebuild.length) {
        var f = prebuild[pi];
        console.log('invoking prebuild function:' + f.name);
        prebuild[pi](xflags, next);
        ++pi;
      } else {
        build();
      }
    };
    next();
  });
}

function commandReinstall(options) {
  var cwd = process.cwd();
  var package = require(path.join(cwd, 'package.json'));
  var configFileName = paht.join(cwd, 'npack.config.js');
  var config = {};
  try {
    config = require(configFileName);
  } catch (ex) {
    if (ex.code !== 'MODULE_NOT_FOUND') throw ex;
  }
  var locked = (config.locked || []).reduce(function(v, name) {
    v[name] = true;
    return v;
  }, {});
  var execOptions = {
    cwd: cwd,
    stdio: 'inherit',
    encoding: 'utf8'
  };
  var proc = function(field, opt) {
    var deps = package[field] || {};
    var names = Object.keys(deps);
    var args = names.reduce(function(args, name) {
      if (!locked[name]) {
        var version = deps[name];
        if (!version.match(/^git\+ssh\:/)) {
          args.push(name);
        }
      }
      return args;
    }, []);

    if (args.length > 0) {
      var cmd = ['npm', 'install', opt, '--save-exact'].concat(options._ || [], args).join(' ');
      console.log(cmd);
      execSync(cmd, execOptions);
    }
  };

  proc('dependencies', '--save');
  proc('devDependencies', '--save-dev');
  proc('optionalDependencies', '--save-optional');
}

var commands = {
  'build': {
    func: commandBuild,
    options: {
      boolean: ['no-debug', 'no-source-map', 'compress', 'minify', 'watch'],
      string: ['rev', 'output'],
      default: {
        watch: false,
        rev: 'dev'
      },
      alias: {
        'D': 'no-debug',
        'M': 'no-source-map',
        'm': 'minify',
        'z': 'compress',
        'o': 'output'
      }
    }
  },
  'reinstall': {
    func: commandReinstall
  }
};

var minimist = require('minimist');

function main() {
  if (process.argv.length < 3) {
    console.log('You can use the following commands:');
    Object.keys(commands).forEach(function(cmd){
      console.log('  ' + cmd);
    });
  } else {
    var cmd = process.argv[2];
    var cmdInfo = commands[cmd];
    if (!cmdInfo) {
      console.error('Unknown command:' + cmd);
      return;
    }
    var options = cmdInfo.options ? minimist(process.argv.slice(3), cmdInfo.options) : {_: process.argv.slice(3)};
    cmdInfo.func(options);
  }
}

main();