window.addEventListener("DOMContentLoaded", function() {
  function eraseCookie(name) {   
    document.cookie = name+'=; Domain=.mantrasystems.co.uk; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT; SameSite=Lax';
  }

  eraseCookie('_ga');
  eraseCookie('_gat_gtag_UA_150294559_1');
  eraseCookie('_ga_68RHWWLT08');
  eraseCookie('_gid');
});