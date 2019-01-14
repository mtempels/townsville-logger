/**
 * @fileOverview Entrypoint of Connection Systems logger
 * @name index.js
 * @author Coen Blijkers <c.blijker@crcvalue.nl>
 * @license Copyright Connection Systems BV
 */

"use strict";

var moment = require('moment');
var os = require('os');
var util = require('util');
var winston = require('winston');
// will expose winston.transports.MappedSyslog
require('./mapped-syslog');


/* @constant {string} Default log level */
var DEFAULT_LOGLEVEL = 'info';
/* @constant {string} Default log file */
var DEFAULT_LOGFILE = 'logging.log';
/* @constant {string} Default logger name */
var DEFAULT_LOGGER_NAME = 'logger';
/* @constant {number} Numeric log levels */
var NR_FATAL = 0;
var NR_ERROR = 10;
var NR_WARN = 20;
var NR_INFO = 30;
var NR_DEBUG = 40;
var NR_TRACE = 50;
/* @constant {number} Show name types */
var SN_NONE = 0;
var SN_SIMPLE = 1;
var SN_FULL= 2;

/* @constant {Object} Default logger settings */
var DEFAULT_SETTINGS = {
  name: DEFAULT_LOGGER_NAME,
  level: DEFAULT_LOGLEVEL,
  showName: true,
  showPid: false,
  console: {
    timestamp: getUTCTimestamp
  },
  colorize: 'true'
};

// Default log level
var logLevel = numLevel(DEFAULT_LOGLEVEL);
// Keeps track of deviating levels by module name
var logLevels = {};
// App name
var appName;
// Flag to show name in log (0=no, 1=small, 2=full)
var showName;
// Flag to show PID in log
var showPid;
// Single instance winston logger
var log;


/**
 * This method initializes the log settings
 * @param {Object} settings Settings to use
 */
function init(settings) {

  // If no settings, use the default
  evaluateSettings(settings || DEFAULT_SETTINGS);
}


/**
 * Convenience method for testing. Clears previous init.
 */
function deinit() {

  log = undefined;
  showName = undefined;
  showPid = undefined;
  appName = undefined;
  logLevels = {};
  logLevel = numLevel(DEFAULT_LOGLEVEL);
}


/**
 * Return a new log instance
 * @param {string} name Logger name
 */
function createLogger(name) {

  return new CsLogger(name);
}


/* -------- Private stuff --------

/**
 * Default UTC timestamp formatter
 * @returns {string} Formatted UTC date time
 */
function getUTCTimestamp() {
  return moment(Date.now()).utc().format('YYYYMMDD-HHmmss.SSS');
}


/**
 * Evaluate/parse the settings
 * @param {Object} Object holding the log settings
 */
function evaluateSettings(settings) {

  // We already have a log (initialized)
  if (log) {
    return;
  }

  // Determine app name
  appName = settings.name || DEFAULT_LOGGER_NAME;
  // Determine if to show the name
  showName = getShowName(settings.showName);
  // Determine if to show the pid
  showPid = (settings.showPid ? true : false);

  // Determine deviating loglevels
  if (settings.levels) {
    getLogLevels(settings.levels);
  }

  // Determine default numeric log level
  if (settings.level) {
    logLevel = numLevel(settings.level);
  }

  // Determine transport log level
  var transLevel = determineTransLevel();

  // Determine transports to use
  var transports = [];

  if (settings.console) {
    transports.push(
      getConsoleTransport(settings.console, transLevel));
  }

  if (settings.file) {
    transports.push(getFileTransport(settings.file, transLevel));
  }

  if (settings.syslog) {
    transports.push(getSyslogTransport(settings.syslog, transLevel));
  }

  // Create (single) log instance
  log = new (winston.Logger)({
    transports: transports,
    levels: {
      fatal: NR_FATAL,
      error: NR_ERROR,
      warn:  NR_WARN,
      info:  NR_INFO,
      debug: NR_DEBUG,
      trace: NR_TRACE
    },
    colors: {
      fatal: 'magenta',
      error: 'red',
      warn:  'yellow',
      info:  'green',
      debug: 'blue',
      trace: 'grey'
    }
  });
}


