/*jshint node:true */
'use strict';
var spawn = require('child_process').spawn;
require('colors');

exports.SayState = SayState;
function SayState(stateMap) {
  this._state = '';
  this._stateMap = stateMap;
}

/**
 * Pass in the current state.
 *
 * The passed in state is compared to the saved state to see if it changed.  If
 * the state has changed, will display (audibly and visibly) the message
 * associated with that new state.  If the state has not changed, will do
 * nothing.
 *
 * @returns bool "is the former state the one passed in?"
 */
SayState.prototype.is = function(state) {
  if (this._state === state) {
    return true;
  }

  var msg = this._stateMap[state];
  if (msg === undefined) {
    throw new TypeError("Invalid state: "+state); // XXX not sanitized
  }
  this._state = state;
  this.say(msg);
  return false;
};

/**
 * Speak and display an arbitrary (string) message.
 */
SayState.prototype.say = function(message) {
  var opts = {
    detached: true,
    stdio: 'inherit', // stay attached to TTY
  };
  var sayProc = spawn('/usr/bin/say', [message], opts);
  sayProc.unref();
  process.stdout.write(message.bold + '\n');
};
