#!/usr/bin/env node
/*
 * index.js: Index all members, posts, crags, and ascents for search.
 *
 */

// Arguments
var optimist = require('optimist');
var argv = optimist
    .describe('help', 'Get help')
    .argv;

if (argv._.length || argv.help) {
  optimist.showHelp();
  process.exit(1);
}

// Module Dependencies
var util = require('util');
var Step = require('step');
var _ = require('underscore');
var request = require('request');
_.mixin(require('underscore.string'));
var boots = require('../boots');
var log = function (s) {console.log(clc.bold(s));};
var clc = require('cli-color');
var cheerio = require('cheerio');
clc.orange = clc.xterm(202);

// Default request headers:
var headers = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_7_5) '
                + 'AppleWebKit/537.17 (KHTML, like Gecko) '
                + 'Chrome/24.0.1312.57 Safari/537.17',
};


var member = 'Lucas Marques';
//var member = 'Sander Pick';

var member_rx = new RegExp(/Profile\.aspx\?UserId=([0-9]+)\'>(.*?)<.*?<nobr>(.+?)<.*?<td>(.*?)</g);

var searchResults = [];

boots.start(function (client) {

  log(clc.blackBright('Searching for member ' + member + '...'));

  Step(
    function getPostHeaders() {
      request.get({
        uri: 'http://www.8a.nu/scorecard/Search.aspx',
        qs: {CountryCode: 'GLOBAL'},
        headers: headers,
        encoding: 'binary'
      }, this);
    },

    function searchMember(err, res, body) {
      viewState_rx = new RegExp(/id=\"__VIEWSTATE\" value=\"([A-Za-z0-9+/=]+)/);
      eventValidation_rx = new RegExp(/id=\"__EVENTVALIDATION\" value=\"([A-Za-z0-9+/=]+)/);

      var form = {
        __EVENTTARGET: undefined,
        __EVENTARGUMENT: undefined,
        __VIEWSTATE: viewState_rx.exec(body)[1],
        __VIEWSTATEGENERATOR:'BE3FD81F',
        __EVENTVALIDATION: eventValidation_rx.exec(body)[1],
        ListboxRorBSimple: 0,
        TextboxAscentCragSimple: undefined,
        ListBoxAscentCountry: undefined,
        TextboxMemberName: member,
        ListBoxSearchUserSex: 2,
        TextboxMemberCity: undefined,
        ListBoxSearchUserCountry: undefined,
        ButtonSearchMember: 'Search',
        TextboxAscentSector: undefined
      };

      request.post({
        uri: 'http://www.8a.nu/scorecard/Search.aspx',
        qs: {CountryCode: 'GLOBAL'},
        form: form,
        headers: headers,
        encoding: 'binary',
      }, this)
    },
    function (err, res, body) {
      var results;
      while (results = member_rx.exec(body)) {
        searchResults.push({
          userId: results[1],
          name: results[2],
          city: results[3],
          country: results[4]
        });
      }
      if (searchResults.length === 0) {
        log(clc.blackBright('No results found ...'));
        process.exit(0);
      }

      // Get the javascript file that contains the ascent URLs
      request.get({
        uri: 'http://www.8a.nu/js/u_common.aspx?UserId=' + searchResults[0].userId,
        headers: _.extend(headers, {'Referer': 'http://www.8a.nu/user/Profile.aspx?UserId' + searchResults[0].userId}),
        encoding: 'binary',
      }, this);

    },
    function (err, res, body) {
      var sandbox = {};
      // Run javascript in a new context to get bouldering/route URLs
      require('vm').runInNewContext(body, sandbox);
      // bouldering ascent
      var url_rx = new RegExp(/<a href="\.\.(.*?)"/);
      var d = 'http://www.8a.nu';
      var boulderUrl = d + url_rx.exec(sandbox['A8_sc_b'])[1];
      var routeUrl = d + url_rx.exec(sandbox['A8_sc_r'])[1];

      request.get({
        uri: boulderUrl,
        headers: headers,
        encoding: 'binary',
      }, this.parallel());

      request.get({
        uri: routeUrl,
        headers: headers,
        encoding: 'binary',
      }, this.parallel());

    },
  function (err, boulders, routes) {

    // filter for ascents
    var ascents_rx = new RegExp(/<!-- Ascents -->([\s\S]+?)<!-- List Options -->/);
    var boulders_html = ascents_rx.exec(boulders.body)[1];
    var routes_html = ascents_rx.exec(routes.body)[1];

    // parse HTML into a DOM structure
    var $ = cheerio.load(boulders_html);

    var boulders_ascents = [];
    $('.AscentListHeadRow').each(function() {
      $(this).parent().nextUntil('tr:has(td:only-child)')
          .each(function() {
        var els = $(this).children();
        var obj =  ({
          date: $(els.get(0)).find('nobr').text(),
          ascent: $(els.get(2)).find('a').text(),
          crag: $(els.get(4)).find('span').text(),
          comment: $(els.get(6)).contents().filter(function() {
            return this.nodeType == 3
          }).text()
        });
        boulders_ascents.push(obj);
      });
    });

    console.log('boulder ascent list');
    console.log(boulders_ascents);

    // parse HTML into a DOM structure
    var $ = cheerio.load(routes_html);

    var routes_ascents = [];
    $('.AscentListHeadRow').each(function() {
      $(this).parent().nextUntil('tr:has(td:only-child)')
          .each(function() {
        var els = $(this).children();
        var obj =  ({
          date: $(els.get(0)).find('nobr').text(),
          ascent: $(els.get(2)).find('a').text(),
          crag: $(els.get(4)).find('span').text(),
          comment: $(els.get(6)).contents().filter(function() {
            return this.nodeType == 3
          }).text()
        });
        routes_ascents.push(obj);
      });
    });

    console.log('routes ascent list');
    console.log(routes_ascents);
    process.exit(0);
  }

  );

});
