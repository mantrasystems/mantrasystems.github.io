// Add a degree of Google Ads tracking to forms using localstorage
// Store gclid if it's in the query string
const params = new URLSearchParams(window.location.search);
const gclid = params.get('gclid');
if (gclid) {
    localStorage.setItem('gclid', gclid);
}

// Populate form field from localStorage
document.addEventListener('DOMContentLoaded', () => {
    const gclidValue = localStorage.getItem('gclid');
    if (gclidValue) {
        const input = document.getElementById('gclid');
        if (input) input.value = gclidValue;
    }
});
