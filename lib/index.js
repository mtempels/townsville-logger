/**
 * @fileOverview Entrypoint of Townsville logger
 * @name index.js
 * @author Matthijs Tempels <matthijs@townsville.nl>
 * @license Copyright Townsville.nl
 */

"use strict";

const {
  format
} = require('winston');
const moment = require('moment');
const util = require('util');
const winston = require('winston');


/* @constant {string} Default log level */
const DEFAULT_LOGLEVEL = 'info';
/* @constant {string} Default log file */
const DEFAULT_LOGFILE = 'logging.log';
/* @constant {string} Default logger name */
const DEFAULT_LOGGER_NAME = 'logger';
/* @constant {number} Numeric log levels */
const NR_FATAL = 0;
const NR_ERROR = 10;
const NR_WARN = 20;
const NR_INFO = 30;
const NR_DEBUG = 40;
const NR_TRACE = 50;
/* @constant {number} Show name types */
const SN_NONE = 0;
const SN_SIMPLE = 1;
const SN_FULL = 2;

/* @constant {Object} Default logger settings */
const DEFAULT_SETTINGS = {
  name: DEFAULT_LOGGER_NAME,
  level: DEFAULT_LOGLEVEL,
  showName: true,
  showPid: false,
  console: {
    timestamp: getUTCTimestamp
  },
  colorize: 'true'
};

/* @constant {Object} Custom level and color defs */
const CUSTOM_DEFS = {
  levels: {
    fatal: NR_FATAL,
    error: NR_ERROR,
    warn: NR_WARN,
    info: NR_INFO,
    debug: NR_DEBUG,
    trace: NR_TRACE
  },
  colors: {
    fatal: 'magenta',
    error: 'red',
    warn: 'yellow',
    info: 'green',
    debug: 'blue',
    trace: 'grey'
  }
};

// Default log level
let logLevel = numLevel(DEFAULT_LOGLEVEL);
// Keeps track of deviating levels by module name
let logLevels = {};
// App name
let appName;
// Flag to show name in log (0=no, 1=small, 2=full)
let showName;
// Flag to show PID in log
let showPid;
// Single instance winston logger
let log;
// Number of transports
let nrTransports = 0;

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

  return new TownsvilleLogger(name);
}

/**
 * End logger
 * @param {function} callback Optional callback to wait for flushing
 */
function end(callback) {
  if (log) {
    log.end();
  }
  // Wait until done (if a callback is defined)
  if (typeof (callback) === 'function') {
    let tmr = setInterval(() => {
      if (nrTransports <= 0) {
        callback();
        clearTimeout(tmr);
      }
    }, 50);
  }
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
  let transLevel = determineTransLevel();

  // Determine transports to use
  let transports = [];

  if (settings.console) {
    transports.push(getConsoleTransport(settings.console, transLevel));
  }

  if (settings.file) {
    transports.push(getFileTransport(settings.file, transLevel));
  }

  // No transports
  nrTransports = transports.length;

  // Create (single) log instance
  log = winston.createLogger({
    transports: transports,
    levels: CUSTOM_DEFS.levels
  });
  // Add console colors
  winston.addColors(CUSTOM_DEFS.colors);
  // Suppress errors
  log.emitErrs = false;

  // Link finish handlers
  transports.forEach((transport) => {
    transport.on('finish', handleFinish);
  });
}

/**
 * Get format based on settings
 * @param {Object} settings
 * @returns {Object} Format object
 */
function getFormat(settings) {

  // Always splat
  let result = format.splat();
  // Optionally colorize
  if (settings.colorize) {
    result = format.combine(format.colorize(), result);
  }
  // Explicitly not use timestamp
  if (settings.timestamp === false) {
    return format.combine(
      result,
      format.printf(info => `${info.level}: ${info.message}${info.meta !== undefined ? ' ' + info.meta : ''}`)
    );
  }
  // Use timestamp
  return format.combine(
    result,
    format.timestamp({
      format: getUTCTimestamp
    }),
    format.printf(info => `${info.timestamp} - ${info.level}: ${info.message}${info.meta !== undefined ? ' ' + info.meta : ''}`)
  );
}


/**
 * Get console transport
 * @param {Object} settings Console settings
 * @param {string} level Transport level
 * @returns {Object} Winston transport
 */
function getConsoleTransport(settings, level) {

  let opts = {};

  opts.level = level;
  opts.format = getFormat(settings);

  return new winston.transports.Console(opts);
}


/**
 * Get file transport
 * @param {Object} settings File settings
 * @param {string} level Transport level
 * @returns {Object} Winston transport
 */
