/**
  * Run with expresso test/app.test.js
  */

var app = require('../app'),
    assert = require('assert'),
    zombie = require('zombie'),
    events = require('events'),
    testHelper = require('./helper');

app.listen(3001);

testHelper.models = [app.Member];

testHelper.setup(function() {
  // Fixtures
  var member = new app.Member({'email' : 'alex@example.com', 'password' : 'test' });
  member.save(function() {
    testHelper.run(exports)
  });
});

testHelper.tests = {
  'test login': function() {
    zombie.visit('http://localhost:3001/', function(err, browser, status) {
      // Fill email, password and submit form
      browser.
        fill('member[email]', 'alex@example.com').
        fill('member[password]', 'test').
        pressButton('Log In', function(err, browser, status) {
          // Form submitted, new page loaded.
          assert.equal(browser.text('#header a.destroy'), 'Log Out');
          testHelper.end();
        });
    });
  }
};

