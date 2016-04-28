var modernizr = require('modernizr');
var JSON5 = require('json5');

function wrapOutput(output) {
  return ";(function(window){\n" + output + "\n" + "module.exports = window.Modernizr;\n" + "}(window)";
}

module.exports = function modernizrLoader(config) {
  var cb = this.async();
  modernizr.build(JSON5.parse(config), output => {
    cb(null, wrapOutput(output));
  });
};