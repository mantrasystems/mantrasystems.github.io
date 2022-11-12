<script>
document.addEventListener("DOMContentLoaded",
  function() {
    const p = document.createElement("p");
    p.setAttribute("class", "custom-information");
    p.innerHTML = "<b>Note:</b> After completing your order, you will be sent an email with a link to download your product(s).";
    const t = document.querySelector('#pay-button');
    t.parentNode.insertBefore(p, t);    
});
</script>