/*
 * Vimeo Player API wrapper
 */

define(['Underscore'], function (_) {

  // create a new wrapper
  var Player = function(iframe, options) {
    this.options = options || {};
    this.iframe = iframe.get(0);
    this.url = iframe.attr('src').split('?')[0];
    this.playing = false;
    this.init();
  }

  // Listen for messages from the player
  Player.prototype.init = function() {
    if (window.addEventListener)
      window.addEventListener('message', _.bind(onMessageReceived, this), false);
    else
      window.attachEvent('onmessage', _.bind(onMessageReceived, this), false);
    this.onReady();
  }

  // Helper function for sending a message to the player
  Player.prototype.post = function(action, value) {
    var data = { method: action };
    if (value)
      data.value = value;
    this.iframe.contentWindow.postMessage(JSON.stringify(data), this.url);
  }

  Player.prototype.onReady = function() {
    if (this.options.debug)
      console.log('Vimeo Player:', 'ready');
    this.post('addEventListener', 'pause');
    this.post('addEventListener', 'finish');
    this.post('addEventListener', 'playProgress');
    callOption.call(this, 'onReady');
  }

  Player.prototype.onStart = function() {
    if (this.options.debug)
      console.log('Vimeo Player:', 'started');
    callOption.call(this, 'onStart');
  }

  Player.prototype.onPause = function() {
    if (this.options.debug)
      console.log('Vimeo Player:', 'paused');
    this.playing = false;
    callOption.call(this, 'onPause');
  }

  Player.prototype.onFinish = function() {
    if (this.options.debug)
      console.log('Vimeo Player:', 'finished');
    this.playing = false;
    callOption.call(this, 'onFinish');
  }

  Player.prototype.onPlayProgress = function(data) {
    if (this.options.debug)
      console.log('Vimeo Player:', data.seconds + 's played');
    if (!this.playing) {
      this.playing = true;
      this.onStart();
    }
    callOption.call(this, 'onPlayProgress');
  }

  function callOption(name) {
    if ('function' === typeof this.options[name])
      this.options[name].call(this);
  }

  // Handle messages received from the player
  function onMessageReceived(e) {
    var data = JSON.parse(e.data);
    switch (data.event) {
      case 'ready':
        this.onReady();
        break;
      case 'playProgress':
        this.onPlayProgress(data.data);
        break;
      case 'pause':
        this.onPause();
        break;
      case 'finish':
        this.onFinish();
        break;
    }
  }

  return {
    Player: Player
  }; 

});
