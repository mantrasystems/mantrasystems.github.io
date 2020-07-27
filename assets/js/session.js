window.addEventListener("DOMContentLoaded", function() {
  function eraseCookie(name) {   
    document.cookie = name+'=; Max-Age=-99999999;';
  }

  eraseCookie('_ga');
  eraseCookie('_gat_gtag_UA_150294559_1');
  eraseCookie('_gid');
});