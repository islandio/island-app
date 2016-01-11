/*
 * Merge ascents view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rest',
  'util',
  'Spin',
  'text!../../templates/ascents.merge.html'
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

      // Handle selects.
      util.customSelects(this.el);

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
      'click .new-session-boulder': 'checkBoulder',
      'click .new-session-route': 'checkRoute',
      'click .modal-cancel': 'cancel',
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

      // Restric numeric inputs.
      util.numbersOnly(this.$('.numeric'));

      // Handle warning, and error displays.
      this.$('input[type="text"]').blur(function (e) {
        var el = $(e.target);
        if (el.hasClass('required') && el.val().trim() === '' &&
            !$('.search-choice', el.parent()).is(':visible')) {
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
        this.$('input[name="name"]').focus();
      }, this), 1);

      // Choose values if pending ascent present.
      var leader = this.options.ascents[0];

      this.$('input[name="name"]').val(leader.name);
      if (leader.type === 'b') {
        this.checkBoulder();
      } else {
        this.checkRoute();
      }
      this.selectOption('grade', leader.grade);
      this.selectOption('rock', leader.rock);

      var note = [];
      _.each(this.options.ascents, function (a, i) {
        if (!a.note || a.note.trim() === '') {
          return;
        }
        note.push(a.note);
      });
      note = note.join('\n- - - - - - - - - - - - - - - - - - - -\n');
      this.$('textarea[name="note"]').val(note);

      // Autogrow the write comment box.
      this.$('textarea[name="note"]').autogrow();

      this.validate();

      return this;
    },

    selectOption: function (key, val) {
      if (val === undefined) {
        return;
      }
      var opt = this.$('select[name="' + key + '"] option[value="' +
          val + '"]');
      $('.select-styled', this.$('select[name="' + key + '"]').parent())
          .text(opt.text());
      opt.attr('selected', true);
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

    validate: function () {

      // Validate log button.
      var name = this.$('input[name="name"]').val().trim();
      var grade = this.$('select[name="grade"]').val();
      var rock = this.$('select[name="rock"]').val();
      if (name === '') {
        this.submitButton.attr('disabled', true).addClass('disabled');
      } else {
        this.submitButton.attr('disabled', false).removeClass('disabled');
      }
      var type = this.$('.new-session-boulder').is(':checked') ? 'b': 'r';
      this.updateGrades(type, this.options.ascents[0].country);
    },

    checkBoulder: function () {
      var b = this.$('.new-session-boulder');
      var r = this.$('.new-session-route');
      b.attr('checked', true);
      r.attr('checked', false);
      this.swapImg(b);
      this.swapImg(r);
      this.updateGrades('b', this.options.ascents[0].country);
    },

    checkRoute: function () {
      var b = this.$('.new-session-boulder');
      var r = this.$('.new-session-route');
      b.attr('checked', false);
      r.attr('checked', true);
      this.swapImg(b);
      this.swapImg(r);

      this.updateGrades('r', this.options.ascents[0].country);
    },

    swapImg: function (el) {
      var img = $('img', el.parent());
      var src = img.data('alt');
      img.data('alt', img.attr('src'));
      img.attr('src', src);
    },

    getPayload: function () {

      // Sanitize.
      this.$('input[type!="submit"]:visible, textarea:visible')
          .each(function () {
        $(this).val(util.sanitize($(this).val()));
      });

      // Build the payload.
      var type = this.$('.new-session-boulder').is(':checked') ? 'b': 'r';
      var grade = Number(this.$('select[name="grade"]').val());
      var payload = {
        ascent_ids: _.map(this.options.ascents, function (a) {
          return a.id;
        }),
        props: {
          name: this.$('input[name="name"]').val().trim(),
          type: type,
          grade: grade,
          rock: this.$('select[name="rock"]').val(),
          note: this.$('textarea[name="note"]').val().trim()
        }
      };

      return payload;
    },

    submit: function (e) {
      e.preventDefault();
      var payload = this.getPayload();

      this.submitButtonSpin.start();
      this.submitButton.addClass('spinning').attr('disabled', true);

      // Do the API request.
      rest.post('/api/ascents/merge', payload, _.bind(function (err, data) {

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
          message: 'You merged ' + payload.ascent_ids.length + ' climb' +
              (payload.ascent_ids.length !== 1 ? 's' : '') + ' in ' +
              this.options.ascents[0].crag + '.',
          level: 'alert',
          type: 'popup'
        }, true]);

        this.app.router.navigate('/crags/' + data.key, {trigger: true});

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

    updateGrades: function (type, country) {
      var added = [];
      var select = this.$('select[name="grade"]');
      var grades = select.parent().find('li');
      var chosen = select.parent().find('.select-styled');
      var txt = chosen.text();
      var val = Number(select.val());
      if (txt !== 'Project' && !isNaN(val)) {
        chosen.text(this.app.gradeConverter[type].convert(val, country));
      }
      grades.each(_.bind(function (index, el) {
        var $e = $(el);
        var from = Number($e.attr('rel'));
        if (!_.isNaN(from)) {
          var grade = this.app.gradeConverter[type].convert(from, country);
          if (added.indexOf(grade) !== -1) {
            $e.hide();
          } else {
            added.push(grade);
            $e.text(grade).show();
          }
        }
      }, this));
    },

    removeAscent: function (e) {
      var li = $(e.target).closest('li');
      this.options.ascents = _.reject(this.options.ascents, function (a) {
        return a.id === li.attr('id');
      });
      li.remove();
      if (this.options.ascents.length < 2) {
        this.cancel();
      }
    },

  });
});
