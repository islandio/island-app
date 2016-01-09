/*
 * Move ascents view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rest',
  'util',
  'Spin',
  'text!../../templates/ascents.move.html',
  'views/lists/choices'
], function ($, _, Backbone, mps, rest, util, Spin, template, Choices) {
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
      'click .new-session-button': 'submit',
      'click .modal-cancel': 'cancel',
      'click .add-crag': 'addNewCrag',
      'click .ascents-tools-list-remove': 'removeAscent'
    },

    setup: function () {
      this.submitButton = this.$('.new-session-button');
      this.submitButtonSpin = new Spin($('.button-spin', this.el), {
        color: '#396400',
        lines: 13,
        length: 3,
        width: 2,
        radius: 6
      });

      // Init choices.
      this.cragChoices = new Choices(this.app, {
        reverse: true,
        el: '.new-session-crag-search',
        choose: true,
        onChoose: _.bind(this.validate, this),
        types: ['crags']
      });
      if (this.options.crag_id) {
        this.cragChoices.preChoose({type: 'crags', id: this.options.crag_id});
      }

      // Focus cursor initial.
      _.delay(_.bind(function () {
        if (!this.options.crag_id) {
          this.$('.new-session-crag-search-input').focus();
        }
      }, this), 1);

      return this;
    },

    destroy: function () {
      $.fancybox.close();
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      _.defer(_.bind(this.cragChoices.destroy, this));
      this.cragChoices.destroy();
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

    validate: function () {
      var crag = this.cragChoices.choice;

      if (!crag) {
        this.submitButton.attr('disabled', true).addClass('disabled');
      } else {
        this.submitButton.attr('disabled', false).removeClass('disabled');
      }
    },

    getPayload: function () {
      var cragChoice = this.cragChoices.choice ?
          this.cragChoices.choice.model.attributes: {};

      return {
        destination: cragChoice.name + ', ' + cragChoice.country,
        crag_id: cragChoice.id,
        ascent_ids: _.map(this.options.ascents, function (a) {
          return a.id;
        })
      };
    },

    submit: function (e) {
      e.preventDefault();
      var payload = this.getPayload();

      if (!payload.crag_id) {
        return false;
      }

      this.submitButtonSpin.start();
      this.submitButton.addClass('spinning').attr('disabled', true);

      // Do the API request.
      rest.post('/api/ascents/move', payload, _.bind(function (err, data) {

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
          message: 'You moved ' + payload.ascent_ids.length + ' ascent' +
              (payload.ascent_ids.length !== 1 ? 's' : '') + ' to ' +
              payload.destination + '.',
          level: 'alert',
          type: 'popup'
        }, true]);

        mps.publish('ascents/removeSelected');

        this.destroy();

      }, this));

      return false;
    },

    addNewCrag: function (e) {
      e.preventDefault();
      this.save();
      this.cancel();
      mps.publish('map/add');
      return false;
    },

    save: function () {
      var payload = this.getPayload();
      store.set('pendingAscentsMove', payload);
      return payload;
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
