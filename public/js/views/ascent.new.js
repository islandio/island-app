/*
 * New ascent view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rest',
  'util',
  'Spin',
  'text!../../templates/ascent.new.html',
  'views/lists/choices',
  'views/session.new'
], function ($, _, Backbone, mps, rest, util, Spin, template, Choices,
      NewSession) {
  return Backbone.View.extend({

    className: 'new-session',

    initialize: function (app, options) {
      this.app = app;
      this.options = options || {};
      this.subscriptions = [];
      this.on('rendered', this.setup, this);
    },

    render: function () {
      this.template = _.template(template);
      this.$el.html(this.template.call(this));

      // Handle selects.
      util.customSelects(this.el);

      // Dump content into modal.
      $.fancybox(this.$el, {
        openEffect: 'fade',
        closeEffect: 'fade',
        closeBtn: false,
        padding: 0,
        minWidth: 680
      });

      this.trigger('rendered');
      return this;
    },

    events: {
      'click .new-session-button': 'submit',
      'click .new-session-boulder': 'checkBoulder',
      'click .new-session-route': 'checkRoute',
      'click .modal-cancel': 'cancel',
      'click .modal-back': 'back',
      'click .add-crag': 'addNewCrag'
    },

    setup: function () {

      // Save refs.
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

      // Restric numeric inputs.
      util.numbersOnly(this.$('.numeric'));

      // Autogrow the write comment box.
      this.$('textarea[name="note"]').autogrow();

      // Handle warning, and error displays.
      this.$('input[type="text"]').blur(function (e) {
        var el = $(e.target);
        if (el.hasClass('required') && el.val().trim() === ''
            && !$('.search-choice', el.parent()).is(':visible')) {
          el.addClass('input-warning');
        }
        if (el.hasClass('input-error')) {
          el.removeClass('input-error');
        }
      });

      // Handle tips on focus.
      this.$('input[type="text"]').focus(function (e) {
        var el = $(e.target);
        if (el.hasClass('input-warning')) {
          el.removeClass('input-warning');
        }
      });

      // Validate on change.
      this.$('input[name="name"]').keyup(_.bind(this.validate, this));
      this.$('select[name="grade"]').change(_.bind(this.validate, this));
      this.$('select[name="rock"]').change(_.bind(this.validate, this));

      // Focus cursor initial.
      _.delay(_.bind(function () {
        if (!this.options.crag_id) {
          this.$('.new-session-crag-search-input').focus();
        } else {
          this.$('input[name="name"]').focus();
        }
      }, this), 1);

      return this;
    },

    selectOption: function (key, val) {
      if (val === undefined) {
        return;
      }
      var opt = this.$('select[name="' + key + '"] option[value="'
          + val + '"]');
      $('.select-styled', this.$('select[name="' + key + '"]').parent())
          .text(opt.text());
      opt.attr('selected', true);
    },

    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.cragChoices.destroy();
      this.undelegateEvents();
      this.stopListening();
      $.fancybox.close();
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

      // Validate log button.
      var name = this.$('input[name="name"]').val().trim();
      var grade = this.$('select[name="grade"]').val();
      var rock = this.$('select[name="rock"]').val();
      if (!crag || name === '' || grade === 'hide' || rock === 'hide') {
        this.submitButton.attr('disabled', true).addClass('disabled');
      } else {
        this.submitButton.attr('disabled', false).removeClass('disabled');
      }
    },

    checkBoulder: function (e) {
      var b = this.$('.new-session-boulder');
      var r = this.$('.new-session-route');
      b.attr('checked', true);
      r.attr('checked', false);
    },

    checkRoute: function (e) {
      var b = this.$('.new-session-boulder');
      var r = this.$('.new-session-route');
      b.attr('checked', false);
      r.attr('checked', true);
    },

    getPayload: function () {

      // Sanitize.
      this.$('input[type!="submit"]:visible, textarea:visible')
          .each(function (i) {
        $(this).val(util.sanitize($(this).val()));
      });

      var cragChoice = this.cragChoices.choice ? 
          this.cragChoices.choice.model.attributes: {};

      // Build the payload.
      var type = this.$('.new-session-boulder').is(':checked') ? 'b': 'r';
      var grade = Number(this.$('select[name="grade"]').val());
      var payload = {
        crag_id: cragChoice.id,
        sector: this.$('input[name="sector"]').val().trim(),
        name: this.$('input[name="name"]').val().trim(),
        type: type,
        grades: isNaN(grade) ? []: [this.app.grades[this.app.grades.length - grade - 1]],
        rock: this.$('select[name="rock"]').val(),
        note: this.$('textarea[name="note"]').val().trim()
      };

      return payload;
    },

    submit: function (e) {
      e.preventDefault();
      var payload = this.getPayload();

      this.submitButtonSpin.start();
      this.submitButton.addClass('spinning').attr('disabled', true);

      // Do the API request.
      rest.post('/api/ascents/', payload, _.bind(function (err, data) {

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
          message: 'You added a new ascent in ' + data.crag + '.',
          level: 'alert'
        }, true]);

        // Go to new ascent page.
        this.app.router.navigate('crags/' + data.key, {trigger: true});
        this.destroy();

        if (this.options.back) {
          new NewSession(this.app, {crag_id: data.crag_id,
              ascent_id: data.ascent_id}).render();
        }
      }, this));

      return false;
    },

    addNewCrag: function (e) {
      e.preventDefault();
      return false;
    },

    back: function (e) {
      if (e) {
        e.preventDefault();
      }
      this.destroy();
      new NewSession(this.app, {crag_id: this.options.crag_id}).render();
    },

    cancel: function (e) {
      if (e) {
        e.preventDefault();
      }
      this.destroy();
    }

  });
});
