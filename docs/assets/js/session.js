window.addEventListener("DOMContentLoaded", function() {
  var GA_TRACKING_ID = 'UA-150294559-1';
  var localStorageCid = {
      objectName: 'ga_client_id',
      expires: 1000*60*60*24*365*2
    };
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());

  if (window.localStorage) {
    var lsCid;
    var jsonObj = window.localStorage.getItem(localStorageCid.objectName) || '{}';
    var obj = JSON.parse(jsonObj);
    var now = new Date().getTime();
    if (obj.clientId && obj.expires) {
      if (now <= obj.expires) {
        lsCid = obj.clientId;
      }
    }

    gtag('config', GA_TRACKING_ID, {
      'client_storage': 'none',
      'anonymize_ip': true,
      'send_page_view': false,
      'client_id': lsCid
    });

    gtag('event', 'page_view', {
      'event_callback': function() {
        createFunctionWithTimeout(function() {
          var tracker_id = GA_TRACKING_ID.replace(/-/g, '_');
          var tracker = window.ga.getByName('gtag_'+tracker_id);
          var _lsc_clientId = tracker.get('clientId');
          var _lsc_obj = JSON.stringify({
              clientId: _lsc_clientId,
              expires: new Date().getTime() + localStorageCid.expires
          });
          window.localStorage.setItem(localStorageCid.objectName, _lsc_obj);
        });
      }
    });
  }
  else {
    gtag('config', GA_TRACKING_ID, {
      'client_storage': 'none',
      'anonymize_ip': true
    });
  }  

  function createFunctionWithTimeout(callback, opt_timeout) {
    var called = false;
    function fn() {
      if (!called) {
        called = true;
        callback();
      }
    }
    setTimeout(fn, opt_timeout || 1000);
    return fn;
  }
});