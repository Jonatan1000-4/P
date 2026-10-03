import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, getDoc, addDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { DEFAULT_MENU, DEFAULT_SETTINGS, DEFAULT_SCHEDULE } from "./default-data.js";

const SIZES={"2":"Comen 2 · pican 4","4":"Comen 4 · pican 6","8":"Comen 8 · pican 10"};
const PRODUCT_IMAGES={"clásica":"assets/picada_2.jpg","especial":"assets/picada_3.jpg","premium":"assets/picada_4.jpg"};
const $=id=>document.getElementById(id);
const orderSection=$("pedido");
function updateOrderVisibility(){
  const bounds=orderSection.getBoundingClientRect();
  document.body.classList.toggle("order-visible",bounds.top<innerHeight&&bounds.bottom>0);
}
window.addEventListener("scroll",updateOrderVisibility,{passive:true});
window.addEventListener("resize",updateOrderVisibility);
updateOrderVisibility();
const money=n=>new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(n);
let db=null, MENU=[], settings={...DEFAULT_SETTINGS}, schedule={...DEFAULT_SCHEDULE};
let cart=[];
let cartToastTimer;

try {
  if(firebaseConfig.apiKey && firebaseConfig.apiKey!="REEMPLAZAR"){
    const app=initializeApp(firebaseConfig); db=getFirestore(app);
    const s=await getDoc(doc(db,"config","business"));
    if(s.exists()) settings={...settings,...s.data()};
    const sch=await getDoc(doc(db,"config","schedule"));
    if(sch.exists()) schedule={...schedule,...sch.data()};
    const snap=await getDocs(collection(db,"products"));
    MENU=snap.empty ? [] : snap.docs.map(d=>({id:d.id,...d.data()})).filter(x=>x.active!==false);
  }
} catch(err){
  console.warn("Firebase no disponible; el catálogo no se cargó desde el admin.",err);
  MENU=[];
}

function render(){
  const cards=$("cards");
  if(!MENU.length){
    cards.innerHTML=`<article class="card hot" style="grid-column:1/-1"><div class="body"><div class="tag">Catálogo</div><h3>Cargando productos…</h3><p class="desc">Si esto dura más, revisá la conexión o el panel admin.</p></div></article>`;
    return;
  }

  cards.innerHTML=MENU.map((m,index)=>`<article class="card ${m.badge?'hot':''}">
    <div class="media" style="--img:url('${PRODUCT_IMAGES[m.name?.trim().toLocaleLowerCase("es-AR")]||m.img||"assets/picada_2.jpg"}')">${m.badge?`<span class="badge">${m.badge}</span>`:""}</div>
    <div class="body"><div class="tag">${m.tag||""}</div><h3>${m.name}</h3><p class="desc">${m.desc||""}</p>
    <div class="prices">${Object.entries(m.prices||{}).map(([s,p])=>`<button type="button" class="price" data-product-index="${index}" data-size="${s}" aria-label="Agregar ${m.name}, ${SIZES[s]||s}, ${money(p)}"><span>${SIZES[s]||s}</span><b>${money(p)}</b><span aria-hidden="true">+</span></button>`).join("")}</div>
    <details><summary>Qué trae</summary><p>${m.items||""}</p></details></div></article>`).join("");

  document.querySelectorAll(".price").forEach(button=>button.onclick=()=>addToCart(MENU[Number(button.dataset.productIndex)],button.dataset.size));
  $("businessStatus").textContent=settings.acceptingOrders!==false ? (settings.statusText||"Tomamos pedidos") : "Pedidos pausados";
  $("submitOrder").disabled=settings.acceptingOrders===false;
  $("submitOrder").textContent=settings.acceptingOrders===false ? "Pedidos pausados" : "Guardar y enviar por WhatsApp";
  buildDates();
  renderCart();
}
function addToCart(product,productSize){
  if(!product)return;
  const unitPrice=Number(product.prices?.[productSize]);
  if(!Number.isFinite(unitPrice)||unitPrice<0)return;
  const productId=product.id||product.name;
  const existing=cart.find(item=>item.productId===productId&&item.size===productSize);
  if(existing)existing.qty=Math.min(10,existing.qty+1);
  else cart.push({productId,name:product.name,size:productSize,sizeLabel:SIZES[productSize]||productSize,unitPrice,qty:1});
  renderCart();
  showCartToast(`Agregaste ${product.name} · ${SIZES[productSize]||productSize} al carrito.`);
}
function showCartToast(message){
  const toast=$("cartToast");
  clearTimeout(cartToastTimer);
  $("cartToastMessage").textContent=message;
  toast.hidden=false;
  toast.classList.add("visible");
  cartToastTimer=setTimeout(()=>{
    toast.classList.remove("visible");
    toast.hidden=true;
  },3000);
}
function renderCart(){
  const count=cart.reduce((sum,item)=>sum+item.qty,0);
  const total=cart.reduce((sum,item)=>sum+item.unitPrice*item.qty,0);
  $("cartCount").textContent=`${count} ${count===1?"unidad":"unidades"}`;
  $("cartItems").innerHTML=cart.length?cart.map((item,index)=>`<article class="cart-line">
    <div class="cart-product"><strong>${item.name}</strong><small>${item.sizeLabel} · ${money(item.unitPrice)} c/u</small></div>
    <div class="cart-line-tools"><div class="cart-actions">
      <button type="button" data-cart-action="minus" data-index="${index}" aria-label="Quitar una unidad de ${item.name}">−</button><span class="cart-qty">${item.qty}</span>
      <button type="button" data-cart-action="plus" data-index="${index}" aria-label="Agregar una unidad de ${item.name}">+</button>
      <button type="button" data-cart-action="remove" data-index="${index}" aria-label="Quitar ${item.name} del pedido">×</button>
    </div><strong class="cart-subtotal">${money(item.unitPrice*item.qty)}</strong></div>
  </article>`).join(""):'<p class="cart-empty">Todavía no agregaste picadas.</p>';
  $("grandTotal").textContent=money(total);
  $("submitOrder").disabled=settings.acceptingOrders===false||cart.length===0;
  $("submitOrder").textContent=settings.acceptingOrders===false?"Pedidos pausados":cart.length?"Enviar pedido por WhatsApp":"Agregá una picada para continuar";
}
$("cartItems").addEventListener("click",event=>{
  const button=event.target.closest("button[data-cart-action]");
  if(!button)return;
  const index=Number(button.dataset.index),item=cart[index];
  if(!item)return;
  if(button.dataset.cartAction==="plus")item.qty=Math.min(10,item.qty+1);
  if(button.dataset.cartAction==="minus")item.qty=Math.max(1,item.qty-1);
  if(button.dataset.cartAction==="remove")cart.splice(index,1);
  renderCart();
});

