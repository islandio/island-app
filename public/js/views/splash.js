/*
 * Page view for splash page.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rest',
  'util',
  'Spin',
  'views/lists/events',
  'views/lists/ticks',
  'text!../../templates/splash.html',
  'device'
], function ($, _, Backbone, mps, rest, util, Spin, Events, Ticks, template) {
  return Backbone.View.extend({

    el: '.main',

    initialize: function (app) {
      this.app = app;
      this.subscriptions = [];
      this.on('rendered', this.setup, this);
    },

    render: function () {
      this.app.title('The Island | Beta');
      this.template = _.template(template);
      this.$el.html(this.template.call(this));
      this.trigger('rendered');
      return this;
    },

    events: {
      'click button.start-button': 'submit',
    },

    setup: function () {
      this.top = this.$('.splash-top');
      this.topInner = this.$('.splash-top-inner');
      this.topBottom = this.$('.splash-top-bottom');
      this.bottom = this.$('.splash-bottom');
      this.header = $('.header');
      this.signupSubmit = this.$('button.start-button');
      this.signupInput = this.$('.splash-signup');
      this.signupButtonSpin = new Spin(this.$('.button-spin'), {
        color: '#396400',
        lines: 13,
        length: 3,
        width: 2,
        radius: 6,
      });

      // Handle the background video.
      if (!document.createElement('video').play) {
        swfobject.embedSWF(__s + '/swf/roll.swf', 'splash-video', '100%',
            '100%', '9.0.0', false, {src: (__s === '' ? '..': '')
            + '/vid/roll.mp4'}, {menu: 'false', wmode: 'opaque',
            allowscriptaccess: 'always', allowfullscreen: 'true'});
      } else {

        // Fix for firefox not looping.
        var vid = this.$('video').get(0);
        if (!device.mobile()) {
          vid.addEventListener('loadeddata', function () {}, false);
          vid.addEventListener('progress', function () {}, false);
          if (!(typeof vid.loop === 'boolean')) {
            vid.addEventListener('ended', function () {
              this.currentTime = 0;
              this.play();
            }, false);
          }
        }
      }

      // Handle resizing.
      $(window).resize(_.debounce(_.bind(this.resize, this), 20));
      this.resize();

      // Render lists.
      this.feed = new Events(this.app, {
        parentView: this,
        reverse: true,
        filters: false,
        headers: false
      });
      this.boulders = new Ticks(this.app, {parentView: this, type: 'tick',
          subtype: 'b', heading: 'Boulders'});
      this.routes = new Ticks(this.app, {parentView: this, type: 'tick',
          subtype: 'r', heading: 'Routes'});

      // Handle the screenshots.
      this.$('.fancybox').fancybox({
        openEffect: 'fade',
        closeEffect: 'fade',
        closeBtn: false,
        nextClick: true,
        padding: 0
      });

      return this;
    },

    resize: function (e) {
      if (this.top.length) {
        var h = Math.max($(window).height() - this.header.height(), 0);
        this.topInner.height(h);
      }
    },

    empty: function () {
      this.$el.empty();
      return this;
    },

    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.feed.destroy();
      this.boulders.destroy();
      this.routes.destroy();
      this.undelegateEvents();
      this.stopListening();
      this.empty();
    },

    submit: function (e) {
      e.preventDefault();

      // Prevent multiple uploads at the same time.
      if (this.working) {
        return false;
      }
      this.working = true;

      // Grab the form data.
      var payload = {email: this.signupInput.val().trim()};

      // Client-side form check.
      var check = util.ensure(payload, ['email']);

      // Add alerts.
      _.each(check.missing, _.bind(function (m, i) {
        var field = this.$('input[type="' + m + '"]');
        field.val('');
        if (i === 0) {
          field.focus();
        }
      }, this));

      if (!util.isEmail(payload.email) || !check.valid) {

        // Set the error display.
        this.signupInput.val('').attr('placeholder',
            'Hey, comrade! We need a valid email address.').focus();
        this.working = false;

        return false;
      }

      // Start load indicator.
      this.signupButtonSpin.start();
      this.signupSubmit.addClass('spinning').attr('disabled', true);

      // Do the API request.
      rest.post('/api/signups', payload, _.bind(function (err, data) {
        
        // Start load indicator.
        this.signupButtonSpin.stop();
        this.signupSubmit.removeClass('spinning').attr('disabled', false);
        this.signupInput.val('');
        this.working = false;

        if (err) {

          // Set the error display.
          if (err.message && err.message === 'Exists') {
            this.signupInput.attr('placeholder',
                'Excited, huh? We\'ll be in touch soon.');
          } else if (err.message && err.message === 'Invited') {
            this.signupInput.attr('placeholder', 'You\'ve already been invited.');
          } else {
            this.signupInput.attr('placeholder', 'Oops! Try again.').focus();
          }

          // In case of spammers
          if (!this.failedAttempts) {
            this.failedAttempts = 0;
          }
          ++this.failedAttempts;
          if (this.failedAttempts >= 10) {
            delete this.failedAttempts;
            this.signupInput.attr('placeholder', 'Whoa there, partner.')
                .attr('disabled', true);
            this.signupSubmit.attr('disabled', true);
            _.delay(_.bind(function () {
              this.signupInput.attr('placeholder', 'Enter your email')
                  .attr('disabled', false);
              this.signupSubmit.attr('disabled', false);
            }, this), 2000);
          }

          return;
        }

        this.signupInput.attr('placeholder',
            'Thank you! We\'ll send an invite soon.');
      }, this));

      return false;
    },

  });
});
