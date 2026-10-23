const $=id=>document.getElementById(id);
let paymentRows=[],periodRows=[],piBands=[];
const euro=n=>Number(n||0).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' €';
const num=v=>{
  if(typeof v==='number')return v;
  let s=String(v??'').replace(/\s/g,'').replace(/[€]/g,'').replace(',','.');
  let n=parseFloat(s);
  return Number.isFinite(n)?n:0
};
function date(s){
  let m=String(s||'').match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if(!m)return null;
  let d=new Date(+m[3],+m[2]-1,+m[1]);
  return d.getDate()==+m[1]&&d.getMonth()==+m[2]-1?d:null
}
function fmtDate(d){
  return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+d.getFullYear()
}
function monthKey(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}
function parseMonth(s){
  let m=String(s).match(/(\d{1,2})\s*[\/.-]\s*(\d{4})/);
  if(!m)return null;
  return new Date(+m[2],+m[1]-1,1)
}
function monthLabel(d){return d.toLocaleDateString('fr-FR',{month:'long',year:'numeric'})}
function addMonths(d,n){return new Date(d.getFullYear(),d.getMonth()+n,1)}
function endMonth(d){return new Date(d.getFullYear(),d.getMonth()+1,0)}
function getPeriods(){
  let a=date($('debut').value),b=date($('fin').value);
  if(!a||!b||a>b)throw Error('Renseigne des dates de début et de fin d’indu valides.');
  let out=[];
  for(let d=new Date(a.getFullYear(),a.getMonth(),1);d<=b;d=addMonths(d,1))out.push(new Date(d));
  return out
}
function attachMoney(el){
  el.addEventListener('blur',()=>{
    if(el.value.trim()!=='')el.value=num(el.value).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})
  })
}
async function pdfText(file){
  if(!window.pdfjsLib)throw Error('La bibliothèque PDF n’a pas pu être chargée. Vérifie la connexion Internet.');
  pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  let pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise,all=[];
  for(let p=1;p<=pdf.numPages;p++){
    let page=await pdf.getPage(p),c=await page.getTextContent();
    all.push(c.items.map(x=>x.str).join(' '))
  }
  return all.join('\n')
}
async function docxText(file){
  if(!window.mammoth)throw Error('La bibliothèque Word n’a pas pu être chargée. Vérifie la connexion Internet.');
  let r=await mammoth.extractRawText({arrayBuffer:await file.arrayBuffer()});
  return r.value
}
$('readFiles').onclick=async()=>{
  try{
    let r=$('resourcesFile').files[0],n=$('noticeFile').files[0];
    if(!r&&!n)throw Error('Sélectionne au moins un document.');
    $('fileStatus').textContent='Lecture locale en cours…';
    if(r)$('resourceText').value=r.name.toLowerCase().endsWith('.pdf')?await pdfText(r):await docxText(r);
    if(n)$('noticeText').value=await pdfText(n);
    $('extractArea').classList.remove('hidden');
    $('fileStatus').textContent='Lecture terminée. Vérifie le texte extrait avec les documents originaux avant de continuer.'
  }catch(e){$('fileStatus').textContent=e.message}
};
$('clearFiles').onclick=()=>{
  $('resourcesFile').value='';
  $('noticeFile').value='';
  $('resourceText').value='';
  $('noticeText').value='';
  $('extractArea').classList.add('hidden');
  $('fileStatus').textContent='Aucun document lu.';
  paymentRows=[];
  renderPayments()
};
function readPaymentRows(text){
  let out=[],re=/(?:ASI\s+)?(\d{2}\/\d{4})\s+(-?[\d.,]+)\s+(-?[\d.,]+)\s+(-?[\d.,]+)/gi,m;
  while((m=re.exec(text))!==null){
    let month=parseMonth(m[1]);
    if(!month)continue;
    out.push({month,newAmount:num(m[2]),paid:num(m[3]),sourceDiff:num(m[4]),right:null,indu:null,checked:false})
  }
  let uniq=new Map();
  out.forEach(r=>uniq.set(monthKey(r.month),r));
  return [...uniq.values()].sort((a,b)=>a.month-b.month)
}
$('parseNotice').onclick=()=>{
  paymentRows=readPaymentRows($('noticeText').value);
  renderPayments();
  $('fileStatus').textContent=paymentRows.length
    ?paymentRows.length+' mensualité(s) reconnue(s). Compare les montants à la notification originale.'
    :'Aucune ligne reconnue automatiquement. Vérifie le texte extrait; le format du décompte peut varier.'
};
function renderPayments(){
  let tb=$('payments').querySelector('tbody');
  tb.innerHTML='';
  paymentRows.forEach((r,i)=>{
    let tr=document.createElement('tr');
    tr.innerHTML=`<td>${monthLabel(r.month)}</td><td><input data-i="${i}" data-k="newAmount" value="${r.newAmount.toFixed(2)}"></td><td><input data-i="${i}" data-k="paid" value="${r.paid.toFixed(2)}"></td><td class="inducell">—</td><td><label><input type="checkbox" data-i="${i}" data-k="checked" ${r.checked?'checked':''}> Vérifié</label></td>`;
    tr.querySelectorAll('input:not([type=checkbox])').forEach(el=>{
      attachMoney(el);
      el.addEventListener('change',()=>paymentRows[+el.dataset.i][el.dataset.k]=num(el.value))
    });
    tr.querySelector('[type=checkbox]').onchange=e=>paymentRows[i].checked=e.target.checked;
    tb.appendChild(tr)
  })
}
function renderPI(){
  let box=$('piBands');
  box.innerHTML='';
  if(!piBands.length){
    let d=date($('debut').value)||new Date();
    let y=d.getMonth()<3?d.getFullYear()-1:d.getFullYear();
    piBands=[{date:`01/04/${y}`,amount:''}]
  }
  piBands.sort((a,b)=>date(a.date)-date(b.date));
  piBands.forEach((b,i)=>{
    let row=document.createElement('div');
    row.className='grid bandrow';
    row.innerHTML=`<div class="field"><label>Date d’effet du montant PI</label><input class="pidate" value="${b.date}" placeholder="JJ/MM/AAAA"></div><div class="field"><label>Montant théorique mensuel PI (€)</label><input class="piamount" value="${b.amount}" placeholder="Montant (€)"></div><div class="field"><label>Action</label><button type="button" class="secondary remove">Supprimer cette ligne</button></div>`;
    row.querySelector('.pidate').onchange=e=>{piBands[i].date=e.target.value};
    row.querySelector('.piamount').onchange=e=>{piBands[i].amount=num(e.target.value)};
    row.querySelector('.remove').onclick=()=>{piBands.splice(i,1);renderPI()};
    box.appendChild(row)
  })
}
$('addPI').onclick=()=>{
  let last=piBands.length?date(piBands[piBands.length-1].date):null;
  let y=last?last.getFullYear()+1:(date($('debut').value)||new Date()).getFullYear();
  piBands.push({date:`01/04/${y}`,amount:''});
  renderPI()
};
$('debut').addEventListener('change',()=>{if(!piBands.length)renderPI()});
function piAt(d){
  let matches=piBands.map(b=>({d:date(b.date),a:num(b.amount)}))
    .filter(b=>b.d&&b.d<=d)
    .sort((a,b)=>b.d-a.d);
  return matches.length?matches[0].a:0
}
function renderPeriodRows(){
  try{
    let months=getPeriods(),tb=$('quarterTable').querySelector('tbody');
    tb.innerHTML='';
    periodRows=[];
    months.forEach(pay=>{
      let refEnd=addMonths(pay,-1),refStart=addMonths(pay,-3),pi=0;
      for(let d=new Date(refStart);d<=refEnd;d=addMonths(d,1))pi+=piAt(d);
      let row={
        pay,refStart,refEnd,pi,salary:0,abatement:0,other:0,capital:0,
        ceiling:0,rights:0,
        paid:paymentRows.find(p=>monthKey(p.month)===monthKey(pay))?.paid??0,
        indu:0
      };
      periodRows.push(row);
      let tr=document.createElement('tr');
      tr.innerHTML=`<td>${monthLabel(pay)}</td><td>${fmtDate(refStart)} au ${fmtDate(endMonth(refEnd))}</td><td><input data-k="pi" value="${pi.toFixed(2)}"></td><td><input data-k="salary" value="0.00"></td><td><input data-k="abatement" value="0.00"></td><td><input data-k="other" value="0.00"></td><td><input data-k="capital" value="0.00"></td><td><input data-k="ceiling" value="0.00"></td><td class="rightcell">—</td><td class="induperiod">—</td>`;
      tr.querySelectorAll('input').forEach(el=>{
        attachMoney(el);
        el.addEventListener('change',()=>row[el.dataset.k]=num(el.value))
      });
      tb.appendChild(tr)
    });
    return true
  }catch(e){
    $('error').textContent=e.message;
    $('error').classList.remove('hidden');
    return false
  }
}
$('buildPeriods').onclick=()=>{renderPeriodRows()};
$('calculate').onclick=()=>{
  try{
    if(!periodRows.length&&!renderPeriodRows())return;
    let missing=periodRows.filter(r=>!r.ceiling);
    if(missing.length)throw Error('Renseigne le plafond trimestriel applicable pour chaque période (ou vérifie les plafonds). Aucun plafond n’est inventé automatiquement.');
    let total=0;
    periodRows.forEach((r,i)=>{
      let resources=r.pi+r.salary-Math.min(r.salary,r.abatement)+r.other+r.capital;
      resources=Math.max(0,resources);
      r.resources=resources;
      r.right=Math.max(0,r.ceiling-resources)/3;
      r.paid=paymentRows.find(p=>monthKey(p.month)===monthKey(r.pay))?.paid??0;
      r.indu=Math.max(0,r.paid-r.right);
      total+=r.indu;
      let pr=paymentRows.find(p=>monthKey(p.month)===monthKey(r.pay));
      if(pr){pr.right=r.right;pr.indu=r.indu}
      let tr=$('quarterTable').querySelector('tbody').rows[i];
      tr.querySelector('.rightcell').textContent=euro(r.right);
      tr.querySelector('.induperiod').textContent=euro(r.indu)
    });
    renderPayments();
    [...$('payments').querySelector('tbody').rows].forEach((tr,i)=>{
      let p=paymentRows[i],cell=tr.querySelector('.inducell');
      cell.textContent=p&&p.indu!=null?euro(p.indu):'—'
    });
    $('summary').innerHTML=`<div class="metric"><span>Mensualités calculées</span><strong>${periodRows.length}</strong></div><div class="metric"><span>Indu recalculé (somme des écarts positifs)</span><strong>${euro(total)}</strong></div><p class="small">Calcul de travail : ressources trimestrielles après abattement, droit théorique mensuel = (plafond trimestriel − ressources retenues) / 3, indu mensuel = max(0, payé − droit théorique). Cette logique doit être confirmée pour chaque situation et chaque période selon les règles et modèles internes CRAMIF. Contrôle les montants PI, les périodes de référence, les abattements et le plafond avant export.</p>`;
    $('exportDocx').disabled=false;
    $('exportCsv').disabled=false;
    $('error').classList.add('hidden')
  }catch(e){
    $('error').textContent=e.message;
    $('error').classList.remove('hidden')
  }
};
function fmtMoney(n){return euro(n)}
function esc(s){
  return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
}
function annexHtml(){
  let name=($('civilite').value+' '+$('nom').value+' '+$('prenom').value).trim(),
      first=periodRows[0],total=periodRows.reduce((a,r)=>a+(r.indu||0),0);
  let out=`<h1>ANNEXE — DÉTAIL DES CALCULS</h1><p>${esc(name)}</p>`;
  if(first)out+=`<p>Pour déterminer les arrérages d’allocation supplémentaire qui vous étaient éventuellement dus au ${fmtDate(first.pay)}, la Caisse Régionale a calculé le montant de vos ressources pour la période du ${fmtDate(first.refStart)} au ${fmtDate(endMonth(first.refEnd))} :</p>`;
  for(let r of periodRows){
    out+=`<h2>Calcul au ${fmtDate(r.pay)}</h2><p>Pour déterminer les arrérages d’allocation supplémentaire dus au ${fmtDate(r.pay)}, la Caisse Régionale a calculé le montant de vos ressources pour la période du ${fmtDate(r.refStart)} au ${fmtDate(endMonth(r.refEnd))} :</p><ul><li>Pension d’invalidité (${fmtMoney(piAt(r.refStart))} × 3 ou montants mensuels applicables) : ${fmtMoney(r.pi)}</li><li>Salaires : ${fmtMoney(r.salary)}</li><li>Abattement (article R. 815-29 du code de la sécurité sociale) : − ${fmtMoney(Math.min(r.salary,r.abatement))}</li><li>Autres ressources : ${fmtMoney(r.other)}</li><li>Capitaux placés / BIM : ${fmtMoney(r.capital)}</li><li>Total des ressources trimestrielles : ${fmtMoney(r.resources)}</li><li>Plafond trimestriel applicable : ${fmtMoney(r.ceiling)}</li><li>Montant trimestriel théorique de l’allocation supplémentaire : ${fmtMoney(Math.max(0,r.ceiling-r.resources))}</li><li>Montant mensuel théorique : ${fmtMoney(r.right)}</li><li>Montant déjà payé : ${fmtMoney(r.paid)}</li><li>Différence retenue au titre de l’indu : ${fmtMoney(r.indu)}</li></ul>`
  }
  out+=`<p>Il en est résulté un trop-perçu calculé à ce stade à ${fmtMoney(total)}, sous réserve de la vérification des données sources et de la validation des règles appliquées.</p>`;
  return out
}
$('exportDocx').onclick=()=>{
  let lib=document.createElement('script');
  lib.src='https://unpkg.com/html-docx-js/dist/html-docx.js';
  lib.onload=()=>{
    let html=`<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:Arial Narrow,Arial,sans-serif;font-size:10pt}h1{text-align:center;font-size:14pt}h2{font-size:11pt}p,li{line-height:1.25}ul{margin-top:3pt}</style></head><body>${annexHtml()}</body></html>`;
    let blob=window.htmlDocx.asBlob(html),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='Annexe_calcul_indu_ASI.docx';a.click();
    setTimeout(()=>URL.revokeObjectURL(url),1500)
  };
  document.head.appendChild(lib)
};
$('exportCsv').onclick=()=>{
  let rows=[['Mensualité','Période de référence','PI','Salaires','Abattement','Autres ressources','Capitaux/BIM','Ressources retenues','Plafond trimestriel','Droit ASI théorique mensuel','Déjà payé','Indu']];
  periodRows.forEach(r=>rows.push([monthLabel(r.pay),fmtDate(r.refStart)+' au '+fmtDate(endMonth(r.refEnd)),r.pi,r.salary,Math.min(r.salary,r.abatement),r.other,r.capital,r.resources,r.ceiling,r.right,r.paid,r.indu]));
  let csv='\ufeff'+rows.map(r=>r.map(x=>'"'+String(x??'').replace(/"/g,'""')+'"').join(';')).join('\r\n'),
      blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='Calcul_indu_ASI.csv';a.click();URL.revokeObjectURL(url)
};
$('downloadJson').onclick=()=>{
  let d={
    identification:Object.fromEntries(['ref','civilite','nom','prenom','situation','dateDemande','dateDecision','dateEffet','dateControle','dateCRA','gestionnaire','mesure','debut','fin','motif'].map(k=>[k,$(k).value])),
    resourcesText:$('resourceText').value,
    noticeText:$('noticeText').value,
    payments:paymentRows,
    periods:periodRows,
    piBands
  };
  let b=new Blob([JSON.stringify(d,null,2)],{type:'application/json'}),u=URL.createObjectURL(b),a=document.createElement('a');
  a.href=u;a.download='Dossier_CRA_ASI.json';a.click();URL.revokeObjectURL(u)
};
renderPI();