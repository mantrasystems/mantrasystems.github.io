/* Web: https://www.labnol.org/internet/light-youtube-embeds/27941/ */

document.addEventListener("DOMContentLoaded",
  function() {
    var anchor, n,
        v = document.getElementsByClassName("youtube-player");
    for (n = 0; n < v.length; n++) {
      anchor = document.createElement("a");
      anchor.setAttribute("data-id", v[n].dataset.id);
      anchor.setAttribute("class", "cta");
      anchor.setAttribute("href", "#");
      anchor.innerHTML = labnolThumb(v[n].dataset.id);
      anchor.onclick = labnolEmbed;
      v[n].appendChild(anchor);
    }
});

function labnolThumb(id) {
  var thumb = '<picture><source srcset="https://i.ytimg.com/vi/ID/mqdefault.jpg" media="(max-width: 480px)"><img src="https://i.ytimg.com/vi/ID/maxresdefault.jpg" alt="Preview image of the video" loading="lazy"></picture>';
  return thumb.replace("ID", id).replace("ID", id);
}

function labnolEmbed(e) {
  e.preventDefault();
  var element = document.createElement("iframe");
  var src = "https://www.youtube-nocookie.com/embed/ID?autoplay=1&amp;rel=0";
  element.setAttribute("src", src.replace("ID", this.dataset.id));
  element.setAttribute("type", "video/mp4");
  element.setAttribute("allowfullscreen", "1");
  this.parentNode.className += " playing";
  this.parentNode.replaceChild(element, this);
}