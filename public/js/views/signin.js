/*
 * Login view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'Modernizr',
  'mps',
  'rpc',
  'util',
  'text!../../../templates/signin.html',
  'swfobject',
  'Spin'
], function ($, _, Backbone, Modernizr, mps, rpc, util, template,
    swfobject, Spin) {

  return Backbone.View.extend({
    
    // The DOM target element for this page:
    className: 'signin',
    
    // Module entry point:
    initialize: function (app) {
      
      // Save app reference.
      this.app = app;

      // Shell events.
      this.on('rendered', this.setup, this);
    },

    // Draw the template
    render: function () {

      // UnderscoreJS rendering.
      this.template = _.template(template);
      this.$el.html(this.template.call(this));

      // Dump content into modal.
      $.fancybox(this.$el, {
        openEffect: 'fade',
        closeEffect: 'fade',
        closeBtn: false,
        padding: 0
      });

      // Add placeholder shim if need to.
      if (Modernizr.input.placeholder)
        this.$('input').placeholder();

      // Init the load indicator.
      this.spin = new Spin(this.$('#signin_spin'), {
        lines: 5, // The number of lines to draw
        length: 12, // The length of each line
        width: 8, // The line thickness
        radius: 24, // The radius of the inner circle
        corners: 1, // Corner roundness (0..1)
        rotate: 0, // The rotation offset
        direction: 1, // 1: clockwise, -1: counterclockwise
        color: '#000', // #rgb or #rrggbb
        speed: 1, // Rounds per second
        trail: 60, // Afterglow percentage
        shadow: false, // Whether to render a shadow
        hwaccel: false, // Whether to use hardware acceleration
        className: 'spinner', // The CSS class to assign to the spinner
        zIndex: 2e9, // The z-index (defaults to 2000000000)
        top: 'auto', // Top position relative to parent in px
        left: 'auto' // Left position relative to parent in px
      });

      // Embed the background video.
      swfobject.embedSWF(
          '/swf/roll.swf', 'roll', '100%', '100%', 10,
          '', {}, {menu: 'false'}, {});

      // Show the spinner when connecting.
      this.$('.signin-strategy-btn').click(_.bind(function (e) {
        this.$('.signin-action-inner').empty();
        this.spin.start();
      }, this));

      // Done rendering ... trigger setup.
      this.trigger('rendered');

      return this;
    },

    // Bind mouse events.
    events: {
      'click #signin': 'signin',
      'click #signup': 'signup'
    },

    // Misc. setup.
    setup: function () {

      // Save refs.
      this.signinForm = $('#signin_form');
      this.signupForm = $('#signup_form');
      this.signinLink = $('#signin_link');
      this.signupLink = $('#signup_link');

      // Handle switching between forms.
      $('a', this.signupLink).click(_.bind(function (e) {
        this.signinForm.animate({
          opacity: [0, 'easeOutExpo'],
          left: ['-=300', 'linear']
        }, 150, _.bind(function () {
          this.signinForm.hide();
          this.signinForm.css({opacity: 1, left: 0});
          this.signupForm.fadeIn('fast');
          this.focus();
        }, this));
        this.signupLink.hide();
        this.signinLink.show();
      }, this));
      $('a', this.signinLink).click(_.bind(function (e) {
        this.signupForm.animate({
          opacity: [0, 'easeOutExpo'],
          left: ['+=300', 'linear']
        }, 150, _.bind(function () {
          this.signupForm.hide();
          this.signupForm.css({opacity: 1, left: 0});
          this.signinForm.fadeIn('fast');
          this.focus();
        }, this));
        this.signinLink.hide();
        this.signupLink.show();
      }, this));

      // Handle error display.
      this.$('input[type="text"], input[type="password"]').blur(function (e) {
        var el = $(e.target);
        if (el.hasClass('input-error'))
          el.removeClass('input-error');
      });

      // Focus cursor.
      this.focus();

      return this;
    },

    // Focus on the first empty input field.
    focus: function (e) {
      _.find(this.$('input[type!="submit"]:visible'), function (i) {
        var empty = $(i).val().trim() === '';
        if (empty) $(i).focus();
        return empty;
      });
    },

    // Similar to Backbone's remove method, but empties
    // instead of removes the view's DOM element.
    empty: function () {
      this.$el.empty();
      return this;
    },

    // Kill this view.
    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.undelegateEvents();
      this.stopListening();
      this.empty();
    },

    signin: function (e) {
      e.preventDefault();

      // Grab the form data.
      var payload = this.signinForm.serializeObject();

      // Client-side form check.
      var errorMsg = $('.signin-error', this.signinForm);
      var check = util.ensure(payload, ['username', 'password']);

      // Add alerts.
      _.each(check.missing, _.bind(function (m, i) {
        var field = $('input[name="' + m + '"]', this.signinForm);
        field.val('').addClass('input-error');
        if (i === 0) field.focus();
      }, this));

      // Show messages.
      if (!check.valid) {

        // Set the error display.
        var msg = 'All fields are required.';
        errorMsg.text(msg);

        return;
      }

      // All good, show spinner.
      this.$('.signin-action-inner > div').hide();
      this.spin.start();

      // Do the API request.
      rpc.post('/api/members/auth', payload, _.bind(function (err, data) {
        if (err) {

          // Stop spinner.
          this.spin.stop();
          this.$('.signin-action-inner > div').show();

          // Set the error display.
          errorMsg.text(err);

          // Clear fields.
          $('input[type="text"], input[type="password"]',
              this.signinForm).val('').addClass('input-error');
          this.focus();
          
          return;
        }

        // TODO: Use the router.
        window.location.reload(true);

      }, this));

      return false;
    },

    signup: function (e) {
      e.preventDefault();

      // Grab the form data.
      var payload = this.signupForm.serializeObject();

      // Client-side form check.
      var errorMsg = $('.signin-error', this.signupForm);
      var check = util.ensure(payload, ['newusername', 'newemail',
          'newpassword']);
      
      // Add alerts.
      _.each(check.missing, _.bind(function (m, i) {
        var field = $('input[name="' + m + '"]', this.signupForm);
        field.val('').addClass('input-error');
        if (i === 0) field.focus();
      }, this));

      // Show messages.
      if (!check.valid) {

        // Set the error display.
        var msg = 'All fields are required.';
        errorMsg.text(msg);

        return;
      }
      if (!util.isEmail(payload.newemail)) {

        // Set the error display.
        $('input[name="newemail"]', this.signupForm)
            .val('').addClass('input-error').focus();
        var msg = 'That does not look like a valid email address.';
        errorMsg.text(msg);

        return;
      }

      // All good, show spinner.
      this.$('.signin-action-inner > div').hide();
      this.spin.start();

      // Do the API request.
      rpc.post('/api/members', payload, _.bind(function (err, data) {
        if (err) {

          // Stop spinner.
          this.spin.stop();
          this.$('.signin-action-inner > div').show();

          // Set the error display.
          errorMsg.text(err);

          // Clear fields.
          if (err === 'Username exists')
            $('input[name="newusername"]', this.signupForm)
                .val('').addClass('input-error').focus();
          else {
            $('input[type="text"], input[type="password"]',
                this.signupForm).val('').addClass('input-error');
            this.focus();
          }
          
          return;
        }

        // TODO: Use the router.
        window.location.reload(true);

      }, this));

      return false;
    },

  });
});
