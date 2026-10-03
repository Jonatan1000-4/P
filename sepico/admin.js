import { initializeApp } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, addDoc, deleteDoc, updateDoc, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/12.3.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";
import { DEFAULT_MENU, DEFAULT_SETTINGS, DEFAULT_SCHEDULE } from "./default-data.js";
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app),$=id=>document.getElementById(id);
const dayNames=["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
let products=[],schedule={...DEFAULT_SCHEDULE};

let shareToastTimer;
function showShareMessage(message){
 $("shareToast").textContent=message;
 $("shareToast").hidden=false;
 clearTimeout(shareToastTimer);
 shareToastTimer=setTimeout(()=>{$("shareToast").hidden=true},3500);
}
$("shareStore").onclick=async()=>{
 const url=new URL("index.html",window.location.href).href;
 const button=$("shareStore");
 button.disabled=true;
 $("shareFallback").hidden=true;
 try{
  if(navigator.share){
   try{
    await navigator.share({title:"Se Picó",text:"Mirá nuestras picadas y hacé tu pedido.",url});
    return;
   }catch(error){
    if(error.name==="AbortError")return;
   }
  }
  try{
   await navigator.clipboard.writeText(url);
   showShareMessage("Enlace de la tienda copiado");
  }catch(error){
   $("storeLink").value=url;
   $("shareFallback").hidden=false;
   $("storeLink").focus();
   $("storeLink").select();
  }
 }finally{button.disabled=false}
};

// Hide panels without rebuilding forms: unsaved edits survive tab changes.
const tabs=[...document.querySelectorAll('[role="tab"]')];
function selectSection(id){
 tabs.forEach(tab=>{
  const selected=tab.dataset.section===id;
  tab.setAttribute("aria-selected",String(selected));tab.tabIndex=selected?0:-1;
  $(tab.getAttribute("aria-controls")).hidden=!selected;
 });
 window.scrollTo({top:0,behavior:"instant"});
}
tabs.forEach((tab,index)=>{
 tab.onclick=()=>selectSection(tab.dataset.section);
 tab.onkeydown=e=>{
  let next;
  if(e.key==="ArrowRight")next=(index+1)%tabs.length;
  if(e.key==="ArrowLeft")next=(index+tabs.length-1)%tabs.length;
  if(e.key==="Home")next=0;
  if(e.key==="End")next=tabs.length-1;
  if(next!==undefined){e.preventDefault();selectSection(tabs[next].dataset.section);tabs[next].focus()}
 };
});
const metricIds=["metricTotal","metricOpen","metricDelivered","metricCancelled","metricRevenue","metricAverage"];
function renderMetrics(orders){
 const delivered=orders.filter(o=>o.status==="delivered");
 const revenue=delivered.reduce((sum,o)=>sum+(Number.isFinite(Number(o.total))?Number(o.total):0),0);
 const money=value=>value.toLocaleString("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0});
 const values=[orders.length,orders.filter(o=>["pending","accepted","preparing","ready"].includes(o.status||"pending")).length,delivered.length,orders.filter(o=>o.status==="cancelled").length,money(revenue),money(delivered.length?revenue/delivered.length:0)];
 metricIds.forEach((id,i)=>$(id).textContent=values[i]);
 $("metricsStatus").textContent=orders.length?`Actualizado a las ${new Date().toLocaleTimeString("es-AR")}. Base: ${orders.length} pedidos.`:"Todavía no hay pedidos para analizar.";
}

$("loginForm").onsubmit=async e=>{e.preventDefault();try{await signInWithEmailAndPassword(auth,$("email").value,$("password").value)}catch(err){alert("No se pudo ingresar: "+err.message)}};
$("logout").onclick=()=>signOut(auth);
onAuthStateChanged(auth,async user=>{
 $("loginBox").classList.toggle("hidden",!!user);$("admin").classList.toggle("hidden",!user);$("logout").classList.toggle("hidden",!user);
 $("userLabel").textContent=user?.email||"";
 $("adminError").classList.add("hidden");
 if(user){try{await loadAll()}catch(err){$("adminError").textContent="No se pudo cargar el panel. Revisá tu conexión y los permisos de acceso; volvé a ingresar para reintentar.";$("adminError").classList.remove("hidden")}}
});
async function loadAll(){
 const s=await getDoc(doc(db,"config","business"));const x=s.exists()?{...DEFAULT_SETTINGS,...s.data()}:DEFAULT_SETTINGS;
 $("accepting").checked=x.acceptingOrders!==false;$("statusText").value=x.statusText||"";$("whatsapp").value=x.whatsapp||"";$("maxOrders").value=x.maxOrdersPerSlot||4;
 const sh=await getDoc(doc(db,"config","schedule"));schedule=sh.exists()?{...DEFAULT_SCHEDULE,...sh.data()}:structuredClone(DEFAULT_SCHEDULE);renderDays();
 const ps=await getDocs(collection(db,"products"));products=ps.empty?DEFAULT_MENU:ps.docs.map(d=>({id:d.id,...d.data()}));renderProducts();await loadOrders();
}
$("saveBusiness").onclick=async()=>{await setDoc(doc(db,"config","business"),{acceptingOrders:$("accepting").checked,statusText:$("statusText").value.trim(),whatsapp:$("whatsapp").value.trim(),maxOrdersPerSlot:Number($("maxOrders").value)||4},{merge:true});alert("Configuración guardada")};
function renderDays(){$("days").innerHTML=dayNames.map((n,i)=>`<div class="day"><label><span><input class="dayEnabled" data-day="${i}" type="checkbox" ${schedule[i]?.enabled?"checked":""} style="width:auto"> ${n}</span></label><label>Horarios<input class="daySlots" data-day="${i}" value="${(schedule[i]?.slots||[]).join(", ")}"></label></div>`).join("")}
$("saveSchedule").onclick=async()=>{document.querySelectorAll(".dayEnabled").forEach(x=>{const d=x.dataset.day;schedule[d]={enabled:x.checked,slots:(document.querySelector(`.daySlots[data-day="${d}"]`).value||"").split(",").map(v=>v.trim()).filter(Boolean)}});await setDoc(doc(db,"config","schedule"),schedule);alert("Horarios guardados")};
function renderProducts(){$("products").innerHTML=products.map((p,i)=>`<div class="product">
 <div class="row between"><b>${p.name}</b><span><input type="checkbox" data-i="${i}" class="pActive" ${p.active!==false?"checked":""}> activo</span></div>
 <label>Nombre<input class="pName" data-i="${i}" value="${p.name||""}"></label><label>Descripción<input class="pDesc" data-i="${i}" value="${p.desc||""}"></label>
 <div class="row"><label>2/pican 4<input class="p2" data-i="${i}" type="number" value="${p.prices?.["2"]||0}"></label><label>4/pican 6<input class="p4" data-i="${i}" type="number" value="${p.prices?.["4"]||0}"></label><label>8/pican 10<input class="p8" data-i="${i}" type="number" value="${p.prices?.["8"]||0}"></label></div>
 <label>Ingredientes<textarea class="pItems" data-i="${i}">${p.items||""}</textarea></label><div class="row"><button class="primary saveP" data-i="${i}">Guardar</button><button class="danger delP" data-i="${i}">Eliminar</button></div></div>`).join("");
 document.querySelectorAll(".saveP").forEach(b=>b.onclick=()=>saveProduct(+b.dataset.i));document.querySelectorAll(".delP").forEach(b=>b.onclick=()=>delProduct(+b.dataset.i));
}
async function saveProduct(i){const p=products[i],data={...p,name:document.querySelector(`.pName[data-i="${i}"]`).value,desc:document.querySelector(`.pDesc[data-i="${i}"]`).value,active:document.querySelector(`.pActive[data-i="${i}"]`).checked,items:document.querySelector(`.pItems[data-i="${i}"]`).value,prices:{"2":Number(document.querySelector(`.p2[data-i="${i}"]`).value),"4":Number(document.querySelector(`.p4[data-i="${i}"]`).value),"8":Number(document.querySelector(`.p8[data-i="${i}"]`).value)}};await setDoc(doc(db,"products",p.id),data);products[i]=data;alert("Producto guardado")}
async function delProduct(i){if(!confirm("¿Eliminar producto?"))return;await deleteDoc(doc(db,"products",products[i].id));products.splice(i,1);renderProducts()}
$("newProduct").onclick=async()=>{const id="producto-"+Date.now();const p={id,name:"Nuevo producto",tag:"",desc:"",img:"assets/picada_2.jpg",active:true,prices:{"2":0,"4":0,"8":0},items:""};await setDoc(doc(db,"products",id),p);products.push(p);renderProducts()};
async function loadOrders(){
 $("refreshOrders").disabled=true;
 $("refreshMetrics").disabled=true;
 $("metricsStatus").textContent="Actualizando métricas…";
 try{
  const snap=await getDocs(query(collection(db,"orders"),orderBy("createdAt","desc"),limit(50)));
  const arr=snap.docs.map(d=>({...d.data(),id:d.id}));
  renderMetrics(arr);
  $("orders").innerHTML=arr.length?arr.map(o=>`<div class="order">
   <div class="row between"><div><b>#${escapeHTML(o.id.slice(0,8).toUpperCase())}</b> · ${escapeHTML(o.name)} · ${escapeHTML(o.product)}</div><div>${escapeHTML(o.date)} ${escapeHTML(o.slot)}</div></div>
   <div class="muted">${escapeHTML(o.sizeLabel)} · x${escapeHTML(o.qty||1)} · $${Number(o.total||0).toLocaleString("es-AR")} · ${escapeHTML(o.mode)}</div>
   <div class="row" style="margin-top:8px"><select aria-label="Estado del pedido ${escapeHTML(o.id.slice(0,8))}" class="status" data-id="${escapeHTML(o.id)}" style="width:auto"><option value="pending">Pendiente</option><option value="accepted">Aceptado</option><option value="preparing">Preparando</option><option value="ready">Listo</option><option value="delivered">Entregado</option><option value="cancelled">Cancelado</option></select><button class="ghost saveStatus" data-id="${escapeHTML(o.id)}">Actualizar estado</button></div>
  </div>`).join(""):"<p class='muted'>Todavía no hay pedidos.</p>";
  document.querySelectorAll(".status").forEach(s=>{s.value=arr.find(o=>o.id===s.dataset.id)?.status||"pending"});
  document.querySelectorAll(".saveStatus").forEach(b=>b.onclick=async()=>{
   const s=b.parentElement.querySelector(".status");
   b.disabled=true;
   try{await updateDoc(doc(db,"orders",b.dataset.id),{status:s.value});await loadOrders()}
   catch(err){alert("No se pudo actualizar el estado. Volvé a intentarlo.")}
   finally{b.disabled=false}
  });
 }catch(e){
  $("orders").innerHTML="<p class='muted'>No se pudieron cargar los pedidos. Revisá tu conexión y los permisos de acceso.</p>";
  metricIds.forEach(id=>$(id).textContent="—");
  $("metricsStatus").textContent="No se pudieron cargar las métricas. Usá Actualizar métricas para reintentar.";
 }finally{
  $("refreshOrders").disabled=false;
  $("refreshMetrics").disabled=false;
 }
}
function escapeHTML(value){return String(value??"").replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]))}

$("refreshMetrics").onclick=loadOrders;
$("refreshOrders").onclick=loadOrders;
