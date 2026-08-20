import{c as o}from"./index-Dii8rHps.js";/**
 * @license lucide-react v1.23.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const u=[["path",{d:"M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z",key:"18u6gg"}],["circle",{cx:"12",cy:"13",r:"3",key:"1vg3eu"}]],A=o("camera",u);/**
 * @license lucide-react v1.23.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const d=[["path",{d:"m15 15 6 6",key:"1s409w"}],["path",{d:"m15 9 6-6",key:"ko1vev"}],["path",{d:"M21 16v5h-5",key:"1ck2sf"}],["path",{d:"M21 8V3h-5",key:"1qoq8a"}],["path",{d:"M3 16v5h5",key:"1t08am"}],["path",{d:"m3 21 6-6",key:"wwnumi"}],["path",{d:"M3 8V3h5",key:"1ln10m"}],["path",{d:"M9 9 3 3",key:"v551iv"}]],R=o("expand",d);/**
 * @license lucide-react v1.23.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const l=[["circle",{cx:"11",cy:"11",r:"8",key:"4ej97u"}],["line",{x1:"21",x2:"16.65",y1:"21",y2:"16.65",key:"13gj7c"}],["line",{x1:"11",x2:"11",y1:"8",y2:"14",key:"1vmskp"}],["line",{x1:"8",x2:"14",y1:"11",y2:"11",key:"durymu"}]],O=o("zoom-in",l);/**
 * @license lucide-react v1.23.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const m=[["circle",{cx:"11",cy:"11",r:"8",key:"4ej97u"}],["line",{x1:"21",x2:"16.65",y1:"21",y2:"16.65",key:"13gj7c"}],["line",{x1:"8",x2:"14",y1:"11",y2:"11",key:"durymu"}]],S=o("zoom-out",m),a="SÓ AÇO INDUSTRIAL LTDA";function c(r){return String(r??"").normalize("NFD").replace(new RegExp("\\p{M}","gu"),"").toUpperCase()}function t(r){const n=String(r??"").trim();if(!n)return a;const e=c(n);return e.includes("SO ACO")||e.includes("ACO INDUSTRIAL")?a:e.includes("SO MOVEIS")||e.includes("MOVEIS")?"SÓ MÓVEIS":e.includes("REFRIGER")?"SO REFRIGERAÇÃO":e.includes("RN MARQUES")||e.includes("R N MARQUES")?"R N MARQUES ARAUJO":e==="LOJA"||e.startsWith("LOJA ")||e.includes(" LOJA")?"LOJA":n}function E(r){const n=c(String(r.setor??"").trim()),e=c(String(r.area??"").trim()),s=c(String(r.diretoria??"").trim()),i=`${n} ${e} ${s}`;return i.includes("REFRIGER")?t("SO REFRIGERAÇÃO"):i.includes("MOVEIS")||i.includes("MOVEL")?t("SÓ MÓVEIS"):i.includes("RN MARQUES")||i.includes("R N MARQUES")?t("R N MARQUES ARAUJO"):e==="LOJA"||n.includes("LOJA")?"LOJA":r.historicoLocal&&String(r.diretoria??"").trim()?t(String(r.diretoria??"").trim()):a}export{A as C,R as E,a as O,S as Z,O as a,t as n,E as r};
