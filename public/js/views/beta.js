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
  'text!../../templates/beta.html'
], function ($, _, Backbone, mps, rest, util, Spin, Events, template) {
  return Backbone.View.extend({

    el: '.main',

    initialize: function (app) {
      this.app = app;
      this.subscriptions = [];
      this.on('rendered', this.setup, this);
    },

    render: function () {
      this.app.title('Island | Train · Climb');

      this.template = _.template(template);
      this.$el.html(this.template.call(this));

      this.trigger('rendered');

      return this;
    },

    events: {
      'click .splash-form button': 'submit',
    },

    setup: function () {

      this.top = this.$('.splash-top');
      this.topInner = this.$('.splash-top-inner');
      this.topBottom = this.$('.splash-top-bottom');
      this.bottom = this.$('.splash-bottom');
      this.header = $('.header');
      this.signupSubmit = this.$('button');
      this.signupInput = this.$('.splash-signup');
      this.signupButtonSpin = new Spin($('.button-spin', this.el), {
        color: '#396400',
        lines: 13,
        length: 3,
        width: 2,
        radius: 6,
      });

      // Embed the background video.
      swfobject.embedSWF(
          __s + '/swf/roll.swf', 'roll', '100%', '100%', '10',
          false, {}, {menu: 'false', wmode: 'opaque'});
      _.delay(_.bind(function () {
        this.$('.banner-roll').css({opacity: 1});
      }, this), 300);

      // Handle resizing.
      $(window).resize(_.debounce(_.bind(this.resize, this), 20));
      this.resize();

      // Render lists.
      /*
      this.events = new Events(this.app, {
        parentView: this,
        reverse: true,
        filters: false,
        headers: false
      });
      */

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
      this.undelegateEvents();
      this.stopListening();
      this.empty();
    },

    submit: function (e) {
      e.preventDefault();

      // Prevent multiple uploads at the same time.
      if (this.working) return false;
      this.working = true;

      // Grab the form data.
      var payload = {email: this.signupInput.val().trim()};

      // Client-side form check.
      var check = util.ensure(payload, ['email']);

      // Add alerts.
      _.each(check.missing, _.bind(function (m, i) {
        var field = this.$('input[type="' + m + '"]');
        field.val('').addClass('input-error');
        if (i === 0) field.focus();
      }, this));

      if (!util.isEmail(payload.email) || !check.valid) {

        // Set the error display.
        this.signupInput.val('').addClass('input-error')
            .attr('placeholder', 'Hey friend! We need a valid Email address')
            .focus();
        this.working = false;

        return false;
      }

      // Start load indicator.
      this.signupButtonSpin.start();
      this.signupSubmit.addClass('loading');
      this.signupSubmit.attr({disabled: 'disabled'});
      this.signupInput.removeClass('input-error');

      // Do the API request.
      rest.post('/api/signups', payload, _.bind(function (err, data) {
        
        // Start load indicator.
        this.signupButtonSpin.stop();
        this.signupSubmit.removeClass('loading');
        this.signupInput.val('');
        this.working = false;

        if (err) {

          // Set the error display.
          if (err.message && err.message === 'Exists') {
            this.signupInput.attr('placeholder', "Excited, huh? We'll be in touch soon.");
          } else {
            this.signupInput.addClass('input-error')
                .attr('placeholder', 'Oops! Try again')
                .focus();
          }

          // in case of spammers
          setTimeout(_.bind(function() {
            this.signupSubmit.removeAttr('disabled');
          }, this), 2000);

          return;
        }

        this.signupSubmit.hide();
        var width = this.signupInput.width();
        this.signupInput.attr('placeholder', '');
        this.signupInput.animate({width: width + 200}, 500, _.bind(function() {
          this.signupInput
            .attr('placeholder', "Thanks! We'll get in touch soon.")
            .attr({disabled: 'disabled'});
        }, this));

        // Ready for more.
        this.working = false;
      }, this));

      return false;
    },

  });
});
