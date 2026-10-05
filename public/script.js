// Empty string = same domain. The Capacitor app will use the full site URL instead.
const API_BASE = "";

let products = [];
let cart = JSON.parse(localStorage.getItem("cart") || "{}"); // { productId: quantity }

const $ = (id) => document.getElementById(id);
const imgSrc = (u) => (/^https?:/.test(u) ? u : API_BASE + u);
const rand = (cents) => "R" + (cents / 100).toFixed(2);
// Escape text before putting it in HTML, so edited product names can't inject code.
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function saveCart() {
  localStorage.setItem("cart", JSON.stringify(cart));
  renderCart();
}

async function loadProducts() {
  try {
    const res = await fetch(API_BASE + "/api/products");
    if (!res.ok) throw new Error("Bad response");
    products = await res.json();
    renderProducts();
    // Drop cart items that no longer exist
    Object.keys(cart).forEach((id) => { if (!products.find((p) => String(p.id) === id)) delete cart[id]; });
    saveCart();
  } catch (err) {
    $("products").innerHTML = "<p class='error'>Couldn't load products. Refresh the page to try again.</p>";
  }
}

function renderProducts() {
  $("products").innerHTML = products.map((p) => `
    <article class="card">
      ${p.image_url ? `<img src="${esc(imgSrc(p.image_url))}" alt="${esc(p.name)}" loading="lazy">` : ""}
      <h3>${esc(p.name)}</h3>
      <p>${esc(p.description || "")}</p>
      <span class="price">${rand(p.price_cents)}</span>
      <button data-add="${p.id}" ${p.stock <= 0 ? "disabled" : ""}>${p.stock <= 0 ? "Sold out" : "Add to cart"}</button>
    </article>`).join("");
}

function renderCart() {
  const ids = Object.keys(cart);
  let total = 0, count = 0;
  $("cart-items").innerHTML = ids.length ? ids.map((id) => {
    const p = products.find((x) => String(x.id) === id);
    if (!p) return "";
    total += p.price_cents * cart[id];
    count += cart[id];
    return `<div class="line">
      <span>${esc(p.name)}<br><small>${rand(p.price_cents)}</small></span>
      <span class="qty">
        <button data-dec="${id}" aria-label="Remove one">-</button>${cart[id]}
        <button data-inc="${id}" aria-label="Add one">+</button>
      </span></div>`;
  }).join("") : "<p>Your cart is empty. Add something from the shop.</p>";
  $("cart-total").textContent = rand(total);
  $("cart-count").textContent = count;
  $("checkout").disabled = count === 0;
}

function changeQty(id, delta) {
  cart[id] = (cart[id] || 0) + delta;
  if (cart[id] <= 0) delete cart[id];
  saveCart();
}

async function checkout() {
  const btn = $("checkout"), err = $("checkout-error");
  err.hidden = true;
  btn.disabled = true;
  btn.textContent = "Redirecting to payment...";
  try {
    const FIELDS = ["first_name", "last_name", "email", "phone", "address_line", "suburb", "city", "province", "postal_code", "delivery_notes"];
    const details = {};
    FIELDS.forEach((k) => { details[k] = $("c-" + k).value.trim(); });
    const missing = ["first_name", "last_name", "email", "phone", "address_line", "city", "province", "postal_code"].filter((k) => !details[k]);
    if (missing.length) throw new Error("Please fill in all the details above (delivery notes and suburb are optional)");
    if (!$("c-consent").checked) throw new Error("Please tick the box to agree");
    details.consent = true;
    // Step 1: create the order. We send only ids and quantities; the server looks up real prices.
    const items = Object.entries(cart).map(([id, qty]) => ({ product_id: Number(id), qty }));
    const post = (path, body) => fetch(API_BASE + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const orderRes = await post("/api/orders", { ...details, items });
    const order = await orderRes.json();
    if (!orderRes.ok) throw new Error(order.error || "Could not create order");
    // Step 2: ask the server for a Yoco payment link for that order (route added in the next step).
    const payRes = await post("/api/checkout", { order_id: order.id });
    const pay = await payRes.json();
    if (!payRes.ok || !pay.redirectUrl) throw new Error(pay.error || "Payment isn't set up yet");
    window.location.href = pay.redirectUrl; // Yoco's hosted payment page
  } catch (e) {
    err.textContent = "Couldn't start payment: " + e.message;
    err.hidden = false;
    btn.disabled = false;
    btn.textContent = "Pay with card";
  }
}

// One listener handles every button inside the product grid and the cart.
document.addEventListener("click", (e) => {
  const t = e.target;
  if (t.dataset.add) { changeQty(t.dataset.add, 1); $("drawer").classList.add("open"); }
  if (t.dataset.inc) changeQty(t.dataset.inc, 1);
  if (t.dataset.dec) changeQty(t.dataset.dec, -1);
});
$("cart-open").onclick = () => $("drawer").classList.add("open");
$("cart-close").onclick = () => $("drawer").classList.remove("open");
$("checkout").onclick = checkout;

if (new URLSearchParams(location.search).get("cancelled")) {
  $("notice").textContent = "Payment cancelled. Your cart is still saved.";
  $("notice").hidden = false;
}

renderCart();
loadProducts();