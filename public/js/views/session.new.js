/*
 * New log view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rest',
  'util',
  'Spin',
  'text!../../templates/session.new.html',
  'text!../../templates/activity.new.html',
  'text!../../templates/tick.new.html',
  'views/lists/choices'
], function ($, _, Backbone, mps, rest, util, Spin, template,
    activityTemp, tickTemp, Choices) {
  return Backbone.View.extend({

    className: 'new-session',
    crag: null,
    tickChoices: {},

    initialize: function (app, options) {
      this.app = app;
      this.options = options;
      this.subscriptions = [];
      this.on('rendered', this.setup, this);
    },

    render: function () {
      this.template = _.template(template);
      this.activityTemp = _.template(activityTemp);
      this.tickTemp = _.template(tickTemp);
      this.$el.html(this.template.call(this, {tick: this.tickTemp.call(this,
          {closable: false})}));

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
      'click .new-session-tried': 'checkTried',
      'click .new-session-sent': 'checkSent',
      'click .modal-cancel': 'cancel'
    },

    setup: function () {
      var tick = this.options.tick;

      // Save refs.
      this.errorMsg = this.$('.new-session-error');
      this.submitButton = this.$('.new-session-button');
      this.submitButtonSpin = new Spin($('.button-spin', this.el), {
        color: '#396400',
        lines: 13,
        length: 3,
        width: 2,
        radius: 6,
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
        this.cragChoices.preChoose({type: 'crags', id: this.options.crag_id},
            !!tick);
      }

      // Init choices.
      var query = this.options.crag_id ? {crag_id: this.options.crag_id}: null;
      this.tickChoices = new Choices(this.app, {
        reverse: true,
        el: '.new-session-ascent-search',
        choose: true,
        onChoose: _.bind(this.validate, this),
        types: ['ascents'],
        query: query
      });
      if (this.options.ascent_id) {
        this.tickChoices.preChoose({type: 'ascents',
            id: this.options.ascent_id}, !!tick);
      }

      // Handle date.
      var date = this.options.tick ? this.options.tick.date: null;
      date = date ? new Date(date): new Date();
      this.dateInput = this.$('.new-session-datepicker').pickadate({
        onStart: function () {
          this.set('select', [date.getFullYear(), date.getMonth(),
              date.getDate()]);
        },
        onSet: _.bind(this.validate, this)
      });
      this.datePicker = this.dateInput.pickadate('picker');

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

      // Focus cursor initial.
      _.delay(_.bind(function () {
        if (!this.options.ascent_id) {
          this.$('.new-session-ascent-search-input').focus();
        } else {
          this.$('textarea[name="note"]').focus();
        }
      }, this), 1);

      // Choose values if tick present.
      if (tick) {
        this.selectOption('duration', tick.duration);
        this.selectOption('performance', tick.performance);
        this.selectOption('grade', tick.grade);
        this.selectOption('feel', tick.feel);
        this.selectOption('tries', tick.tries);
        this.selectOption('rating', tick.rating);
        if (tick.first !== undefined || tick.firstf !== undefined) {
          if (tick.first === true) {
            tick.first = 1;
          } else if (tick.firstf === true) {
            tick.first = 2;
          } else {
            tick.first = 0;
          }
          this.selectOption('first', tick.first);
        }
        if (tick.note) {
          this.$('textarea[name="note"]').val(tick.note)
        }
        if (tick.sent) {
          this.checkSent();
        }
      }

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
      this.tickChoices.destroy();
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
      var tick = this.tickChoices.choice;

      // Ensure the tick is from the crag.
      if (crag) {
        if (tick && tick.model.get('crag_id') !== crag.model.get('id')) {
          this.tickChoices.clearChoice();
        }
        this.tickChoices.options.query.crag_id = crag.model.get('id');
      } else if (!crag) {
        if (tick && !this.tickChoices.options.query.crag_id) {
          this.cragChoices.preChoose({type: 'crags', id: tick.model.get('crag_id')});
        }
        this.tickChoices.options.query = {};
      }

      // Validate log button.
      var dateTxt = this.dateInput ? this.dateInput.val().trim(): '';
      if (!crag || !tick || dateTxt === '') {
        this.submitButton.attr('disabled', true).addClass('disabled');
      } else {
        this.submitButton.attr('disabled', false).removeClass('disabled');
      }
    },

    checkTried: function (e) {
      var ctx = this.$('.new-session-tick');
      var sent = $('.new-session-sent', ctx);
      var tried = $('.new-session-tried', ctx);
      $(sent).attr('checked', false);
      $(tried).attr('checked', true);
      $('.new-session-tick-details', ctx).hide();
    },

    checkSent: function (e) {
      var ctx = this.$('.new-session-tick');
      var sent = $('.new-session-sent', ctx);
      var tried = $('.new-session-tried', ctx);
      $(sent).attr('checked', true);
      $(tried).attr('checked', false);
      $('.new-session-tick-details', ctx).show();
    },

    submit: function (e) {
      e.preventDefault();
      var oldTick = this.options.tick;

      // Sanitize.
      this.$('input[type!="submit"]:visible, textarea:visible')
          .each(function (i) {
        $(this).val(util.sanitize($(this).val()));
      });

      var tickChoice = this.tickChoices.choice.model.attributes;
      var cragChoice = this.cragChoices.choice.model.attributes;

      // Build the payload.
      var payload = {
        crag_id: cragChoice.id,
        date: this.datePicker.get('select').pick,
        name: (new Date(this.datePicker.get('select').pick)).format('mm.dd.yy')
      };
      if (oldTick) {
        payload.tick_id = oldTick.id;
      }

      // Get all actions.
      var actions = [];
      var action = {
        index: 0,
        type: tickChoice.type
      };

      // Get tick.
      var ticks = [];
      var tick = {
        index: 0,
        type: tickChoice.type,
        ascent_id: tickChoice.id,
        duration: this.$('select[name="duration"]').val(),
        performance: this.$('select[name="performance"]').val(),
        note: this.$('textarea[name="note"]').val().trim()
      };
      var sent = this.$('.new-session-sent').is(':checked');
      if (sent) {
        _.extend(tick, {
          sent: true,
          grade: this.$('select[name="grade"]').val(),
          feel: this.$('select[name="feel"]').val(),
          tries: this.$('select[name="tries"]').val(),
          rating: this.$('select[name="rating"]').val(),
          first: this.$('select[name="first"]').val()
        });
      }
      ticks.push(tick);
      action.ticks = ticks;
      actions.push(action);
      payload.actions = actions;

      // All good, show spinner.
      this.submitButtonSpin.start();
      this.submitButton.addClass('spinning').attr('disabled', true);

      var fn = oldTick ? rest.put: rest.post;
      var path = oldTick ? '/api/sessions/' + oldTick.id: '/api/sessions';

      // Do the API request.
      fn(path, payload, _.bind(function (err, data) {

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
          message: 'You ' + (oldTick ? 'updated': 'logged') + ' an ascent.',
          level: 'alert'
        }, true]);

        this.destroy();
      }, this));

      return false;
    },

    cancel: function (e) {
      e.preventDefault();
      $.fancybox.close();
    },

  });
});
