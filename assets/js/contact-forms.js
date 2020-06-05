window.addEventListener("DOMContentLoaded", function() {

  // get the form elements defined in your form HTML above
  
  var contactForms = document.getElementsByClassName("contact-form");

  // handle the form submission event

  for (var i = 0; i < contactForms.length; i++) {
    contactForms.item(i).addEventListener("submit", function(ev) {
      ev.preventDefault();

      var form = this,
          formID = form.getAttribute('id'),
          data = new FormData(form),
          fieldset = form.getElementsByTagName("fieldset");

      function success() {
        form.reset();
        fieldset[0].style = "display: none";
        var notice = document.createElement('p');
        notice.className = "notice success";

        if (formID == "callback-form") {
          notice.innerHTML = "Good news! Your callback request has been received. We will be in touch shortly.";
        } else if (formID == "events-form") {
          notice.innerHTML = "Good news! You have successfully registered your place. We will send an email with further instructions in due course.";
        } else if (formID == "downloads-form") {
          notice.innerHTML = "Good news! We have received your request and sent you an email with a link to access our downloads.";
        }

        form.appendChild(notice);
      }

      function error() {
        var notice = document.createElement('p');
        notice.className = "notice error";
        notice.innerHTML = "We're sorry. There was a problem. Please try submitting the form again.";
        form.appendChild(notice);
      }

      ajax(form.method, form.action, data, success, error);
    });
  }
});

// helper function for sending an AJAX request

function ajax(method, url, data, success, error) {
  var xhr = new XMLHttpRequest();
  xhr.open(method, url);
  xhr.setRequestHeader("Accept", "application/json");
  xhr.onreadystatechange = function() {
    if (xhr.readyState !== XMLHttpRequest.DONE) return;
    if (xhr.status === 200) {
      success(xhr.response, xhr.responseType);
    } else {
      error(xhr.status, xhr.response, xhr.responseType);
    }
  };
  xhr.send(data);
}