function localISO(d){ const x=new Date(d.getTime()-d.getTimezoneOffset()*60000); return x.toISOString().slice(0,10); }
function buildDates(){
  const sel=$("date"); sel.innerHTML='<option value="">Elegí una fecha</option>';
  const now=new Date();
  for(let i=0;i<21;i++){ const d=new Date(now); d.setDate(now.getDate()+i); const day=schedule[String(d.getDay())];
    if(day?.enabled){ const o=document.createElement("option");o.value=localISO(d);o.textContent=d.toLocaleDateString("es-AR",{weekday:"long",day:"numeric",month:"short"});sel.appendChild(o); }
  }
  sel.onchange=buildSlots; buildSlots();
}
async function buildSlots(){
  const sel=$("slot"); sel.innerHTML='<option value="">Elegí un horario</option>'; if(!$("date").value)return;
  const day=new Date($("date").value+"T12:00:00").getDay(), slots=schedule[String(day)]?.slots||[];
  let counts={};
  if(db){
    try{ const q=query(collection(db,"orders"),where("date","==",$("date").value)); const snap=await getDocs(q);
      snap.forEach(d=>{const x=d.data(); if(!["cancelled","rejected"].includes(x.status)) counts[x.slot]=(counts[x.slot]||0)+1;});
    }catch(e){console.warn(e)}
  }
  slots.forEach(s=>{const full=(counts[s]||0)>=Number(settings.maxOrdersPerSlot||4); const o=document.createElement("option");o.value=s;o.disabled=full;o.textContent=full?`${s} · completo`:s;sel.appendChild(o)});
}

$("orderForm").addEventListener("submit",async e=>{
  e.preventDefault();
  if(settings.acceptingOrders===false) return alert("Los pedidos están pausados.");
  if(!cart.length) return alert("Agregá al menos una picada al pedido.");
  if(!$("date").value||!$("slot").value) return alert("Elegí fecha y horario.");
  const total=cart.reduce((sum,item)=>sum+item.unitPrice*item.qty,0);
  const items=cart.map(item=>({productId:item.productId,product:item.name,size:item.size,sizeLabel:item.sizeLabel,qty:item.qty,unitPrice:item.unitPrice,total:item.unitPrice*item.qty}));
  const order={product:items.map(item=>`${item.product} (${item.sizeLabel}) x${item.qty}`).join(" + "),size:items.length===1?items[0].size:"multiple",sizeLabel:items.length===1?items[0].sizeLabel:"Varias opciones",items,qty:items.reduce((sum,item)=>sum+item.qty,0),total,name:$("name").value.trim(),address:$("address").value.trim(),
    notes:$("notes").value.trim(),date:$("date").value,slot:$("slot").value,mode:$("mode").value,status:"pending",createdAt:new Date().toISOString()};
  let orderId="SIN-ID";
  if(db){
    try{ const ref=await addDoc(collection(db,"orders"),{...order,createdAt:serverTimestamp()}); orderId=ref.id.slice(0,8).toUpperCase(); }
    catch(err){ console.error(err); if(!confirm("No se pudo guardar en Firebase. ¿Querés continuar por WhatsApp igualmente?"))return; }
  }
  const msg=`Hola! 👋 Quiero hacer un pedido en *Se Picó*.

🧾 *Pedido:* #${orderId}
🥓 *Picadas:*
${items.map(item=>`• ${item.product} · ${item.sizeLabel} x${item.qty}: ${money(item.total)}`).join("\n")}
📅 *Fecha:* ${$("date").value}
🕐 *Horario:* ${$("slot").value}
🚚 *Modalidad:* ${$("mode").value}
💰 *Total:* ${money(total)}

👤 *Nombre:* ${order.name}
📍 *Entrega / zona:* ${order.address||"A coordinar"}
📝 *Observaciones:* ${order.notes||"Sin observaciones"}

¿Me confirman el pedido?`;
  const phone=settings.whatsapp||"5492645309178";
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`,"_blank");
});
render();
