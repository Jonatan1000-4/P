export const DEFAULT_SETTINGS = {
  businessName: "Se Picó",
  whatsapp: "5492645309178",
  whatsappAlt: "5492644584501",
  address: "Rodeo · Iglesia · San Juan",
  deliveryText: "Delivery los fines de semana",
  acceptingOrders: true,
  statusText: "Tomamos pedidos",
  deliveryEnabled: true,
  pickupEnabled: true,
  maxOrdersPerSlot: 4
};

export const DEFAULT_MENU = [
  {id:"clasica",name:"Clásica",tag:"La de siempre",desc:"Simple, abundante y bien argentina.",img:"assets/picada_2.jpg",active:true,
   prices:{"2":20000,"4":30000,"8":60000},
   items:"Queso barra · Salame Milán · Mortadela · Paleta · Jamón crudo · Salchichón · Pan común · Grisines · Mayo casera · Berenjena en escabeche · Aceitunas condimentadas · Porotos en escabeche."},
  {id:"especial",name:"Especial",tag:"Más completa",desc:"Más variedad de quesos, fiambres y acompañamientos.",img:"assets/picada_3.jpg",badge:"La más pedida",active:true,
   prices:{"2":25000,"4":38000,"8":70000},
   items:"Queso pategrás · Queso barra · Queso de cerdo · Salame Milán · Salame metro · Bondiola · Jamón crudo · Pan común · Aceitunas condimentadas · Mayo casera · Mayo de palta · Tomates disecados · Porotitos condimentados."},
  {id:"premium",name:"Premium",tag:"La más completa",desc:"La opción grande para una juntada que pide de todo.",img:"assets/picada_4.jpg",active:true,
   prices:{"2":35000,"4":50000,"8":80000},
   items:"Queso barra · Pategrás · Tybo · Queso de cerdo · Salame Milán · Salame metro · Paleta · Jamón cocido · Jamón crudo · Bondiola · Lomito · Mortadela · Salchichón · Aceitunas · Berenjena · Cebollita · Porotos · Tomates disecados · Mayo casera, de palta y picante."}
];

export const DEFAULT_SCHEDULE = {
  "0": {enabled:false, slots:[]},
  "1": {enabled:false, slots:[]},
  "2": {enabled:false, slots:[]},
  "3": {enabled:false, slots:[]},
  "4": {enabled:false, slots:[]},
  "5": {enabled:true, slots:["20:00","20:30","21:00","21:30","22:00","22:30"]},
  "6": {enabled:true, slots:["20:00","20:30","21:00","21:30","22:00","22:30"]}
};
