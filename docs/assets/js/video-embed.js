/* Light YouTube Embeds by @labnol */
/* Web: http://labnol.org/?p=27941 */

document.addEventListener("DOMContentLoaded",
  function() {
    var div, n,
        v = document.getElementsByClassName("youtube-player");
    for (n = 0; n < v.length; n++) {
      div = document.createElement("div");
      div.setAttribute("data-id", v[n].dataset.id);
      div.innerHTML = labnolThumb(v[n].dataset.id);
      div.onclick = labnolEmbed;
      v[n].appendChild(div);
    }
});

function labnolThumb(id) {
  var thumb = '<img src="https://i.ytimg.com/vi_webp/ID/maxresdefault.webp" loading="lazy">',
    play = '<div class="play"></div>';
  return thumb.replace("ID", id) + play;
}

function labnolEmbed() {
  var embed = document.createElement("embed");
  var url = "https://www.youtube.com/embed/ID?autoplay=1&amp;rel=0&amp;showinfo=0";
  embed.setAttribute("src", url.replace("ID", this.dataset.id));
  embed.setAttribute("frameborder", "0");
  embed.setAttribute("allowfullscreen", "1");
  this.parentNode.replaceChild(embed, this);
}