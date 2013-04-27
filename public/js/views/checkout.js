/*
 * Checkout view
 */

define([
  'jQuery',
  'Underscore',
  'Backbone',
  'mps',
  'util',
  'config',
  'models/transaction',
  'balanced'
], function ($, _, Backbone, mps, util, config, Transaction, balanced) {
  return Backbone.View.extend({
    
    initialize: function (options) {
      this.options = options || {};
      balanced.init(config.getMarketplace());
      this.on('rendered', this.setup, this);
    },

    render: function () {
      if (this.options.isModal) {
        this.setElement($('#checkout_modal'));
        this.$el.modal({
          closeClass: 'close-cancel-icon'
        });
      } else
        this.setElement($('.checkout'));
      if (!this.options.data) {
        this.options.data = {
          campaign: this.$el.data('campaign'),
          opportunity: this.$el.data('opportunity'),
          owner: this.$el.data('owner'),
          amount: this.$el.data('amount'),
          fee: this.$el.data('fee'),
          total: this.$el.data('total')
        }
        this.$el.attr({
          'data-campaign': '',
          'data-opportunity': '',
          'data-owner': '',
          'data-amount': '',
          'data-fee': '',
          'data-total': ''
        });
      }
      this.trigger('rendered');
      return this;
    },

    events: {
      'click .checkout-button': 'checkout',
      'click .change-card': 'toggleCardCapture'
    },

    setup: function () {
      var balanced = config.getBalanced();
      var buyer = balanced ? {
        card_uri: balanced.card_uri,
        card_meta: balanced.card_meta
      } : {};
      if (buyer.card_uri) {
        this.$('#card_on_file span')
            .html('Your current card is '
                  + ' <strong>' + buyer.card_meta.brand
                  + ' ************'
                  + buyer.card_meta.last_four + '.</strong>');
        this.$('#card_on_file').show();
        this.$('.data-capture').hide();
        this.$('.data-capture input').attr('disabled', true);
      } else {
        this.$('.change-card').hide();
      }
      this.$('.modal-inner').show();
      this.fitModal();
      this.$('.done-button').attr('href', '/' + this.options.data.campaign.location).hide();
      util.initForm(this.$('form'));
      var title = '<em>' + this.options.data.campaign.about + '</em>';
      var subtitle = 'A CROWDFUNDING CAMPAIGN by '
                      + this.options.data.owner.name + '.';
      this.$('#box_heading_text').html(title);
      this.$('#box_heading_subtext').html(subtitle);
      this.$('#checkout_total').text((this.options.data.total / 100).toFixed(2));
      if (this.options.data.opportunity.cost_dollars !== 0) {
        this.$('#opportunity_about').text(this.options.data.opportunity.about);
        this.$('#opportunity_desc').text(this.options.data.opportunity.description);
      } else
        this.$('#opportunity').hide();
      this.$('.currency').each(function () {
        var str = util.addCommas(parseFloat($(this).text()).toFixed(2));
        $(this).text('$' + str.trim());
      });
      _.delay(_.bind(function () {
        this.$('[name="card_number"]').focus();
      }, this), 0);
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

    toggleCardCapture: function (e) {
      var current = this.$('#card_on_file')
      var capture = this.$('.data-capture') 
      if (current.is(':visible')) {
        current.hide();
        $('input', capture).attr('disabled', false);
        capture.show();
        this.$('[name="card_number"]').focus();
      } else {
        current.show();
        capture.hide();
        $('input', capture).attr('disabled', true);
      }
      return false;
    },

    checkout: function (e) {
      e.preventDefault();
      var self = this;
      var form = this.$('form');
      var button = this.$('.checkout-button');
      var done = this.$('.done-button');
      var thanks = this.$('.checkout-thanks');
      var parent_id = this.options.data.opportunity.id;
      if (!util.validate(form))
        return false;
      button.attr('disabled', true).addClass('disabled');
      $('span', button).text('Processing ...');
      $('i', button).hide();
      var cardData = util.cleanObject(form.serializeObject());
      if (_.isEmpty(cardData)) {
        finish.call(this);
        return;
      }
      $('input:visible, textarea:visible', form).attr('disabled', true);

      function finish(card_data) {
        card_data = card_data || {};
        props = _.extend(card_data, {
          amount_in_cents: this.options.data.amount,
          fee_in_cents: this.options.data.fee,
          total_in_cents: this.options.data.total
        });
        var model = new Transaction;
        model.save({
          props: props,
          parent: parent_id
        }, {
          success: function (data, model) {
            util.clear(form);
            button.hide();
            done.show();
            $('table, dl.form', form).hide();
            thanks.html('<strong>' + config.getPerson().get('name')
                + ', thank you for your contribution.</strong><br /> - '
                + self.options.data.owner.name).show();
            mps.publish('flash/new', [{
              message: 'Your transaction is complete.',
              level: 'alert'
            }]);
          }
        });
      }

      balanced.card.create(cardData, _.bind(function (res) {
        if (res.status !== 201) {
          _.each(res.error, function (msg) {
            var flash = { message: msg + '.', level: 'error' };
            mps.publish('flash/new', [flash]);
          });
          button.attr('disabled', false).removeClass('disabled');
          $('span', button).text('Complete Transaction');
          $('i', button).show();
          $('input:visible, textarea:visible', form).attr('disabled', false);
        } else {
          var data = {
            card_uri: res.data.uri,
            card_meta: {
              brand: res.data.brand,
              last_four: res.data.last_four
            }
          };
          finish.call(this, data);
        }
      }, this));
    },

  });
});