function getFileTransport(settings, level) {

  let opts = {};

  opts.level = level;
  opts.filename = settings.path || DEFAULT_LOGFILE;
  opts.format = getFormat(settings);

  if (settings.rollingFile) {
    opts.maxsize = settings.rollingFile.maxSize || 10000000;
    opts.maxFiles = settings.rollingFile.maxFiles || 10;
    opts.tailable = (settings.rollingFile.tailable === undefined ? true : settings.tailable);
  }

  return new winston.transports.File(opts);
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
  Object.keys(settings).forEach((entry) => {
    logLevels[entry] = numLevel(settings[entry]);
  });
}


/**
 * Translate show name setting to a number
 * @param {string} value Setting value
 */
function getShowName(value) {
  if (typeof (value) === 'string') {
    switch (value.toLowerCase()) {
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
  let minLevel = logLevel;
  for (let key in logLevels) {
    if (logLevels[key] > minLevel) {
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
    case 'fatal':
      return NR_FATAL;
    case 'error':
      return NR_ERROR;
    case 'warn':
      return NR_WARN;
    case 'info':
      return NR_INFO;
    case 'debug':
      return NR_DEBUG;
    case 'trace':
      return NR_TRACE;
    default:
      return NR_TRACE;
  }
}

/**
 * Translate log level number to a string
 * @param {string} value
 * @returns {number} Log level string
 */
function strLevel(value) {
  switch (value) {
    case NR_FATAL:
      return 'fatal';
    case NR_ERROR:
      return 'error';
    case NR_WARN:
      return 'warn';
    case NR_INFO:
      return 'info';
    case NR_DEBUG:
      return 'debug';
    case NR_TRACE:
      return 'trace';
    default:
      return 'trace';
  }
}

/**
 * Handle finished
 */
function handleFinish() {
  if (nrTransports > 0) {
    nrTransports--;
  }
}


class TownsvilleLogger {

  /**
   * Create TownsvilleLogger instance
   * @param {string} name Module name
   */
  constructor(name) {

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
  fatal() {
    if (this._isToLog(NR_FATAL) && nrTransports) {
      this._addToArgs(arguments);
      log.fatal.apply(null, arguments);
    }
  }

  isFatal() {
    return this._isToLog(NR_FATAL);
  }

  /**
   * Error
   */
  error() {
    if (this._isToLog(NR_ERROR) && nrTransports) {
      this._addToArgs(arguments);
      log.error.apply(null, arguments);
    }
  }

  isError() {
    return this._isToLog(NR_ERROR);
  }

  /**
   * Warn
   */
  warn() {
    if (this._isToLog(NR_WARN) && nrTransports) {
      this._addToArgs(arguments);
      log.warn.apply(null, arguments);
    }
  }

  isWarn() {
    return this._isToLog(NR_WARN);
  }

  /**
   * Info
   */
  info() {
    if (this._isToLog(NR_INFO) && nrTransports) {
      this._addToArgs(arguments);
      log.info.apply(null, arguments);
    }
  }

  isInfo() {
    return this._isToLog(NR_INFO);
  }

  /**
   * Debug
   */
  debug() {
    if (this._isToLog(NR_DEBUG) && nrTransports) {
      this._addToArgs(arguments);
      log.debug.apply(null, arguments);
    }
  }

  isDebug() {
    return this._isToLog(NR_DEBUG);
  }

  /**
   * Trace
   */
  trace() {
    if (this._isToLog(NR_TRACE) && nrTransports) {
      this._addToArgs(arguments);
      log.trace.apply(null, arguments);
    }
  }

  isTrace() {
    return this._isToLog(NR_TRACE);
  }


  // ---- Private ----


  /**
   * Prefix name and / or pid to arg 0
   * @param {} arg
   * @returns {}
   */
  _addToArgs(args) {

    // Nothing to do
    if ((showName === SN_NONE && !showPid) ||
      !args) {
      return;
    }

    let addOn = '';
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

    // Convert 'object' type arguments to string
    const argLen = args.length;
    for (let i = 1; i < argLen; i++) {
      const arg = args[i];
      // It's an object, stringify its value
      if (typeof (arg) === 'object') {
        args[i] = JSON.stringify(args[i]);
      }
    }
  }

  /**
   * Check if the given level is to log
   * @param {number} level Level to log
   * @throws {Error} If not initialized
   * @returns {boolean} True if this is to log
   */
  _isToLog(level) {
    if (!log) {
      throw new Error('Log system is not initialized');
    }
    return (this._level >= level);
  }
}

// Exports
module.exports.init = init;
module.exports.deinit = deinit;
module.exports.createLogger = createLogger;
module.exports.end = end;