/**
 * Get console transport
 * @param {Object} settings Console settings
 * @param {string} level Transport level
 * @returns {Object} Winston transport
 */
function getConsoleTransport(settings, level) {

  var opts = {};

  opts.timestamp = (settings.timestamp === false ? false : getUTCTimestamp);
  opts.json = (settings.json === undefined ? false : settings.json);
  opts.colorize = (settings.colorize === undefined ? true : settings.colorize);
  opts.level = level;

  return new winston.transports.Console(opts);
}


/**
 * Get file transport
 * @param {Object} settings File settings
 * @param {string} level Transport level
 * @returns {Object} Winston transport
 */
function getFileTransport(settings, level) {

  var opts = {};

  opts.timestamp = (settings.timestamp === false ? false : getUTCTimestamp);
  opts.json = (settings.json === undefined ? false : settings.json);
  opts.colorize = (settings.colorize === undefined ? false : settings.colorize);
  opts.level = level;
  opts.filename = settings.path || DEFAULT_LOGFILE;

  if (settings.rollingFile) {
    opts.maxsize = settings.rollingFile.maxSize || 10000000;
    opts.maxFiles = settings.rollingFile.maxFiles || 10;
    opts.tailable = (settings.rollingFile.tailable === undefined ? true : settings.tailable);
  }

  return new winston.transports.File(opts);
}


/**
 * Get syslog transport
 * @param {Object} settings Syslog settings
 * @param {string} level Transport level
 * @returns {Object} Winston transport
 */
function getSyslogTransport(settings, level) {

  var opts = {};

  opts.host = settings.host;
  opts.port = (isNaN(settings.port) ? undefined : settings.port);
  opts.protocol = settings.protocol;
  opts.path = settings.path;
  // Don't set pid. Default process.pid is fine
  opts.facility = settings.facility;
  opts.localhost = settings.host ? settings.host : os.hostname();
  // UTC Timestamp is off for this transport
  // (syslog transport creates its own timestamp)
  opts.timestamp = false;
  // Default to RFC5425 for its hires timestamp support
  opts.type = settings.type ? settings.type : 'RFC5425';
  opts.app_name = appName;
  opts.level = level;

  return new winston.transports.MappedSyslog(opts);
}


/**
 * Get optinally deviating log levels
 * @param {Object} settings Object holding a level per logger
 */
function getLogLevels(settings) {
  if (!settings) {
    return;
  }

  // Add numeric value of log level to a lookup
  Object.keys(settings).forEach(function(entry) {
    logLevels[entry] = numLevel(settings[entry]);
  });
}


/**
 * Translate show name setting to a number
 * @param {string} value Setting value
 */
function getShowName(value) {
  if (typeof(value) === 'string') {
    switch(value.toLowerCase()) {
    case 'full':
      return SN_FULL;
    case 'none':
    case 'false':
      return SN_NONE;
    default:
      return SN_SIMPLE;
    }
  }
  return (value ? SN_SIMPLE : SN_NONE);
}


/**
 * Determine transport level using the given value
 * Take specific defined loglevels into account
 * @param {string} value Level
 */
function determineTransLevel() {

  // Minimum level is default log level
  var minLevel = logLevel;
  for(var key in logLevels) {
    if (logLevels[key] >= minLevel) {
      minLevel = logLevels[key];
    }
  }
  // Get string presentation
  return strLevel(minLevel);
}

/**
 * Translate log level string to a number
 * @param {string} value
 * @returns {number} Log level number
 */
function numLevel(value) {
  switch (value.toLowerCase()) {
  case 'fatal': return NR_FATAL;
  case 'error': return NR_ERROR;
  case 'warn': return NR_WARN;
  case 'info': return NR_INFO;
  case 'debug': return NR_DEBUG;
  case 'trace': return NR_TRACE;
  default: return NR_TRACE;
  }
}

