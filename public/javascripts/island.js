/*!
 * Island.IO
 * v 0.1
 * Copyright(c) 2011 Sander Pick <sanderpick@gmail.com>
 */

Island = (function ($) {

  /**
   * logo pulse
   */
   
  var pulseCnt = 0

    , pulse = function (a, b) {
        if (pulseCnt % 2 == 0) 
          $(b).fadeTo(500, 0.75);
        else 
          $(b).fadeTo(500, 1);
        pulseCnt += 1;
      }
    
    , cancelPulse = function () {
        clearInterval(pulseTimer);
        clearTimeout(pulseCancel);
        $("#logo-a").show();
        $("#logo-b").hide();
      }

  /**
   * tweets
   */

    , twitters = []
    , tweets = []
    , twot = 0
    , twut = 0
    , twap
    
    , twit = function () {
        twap.hide().html(tweets[twut]);
        twap.fadeIn('fast');
        twut++;
        if (twut == tweets.length) 
          twut = 0;
      }

    , twat = function (t) {
        tweets = tweets.concat(t);
        twot++;
        if (twot == twitters.length) {
          $.fisherYates(tweets);
          var tweeter = $.setIntervalObj(this, 5000, twit);
          twit();
        }
      }

  /**
   * handle relative time
   */

    , relativeTime = function (ts) {
        var parsed_date = Date.parse(ts)
          , relative_to = (arguments.length > 1) ? arguments[1] : new Date()
          , delta = parseInt((relative_to.getTime() - parsed_date) / 1000)
        ;
        if (delta < 5)
          return 'just now';
        else if (delta < 15)
          return 'just a moment ago';
        else if (delta < 30)
          return 'just a few moments ago';
        else if (delta < 60) 
          return 'less than a minute ago';
        else if (delta < 120) 
          return 'about a minute ago';
        else if (delta < (45 * 60)) 
          return (parseInt(delta / 60)).toString() + ' minutes ago';
        else if (delta < (90 * 60)) 
          return 'about an hour ago';
        else if (delta < (24 * 60 * 60)) 
          return 'about ' + (parseInt(delta / 3600)).toString() + ' hours ago';
        else if (delta < (2 * 24 * 60 * 60)) 
          return 'about a day ago';
        else if (delta < (10 * 24 * 60 * 60))
          return (parseInt(delta / 86400)).toString() + ' days ago';
        else
          return
            new Date(ts).toLocaleDateString();
      }
      
    , updateTimes = function () {
        $('.comment-added').each(function (i) {
          var time = $(this);
          if (!time.data('ts'))
            time.data('ts', time.text());
          time.text(relativeTime(time.data('ts')));
        });
      }

  /**
   * header control
   */    
    // , overHeader = false
    // , shrinkHeader = function() {
    //     if (!$('#menu').is(":visible"))
    //        return;
    //      $('#twitter').css({ visibility: 'hidden' });
    //      $('#menu, #twitter').hide();
    //      $('#header').css({ width: 363 });
    //   }
    //   
    // , expandHeader = function() {
    //     if ($('#menu').is(":visible"))
    //        return;
    //      $('#header').css({ width: 984 });
    //      $('#menu, #twitter').show();
    //      $('#twitter').css({ visibility: 'visible' });
    //   }

  /**
   * select hearts for rating
   */

    , rater
    , hearts
    , selectHearts = function (x, h) {
        if (!h) {
          var h;
          if (x < 10) h = 0;
          else if (x < 30) h = 1;
          else if (x < 55) h = 2;
          else if (x < 80) h = 3;
          else if (x < 105) h = 4;
          else h = 5;
        }
        $(hearts.children()).hide();
        for (var i=0; i < h; i++)
          $(hearts.children()[i]).show();
        return h;
      }

  /**
   * search media
   */

    , search = function (by, val, fn) {
        $('#grid').empty();
        var data = {
              by  : by
            , val : val
          };
        $.get('/search/' + val + '.json', data, fn);
      }

  /**
   * trending media
   */

    , trending
    , Trending = function (el) {
        var scroller
          , holder
          , holderHeight
          , kids
          , top = 0
          , newKids = []
        ;
        
        return {
            init: function() {
              holder = $(el);
              this.start();
            }
          , start: function() {
              holderHeight = holder.height();
              kids = holder.children();
              $(kids[0]).clone().appendTo(holder);
              scroller = $.setIntervalObj(this, 40, this.scroll);
            }
          , update: function () {
              clearInterval(scroller);
              this.start();
            }
          , scroll: function () {
              top -= 4;
              if (-top >= holderHeight) {
                top = 0;
                if (newKids.length != 0) {
                  holder.empty();
                  for (var i=0; i < newKids.length; i++)
                    newKids[i].appendTo(holder);
                  this.update();
                }
              }
              holder.css({ marginTop: top });
            }
          , receive: function (trends) {
              newKids = [];
              for (var i=0; i < trends.length; i++)
                newKids.push($(trends[i]));
            }
        };
      }

  /**
   * media grid
   */

    , grid
    , Grid = function (el) {
        // grid vars
        var wrap = $(el)
          , NUM_GRID = 50
          , NUM_FLOW = 25
          , GRID_OBJ_FREQ = { '482px': 1, '231px': '*' }
          , COL_WIDTH = 231
          , COL_GAP_X = 20
          , COL_GAP_Y = 30
          , MIN_COLS = 2
          , MAX_COLS = 4
          , x_off = 0
          , y_off = 0
          , col_heights = []
        ;
        // determine the number of columns
        function num_cols() {
          return Math.min(Math.max(
              MIN_COLS
            , (parseInt(wrap.innerWidth()) + COL_GAP_X) / (COL_WIDTH + COL_GAP_X)
          )
          , MAX_COLS);
        }
        
        return {
          collage: function () {
            
            // hide hovers
            $('.grid-obj-hover').hide();
            
            // calc num cols once
            var nc = num_cols();
            
            // clear column height array
            for (var x = 0; x < nc; x++) 
              col_heights[x] = 0;
            
            // loop over each object in grid
            $('.each-grid-obj').each(function (i) {
            
              var self = $(this)
                , obj_col = 0
                , obj_y = 0
              
                // determine how many columns the object will span
                , obj_span = Math.max(Math.round(self.outerWidth() / COL_WIDTH), 1)
              ;
              
              // determine which column to place the object in
              for (var x = 0; x < nc - (obj_span - 1); x++) 
                obj_col = col_heights[x] < col_heights[obj_col] ? x : obj_col;
              
              // determine the object's y position
              for (x = 0; x < obj_span; x++) 
                obj_y = Math.max(obj_y, col_heights[obj_col + x]);
              
              // determine the new height for the effected columns
              for (x = 0; x < obj_span; x++) 
                col_heights[obj_col + x] = parseInt(self.outerHeight()) + COL_GAP_Y + obj_y;
              
              // set the object's css position
              self.css('left', obj_col * (COL_WIDTH + COL_GAP_X) + x_off).css('top', obj_y + y_off);
            });
            
            // add the column gap to the bottom of the collage
            wrap.height(Math.max.apply(Math, col_heights) - COL_GAP_Y + 'px');
          }
        }
      }
    , hideFlashMessages = function () {
        $(this).fadeOut();
      }
    , log = function (m) {
        console.log(m);
      }
  ;


  return {
    
    /**
     * setup doc
     */
      
      go: function () {
      
        // extras
        if (!window.console) window.console = { log: function () {} };
        String.prototype.trim = function() { return this.replace(/^\s+|\s+$/g,""); }
        String.prototype.ltrim = function() { return this.replace(/^\s+/,""); }
        String.prototype.rtrim = function() { return this.replace(/\s+$/,""); }


        // scope aware timeouts
        // TODO: replace with native
        $.setTimeoutObj = function (o, t, f, a) {
          return setTimeout(function () { f.apply(o, a); }, t);
        }
        $.setIntervalObj = function (o, t, f, a) {
          return setInterval(function () { f.apply(o, a); }, t); 
        }


        // random generation
        $.fisherYates = function (a) {
          var i = a.length;
          if (i==0 ) return false;
          while (--i) {
            var j = Math.floor(Math.random() * (i + 1));
            var tempi = a[i];
            var tempj = a[j];
            a[i] = tempj;
            a[j] = tempi;
          }
        }


        // determine of object is empty (non-enumerable)
        $.isEmpty = function (o) {
          for (var p in o)
            if (o.hasOwnProperty(p))
              return false;
          return true;
        }


        // map form data to JSON
        $.fn.serializeObject = function () {
          var o = {}
            , a = this.serializeArray()
          ;
          $.each(a, function () {
            if (o[this.name]) {
              if (!o[this.name].push)
                o[this.name] = [o[this.name]];
              o[this.name].push(this.value || '');
            } else
              o[this.name] = this.value || '';
          });
          return o;
        };


        // get database ID
        $.fn.itemID = function () {
          try {
            var items = $(this).attr('id').split('-');
            return items[items.length - 1];
          } catch (exception) {
            return null;
          }
        };


        // server PUT
        $.put = function(url, data, success) {
          data._method = 'PUT';
          $.post(url, data, success, 'json');
        };


        // server GET
        $.get = function(url, data, success) {
          data._method = 'GET';
          $.post(url, data, success, 'json');
        };


        // hide server message in load
        setTimeout(function() {
          $('.flash').each(hideFlashMessages);
        }, 5000);
        $('.flash').click(hideFlashMessages);


        // init trending
        trending = new Trending('#trend');
        trending.init();


        // fit comments
        recentComments = $('#recent-comments');
        while (recentComments.height() > 360)
          $(recentComments.children()[recentComments.children().length - 1]).remove();


        // get relative comment times
        $.setIntervalObj(this, 5000, updateTimes); updateTimes();


        // init media grid
        grid = new Grid('#grid');
        grid.collage();


        // init mediaelement
        if ($('video').length > 0)
          new MediaElementPlayer('video', { mode:'shim' });


        // landing page login - register
        // TODO: reduce DOM calls
        $('#goto-register-form a').live('click', function () {
          $('#login-form').hide();
          $('#register-form').fadeIn('fast');
          $(this.parentNode).hide();
          $('#goto-login-form').show();
          $('input[name="newmember[name.first]"]').focus();
        });
        $('#goto-login-form a').live('click', function () {
          $('#register-form').hide();
          $('#login-form').fadeIn('fast');
          $(this.parentNode).hide();
          $('#goto-register-form').show();
          $('input[name="member[email]"]').focus();
        });
        $('input[name="member[email]"]').focus();


        // logout of island
        // TODO: replace without alert
        $('#nav-logout').live('click', function (e) {
          e.preventDefault();
          var element = $(this)
            , form = $('<form></form>')
          ;
          form
            .attr({
                method: 'POST'
              , action: '/sessions'
            })
            .hide()
            .append('<input type="hidden" />')
            .find('input')
            .attr({
                'name': '_method'
              , 'value': 'delete'
            })
            .end()
            .submit();
        });


        // pulse logo on mouseover
        var logoA = $('#logo-a')
          , logoB = $('#logo-b')
          , logos = [ logoA, logoB ]
        ;
        $('#logo').bind('mouseover', function () {
          logoA.hide();
          logoB.show();
          pulse(logos[0], logos[1]);
          pulseTimer = $.setIntervalObj(this, 500, pulse, logos);
          pulseCancel = $.setTimeoutObj(this, 5000, cancelPulse);
        }).bind('mouseout', function () {
          cancelPulse();
        });


        // tweets
        twitterNames = $('#twitter-names').text().split(',');
        for (var i=0; i < twitterNames.length; i++)
          if (twitterNames[i] != 'undefined' && twitterNames[i] != '')
            twitters.push(twitterNames[i]);
        twap = $('#twitter');
        for (var tt in twitters)
          $.tweet({
              username: twitters[tt]
            , callback: twat
          });


        // reduce header on scroll
        // TODO: throttle this shit
        // $(window).scroll(function () {
        //   if ($(this).scrollTop() > 100) {
        //     if (!overHeader)
        //       shrinkHeader();
        //   } else if ($(this).scrollTop() < 100) {
        //     if (!overHeader)
        //       expandHeader();
        //   }
        // });
        // 
        // $('#header').bind('mouseenter', function () {
        //   overHeader = true;
        //   if ($(window).scrollTop() > 100) {
        //     expandHeader();
        //     $(this).animate({ backgroundColor: 'rgba(255, 255, 255, 0.95)' }, 500);
        //   }
        // }).bind('mouseleave', function () {
        //   overHeader = false;
        //   if ($(window).scrollTop() > 100) {
        //     shrinkHeader();
        //     $(this).animate({ backgroundColor: 'rgba(255, 255, 255, 0.5)' }, 500);
        //   }
        // });


        // init autogrow text
        $('textarea').autogrow();


        // rollover each object
        $('.grid-obj-img').live('mouseenter', function () {
          $(this.previousElementSibling).show();
        });
        $('.grid-obj-hover').live('mouseleave', function () {
          $(this).fadeOut(100);
        });


        // search box
        $('#search-box').bind('keyup search', function (e) {
          var txt = $(this).val().trim();
          $('#grid').empty();
          search(['meta.tags', 'terms'], txt, function (serv) {
            if (serv.status == 'success') {
              var objects = serv.data.objects;
              for (var i=0; i < objects.length; i++)
                $(objects[i]).appendTo('#grid');
              grid.collage();
            } else
              log(serv.message);
          });
        });


        // filter grid by tag
        $('.grid-obj-tag').live('click', function () {
          var tag = $(this).text();
          $('#search-box').val('tag:' + tag);
          search(['meta.tags'], tag, function (serv) {
            if (serv.status == 'success') {
              var objects = serv.data.objects;
              for (var i=0; i < objects.length; i++)
                $(objects[i]).appendTo('#grid');
              grid.collage();
            } else
              log(serv.message);
          });
        });


        // comment input behavior
        $('.commentor-input-dummy').live('focus', function () {
          $(this).hide();
          $(this.nextElementSibling).show();
          $(this.nextElementSibling.firstElementChild).focus();
        });
        $('.commentor-input').live('blur', function () {
          if (this.value == '') {
            $(this.parentNode).hide();
            $(this.parentNode.previousElementSibling).show();
          }
        });


        // add comment on media
        $('.add-comment').live('click', function () {
          var comment = $(this.previousElementSibling).val().trim();
          if (comment == '') 
            return false;
          $(this.previousElementSibling).val('');
          $(this.parentNode).hide();
          $(this.parentNode.previousElementSibling).show();
          var pid = $(this).itemID()
            , data = {
                comment : comment 
              , pid     : pid
            };
          $.put('/comment/' + pid + '.json', data, function (serv) {
            if (serv.status == 'success')
              // update everyone
              now.distributeComment(serv.data);
            else
              log(serv.message);
          });
        });


        // show like heart
        $('.obj-holder').live('mouseenter', function () {
          $('.hearts', this).show();
        }).live('mouseleave', function () {
          $('.hearts', this).hide();
        });


        // no dragging hearts
        $('.hearts-wrap img, .hearts-back img').live('mousedown', function (e) {
          e.preventDefault();
        });


        // rate media with hearts
        var currentHearts = parseInt($('input[name="hearts"]').val())
          , x = 0
          , h = 0
        ;
        rater = $('.hearts-back');
        hearts = $('.hearts-wrap');
        if (currentHearts)
          selectHearts(null, currentHearts);
        rater.live('mouseenter', function (e) {
          
        }).live('mouseleave', function (e) {
          selectHearts(null, currentHearts);
        }).live('mousemove', function (e) {
          x = e.pageX - rater.offset().left;
          h = selectHearts(x);
        }).live('click', function (e) {
          currentHearts = h;
          var id = rater.itemID()
            , data = {
                id  : id
              , hearts : h
            };
          $.put('/hearts/' + id + '.json', data, function (serv) {
            if (serv.status == 'success') {
              // do something ?
            } else
              log(serv.message);
          });
        });


        // new media
        var mediaForm = $('#media-form')
          , mediaButton = $('#add-media')
          , mediaButtonMask = $('#add-media-mask')
          , mediaTitle = $('input[name="media[title]"]')
          , mediaBody = $('textarea[name="media[body]"]')
          , mediaTags = $('input[name="media[meta.tags]"]')
          , mediaFile = $('input[name="my_file"]')
          , mediaTitleLabel = $('label[for="media[title]"]')
          , mediaBodyLabel = $('label[for="media[body]"]')
          , mediaTagsLabel = $('label[for="media[meta.tags]"]')
          , mediaFileLabel = $('label[for="my_file"]')
        ;

        mediaButtonMask.each(function (i) {
          var w = mediaButton.outerWidth()
            , h = mediaButton.outerHeight()
          ;
          mediaButtonMask.css({ width: w, height: h });
        });

        mediaButtonMask.bind('mouseenter', function () {
          var title = mediaTitle.val().trim()
            , body = mediaBody.val().trim()
            , file = mediaFile.val()
          ;
          if (title != '' && body != '' && file != '') {
            mediaButtonMask.css('bottom', 10000).hide();
            resetMediaStyles();
          } else {
            mediaButton.addClass('is-button-alert');
            if (title == '') 
              mediaTitleLabel.css('color', 'red');
            if (body == '')
              mediaBodyLabel.css('color', 'red');
            if (file == '') 
              mediaFileLabel.css('color', 'red');
          }
        }).bind('mouseleave', exitMediaButton);

        function exitMediaButton() {
          mediaButtonMask.show();
          mediaButton.removeClass('is-button-alert');
          resetMediaStyles();
        }

        function resetMediaStyles() {
          mediaTitleLabel.css('color', 'gray');
          mediaBodyLabel.css('color', 'gray');
          mediaFileLabel.css('color', 'gray');
        }

        mediaButton.bind('mouseleave', function () {
          mediaButtonMask.css('bottom', 0);
          exitMediaButton();
        });

        mediaForm.transloadit({
            wait: true
          , autoSubmit: false
          , onSuccess: function (assembly) {
              if (assembly.ok != 'ASSEMBLY_COMPLETED') {
                alert('Upload failed. Please try again.');
                return;
              }
              if ($.isEmpty(assembly.results)) {
                alert('You must choose a file to contribute.');
                return;
              }
              var data = mediaForm.serializeObject();
              data.params = JSON.parse(data.params);
              data.assembly = assembly;
              $.put('/insert', data, function (serv) {
                if (serv.status == 'success') {
                  // clear form
                  mediaTitle.val('');
                  mediaBody.val('');
                  mediaTags.val('');
                  mediaFile = $('input[name="my_file"]');
                  // update everyone
                  now.distributeObject(serv.data.id);
                } else
                  log(serv.message);
              });
            }
        });
      
      }

  /**
   * Push a media object to all clients.
   */

    , receiveObject: function (serv) {
        if (serv.status == 'success') {
          var obj = $(serv.data.obj);
          obj.prependTo('#grid').css({ opacity: 0 });
          grid.collage();
          obj.animate({ opacity: 1 }, 500);
        } else
          log(serv.message);
      }

  /**
   * Push a comment to all clients.
   */

    , receiveComment: function (serv) {
        if (serv.status == 'success') {
          var com = $(serv.data.com)
            , rec = $(serv.data.rec)
            , comHolder = $('#coms-' + serv.data.pid)
            , recHolder = $('#recent-comments')
          ;
          if (recHolder.length == 0)
            setTimeout(function () {
              com.hide().css({ opacity: 0 }).prependTo(comHolder).show(250).animate({ opacity: 1 }, 500);
              var time = $('.comment-added', com);
              time.data('ts', time.text());
              time.text(relativeTime(time.data('ts')));
            }, 100);
          else
            rec.hide().css({ opacity: 0 }).appendTo(recHolder);
            var time = $('.comment-added', rec);
            time.data('ts', time.text());
            time.text(relativeTime(time.data('ts')));
            while (recHolder.height() + rec.height() + 5 > 360)
              $(recHolder.children()[recHolder.children().length - 2]).remove();
            setTimeout(function () {
              rec.prependTo(recHolder).show(250).animate({ opacity: 1 }, 500);
            }, 100);
        } else
          log(serv.message);
      }

  /**
   * Push new trends to all clients.
   */

    , receiveTrends: function (serv) {
        if (serv.status == 'success')
          trending.receive(serv.data.trends);
        else
          log(serv.message);
      }
  }

})(jQuery);


/**
 * Now.JS handlers
 */

now.receiveObject = Island.receiveObject;
now.receiveComment = Island.receiveComment;
now.receiveTrends = Island.receiveTrends;





