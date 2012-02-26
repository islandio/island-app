var _ = require('underscore');
_.mixin(require('underscore.string'));

var logTimestamp = exports.logTimestamp = function() {
  var d = new Date();
  return _.sprintf('%04d-%02d-%02d %02d:%02d:%02d.%03d',
                   d.getFullYear(), d.getMonth() + 1, d.getDate(),
                   d.getHours(), d.getMinutes(), d.getSeconds(),
                   d.getMilliseconds());
}

exports.log = function() {
  console.log(logTimestamp() + ' ' + _.toArray(arguments).join(' '));
}