/**
 * Translate log level number to a string
 * @param {string} value
 * @returns {number} Log level string
 */
function strLevel(value) {
  switch (value) {
  case NR_FATAL: return 'fatal';
  case NR_ERROR: return 'error';
  case NR_WARN: return 'warn';
  case NR_INFO: return 'info';
  case NR_DEBUG: return 'debug';
  case NR_TRACE: return 'trace';
  default: return 'trace';
  }
}

/**
 * Create CsLogger instance
 * @param {string} name Module name
 */
function CsLogger(name) {

  // Copy name
  this._name = name;
  // Set default log level
  this._level = logLevel;
  // Override if there is one specifically defined
  if (name in logLevels) {
    this._level = logLevels[name];
  }
  // Obtain pid
  this._pid = process.pid;
}

/**
 * Fatal
 */
CsLogger.prototype.fatal = function() {

  if (this._isToLog(NR_FATAL)) {
    this._addToArgs(arguments);
    log.fatal.apply(null, arguments);
  }
};

CsLogger.prototype.isFatal = function(){

  return this._isToLog(NR_FATAL);
};


/**
 * Error
 */
CsLogger.prototype.error = function() {

  if (this._isToLog(NR_ERROR)) {
    this._addToArgs(arguments);
    log.error.apply(null, arguments);
  }
};

CsLogger.prototype.isError = function(){

  return this._isToLog(NR_ERROR);
};


/**
 * Warn
 */
CsLogger.prototype.warn = function() {

  if (this._isToLog(NR_WARN)) {
    this._addToArgs(arguments);
    log.warn.apply(null, arguments);
  }
};

CsLogger.prototype.isWarn = function(){

  return this._isToLog(NR_WARN);
};


/**
 * Info
 */
CsLogger.prototype.info = function() {

  if (this._isToLog(NR_INFO)) {
    this._addToArgs(arguments);
    log.info.apply(null, arguments);
  }
};

CsLogger.prototype.isInfo = function(){

  return this._isToLog(NR_INFO);
};


/**
 * Debug
 */
CsLogger.prototype.debug = function() {

  if (this._isToLog(NR_DEBUG)) {
    this._addToArgs(arguments);
    log.debug.apply(null, arguments);
  }
};

CsLogger.prototype.isDebug = function(){

  return this._isToLog(NR_DEBUG);
};


/**
 * Trace
 */
CsLogger.prototype.trace = function() {

  if (this._isToLog(NR_TRACE)) {
    this._addToArgs(arguments);
    log.trace.apply(null, arguments);
  }
};

CsLogger.prototype.isTrace = function(){

  return this._isToLog(NR_TRACE);
};


// ---- Private ----


/**
 * Prefix name and / or pid to arg 0
 * @param {} arg
 * @returns {}
 */
CsLogger.prototype._addToArgs = function(args){

  // Nothing to do
  if ((showName === SN_NONE && !showPid) ||
      !args) {
    return;
  }

  var addOn = '';
  // Add pid if required
  if (showPid) {
    addOn += util.format('#%d', this._pid);
  }
  // Add name if required
  if (showName > SN_NONE) {
    if (showPid) {
      addOn += '-';
    }
    if (showName === SN_FULL) {
      addOn += util.format('%s.%s', appName, this._name);
    } else {
      addOn += this._name;
    }
  }

  // Prepend addon betwee brackets
  args['0'] = util.format('[%s] %s', addOn, args['0']);
};


/**
 * Check if the given level is to log
 * @param {number} level Level to log
 * @throws {Error} If not initialized
 * @returns {boolean} True if this is to log
 */
CsLogger.prototype._isToLog = function(level){

  if (!log) {
    throw new Error('Log system is not initialized');
  }
  return (this._level >= level);
};


module.exports.init = init;
module.exports.deinit = deinit;
module.exports.createLogger = createLogger;
