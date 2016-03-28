/*
 * Ascents view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rest',
  'util',
  'views/session.new',
  'views/ascents.move',
  'views/ascents.merge',
  'views/ascents.delete',
  'text!../../../templates/ascents.html',
], function ($, _, Backbone, mps, rest, util, NewSession, Move, Merge, Delete,
      template) {
  return Backbone.View.extend({

    el: '.crag-ascents',

    initialize: function (app, options) {
      this.app = app;
      this.template = _.template(template);
      this.subscriptions = [];
      this.options = options || {};
      this.on('rendered', this.setup, this);
      this.grades = {
        'r': [],
        'b': []
      };
    },

    events: {
      'click .navigate': 'navigate',
      'click .list-button-log': 'log',
      'click .list-button-edit': 'editAscentName',
      'click .list-button-ok': 'submitAscentName',
      'click .list-button-cancel': 'cancelAscentName',
      'change .ascent-select': 'checkToolsEnabled',
      'click .ascent-tool-move': 'move',
      'click .ascent-tool-merge': 'merge',
      'click .ascent-tool-delete': 'delete',
      'keydown input.ascent-name-edit': 'enterSubmitAscentName',
    },

    render: function (options) {

      function _render() {

        // Save ref to flattened lists for filtering and convert the grade
        this.flattened = {};
        this.count = 0;
        var prefs = this.app.profile.member ?
            this.app.profile.member.prefs: this.app.prefs;
        _.each(this.data.ascents, _.bind(function (ascents, t) {
          this.flattened[t] = _.flatten(ascents);
          this.count += this.flattened[t].length;


          // convert grades
          var a = {};
          var self = this;
          var system = t === 'r' ? prefs.grades.route: prefs.grades.boulder;
          _.each(ascents, function (ascent, grade) {
            var key = self.app.gradeConverter[t].convert(Number(grade),
                self.data.country, system);
            if (!a[key]) a[key] = [];
            a[key] = a[key].concat(ascent);
            delete ascents[grade];
          });

          _.each(a, function (_a, grade) {
            ascents[grade] = _a;
          });

          // sort grades
          this.grades[t] = _.keys(a).sort(function (a, b) {
            return self.app.gradeConverter[t].compare(b, a,
                self.data.country, system);
          });
        }, this));

        this.$el.html(this.template.call(this));

        this.trigger('rendered');
      }

      // Clear.
      this.empty();
      delete this.data;

      // Fetch or use options data.
      if (options.cragId) {
        this.app.router.start();
        rest.post('/api/ascents/list/' + options.cragId, {},
            _.bind(function (err, data) {
          this.app.router.stop();

          if (err) {

            // Set the error display.
            mps.publish('flash/new', [{
              err: err,
              level: 'error'
            }, true]);
            return;
          }

          // Render sidebar.
          this.data = data;
          _render.call(this);
        }, this));
      } else if (options.data) {
        this.data = options.data;
        _render.call(this);
      }

      return this;
    },

    setup: function () {

      // Save refs.
      this.filterBox = this.$('.ascents-filter-input input');
      this.bouldersFilter = this.$('.b-filter').parent();
      this.routesFilter = this.$('.r-filter').parent();
      this.boulders = this.$('.b-ascents');
      this.routes = this.$('.r-ascents');
      this.tools = this.$('.ascents-tools');

      if (this.app.profile.member && this.app.profile.member.admin) {
        this.$el.addClass('editing');
      }

      // Handle type changes.
      this.data.ascents.bcnt = this.data.ascents.bcnt || 0;
      this.data.ascents.rcnt = this.data.ascents.rcnt || 0;
      if (this.data.ascents.bcnt >= this.data.ascents.rcnt) {
        this.currentType = 'b';
        this.bouldersFilter.addClass('active');
        this.boulders.show();
      } else {
        this.currentType = 'r';
        this.routesFilter.addClass('active');
        this.routes.show();
      }
      this.checkCurrentCount();
      this.bouldersFilter.click(_.bind(this.changeType, this, 'b'));
      this.routesFilter.click(_.bind(this.changeType, this, 'r'));
      this.handleListScroll();

      this.offset = this.$el.offset().top;
      $(window).bind('scroll', _.bind(this.handleScroll, this));

      // Handle filtering.
      this.filterBox.bind('keyup search', _.bind(this.filter, this));

      this.subscriptions.push(mps.subscribe('ascents/clearSelected',
          _.bind(function () {
        this.$('.ascent-select:checked').attr('checked', false);
      }, this)));

      this.subscriptions.push(mps.subscribe('ascents/removeSelected',
          _.bind(function () {
        this.$('.ascent-select:checked').closest('li').remove();
        _.delay(_.bind(function () {
          $('.crag-ascents ul.list').not(':has(li)').remove();
        }, 50));
      }, this)));

      return this;
    },

    empty: function () {
      this.$el.empty();
      return this;
    },

    destroy: function () {
      _.each(this.subscriptions, function (s) {
        mps.unsubscribe(s);
      });
      this.undelegateEvents();
      this.stopListening();
      this.remove();
    },

    navigate: function (e) {
      e.preventDefault();
      var path = $(e.target).closest('a').attr('href');
      if (path) {
        this.app.router.navigate(path, {trigger: true});
      }
    },

    checkCurrentCount: function () {
      var ticks = this.flattened[this.currentType] || [];
      if (ticks.length === 0) {
        this.filterBox.hide();
        this.$('.' + this.currentType + '-ascents .empty-feed').show()
            .css('display', 'block');
      } else {
        this.filterBox.show();
        this.$('.' + this.currentType + '-ascents .empty-feed').hide();
      }
    },

    changeType: function (type, e) {

      // Update buttons.
      var chosen = $(e.target).closest('li');
      if (chosen.hasClass('active') || chosen.hasClass('disabled')) {
        return;
      }
      var active = $('.active', chosen.parent());
      chosen.addClass('active');
      active.removeClass('active');

      // Set new type.
      this.currentType = type;
      this.$('.list-wrap').hide();
      this.$('.' + this.currentType + '-ascents').show();
      this.checkCurrentCount();
      this.filterBox.keyup();
      this.handleListScroll();
    },

    handleScroll: function (e) {
      var win = $(window);
      var scrollTop = win.scrollTop();
      if (this.offset - scrollTop - 30 <= 0) {
        this.$el.addClass('sidebar-sticky');
      } else {
        this.$el.removeClass('sidebar-sticky');
      }
    },

    handleListScroll: function () {
      var win = $(window);
      var list = this.$('.' + this.currentType + '-ascents');
      var groups = this.$('.' + this.currentType + '-ascents ul.list');
      list.scrollTop(0);

      var height = _.bind(function (e) {
        var winHeight = win.height();
        list.height(winHeight - 306);
      }, this);

      var stickyTop = this.$('.ascents-tools').length > 0 ? 190: 148;
      var scroll = _.bind(function (e) {
        var scrollTop = list.scrollTop();
        var listTop = list.offset().top;
        groups.each(function (i) {
          var group = $(this);
          var diff = listTop - group.offset().top;
          var rel = group.hasClass('sticky') ? -33: 0;
          if (diff >= rel) {
            group.addClass('sticky');
            $('.list-group-heading', group).css('top', stickyTop);
          } else {
            group.removeClass('sticky');
            $('.list-group-heading', group).css('top', 'initial');
          }
        });
      }, this);

      win.bind('resize', height);
      height();

      list.bind('scroll', scroll);
      scroll();
    },

    filter: function () {
      var txt = this.filterBox.val().trim().toLowerCase();
      var ct = this.currentType;
      this.$('.' + this.currentType + '-ascents').scrollTop(0);
      $('.' + ct + '-ascents .no-results').hide();
      if (txt === '') {
        $('.' + ct + '-ascents .list li').show();
        $('.' + ct + '-ascents .list-group-heading').show();
        return false;
      }
      $('.' + ct + '-ascents .list li').hide();
      $('.' + ct + '-ascents .list-group-heading').hide();
      var rx = new RegExp('^(.*?(' + txt + ')[^$]*)$', 'ig');
      var y = false;
      _.each(this.flattened[ct], function (a) {
        if (rx.test(a.name)) {
          y = true;
          var d = $('.' + ct + '-ascents .list li[id="' + a.id + '"]');
          d.show();
          $('.list-group-heading', d.parent()).show();
        }
      });
      if (!y) {
        $('.list-wrap .no-results').show();
      }
      return false;
    },

    log: function (e) {
      e.preventDefault();
      var aid = $(e.target).closest('li').attr('id');
      var cid = $(e.target).closest('li').data('cid');
      new NewSession(this.app, {crag_id: cid, ascent_id: aid}).render();
    },

    getSelected: function () {
      var flattened = this.flattened;
      return _.map(this.$('.ascent-select:checked'), function (a) {
        a = $(a);
        var id = a.attr('name');
        var type = a.data('type');
        return _.find(flattened[type], function (i) {
          return i.id === id;
        });
      });
    },

    checkToolsEnabled: function() {
      var selected = this.getSelected();

      if (selected.length > 0) {
        this.$('.ascent-tool-move, .ascent-tool-delete')
            .attr('disabled', false).removeClass('disabled');
      } else {
        this.$('.ascent-tool-move, .ascent-tool-delete')
            .attr('disabled', true).addClass('disabled');
      }

      if (selected.length > 1) {
        this.$('.ascent-tool-merge').attr('disabled', false)
            .removeClass('disabled');
      } else {
        this.$('.ascent-tool-merge').attr('disabled', true)
            .addClass('disabled');
      }
    },

    move: function (e) {
      e.preventDefault();
      new Move(this.app, {ascents: this.getSelected()}).render();
    },

    merge: function (e) {
      e.preventDefault();
      new Merge(this.app, {ascents: this.getSelected()}).render();
    },

    delete: function (e) {
      e.preventDefault();
      new Delete(this.app, {ascents: this.getSelected()}).render();
    },

    editAscentName: function (e) {
      var li = $(e.target).closest('li');
      var input = $('.ascent-name-edit', li);
      input.val(input.data('original'));
      li.addClass('editing');
    },

    enterSubmitAscentName: function(e) {
      if (e.keyCode === 13 || e.which === 13) {
        this.submitAscentName(e);
        return false;
      } else if (e.keyCode === 27 || e.which === 27) {
        this.cancelAscentName(e);
        return false;
      }
    },

    submitAscentName: function (e) {
      var li = $(e.target).closest('li');
      var id = li.attr('id');
      var display = $('.list-row-title', li);
      var anc = $('.ascent-name', li);
      var input = $('.ascent-name-edit', li);
      var original = input.data('original');
      var value = input.val();
      var payload = {name: value};

      rest.put('/api/ascents/' + id, payload, _.bind(function (err, data) {
        if (err) {
          if (err.type === 'LENGTH_INVALID') {
            input.val(original);
          }
          mps.publish('flash/new', [{err: err, level: 'error'}]);
          return false;
        }

        input.data('original', value);
        display.text(value);
        anc.attr('href', '/crags/' + data.key);
        li.removeClass('editing');

        // Show saved status.
        mps.publish('flash/new', [{
          message: 'Saved.',
          level: 'alert',
          type: 'popup'
        }, true]);

      }, this));

      return false;
    },

    cancelAscentName: function (e) {
      var li = $(e.target).closest('li');
      li.removeClass('editing');
    }

  });
});
