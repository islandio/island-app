/*
 * New session view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rpc',
  'util',
  'Spin',
  'text!../../templates/session.new.html',
  'text!../../templates/activity.html',
  'text!../../templates/tick.html',
  'views/lists/choices'
], function ($, _, Backbone, mps, rpc, util, Spin, template,
    activityTemp, tickTemp, Choices) {

  return Backbone.View.extend({

    // The DOM target element for this page
    el: '.main',
    crag: null,
    tickChoices: {},

    // Module entry point
    initialize: function (app) {
      
      // Save app reference.
      this.app = app;

      // Shell events.
      this.on('rendered', this.setup, this);

      // Client-wide subscriptions
      this.subscriptions = [];
    },

    // Draw the template
    render: function () {

      // Set page title
      this.app.title('Log Session');

      // UnderscoreJS rendering.
      this.template = _.template(template);
      this.$el.html(this.template.call(this));
      this.activityTemp = _.template(activityTemp);
      this.tickTemp = _.template(tickTemp);

      // Done rendering ... trigger setup.
      this.trigger('rendered');

      return this;
    },

    // Bind mouse events.
    events: {
      'click .activity-button': 'addActivity',
      'click .new-session-activity-clear': 'deleteActivity',
      'click .tick-button': 'addTick',
      'click .new-session-tick-clear': 'deleteTick',
      'click .new-session-button': 'submit',
      'click .navigate': 'navigate',
      'click .new-session-tried': 'checkTried',
      'click .new-session-sent': 'checkSent',
      'keyup .new-session-crag-search-input': 'validate',
      'click .new-session-crag-search .choice': 'validate',
      'click .new-session-crag-search .search-choice-clear': 'validate',
      'change .new-session-datepicker': 'validate',
      'change .new-session-activity-type': 'validateTicks'
    },

    // Misc. setup.
    setup: function () {

      // Save refs.
      this.dateInput = this.$('.new-session-datepicker').pickadate();
      this.activities = this.$('.new-session-activities');
      this.datePicker = this.dateInput.pickadate('picker');
      this.errorMsg = this.$('.new-session-error');
      this.submitButton = this.$('.new-session-button');
      this.submitButtonSpin = new Spin($('.button-spin', this.el), {
        color: '#4d4d4d',
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
        onChoose: _.bind(this.validateTicks, this),
        types: ['crags']
      });

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
      _.find(this.$('input[type!="submit"]:visible:not(.new-session-datepicker)'),
          function (i) {
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

    navigate: function (e) {
      e.preventDefault();

      // Route to wherever.
      var path = $(e.target).closest('a').attr('href');
      if (path)
        this.app.router.navigate(path, {trigger: true});
    },

    addActivity: function (e) {
      if (e) e.preventDefault();

      // Render and attach.
      var activity = $(this.activityTemp.call(this))
          .insertBefore($('.activity-button'));

      // Handle selects.
      util.customSelects(activity);

      // Restric numeric inputs.
      util.numbersOnly($('.numeric', activity));

      // Handle error display.
      $('input[type="text"]', activity).blur(function (e) {
        var el = $(e.target);
        if (el.hasClass('input-error'))
          el.removeClass('input-error');
      });
    },

    deleteActivity: function (e) {
      if (e) e.preventDefault();

      // Remove.
      $(e.target).closest('.new-session-activity').remove();
    },

    validateTicks: function (e) {
      if (!this.cragChoices.choice) {
        this.$('.new-session-ticks').hide();
        _.each(this.tickChoices, function (t) {
          t.destroy();
        });
        this.tickChoices = {};
        this.$('.new-session-tick').remove();
        return;
      }
      var types = this.$('.new-session-activity-type');
      _.each(types, _.bind(function (t) {
        t = $(t);
        var opt = $('option[value="' + t.val() + '"]', t);
        var type = opt.data('type');
        var ticks = $('.new-session-ticks', t.closest('.new-session-activity'));
        var label = $('.tick-button span', ticks);
        if (type) {
          _.each($('.new-session-tick', ticks), _.bind(function (st) {
            st = $(st);
            var tid = st.data('tid');
            var stt = this.tickChoices[tid].options.query.type;
            if (stt)
              if (stt !== type) st.addClass('hidden');
              else st.removeClass('hidden');
            else
              this.tickChoices[tid].options.query.type = type;
          }, this));
          ticks.show();
          if (type === 'b') label.text('Problem');
          else label.text('Route');
        } else {
          ticks.hide();
          _.each($('.new-session-tick', ticks), _.bind(function (st) {
            st = $(st);
            var tid = st.data('tid');
            this.tickChoices[tid].destroy();
            delete this.tickChoices[tid];
            st.remove();
          }, this));
        }
      }, this));
    },

    addTick: function (e) {
      if (e) e.preventDefault();

      // Render and attach.
      var ctx = $(e.target).closest('.new-session-activity');
      var types = $('.new-session-activity-type', ctx);
      var type = $('option[value="' + types.val() + '"]', types).data('type');
      var title = type === 'b' ? 'Problem': 'Route';
      var tick = $(this.tickTemp.call(this, {title: title}))
          .insertBefore($('.tick-button', ctx));
      var tid = util.makeID();
      tick.attr('data-tid', tid);

      // Handle selects.
      util.customSelects(tick);

      // Restric numeric inputs.
      util.numbersOnly($('.numeric', tick));

      // Autogrow the write comment box.
      $('textarea[name="note"]', tick).autogrow();

      // Init choices.
      var choices = new Choices(this.app, {
        reverse: true, 
        el: $('.new-session-ascent-search', tick).get(0),
        choose: true,
        types: ['ascents'],
        query: {
          crag_id: this.cragChoices.choice.model.id,
        }
      });
      this.tickChoices[tid] = choices;
      this.validateTicks();

      // Handle error display.
      $('input[type="text"]', tick).blur(function (e) {
        var el = $(e.target);
        if (el.hasClass('input-error'))
          el.removeClass('input-error');
      });
    },

    deleteTick: function (e) {
      if (e) e.preventDefault();

      // Remove.
      var tick = $(e.target).closest('.new-session-tick');
      var tid = tick.data('tid');
      this.tickChoices[tid].destroy();
      delete this.tickChoices[tid];
      tick.remove();
    },

    checkTried: function (e) {
      var ctx = $(e.target).closest('.new-session-tick');
      var sent = $('.new-session-sent', ctx);
      var tried = $('.new-session-tried', ctx);
      $(sent).attr('checked', false);
      $(tried).attr('checked', true);
      $('.new-session-tick-details', ctx).hide();
    },

    checkSent: function (e) {
      var ctx = $(e.target).closest('.new-session-tick');
      var sent = $('.new-session-sent', ctx);
      var tried = $('.new-session-tried', ctx);
      $(sent).attr('checked', true);
      $(tried).attr('checked', false);
      $('.new-session-tick-details', ctx).show();
    },

    validate: function (e) {
      if (!this.cragChoices.choice
          || this.dateInput.val().trim() === '')
        this.submitButton.attr('disabled', true).addClass('disabled');
      else
        this.submitButton.attr('disabled', false).removeClass('disabled');
      return true;
    },

    submit: function (e) {

      // Sanitize.
      this.$('input[type!="submit"]:visible, textarea:visible')
          .each(function (i) {
        $(this).val(util.sanitize($(this).val()));
      });

      // Build the payload.
      var payload = {
        crag_id: this.cragChoices.choice.model.id,
        date: this.datePicker.get('select').pick,
        note: this.$('#new-session-note').val().trim(),
        name: this.$('#new-session-name').val().trim()
      };

      // Handle name.
      if (payload.name === '')
        payload.name = (new Date).format('mm/dd/yy');

      // Get all actions.
      var actions = [];
      _.each(this.$('.new-session-activity'), _.bind(function (a, i) {
        a = $(a);
        var type = $('.new-session-activity-type', a);
        var actionType = type.val();
        if (actionType === 'hide') return;
        var action = {
          index: i,
          type: actionType,
          duration: $('select[name="duration"]', a).val(),
          performance: $('select[name="performance"]', a).val()
        };

        // Get all ticks.
        var ticks = [];
        var tickType = $('option[value="' + actionType + '"]',
            type).data('type');
        _.each($('.new-session-tick', a), _.bind(function (t, i) {
          t = $(t);
          var choice = this.tickChoices[t.data('tid')].choice;
          if (!choice) return;
          var sent = $('.new-session-sent', t).is(':checked');
          var tick = {
            index: i,
            type: tickType,
            ascent_id: choice.model.id,
            note: $('textarea[name="note"]', t).val().trim()
          };
          if (sent)
            _.extend(tick, {
              sent: true,
              grade: $('select[name="grade"]', t).val(),
              feel: $('select[name="feel"]', t).val(),
              tries: $('select[name="tries"]', t).val(),
              rating: $('select[name="rating"]', t).val(),
              first: $('select[name="first"]', t).val()
            });
          ticks.push(tick);
        }, this));

        if (ticks.length !== 0) action.ticks = ticks;
        actions.push(action);
      }, this));
      if (actions.length !== 0) payload.actions = actions;

      // All good, show spinner.
      this.submitButtonSpin.start();
      this.submitButton.addClass('spinning');

      // Do the API request.
      rpc.post('/api/sessions', payload, _.bind(function (err, data) {

        // Stop spinner.
        this.submitButtonSpin.stop();
        this.submitButton.removeClass('spinning');
        
        if (err) {

          // Set the error display.
          mps.publish('flash/new', [{
            message: err,
            level: 'error'
          }, true]);
          return;
        }

        // Scroll to top.
        $(window).scrollTop(0);

        // Show success.
        mps.publish('flash/new', [{
          message: 'You logged a session.',
          level: 'alert'
        }, true]);

        // Clear fields.
        _.each(this.tickChoices, function (tc) { tc.destroy(); });
        this.tickChoices = {};
        $('.new-session-activity').remove();
        this.$('input[type="text"], textarea').val('');
        this.cragChoices.clearChoice();
        this.validate();

      }, this));

      return false;
    },

  });
});
