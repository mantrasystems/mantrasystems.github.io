window.addEventListener("DOMContentLoaded", function() {
  var requestReferrer = document.getElementById("request-referrer"),
      input = document.createElement('input');

  input.setAttribute("type","hidden");
  input.setAttribute("name","previous page");
  input.setAttribute("value",document.referrer);

  requestReferrer.appendChild(input);
});