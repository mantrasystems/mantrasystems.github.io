document.addEventListener("DOMContentLoaded", () => {
    const iframeEle = document.getElementById("mdcg-search");
    const iframeBody = iframeEle.contentWindow.document.body;
    iframeEle.style.height = iframeBody.scrollHeight+"px";

    const ro = new ResizeObserver(function() {
        //iframeEle.style.height = iframeBody.scrollHeight+"px";
    });

    ro.observe(iframeBody);
});