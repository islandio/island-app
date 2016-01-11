/*
 * Delete ascents view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rest',
  'util',
  'Spin',
  'text!../../templates/ascents.delete.html'
], function ($, _, Backbone, mps, rest, util, Spin, template) {
  return Backbone.View.extend({

    className: 'new-session',

    initialize: function (app, options) {
      this.app = app;
      this.options = options || {};
      this.subscriptions = [];
      this.on('rendered', this.setup, this);
    },

    render: function () {
      this.options.cragName = this.options.ascents[0].crag;
      this.template = _.template(template);
      this.$el.html(this.template.call(this));

      // Dump content into modal.
      $.fancybox(this.$el, {
        openEffect: 'fade',
        closeEffect: 'fade',
        closeBtn: false,
        padding: 0,
        minWidth: 680,
        modal: true
      });

      this.trigger('rendered');
      return this;
    },

    events: {
      'click .modal-delete': 'submit',
      'click .modal-cancel': 'cancel',
      'click .ascents-tools-list-remove': 'removeAscent'
    },

    setup: function () {
      this.submitButton = this.$('.modal-delete');
      this.submitButtonSpin = new Spin($('.button-spin', this.el), {
        color: '#d04c38',
        lines: 13,
        length: 3,
        width: 2,
        radius: 6
      });

      return this;
    },

    destroy: function () {
      $.fancybox.close();
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.undelegateEvents();
      this.stopListening();
    },

    navigate: function (e) {
      e.preventDefault();
      var path = $(e.target).closest('a').attr('href');
      if (path) {
        this.app.router.navigate(path, {trigger: true});
      }
    },

    getPayload: function () {
      return {
        ascent_ids: _.map(this.options.ascents, function (a) {
          return a.id;
        })
      };
    },

    submit: function (e) {
      e.preventDefault();
      if (!this.armedForDelete) {
        this.armedForDelete = true;
        this.submitButton.addClass('armed');
        $('span', this.submitButton).text('Confirm delete');
        return false;
      }

      var payload = this.getPayload();

      this.submitButtonSpin.start();
      this.submitButton.addClass('spinning').attr('disabled', true);

      // Do the API request.
      rest.delete('/api/ascents', payload, _.bind(function (err, data) {

        // Stop spinner.
        this.submitButtonSpin.stop();
        this.submitButton.removeClass('spinning').attr('disabled', false);

        if (err) {

          // Set the error display.
          mps.publish('flash/new', [{
            err: err,
            level: 'error'
          }, true]);
          return;
        }

        // Show success.
        mps.publish('flash/new', [{
          message: 'You deleted ' + payload.ascent_ids.length + ' climb' +
              (payload.ascent_ids.length !== 1 ? 's' : '') + ' from ' +
              this.options.ascents[0].crag + '.',
          level: 'alert',
          type: 'popup'
        }, true]);

        mps.publish('ascents/removeSelected');

        this.destroy();

      }, this));

      return false;
    },

    cancel: function (e) {
      if (e) {
        e.preventDefault();
      }
      this.destroy();
    },

    removeAscent: function (e) {
      var li = $(e.target).closest('li');
      this.options.ascents = _.reject(this.options.ascents, function (a) {
        return a.id === li.attr('id');
      });
      li.remove();
      if (this.options.ascents.length === 0) {
        this.cancel();
      }
    },

  });
});
