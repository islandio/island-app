/*
 * Build view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'rpc',
  'util',
  'text!../../templates/build.html',
], function ($, _, Backbone, mps, rpc, util, template) {
  return Backbone.View.extend({

    // Module entry point:
    initialize: function (app, options) {

      // Save app reference.
      this.app = app;

      // Save options.
      this.options = options || {};

      // Shell events:
      this.on('rendered', this.setup, this);
    },

    // Draw our template from the profile JSON.
    render: function () {

      // Determine if this view is a modal.
      if (this.options.modal) {
        this.setElement($('#build_modal'));
        this.modal = this.$el.modal({
          overlayClose: true,
          escClose: true,
        });
      } else this.setElement($('#build'));

      // UnderscoreJS templating:
      this.$el.html(_.template(template).call(this));

      // Done rendering ... trigger setup.
      this.trigger('rendered');

      return this;
    },

    // Bind mouse events.
    events: {
      'click .build-button': 'build',
      // 'click .sticky-button': 'toggleMenu',
      'click .sticky-menu-item': 'setType',
      'click .menu-overlay': 'hideAllMenus',
      'change input[name="public"]': 'setPrivacy'
    },

    // Misc. setup.
    setup: function () {
      this.$('.modal-inner', this.el).show();
      this.$('[name="about"]')
          .bind('keyup', _.bind(this.setName, this));
      this.$('[name="description"]').autogrow();
      this.$('[name="slug"]')
          .bind('keyup', _.bind(this.setAutoName, this))
          .bind('blur', _.bind(function () {
        this.$('[name="about"]').trigger('keyup');
      }, this));
      util.initForm(this.$('form'));
      this.$('#public').click();
      this.$('#campaign_info input, #campaign_info textarea')
          .attr('disabled', true);
      if (this.options.from) {
        this.fitBreadCrumb();
        var buildFrom = '<div class="build-from">'
                        + '<span>New idea from '
                        + '<em>' + this.options.from.model.get('person').name + '</em>'
                        + '</span>'
                        + '<img src="' + this.options.from.model.get('person').avatar_url
                        + '" width="19" height="19">'
                        + '<span><em>\'s</em> comment, "'
                        + this.options.from.model.get('content')
                        + '" ...</span></div>';
        this.$('#build-from').html($(buildFrom));
        this.fitModal();
        this.$('[name="about"]')
            .val(this.options.from.about)
            .keyup();
        _.delay(_.bind(function () {
          this.$('.box-heading-subtitle').hide();
          this.$('[name="about"]').focus().select();
        }, this), 0);
      } else if (this.options.campaign) {
        var idea = this.app.profile.get('page').shell.idea;
        this.$('.sticky-menu-item[data-value="campaign"]').click();
        this.fitBreadCrumb();
        var buildFrom = '<div class="build-from">'
                        + '<span>New campaign from your idea, "'
                        + idea.about
                        + '" ...</span></div>';
        this.$('#build-from').html($(buildFrom));
        this.fitModal();
        this.$('[name="about"]')
            .val(idea.about)
            .keyup();
        _.delay(_.bind(function () {
          this.$('.box-heading-subtitle').hide();
          $('#idea_info').hide();
          this.$('#campaign_info input, #campaign_info textarea')
              .attr('disabled', false);
          $('#campaign_info').show();
          this.fitModal();
          this.$('[name="slug"]').addClass('disabled').attr('disabled', 'disabled');
          this.$('[name="about"]').addClass('disabled').attr('disabled', 'disabled');
          this.$('[name="description"]').focus().select();
        }, this), 0);
      } else {
        this.fitBreadCrumb();
        this.$('#build-from').hide();
        _.delay(_.bind(function () {
          this.$('[name="about"]').val('').focus();
        }, this), 0);
      }

      // Close the modal on 'x' click and escape.
      if (this.options.modal) {
        this.$('.close-cancel-icon').click(_.bind(this.close, this, true));
        this.$('input, textarea').bind('keyup', _.bind(this.close, this, false));
        $(document).bind('keyup', _.bind(this.close, this, false));
      }

    },

    close: function (click, e) {
      if (click || e.keyCode === 27 || e.which === 27) {
        this.modal.close();
        $(document).unbind('keyup', arguments.callee);
      }
    },

    fitBreadCrumb: function () {
      var formWidth = this.$('form').width() - 1;
      var breadWidth = 0;
      var breadChildren = this.$('.build-breadcrum').children();
      breadChildren.each(function (i) {
        if (i === 0) return;
        if (i !== breadChildren.length - 1)
          breadWidth += $(this).outerWidth(true);
        else
          $('input', this).get(0).style.width = formWidth - breadWidth + 'px';
      });
    },

    fitModal: function () {
      var modal = $('#simplemodal-container');
      var winH = $(window).height();
      var modalH = this.$el.height()
      modal.css({
        top: winH / 2 - modalH / 2,
        height: modalH
      });
    },

    toggleMenu: function (e, close) {
      var button = $(e.target).closest('.sticky-button');
      var menu = $('.sticky-menu', $(e.target).closest('dd'));
      if (menu.length === 0) return;
      if (button.hasClass('pressed') || close) {
        button.removeClass('pressed');
        menu.hide();
      } else {
        this.$('.menu-overlay').show();
        button.addClass('pressed');
        menu.fadeIn(200);
      }
      return false;
    },

    hideAllMenus: function () {
      $('.sticky-button').removeClass('pressed');
      $('.sticky-menu, .menu-overlay', this.el).hide();
    },

    setType: function (e, type) {
      var row = $(e.target).closest('li');
      var ctx = $(e.target).closest('dd');
      var menu = $('.sticky-menu', ctx);
      var button = $('.sticky-button', ctx);
      var avatar = $('.sticky-shell-avatar', button);
      var value = _.str.capitalize(row.data('value'));
      $('.sticky-button-text', button).text(value);
      var prv = avatar.hasClass('private') ? 'private' : '';
      avatar.attr({
        class: 'sticky-shell-avatar ' + prv + ' '
                + value.toLowerCase() + '-type'
      });
      button.removeClass('pressed');
      menu.hide();
      this.$('.menu-overlay').hide();
      if (value === 'Campaign') {
        $('#idea_info').hide();
        this.$('#campaign_info input, #campaign_info textarea')
            .attr('disabled', false);
        $('#campaign_info').show();
      } else {
        $('#campaign_info').hide();
        this.$('#campaign_info input, #campaign_info textarea')
            .attr('disabled', true);
      }
      $('input[type="radio"]', row).attr('checked', true);
      this.fitBreadCrumb();
      this.fitModal();
      return false;
    },

    setPrivacy: function () {
      var value = this.$('input[name="public"]:checked').val();
      if (!value) {
        this.$('.shell-privacy').text('public');
        this.$('.sticky-shell-avatar').removeClass('private');
        this.$('.build-breadcrum').removeClass('private');
      } else {
        this.$('.shell-privacy').text('private');
        this.$('.sticky-shell-avatar').addClass('private');
        this.$('.build-breadcrum').addClass('private');
      }
      return false;
    },

    setName: function (e) {
      var slug = this.$('input[name="slug"]');
      if (slug.data('auto') === 0) return;
      var name = util.slugify($(e.target).val());
      this.$('input[name="slug"]').val(name);
      return false;
    },

    setAutoName: function (e) {
      var slug = this.$('input[name="slug"]');
      if (slug.val().trim() === '')
        slug.data('auto', 1);
      else slug.data('auto', 0);
      return false;
    },

    /**
     * Optimistically create an idea/campaign.
     *
     * This function assumes that an idea/campaign will successfully be created on the
     * server. Based on that assumption we render it in the UI before the 
     * success callback fires.
     *
     * If the error callback fires, we redirect the browser to their
     * previous location and notify the user (or retry).
     */
    build: function (e) {
      e.preventDefault();

      // Grab form:
      var form = this.$('form');

      // Un-disable fields:
      $('input[type="text"].disabled, textarea.disabled')
          .attr('disabled', false);

      // From validation:
      if (!util.validate(form))
        return false;

      // For the server:
      var payload = util.cleanObject(form.serializeObject());

      // Clear the form.
      util.clear(form);

      // Remove whitespace from slug field.
      payload.slug = payload.slug.trim();

      // Set public.
      if (!payload.public) payload.public = 'true';

      // Try to parse the video URL, delete it if not parsable.
      if (payload.video_url)
        payload.video_url = this.parseVideoURL(payload.video_url);
      if (!payload.video_url)
        delete payload.video_url;

      // Get the creator.
      var person = this.app.profile.get('person');

      // Create the mock idea/campaign.
      var model = this.options.campaign ?
        _.extend(_.clone(payload), {
          id: -1, // needs update
          created: new Date().toISOString(),
          owner_avatar: person.avatar_url,
          owner_name: person.name,
          owner_username: person.username,
          idea_id: this.app.profile.get('page').shell.idea.id,
          total_cents: 0,
          // One hour from now:
          deadline: new Date(new Date().getTime() + (60*60*1000)).toISOString(),
        }):
        _.extend(_.clone(payload), {
          id: -1, // needs update
          created: new Date().toISOString(),
          owner_avatar: person.avatar_url,
          owner_name: person.name,
          owner_username: person.username
        });

      // Build the url path for this idea/campaign.
      var path = [person.username, model.code, model.slug].join('/');

      // Build the new profile page.
      var page = {
        comments: { items: [], more: false },
        currency: {
          capital: {
            created: model.created,
            id: -1,  // needs update
            shell: path,
            investor_count: 0,
            total_investment_hylos: 0,
            total_investment_dollars: 0
          },
          shell: -1,  // needs update
          shell_id: path
        },
        subscription: {
          actions: ['commented on', 'invested in', 'evolved'],
          created: model.created,
          ignore: false,
          person: person.username,
          shell: -1, // needs update
          status: 'watch'
        }
      }

      // Set page shell.
      page.shell = this.options.campaign ? {campaign: model} : {idea: model};
      page.shell.kind = model.code;

      // Choose the service.
      var service = this.options.campaign ?
                    '/service/idea.enable_crowdfunding':
                    '/service/idea.create';

      // Add the idea_id to payload if campaign.
      if (this.options.campaign)
        payload.idea_id = [person.username, 'i', model.slug].join('/');;

      // Add or replace app.page.
      this.app.profile.set('page', page);

      // Route to the idea/campaign:
      this.app.router.navigate(path, {trigger: true});

      // Remove the modal if we're creating from one.
      if (this.options.modal)
        this.modal.close();

      // TODO: maybe add this back in ... comment that was
      // branched to create this idea.
      // if (this.options.from)
      //   data.from_key = this.options.from.model.get('id');

      // Now save the idea to server:
      rpc.execute(service, payload, {
        success: _.bind(function (data) {

          // All good, just update the idea/campaign id.
          var page = this.app.profile.get('page');
          switch (page.shell.kind) {
            case 'i':
              page.shell.idea.id = data.id;
              break;
            case 'c':
              page.shell.campaign.id = data.id;
              break;
          }
          page.currency.shell = data.id;
          page.currency.capital.id = data.id;
          page.subscription.shell = data.id;
        
        }, this),
        error: _.bind(function(error, status) {

          // Route to the idea/campaign:
          this.app.router.navigate('/', {trigger: true, replace: true});

          // TODO: create a flash warning.

          // Oops, idea/campaign wasn't created.
          console.log("TODO: Retry, notify user, etc.")
        
        }, this)
      });

      return false;
    },

    parseVideoURL: function (url) {
      var vid = url.match(/vimeo.com\/([0-9]*)/i);
      if (!vid)
        vid = url.match(/vimeo.com\/video\/([0-9]*)/i);
      if (vid)
        return url = 'https://player.vimeo.com/video/' + vid[1];
      else
        return false;
    },

  });
});
