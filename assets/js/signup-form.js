window.addEventListener("DOMContentLoaded", function() {
  var signupStatement = document.getElementById("signup-statement"),
      button = document.createElement('button');

  button.className = "button";
  button.setAttribute("type","submit");
  button.innerText = "Sign-up";

  signupStatement.parentNode.insertBefore(button, signupStatement);
});