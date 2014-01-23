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
  'text!../../templates/activity.html',
  'text!../../templates/tick.html',
  'views/lists/choices',
  'views/lists/events'
], function ($, _, Backbone, mps, rpc, util, template,
    activityTemp, tickTemp, Choices, Events) {

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
      'click .session-activity-clear': 'deleteActivity',
      'click .tick-button': 'addTick',
      'click .session-tick-clear': 'deleteTick',
      'click .session-button': 'submit',
      'click .navigate': 'navigate',
      'click .session-tried': 'checkTried',
      'click .session-sent': 'checkSent',
      'keyup .session-crag-search-input': 'validate',
      'click .session-crag-search .choice': 'validate',
      'click .session-crag-search .search-choice-clear': 'validate',
      'change .session-datepicker': 'validate',
      'change .session-activity-type': 'validateTicks'
    },

    // Misc. setup.
    setup: function () {

      // Save refs.
      this.dateInput = this.$('.session-datepicker').pickadate();
      this.activities = this.$('.session-activities');
      this.datePicker = this.dateInput.pickadate('picker');
      this.errorMsg = this.$('.session-error');
      this.submitButton = this.$('.session-button');

      // Init choices.
      this.cragChoices = new Choices(this.app, {
        reverse: true, 
        el: '.session-crag-search',
        choose: true,
        onChoose: _.bind(this.validateTicks, this),
        types: ['crags']
      });

      // Add first activity.
      this.addActivity();

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

      // Render lists.
      this.events = new Events(this.app, {parentView: this, reverse: true});

      return this;
    },

    // Focus on the first empty input field.
    focus: function (e) {
      _.find(this.$('input[type!="submit"]:visible:not(.session-datepicker)'),
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
      this.events.destroy();
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
      $(e.target).closest('.session-activity').remove();
    },

    validateTicks: function (e) {
      if (!this.cragChoices.choice) {
        this.$('.session-ticks').hide();
        _.each(this.tickChoices, function (t) {
          t.destroy();
        });
        this.tickChoices = {};
        this.$('.session-tick').remove();
        return;
      }
      var types = this.$('.session-activity-type');
      _.each(types, _.bind(function (t) {
        t = $(t);
        var opt = $('option[value="' + t.val() + '"]', t);
        var type = opt.data('type');
        var ticks = $('.session-ticks', t.closest('.session-activity'));
        var label = $('.tick-button span', ticks);
        if (type) {
          _.each($('.session-tick', ticks), _.bind(function (st) {
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
          _.each($('.session-tick', ticks), _.bind(function (st) {
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
      var ctx = $(e.target).closest('.session-activity');
      var types = $('.session-activity-type', ctx);
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
        el: $('.session-ascent-search', tick).get(0),
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
      var tick = $(e.target).closest('.session-tick');
      var tid = tick.data('tid');
      this.tickChoices[tid].destroy();
      delete this.tickChoices[tid];
      tick.remove();
    },

    checkTried: function (e) {
      var ctx = $(e.target).closest('.session-tick');
      var sent = $('.session-sent', ctx);
      var tried = $('.session-tried', ctx);
      $(sent).attr('checked', false);
      $(tried).attr('checked', true);
      $('.session-tick-details', ctx).hide();
    },

    checkSent: function (e) {
      var ctx = $(e.target).closest('.session-tick');
      var sent = $('.session-sent', ctx);
      var tried = $('.session-tried', ctx);
      $(sent).attr('checked', true);
      $(tried).attr('checked', false);
      $('.session-tick-details', ctx).show();
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
        note: this.$('#session-note').val().trim(),
        name: this.$('#session-name').val().trim()
      };

      // Get all actions.
      var actions = [];
      _.each(this.$('.session-activity'), _.bind(function (a) {
        a = $(a);
        var type = $('.session-activity-type', a);
        var action = {
          type: type.val(),
          duration: $('select[name="duration"]', a).val(),
          performance: $('select[name="performance"]', a).val()
        };

        // Get all ticks.
        var ticks = [];
        var tickType = $('option[value="' + type.val() + '"]', type).data('type');
        
        console.log($('.session-tick', a).length)
        _.each($('.session-tick', a), _.bind(function (t) {
          t = $(t);
          var choice = this.tickChoices[t.data('tid')].choice;
          if (!choice) return;
          var sent = $('.session-sent', t).is(':checked');
          var tick = {
            type: tickType,
            ascent_id: choice.model.id,
            sent: sent,
            note: $('textarea[name="note"]', t).val().trim()
          };
          if (sent)
            _.extend(tick, {
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

      console.log(payload);
      return;

      // Client-side form check.
      var check = util.ensure(payload, []);

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
      // this.spin.start();

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

  });
});
