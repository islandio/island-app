/*
 * Page view for an ascent profile.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rest',
  'util',
  'models/ascent',
  'text!../../templates/ascent.html',
  'text!../../templates/ascent.title.html',
  'views/lists/events',
  'views/lists/watchers',
  'views/instafeed',
  'views/chart.histogram',
  'text!../../templates/confirm.html',
  'Skycons'
], function ($, _, Backbone, mps, rest, util, Ascent, template, title, Events,
      Watchers, Instafeed, Histogram, confirm, Skycons) {
  return Backbone.View.extend({

    el: '.main',

    initialize: function (app, options) {
      this.app = app;
      this.options = options || {};
      this.subscriptions = [];
      this.on('rendered', this.setup, this);
    },

    render: function () {
      var data = this.app.profile.content.page;
      data.gradeConverter = this.app.gradeConverter[data.type];
      data.prefs = this.app.profile.member ? this.app.profile.member.prefs:
          this.app.prefs;
      this.model = new Ascent(data);
      this.template = _.template(template);
      this.$el.html(this.template.call(this));
      this.setTitle();
      this.title = _.template(title).call(this);

      _.defer(_.bind(function () {
        var weather = this.app.profile.weather;
        if (weather) {
          this.skycons = new Skycons({'color': '#666', static: true});
          this.skycons.add('crag_weather', weather.icon);
        }
      }, this));

      if ($('.ascent-grades-histogram').length) {
        this.histogram = new Histogram(this.app, {
          $el: $('.ascent-grades-histogram')
        }).render();
      }

      // Handle selects.
      util.customSelects(this.el);

      this.trigger('rendered');
      return this;
    },

    events: {
      'click .navigate': 'navigate',
      'change .settings-param': 'save',
      'change select': 'save',
      'click .demolish': 'demolish',
      'click .ascent-type input[type="checkbox"]': 'updateType',
    },

    setup: function () {

      // Set map view.
      mps.publish('map/fly', [this.model.get('location')]);

      // Render events.
      if (!this.options.config) {
        this.feed = new Events(this.app, {
          parentView: this,
          parentId: this.model.id,
          parentType: 'ascent',
          reverse: true,
          input: true,
          filters: ['tick', 'post'],
          filterTitles: ['Efforts', 'Posts'],
          feedStore: 'ascentFeed',
          hide: []
        });
      }

      // Render lists.
      this.watchers = new Watchers(this.app, {parentView: this, reverse: true});

      // Grab an Instsgram feed.
      if (!this.options.config) {
        this.instafeed = new Instafeed(this.app, {
          el: this.$('#ig_tagged'),
          tags: this.model.instagramTags(),
        }).render();
      }

      // Handle text area height.
      if (this.options.config) {
        this.$('textarea').autogrow();

        // Handle selects.
        var type = this.model.get('type');
        var country = this.model.get('country');
        var grade = this.app.gradeConverter[type].convert(
            this.model.get('grade'), null, 'indexes');
        this.selectOption('grade', grade);
        this.updateGrades(type, country);
        this.selectOption('rock', this.model.get('rock'));
      }

      if (this.histogram) {
        this.histogram.update(this.model.makeHistogram(),
            this.model.getGrade());
      }

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

    updateType: function (e) {
      var selected = $(e.target).closest('input');
      var type = selected.val();
      var parent = selected.parent().parent();
      var other = $('input', parent).not('[value="' + type + '"]');
      selected.attr('checked', true);
      other.attr('checked', false);
      this.swapImg(selected);
      this.swapImg(other);
      this.updateGrades(type, this.model.get('country'));
      this.save(null, selected);
    },

    swapImg: function (el) {
      var img = $('img', el.parent());
      var src = img.data('alt');
      img.data('alt', img.attr('src'));
      img.attr('src', src);
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
            $e.text(this.app.gradeConverter[type].convert(from, country));
          }
        }
      }, this));
    },

    empty: function () {
      this.$el.empty();
      return this;
    },

    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      if (this.skycons) {
        this.skycons.remove('crag-weather');
      }
      if (this.feed) {
        this.feed.destroy();
      }
      if (this.histogram) {
        this.histogram.destroy();
      }
      this.watchers.destroy();
      this.undelegateEvents();
      this.stopListening();
      this.empty();
    },

    navigate: function (e) {
      e.preventDefault();
      var path = $(e.target).closest('a').attr('href');
      if (path) {
        this.app.router.navigate(path, {trigger: true});
      }
    },

    setTitle: function () {
      this.app.title('Island | ' + this.model.get('name') +
          ' - ' + [this.model.get('crag'),
          this.model.get('country')].join(', '));
    },

    // Save the field.
    save: function (e, field) {
      field = field || $(e.target);
      var payload = {};
      var name = field.attr('name');
      var val = util.sanitize(field.val());

      // Create the paylaod.
      if (name !== 'type' && val === field.data('saved')) {
        return false;
      }

      if (name === 'grade') {
        val = Number(val);
      }

      payload[name] = val;

      // Now do the save.
      rest.put('/api/ascents/' + this.model.id, payload,
          _.bind(function (err, data) {
        if (err) {
          if (err.type === 'LENGTH_INVALID') {
            field.val(field.data('saved'));
          }
          mps.publish('flash/new', [{err: err, level: 'error'}]);
          return false;
        }

        // Save the saved state.
        if (val) {
          field.data('saved', val);
        }

        // Show saved status.
        mps.publish('flash/new', [{
          message: 'Saved.',
          level: 'alert',
          type: 'popup'
        }, true]);

        // Ascent's URL changed so refresh.
        if (data && this.model.get('key') !== data.key) {
          this.model.set('key', data.key);
          this.app.router.navigate('/crags/' + data.key + '/config',
              {trigger: true});
        }

      }, this));

      return false;
    },

    demolish: function (e) {
      e.preventDefault();

      // Render the confirm modal.
      $.fancybox(_.template(confirm)({
        message: 'Delete this climb forever? All associated content and' +
            ' activity will be deleted.',
      }), {
        openEffect: 'fade',
        closeEffect: 'fade',
        closeBtn: false,
        padding: 0
      });

      // Setup actions.
      $('.modal-cancel').click(function () {
        $.fancybox.close();
      });
      $('.modal-confirm').click(_.bind(function () {

        // Delete the user.
        rest.delete('/api/ascents/' + this.model.id, _.bind(function (err) {
          if (err) {
            mps.publish('flash/new', [{err: err, level: 'error', type: 'popup'},
                true]);
            return false;
          }
          mps.publish('flash/new', [{
            message: 'You deleted the climb ' + this.model.get('name') + '.',
            level: 'alert'
          }, true]);

          // Route to crag home.
          var parts = this.model.get('key').split('/');
          var code = [parts[0], parts[1]].join('/');
          this.app.router.navigate('/crags/' + code, {trigger: true});

          // Close the modal.
          $.fancybox.close();
        }, this));
      }, this));

      return false;
    },

  });
});
