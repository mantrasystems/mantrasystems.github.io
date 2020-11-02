/* Light YouTube Embeds by @labnol */
/* Web: http://labnol.org/?p=27941 */

document.addEventListener("DOMContentLoaded",
  function() {
    var anchor, n,
        v = document.getElementsByClassName("youtube-player");
    for (n = 0; n < v.length; n++) {
      anchor = document.createElement("a");
      anchor.setAttribute("data-id", v[n].dataset.id);
      anchor.setAttribute("class", "cta");
      anchor.setAttribute("href", "#");
      anchor.setAttribute("title", "Listen to Dr Paul Hercock introduce Mantra Systems");
      anchor.innerHTML = labnolThumb(v[n].dataset.id);
      anchor.onclick = labnolEmbed;
      v[n].appendChild(anchor);
    }
});

function labnolThumb(id) {
  var thumb = '<picture><source srcset="https://i.ytimg.com/vi/ID/mqdefault.jpg" media="(max-width: 480px)"><img src="https://i.ytimg.com/vi/ID/maxresdefault.jpg" alt="Preview image: Mantra Systems CEO, Dr Paul Hercock" loading="lazy"></picture>';
  return thumb.replace("ID", id).replace("ID", id);
}

function labnolEmbed(e) {
  e.preventDefault();
  var embed = document.createElement("embed");
  var url = "https://www.youtube-nocookie.com/embed/ID?autoplay=1&amp;rel=0&amp;showinfo=0";
  embed.setAttribute("src", url.replace("ID", this.dataset.id));
  this.parentNode.className += " playing";
  this.parentNode.replaceChild(embed, this);
}