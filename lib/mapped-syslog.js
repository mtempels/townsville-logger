/**
 * @fileOverview Level mapping Wrapper around default syslog
 * @name mapped-syslog.js
 * @author Matthijs Tempels <matthijs@townsville.nl>
 * @license Copyright Townsville.nl
 */

"use strict";

var Syslog = require('winston-syslog').Syslog;
var util = require('util');
var winston = require('winston');


/**
 * Class constructor
 * @constructor
 * @param {Object} options Logger options
 */
function MappedSyslog(options) {

  // Call super
  Syslog.call(this, options);
}

// Inherit from Syslog
util.inherits(MappedSyslog, Syslog);

//
// Define a getter so that `winston.transports.MappedSyslog`
// is available and thus backwards compatible.
//
winston.transports.MappedSyslog = MappedSyslog;

//
// Expose the name of this Transport on the prototype
//
MappedSyslog.prototype.name = 'MappedSyslog';

//
// ### function log (level, msg, [meta], callback)
// #### @level {string} Target level to log to
// #### @msg {string} Message to log
// #### @meta {Object} **Optional** Additional metadata to log.
// #### @callback {function} Continuation to respond to when complete.
// Core logging method exposed to Winston. Logs the `msg` and optional
// metadata, `meta`, to the specified `level`.
//
MappedSyslog.prototype.log = function (level, msg, meta, callback) {

  // Do the mapping
  var syslogLevel;
  switch(level) {
  case 'fatal':
    syslogLevel = 'crit'; break;
  case 'error':
    syslogLevel = 'error'; break;
  case 'warn':
    syslogLevel = 'warning'; break;
  case 'info':
    syslogLevel = 'info'; break;
  default:
    syslogLevel = 'debug'; break;
  }

  // Call the original syslog log method
  Syslog.prototype.log.call(this, syslogLevel, msg, meta, callback);
};


// Exports
module.exports = MappedSyslog;
