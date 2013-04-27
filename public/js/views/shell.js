/*
 * Page view for ideas.
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'rpc',
  'mps',
  'util',
  'text!../../templates/idea.html',
  'text!../../templates/campaign.html',
  'text!../../templates/checkout.html',
  // 'views/lists/opportunities',
  'views/lists/comments'
], function ($, _, Backbone, rpc, mps, util,
      idea_template, campaign_template, checkout_template, Comments) {

  return Backbone.View.extend({

    // The DOM target element for this page:
    el: '#wrap > .content',

    // Module entry point:
    initialize: function (app) {

      // Save app reference.
      this.app = app;

      // Shell events:
      this.on('rendered', this.setup, this);

      // Shell subscriptions:
      this.subscriptions = [
        mps.subscribe('currency/investment', _.bind(this.investment, this))
      ];
    },

    // Draw our template from the profile JSON.
    render: function () {

      // UnderscoreJS templating:
      var shell = this.app.profile.get('page').shell;
      switch (shell.kind) {
        case 'i':
          this.$el.html(_.template(idea_template).call(this));
          break;
        case 'c':
          this.ended = new Date(shell.campaign.deadline).getTime()
                     - new Date().getTime() <= 0;
          this.success = shell.campaign.total_cents
                       >= shell.campaign.goal_dollars * 100;
          if (this.ended && this.success)
            this.outcome = 'successful';
          else if (this.ended && !this.success)
            this.outcome = 'failed';
          else this.outcome = false;
          this.$el.html(_.template(campaign_template).call(this));
          break;
      }

      // Done rendering ... trigger setup.
      this.trigger('rendered');

      return this;
    },

    // Misc. setup.
    setup: function () {

      // Grab page:
      var page = this.app.profile.get('page');

      // Handle watch status
      if (page.subscription)
        switch (page.subscription.status) {
          case 'participate':
            this.setType(null, 0);
            break;
          case 'watch':
            this.setType(null, 1);
            break;
          case 'ignore':
            this.setType(null, 2);
            break;
        }

      // Autogrow the write comment box.
      this.$('textarea[name="content"]').autogrow();
      this.$('textarea[name="content"]').bind('keyup', _.bind(function (e) {
        if (!e.shiftKey && (e.keyCode === 13 || e.which === 13))
          this.writeComment();
      }, this));

      // Render comments comments.
      this.comments = new Comments(this.app, {parentView: this, reverse: true});
      
      // Show the write comment box.
      this.$('#comment_input .comment').show();
      this.$('textarea[name="content"]').focus();

      // Check state and show create campaign.
      var capital = page.currency.capital;
      if (capital.total_investment_hylos >= this.app.investmentThreshold
          && page.shell.idea.owner_username
          === this.app.profile.get('person').username
          && page.shell.idea.state === 'lockdown') {
        var msg = 'Whoa! Your idea has more than <em>'
                  + this.app.investmentThreshold + ' hylos</em>. '
                  + 'You have 5 minutes to <a href="javascript:;" '
                  + 'id="to_campaign"'
                  + '>start a crowdfunding'
                  + ' campaign</a> based on this idea.'
        var flash = {message: msg, level: 'alert'};
        mps.publish('flash/new', [flash]);
      }

      // Return if not campaign.
      if (!page.shell.campaign) return this;

      /**
       * TODO:
       *   this.opportunities = new Opportunities({ parentView: this });
       */

      // Handle currency displays.
      this.$('.currency').each(function () {
        var str = util.addCommas($(this).text());
        $(this).text('$' + str.trim());
      });

      // Handle times display.
      var deadline = new Date(page.shell.campaign.deadline);
      if (!this.ended)
        (function (n) {
          var future = !n ? util.getRelativeFutureTime(page.shell.campaign.deadline)
                          : util.getRelativeFutureTime(n);
          this.$('.shell-deadline').text(future.value);
          this.$('.shell-deadline-label').text(future.label + ' to go.');
          if (!this.timerInterval || future.interval !== this.timerInterval) {
            this.timerInterval = future.interval;
            if (this.timer)
              clearInterval(this.timer);
            if (this.timerInterval !== -1)
              this.timer = setInterval(_.bind(arguments.callee, this, n),
                                      this.timerInterval);
          }
          this.$('.shell-date').text('Ends on '
              + util.toLocaleString(deadline, 'm/d/yy h:MM tt Z') + '.');
        }).call(this);
      else
        this.$('.shell-date').text(
            util.toLocaleString(deadline, 'm/d/yy h:MM tt Z'));

      // Handle progress display.
      (function () {
        var percent = capital.total_investment_dollars / 
                      page.shell.campaign.goal_dollars;
        if (percent > 100) percent = 100;
        this.$('.shell-complete-inner').css('width', percent + '%');
        this.$('.shell-percent').text((Math.round(percent * 10) / 10).toFixed(1) + '%');
      }).call(this);

      return this;
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
      this.comments.destroy();
      this.undelegateEvents();
      this.stopListening();
      this.empty();
    },

    // Returns the investment of person viewing idea.
    getViewerInvestmentHylos: function (investment) {
      if (!this.app.profile.get('person')) return 0;
      var username = this.app.profile.get('person').username;
      var i = _.find(investment, function (x) {
        return x.person === username;
      });
      return i ? i.hylos : 0;
    },

    // Bind mouse events.
    events: {
      'click .action-button': 'writeComment',
      'click #invest': 'invest',
      'click #uninvest': 'invest',
      'click #watch_button': 'toggleMenu',
      'click .sticky-menu-item': 'setType',
      'click .menu-overlay': 'hideAllMenus',
      'submit #pledge_form': 'pledge',
    },

    /**
     * Optimistically writes a comment.
     *
     * This function assumes that a comment will successfully be created on the
     * server. Based on that assumption we render it in the UI before the 
     * success callback fires.
     *
     * When the success callback fires, we update the comment model id from the
     * comment created on the server. If the error callback fires, we remove 
     * the comment from the UI and notify the user (or retry).
     */
    writeComment: function (e) {
      if (e) e.preventDefault();
      var input = this.$('textarea.comment-input');
      if (input.val().trim() === '')
        return;
      var form = this.$('form.comment-input-form');
      var payload = form.serializeObject(); // For server.
      var person = this.app.profile.get('person');
      var created = new Date().toISOString();
      var data = { // Our mock comment.
        id: -1,
        content: payload.content,
        owner_name: person.name, 
        created: created, 
        owner_username: person.username,
      };

      // Add the parent shell's id.
      payload.parent_id = this.app.profile.get('page').shell.idea ?
                          this.app.profile.get('page').shell.idea.id:
                          this.app.profile.get('page').shell.campaign.id;

      // Optimistically add comment to page:
      this.comments.collection.unshift(data);
      input.val('').keyup();

      // Now save the comment to server:
      rpc.execute('/service/comment.create', payload, {
        success: _.bind(function (data) {

          // All good, just update the comment id.
          var id = data.id;
          var comment = this.comments.collection.get(-1);
          comment.set('id', id);

        }, this),
        error: _.bind(function (error, status) {

          // Oops, comment wasn't created.
          console.log("TODO: Retry, notify user, etc.");
          this.comments.collection.pop();

        }, this),
      });

      return false;
    },

    /**
     * Optimistically invest.
     *
     * This function assumes that an investment will successfully be created on the
     * server. Based on that assumption we render it in the UI before the 
     * notification arrives on the bus.
     *
     * When the notification arrives, we simply overide the existing investment values.
     * TODO: If the notification does not arrive, do something man!
     */
    invest: function (e) {

      // Get amount to invest.
      var page = this.app.profile.get('page');
      var amount = parseInt($(e.target).closest('.sticky-button').data('amount'));
      if (amount > 0 && this.$('#invest').hasClass('disabled'))
        return false;

      // Grab the portfolio.
      var portfolio = this.app.profile.get('portfolio');

      // Enough Hylos?
      if (portfolio.balance < amount)
        return;
      portfolio.balance -= amount;

      // Optimistically set the investment values for the idea.
      var pt = this.$('#person_total');
      pt.text(parseInt(pt.text()) + amount);
      var st = this.$('#shell_total');
      st.text(parseInt(st.text()) + amount);

      // Hide invest.
      if (portfolio.balance === 0
          || page.currency.capital.total_investment_hylos + amount
          >= this.app.investmentThreshold)
        this.$('#invest').addClass('disabled');
  
      // Optimistically set the investment values for the person.
      // WTF, should not have to trigger this.
      this.app.profile.set('portfolio', portfolio).trigger('change:portfolio');

      // Execute the investment, which fires a "currency/investment"
      // bus message that we are subscribed to.
      rpc.execute('/service/currency.invest',
        {shell: page.shell.idea.id, hylos: amount}, {
          success: _.bind(function () {

          // Check threshold and evolve.
          // TODO: make sure this only happens once on the server
          // we could be hitting it from multiple clients.
          if (page.currency.capital.total_investment_hylos + amount
              >= this.app.investmentThreshold) {
            var idea = page.shell.idea;
            var id = [idea.owner_username, idea.code, idea.slug].join('/');
            rpc.execute('/service/idea.evolve', {id: id}, {
              success: _.bind(function () {

                // TODO: Update UI

            }, this),
            error: _.bind(function (error, status) {

              // Oops, idea was not evolved.
              console.log("TODO: Retry, notify user, etc.");

            }, this),
            });
          }

        }, this),
        error: _.bind(function (error, status) {

          // Oops, investment wasn't created.
          console.log("TODO: Retry, notify user, etc.");

        }, this)
      });

      return false;
    },

    // Subscription handler for "currency/investment" bus messages.
    investment: function (payload) {

      // Make sure this message pertains to this idea.
      var page = this.app.profile.get('page');
      if (page.shell.idea.id === payload.shell.id) {

        // update profile
        page.currency.capital = payload.capital;
        page.currency.investment = payload.investment;

        this.$('#person_total').text(this.getViewerInvestmentHylos(payload.investment));
        this.$('#shell_total').text(payload.capital.total_investment_hylos);

        // Check state and show create campaign.
        var capital = page.currency.capital;
        if (capital.total_investment_hylos >= this.app.investmentThreshold
            && page.shell.idea.owner_username
            === this.app.profile.get('person').username) {
          page.shell.idea.state = 'lockdown';
          var msg = 'Whoa! Your idea has more than <em>'
                    + this.app.investmentThreshold + ' hylos</em>. '
                    + 'You have 5 minutes to <a href="javascript:;" '
                    + 'id="to_campaign"'
                    + '>start a crowdfunding'
                    + ' campaign</a> based on this idea.'
          var flash = {message: msg, level: 'alert'};
          mps.publish('flash/new', [flash]);
        }

      }
    },

    // Pledge to a campaign.
    pledge: function (e) {
      e.preventDefault();

      // Render a checkout modal.      
      $("#checkout_modal").html(_.template(checkout_template).call(this));
      this.modal = this.$el.modal({
        overlayClose: true,
        escClose: true
      });

      // Close the modal on 'x' click and escape.
      if (this.options.modal) {
        this.$('.close-cancel-icon').click(_.bind(this.close, this, true));
        this.$('input, textarea').bind('keyup', _.bind(this.close, this, false));
        $(document).bind('keyup', _.bind(this.close, this, false));
      }

    },

    // Sticky menu handling (the watch button).
    toggleMenu: function (e, close) {
      var button = $(e.target).closest('.sticky-button');
      var menu = $('.sticky-menu', $(e.target).closest('li'));
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

    // Click handler for selecting watch status from the sticky menu.
    setType: function (e, force) {

      // Context selection.
      var target = e ? $(e.target) :
          $('#watch_state .sticky-menu-item:nth-child('
          + (force + 1) + ')');
      var row = target.closest('li');
      var ctx = target.closest('.shell-button');
      var menu = $('.sticky-menu', ctx);
      var current = $('[name="shell"]', menu).val();
      var button = $('.sticky-button', ctx);
      var txt = $('.sticky-button-text', button);
      var icon = $('i.left-side', button);
      var input = $('input[type="radio"]', row);
      this.$('.sticky-menu i').hide();
      $('i', row).show();

      // Choose the correct topic.
      var topic;
      switch (input.val()) {
        case '0':
          txt.text('Watch');
          icon.attr('class', 'icon-eye left-side');
          topic = 'participate';
          break;
        case '1':
          txt.text('Unwatch');
          icon.attr('class', 'icon-eye-off left-side');
          topic = 'watch';
          break;
        case '2':
          txt.text('Stop Ignoring');
          icon.attr('class', 'icon-block left-side red');
          topic = 'ignore';
          break;
      }

      // All done. Execute the update.
      input.attr('checked', true);
      button.removeClass('pressed');
      this.$('.menu-overlay').hide();
      menu.hide();
      if (topic && force === undefined) {
        rpc.execute('/service/notify.update', 
          {shell: this.app.profile.get('page').shell.idea.id, status: topic});
      }
      return false;
    },

    // Click handler for the invisible fullscreen
    // overlay that exits the sticky menu.
    hideAllMenus: function () {
      $('.sticky-button').removeClass('pressed');
      $('.sticky-menu, .menu-overlay').hide();
    },

  });
});