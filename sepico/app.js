import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getFirestore, collection, getDocs, doc, getDoc, addDoc, query, where, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { DEFAULT_MENU, DEFAULT_SETTINGS, DEFAULT_SCHEDULE } from "./default-data.js";

const SIZES={"2":"Comen 2 · pican 4","4":"Comen 4 · pican 6","8":"Comen 8 · pican 10"};
const PRODUCT_IMAGES={"clásica":"assets/picada_2.jpg","especial":"assets/picada_3.jpg","premium":"assets/picada_4.jpg"};
const $=id=>document.getElementById(id);
const money=n=>new Intl.NumberFormat("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0}).format(n);
let db=null, MENU=[], settings={...DEFAULT_SETTINGS}, schedule={...DEFAULT_SCHEDULE};
let type="", size="2";

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

type=MENU[0]?.name||"";

function render(){
  const cards=$("cards");
  if(!MENU.length){
    cards.innerHTML=`<article class="card hot" style="grid-column:1/-1"><div class="body"><div class="tag">Catálogo</div><h3>Cargando productos…</h3><p class="desc">Si esto dura más, revisá la conexión o el panel admin.</p></div></article>`;
    return;
  }

  cards.innerHTML=MENU.map(m=>`<article class="card ${m.badge?'hot':''}">
    <div class="media" style="--img:url('${PRODUCT_IMAGES[m.name?.trim().toLocaleLowerCase("es-AR")]||m.img||"assets/picada_2.jpg"}')">${m.badge?`<span class="badge">${m.badge}</span>`:""}</div>
    <div class="body"><div class="tag">${m.tag||""}</div><h3>${m.name}</h3><p class="desc">${m.desc||""}</p>
    <div class="prices">${Object.entries(m.prices||{}).map(([s,p])=>`<button type="button" class="price" data-type="${m.name}" data-size="${s}"><span>${SIZES[s]||s}</span><b>${money(p)}</b></button>`).join("")}</div>
    <details><summary>Qué trae</summary><p>${m.items||""}</p></details>
    <button class="btn btn-primary choose" data-type="${m.name}">Elegir ${m.name}</button></div></article>`).join("");

  const chips=(id,name,opts,checked)=>$(id).innerHTML=opts.map(([v,t])=>`<input type="radio" name="${name}" id="${name}-${String(v).replace(/\s/g,"-")}" value="${v}" ${v==checked?"checked":""}><label for="${name}-${String(v).replace(/\s/g,"-")}">${t}</label>`).join("");
  chips("typeChips","type",MENU.map(m=>[m.name,m.name]),type);
  chips("sizeChips","size",Object.entries(SIZES),size);

  document.querySelectorAll('input[name=type]').forEach(r=>r.onchange=()=>{type=r.value;update()});
  document.querySelectorAll('input[name=size]').forEach(r=>r.onchange=()=>{size=r.value;update()});
  document.querySelectorAll(".choose").forEach(b=>b.onclick=()=>{type=b.dataset.type;update();go()});
  document.querySelectorAll(".price").forEach(b=>b.onclick=()=>{type=b.dataset.type;size=b.dataset.size;update();go()});
  $("businessStatus").textContent=settings.acceptingOrders!==false ? (settings.statusText||"Tomamos pedidos") : "Pedidos pausados";
  $("submitOrder").disabled=settings.acceptingOrders===false;
  $("submitOrder").textContent=settings.acceptingOrders===false ? "Pedidos pausados" : "Guardar y enviar por WhatsApp";
  buildDates();
  update();
}
const qtyEl=$("qty"),getQty=()=>Math.min(10,Math.max(1,Number(qtyEl.value)||1));
const current=()=>MENU.find(m=>m.name===type)||MENU[0];
const unit=()=>Number(current()?.prices?.[size]||0);
function update(){ $("total").textContent=money(unit()*getQty()); }
const go=()=>$("pedido").scrollIntoView({behavior:"smooth"});
qtyEl.oninput=update;
$("minus").onclick=()=>{qtyEl.value=Math.max(1,getQty()-1);update()};
$("plus").onclick=()=>{qtyEl.value=Math.min(10,getQty()+1);update()};

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
  if(!$("date").value||!$("slot").value) return alert("Elegí fecha y horario.");
  const q=getQty(), total=unit()*q;
  const order={product:type,size,sizeLabel:SIZES[size],qty:q,total,name:$("name").value.trim(),address:$("address").value.trim(),
    notes:$("notes").value.trim(),date:$("date").value,slot:$("slot").value,mode:$("mode").value,status:"pending",createdAt:new Date().toISOString()};
  let orderId="SIN-ID";
  if(db){
    try{ const ref=await addDoc(collection(db,"orders"),{...order,createdAt:serverTimestamp()}); orderId=ref.id.slice(0,8).toUpperCase(); }
    catch(err){ console.error(err); if(!confirm("No se pudo guardar en Firebase. ¿Querés continuar por WhatsApp igualmente?"))return; }
  }
  const msg=`Hola! 👋 Quiero hacer un pedido en *Se Picó*.

🧾 *Pedido:* #${orderId}
🥓 *Picada:* ${type}
👥 *Tamaño:* ${SIZES[size]}
📦 *Cantidad:* ${q}
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
