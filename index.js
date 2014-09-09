#!/usr/bin/env node
/*jshint node:true */
'use strict';

var request = require('request');
var program = require('commander');
var nextTime = require('next-time');
require('colors');

program
.version('0.0.0')
.usage('[options]')
.option('-s, --symbol <sym>', 'stock symbol')
.option('-u, --upper <n>', 'Upper limit', parseFloat)
.option('-l, --lower <n>', 'Lower limit', parseFloat)
.parse(process.argv);


var PERIOD = 5 * 60 * 1000;
var URL = 'https://finance.google.com/finance/info?client=ig&q={symbol}';
var MARKET_OPEN = '6:30'; // PDT
var MARKET_CLOSE = '13:00'; // PDT

var symbol = program.symbol;
var upper = program.upper || 100.0;
var lower = program.lower || 0.0;

if (!symbol) {
  return program.help();
}

var jar = request.jar();

function bail(err) {
  console.error(err.stack);
  return process.exit(1);
}

function checkStock() {
  var symbolUrl = URL.replace('{symbol}', symbol);
  var opts = {
    method: 'GET',
    url: symbolUrl,
    json: false,
    jar: jar
  };
  request(opts, function(err, response, body) {
    if (err) {
      return bail(err);
    }

    var json = body.replace(/^\s*\/\/\s*/,'');
    try {
      var data = JSON.parse(json);
      doDisplay(data[0]);
    } catch(e) {
      return bail(e);
    }
  });
}

function doDisplay(data) {
  var str = data.lt_dts + ': ';
  var price = data.l;
  var priceFloat = parseFloat(price);

  if (priceFloat <= lower) {
    str += price.bold.red;
  } else if (priceFloat >= upper) {
    str += price.bold.green;
  } else {
    str += price;
  }

  var change = data.c;
  var changeFloat = parseFloat(change);
  var changeStr = change + ' / ' + data.cp + '%';
  str += ' (';
  if (changeFloat < 0.0) {
    str += changeStr.red;
  } else {
    str += changeStr.green;
  }
  str += ')\n';

  process.stdout.write(str);
}

var said = 'nothing';
function checkState() {
  var today = (new Date().getDate());
  var nextOpen = nextTime(MARKET_OPEN).getDate();
  var nextClose = nextTime(MARKET_CLOSE).getDate();

  if (nextClose === today && nextOpen !== today) {
    // market open!
    if (said !== 'open') {
      process.stdout.write("Market is open!".bold + '\n');
      said = 'open';
    }

    checkStock();

  } else {
    // market is closed
    if (said !== 'closed') {
      process.stdout.write("Market is closed!".bold + '\n');
      checkStock(); // one last time
      said = 'closed';
    }
  }
}

setInterval(checkState, PERIOD);
checkState();

