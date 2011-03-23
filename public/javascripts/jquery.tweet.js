(function($) {
  // get the tweets
  $.tweet = function(o) {
    // defaults
    var s = {
      username:null,
      count: 10,
      auto_join_text_default:"<br />said,",
      auto_join_text_ed:"<br />",
      auto_join_text_ing:"<br />was",
      auto_join_text_reply:"<br />replied to",
      auto_join_text_url:"<br />was looking at",
      query:null,
       tweets:new Array(),
      callback:function() { }
    };
    // merge settings
    if(o) $.extend(s, o);
    // extend utils
    $.fn.extend({
      linkUrl: function() {
        var returning = [];
        var regexp = /((ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?)/gi;
        this.each(function() {
          returning.push(this.replace(regexp,"<a target='_blank' href=\"$1\">$1</a>"))
        });
        return $(returning);
      },
      linkUser: function() {
        var returning = [];
        var regexp = /[\@]+([A-Za-z0-9-_]+)/gi;
        this.each(function() {
          returning.push(this.replace(regexp,"<a target='_blank' href=\"http://twitter.com/#!/$1\">@$1</a>"))
        });
        return $(returning);
      },
      linkHash: function() { //http://twitter.com/#!/search?q=%23transloadit
        var returning = [];
        var regexp = / [\#]+([A-Za-z0-9-_]+)/gi;
        this.each(function() {
          returning.push(this.replace(regexp, ' <a target="_blank" href="http://twitter.com/#!/search?q=%23$1">#$1</a>'))
        });
        return $(returning);
      },
      capAwesome: function() {
        var returning = [];
        this.each(function() {
          returning.push(this.replace(/(a|A)wesome/gi, 'AWESOME'))
        });
        return $(returning);
      },
      capEpic: function() {
        var returning = [];
        this.each(function() {
          returning.push(this.replace(/(e|E)pic/gi, 'EPIC'))
        });
        return $(returning);
      },
      makeHeart: function() {
        var returning = [];
        this.each(function() {
          returning.push(this.replace(/(&lt;)+[3]/gi, "<tt class='heart'>&#x2665;</tt>"))
        });
        return $(returning);
      }
    });
    // time to text
    function relative_time(time_value) {
      var parsed_date = Date.parse(time_value);
      var relative_to = (arguments.length > 1) ? arguments[1] : new Date();
      var delta = parseInt((relative_to.getTime() - parsed_date) / 1000);
      if(delta < 60) return 'less than a minute ago';  
      else if(delta < 120) return 'about a minute ago';
      else if(delta < (45*60)) return (parseInt(delta / 60)).toString() + ' minutes ago';  
      else if(delta < (90*60)) return 'about an hour ago';
      else if(delta < (24*60*60)) return 'about ' + (parseInt(delta / 3600)).toString() + ' hours ago';  
      else if(delta < (48*60*60)) return '1 day ago';  
      else return (parseInt(delta / 86400)).toString() + ' days ago';
    }
    // make array for query
    if(typeof(s.username) == "string") s.username = [s.username];
    // write query
    var query = '';
    if(s.query) query += 'q='+s.query;
    query += '&q=from:'+s.username.join('%20OR%20from:');
    // search url
    var url = 'http://search.twitter.com/search.json?&'+query+'&rpp='+s.count+'&callback=?';
    // get data
    $.getJSON(url,function(data) {
      // build tweets
      $.each(data.results,function(i,item) {
         // auto join text based on verb tense and content              
        if(item.text.match(/^(@([A-Za-z0-9-_]+)) .*/i)) var join_text = s.auto_join_text_reply;
        else if(item.text.match(/(^\w+:\/\/[A-Za-z0-9-_]+\.[A-Za-z0-9-_:%&\?\/.=]+) .*/i)) var join_text = s.auto_join_text_url;
        else if(item.text.match(/^((\w+ed)|just) .*/im)) var join_text = s.auto_join_text_ed;
        else if(item.text.match(/^(\w*ing) .*/i)) var join_text = s.auto_join_text_ing;
        else var join_text = s.auto_join_text_default;
        // make tweet
        var date = '<a target="_blank" href="http://twitter.com/#!/'+item.from_user+'/status/'+item.id_str+'" title="view tweet on twitter">'+s.username+' ('+relative_time(item.created_at)+')</a>';
        var join = '<span class="tweet_join"> '+join_text+' </span>';
        var text = '<span class="tweet_text">' +$([item.text]).linkUrl().linkUser().linkHash().makeHeart().capAwesome().capEpic()[0]+'</span>';
        // add to list
        s.tweets.push('<p>' + date + join + text + '</p>');
      });
      // call back and send tweets
      s.callback(s.tweets);
    });
  };
})(jQuery);