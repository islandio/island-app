/*
 * Session view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rpc',
  'util',
  'text!../../templates/session.html',
  'Spin'
], function ($, _, Backbone, mps, rpc, util, template, Spin) {

  return Backbone.View.extend({

    // The DOM target element for this page
    className: 'session',

    // Module entry point
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
        padding: 0,
        modal: true
      });

      // Init the load indicator.
      this.spin = new Spin(this.$('.session-spin'), {
        lines: 17,
        length: 12,
        width: 4,
        radius: 18,
        color: '#4d4d4d'
      });

      // Show the spinner when connecting.
      this.$('.modal-submit').click(_.bind(function (e) {
        this.signinInner.fadeOut('fast');
        this.spin.start();
      }, this));

      // Done rendering ... trigger setup.
      this.trigger('rendered');

      return this;
    },

    // Bind mouse events.
    events: {
      'click .modal-submit': 'submit',
      'click .modal-cancel': 'cancel',
      'click .navigate': 'navigate',
    },

    // Misc. setup.
    setup: function () {

      // Save refs.
      this.dateInput = this.$('.datepicker').pickadate();
      this.datePicker = this.dateInput.pickadate('picker');

      // Autogrow the write comment box.
      this.$('textarea[name="note"]').autogrow();

      // Handle error display.
      this.$('input[type="text"]').blur(function (e) {
        var el = $(e.target);
        if (el.hasClass('input-error'))
          el.removeClass('input-error');
      });

      // Focus cursor initial.
      _.delay(_.bind(function () { this.focus(); }, this), 1);

      return this;
    },

    // Focus on the first empty input field.
    focus: function (e) {
      _.find(this.$('input[type!="submit"]:visible:not(.datepicker)'), function (i) {
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

    cancel: function (e) {
      $.fancybox.close();
    },

    submit: function (e) {

      // Sanitize.
      this.$('input[type!="submit"]:visible').each(function (i) {
        $(this).val(util.sanitize($(this).val()));
      });

      // Grab the form data.
      var payload = this.sessionForm.serializeObject();

      // Client-side form check.
      // var errorMsg = $('.signin-error', this.signinForm);
      // var check = util.ensure(payload, ['username', 'password']);

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

        return false;
      }

      // All good, show spinner.
      this.spin.start();

      // // Do the API request.
      // rpc.post('/api/sessions', payload, _.bind(function (err, data) {
      //   if (err) {

      //     // Stop spinner.
      //     this.spin.stop();

      //     // Set the error display.
      //     errorMsg.text(err.message);

      //     // Clear fields.
      //     $('input[type="text"], input[type="password"]',
      //         this.signinForm).val('').addClass('input-error');
      //     this.focus();

      //     return;
      //   }

      //   // Wait a little then close the modal.
      //   _.delay(_.bind(function () {
      //     $.fancybox.close();
      //   }, this), 2000);

      // }, this));

      return false;
    },

    navigate: function (e) {
      e.preventDefault();

      // Route to wherever.
      var path = $(e.target).closest('a').attr('href');
      if (path) {
        $.fancybox.close();
        this.app.router.navigate(path, {trigger: true});
      }
    },

  });
});
