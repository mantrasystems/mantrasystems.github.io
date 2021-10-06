window.addEventListener("DOMContentLoaded", function() {
  function eraseCookie(name) {   
    document.cookie = name+'=; Max-Age=-99999999; SameSite=Lax';
  }

  eraseCookie('_ga');
  eraseCookie('_gat_gtag_UA_150294559_1');
  eraseCookie('_ga_68RHWWLT08');
  eraseCookie('_gid');
});