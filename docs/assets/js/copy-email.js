document.addEventListener("DOMContentLoaded",
  function() {
    var anchor, n,
        v = document.getElementsByClassName("email-address");
    for (n = 0; n < v.length; n++) {
      var emailAddress = v[n].getAttribute("href").replace('mailto:','').replace(/(\?.*)|(#.*)/g,'');
      /data-/g,''
      anchor = document.createElement("a");
      anchor.setAttribute("class", "copy-email icon-copy");
      anchor.setAttribute("title", "Copy email address");
      anchor.setAttribute("href", "#");
      anchor.innerHTML = "<span>Copy email address</span>";

      if (v[n].classList.contains("landing-page")) {
        anchor.setAttribute("onclick", "return gtag_report_conversion('#0');");
      }

      v[n].insertAdjacentElement("afterend", anchor);

      anchor.addEventListener('click', function(e) {
        e.preventDefault();
        navigator.clipboard.writeText(emailAddress);
      },);
    }
});
