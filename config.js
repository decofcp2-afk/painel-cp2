/* ============================================================================
   config.js — ADAPTADOR SUPABASE (réplica fiel do painel)
   Mantém o frontend (index.html) intocado. O loader original busca a "apiUrl";
   aqui interceptamos fetch e JSONP e devolvemos o MESMO formato { processos:[...] }
   construído a partir do schema "contratacoes" do Supabase.
   Multi-unidade via ?unidade=SIGLA (default COMP) + seletor visível no cabeçalho.
   ============================================================================ */
(function () {
  var SB_URL = "https://fhgqixzufmgebwfffdai.supabase.co";
  var SB_KEY = "sb_publishable_O_m4yrige70t94drd8NGrQ_In80Vn32";
  var SCHEMA = "contratacoes";
  var SENTINEL = "supabase-adapter.local";

  // Mantém a forma esperada pelo index.html (loader lê PAINEL_CONFIG.apiUrl).
  window.PAINEL_CONFIG = { apiUrl: "https://" + SENTINEL + "/painel" };

  // ---- repontar "Acesso Restrito" para o app-cp2 (Supabase) ----
  var APP_URL = "https://decofcp2-afk.github.io/app-cp2/";
  function repontarAcessoRestrito(){
    try{
      Array.from(document.querySelectorAll('a')).forEach(function(a){
        if(/acesso restrito|restrito/i.test(a.textContent||"") || /app_gestao-compartilhada/.test(a.getAttribute("href")||"")){
          a.setAttribute("href", APP_URL); a.setAttribute("target","_blank"); a.removeAttribute("onclick");
        }
      });
    }catch(e){}
  }
  document.addEventListener("DOMContentLoaded", repontarAcessoRestrito);
  setTimeout(repontarAcessoRestrito, 600); setTimeout(repontarAcessoRestrito, 1800);

  // ---- seletor de unidade visível (transforma o chip da marca em dropdown) ----
  function instalarSeletorUnidade(){
    try{
      var chip = document.querySelector('.brand-chip');
      if(!chip || chip.__selInstalado) return;
      sbReady.then(function(sb){
        sb.schema(SCHEMA).from("unidade").select("sigla,nome").eq("ativa", true).order("nome").then(function(r){
          var us = (r.data || []);
          if(!us.length) return;
          var atual = (new URLSearchParams(location.search).get("unidade") || "COMP").toUpperCase();
          var sel = document.createElement("select");
          sel.title = "Selecionar unidade";
          sel.setAttribute("aria-label", "Selecionar unidade");
          sel.style.cssText = "font:inherit;color:inherit;background:transparent;border:0;outline:0;cursor:pointer;-webkit-appearance:none;appearance:none;max-width:340px;";
          us.forEach(function(u){
            var o = document.createElement("option");
            o.value = String(u.sigla||"").toUpperCase();
            o.textContent = u.nome || u.sigla;
            o.style.color = "#0f172a";
            if(o.value === atual) o.selected = true;
            sel.appendChild(o);
          });
          var wrap = document.createElement("span");
          wrap.style.cssText = "display:inline-flex;align-items:center;gap:3px;";
          var arrow = document.createElement("span");
          arrow.textContent = "▾";
          arrow.style.cssText = "font-size:.8em;opacity:.7;pointer-events:none;";
          chip.textContent = "";
          wrap.appendChild(sel); wrap.appendChild(arrow);
          chip.appendChild(wrap);
          chip.__selInstalado = true;
          sel.addEventListener("change", function(){
            location.href = location.pathname + "?unidade=" + encodeURIComponent(sel.value);
          });
        });
      });
    }catch(e){}
  }
  document.addEventListener("DOMContentLoaded", instalarSeletorUnidade);
  setTimeout(instalarSeletorUnidade, 700); setTimeout(instalarSeletorUnidade, 1800); setTimeout(instalarSeletorUnidade, 3000);

  // ---- carrega supabase-js sob demanda ----
  // IMPORTANTE: o painel é PÚBLICO e mora no mesmo domínio (github.io) que o
  // app-cp2. Sem forçar o modo público, o supabase-js herdaria a sessão do
  // usuário logado no app (mesmo localStorage) e o RLS esconderia os processos.
  // Por isso desligamos a sessão e fixamos a chave publishable como Authorization.
  var sbReady = new Promise(function (resolve, reject) {
    var s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    s.onload = function () {
      try {
        resolve(window.supabase.createClient(SB_URL, SB_KEY, {
          db: { schema: SCHEMA },
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
          global: { headers: { Authorization: "Bearer " + SB_KEY, apikey: SB_KEY } }
        }));
      }
      catch (e) { reject(e); }
    };
    s.onerror = function () { reject(new Error("Falha ao carregar supabase-js")); };
    document.head.appendChild(s);
  });

  // ---- helpers de cálculo (porte fiel do Code.gs, modo 'corridos') ----
  var ANO_BASE = 2026;
  var MOS = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  function parseISO(s){ if(!s) return null; var p=String(s).slice(0,10).split("-"); if(p.length<3) return null; var d=new Date(+p[0], +p[1]-1, +p[2]); return isNaN(d.getTime())?null:d; }
  function monthIdx(s){ var d=parseISO(s); if(!d) return null; return (d.getFullYear()-ANO_BASE)*12 + d.getMonth(); }
  function absToLabel(idx){ if(idx===null||idx===undefined) return "—"; var y=ANO_BASE+Math.floor(idx/12); return MOS[((idx%12)+12)%12]+"/"+y; }
  function daysBetween(aIso,bIso){ var a=parseISO(aIso), b=parseISO(bIso); if(!a||!b) return 0; return Math.round((b.getTime()-a.getTime())/86400000); }
  function cap(s){ s=String(s||""); return s ? s.charAt(0).toUpperCase()+s.slice(1) : s; }
  function modalAbrev(m){ m=String(m||"").trim(); if(/preg|^pe$/i.test(m)) return "PE"; if(/direta|dispensa|inexig|^cd$/i.test(m)) return "CD"; if(/concorr|^cc$/i.test(m)) return "CC"; return m||"—"; }

  function mapProc(p){
    var ets = (p.etapa||[]).slice().sort(function(a,b){ return (a.ordem||0)-(b.ordem||0); });
    ets = ets.filter(function(e){
      var n = String(e.nome||"").toLowerCase();
      if (n.indexOf("assinatura")>=0 || n.indexOf("arp")>=0) return false;
      if (e.status_etapa === "naoaplica") return false;
      return true;
    });
    if (!ets.length) return null;

    var etapasCalc = ets.map(function(e){
      var st = e.status_etapa || "planejamento";
      var iniIso = e.prazo_ini, fimIso = e.prazo_fim;
      var base = e.prazo_dias || 0;
      var realIso = (st === "ok" && e.data_realizacao) ? e.data_realizacao : null;
      var atraso = 0;
      if (realIso && base > 0) { atraso = daysBetween(fimIso, realIso); if (atraso < 0) atraso = 0; }
      var fimRealIso = (realIso && base > 0) ? realIso : fimIso;
      var pIni = monthIdx(iniIso), pFim = monthIdx(fimIso);
      var rFim = atraso > 0 ? monthIdx(fimRealIso) : pFim;
      return {
        nome: e.nome, agente: e.agente_responsavel || "", fase: cap(e.fase), status: st,
        prazo_ini: pIni, prazo_fim: pFim, real_ini: pIni, real_fim: rFim, dias: atraso,
        motivo: e.motivo_atraso || "", realizacao_iso: realIso,
        ini_iso: iniIso, fim_iso: fimIso, fim_real_iso: fimRealIso
      };
    });

    var todosIni = etapasCalc.map(function(e){ return e.prazo_ini; }).filter(function(x){ return x!==null; });
    var todosFim = etapasCalc.map(function(e){ return e.real_fim!==null ? e.real_fim : e.prazo_fim; }).filter(function(x){ return x!==null; });
    var inicio = todosIni.length ? Math.min.apply(null, todosIni) : 0;
    var fim2   = todosFim.length ? Math.max.apply(null, todosFim) : 0;
    var concl  = etapasCalc.filter(function(e){ return e.status==="ok"; }).length;
    var execucao = etapasCalc.length ? Math.round(concl/etapasCalc.length*100) : 0;
    var d0Sim = !p.d0;
    var temAtras  = etapasCalc.some(function(e){ return e.dias>0; });
    var temAguard = etapasCalc.some(function(e){ return e.status==="aguardando"; });
    var temParal  = etapasCalc.some(function(e){ return e.status==="paralisado"; });
    var temAnd    = etapasCalc.some(function(e){ return e.status==="andamento"; });
    var statusBase = p.status || "planejamento";
    var statusGeral = d0Sim ? "planejamento"
      : temAtras ? "atrasado"
      : temAguard ? "aguardando"
      : temParal ? "paralisado"
      : temAnd ? "andamento"
      : execucao===100 ? "ok"
      : (statusBase || "planejamento");
    var motivos = etapasCalc.filter(function(e){ return e.status==="ok" && e.dias>0 && e.motivo; }).map(function(e){ return e.motivo; });

    return {
      id: p.id, num: p.num_suap || p.id, pid: p.id, nome: String(p.objeto||p.id).trim(),
      status: statusGeral, inicio: inicio, fim: fim2,
      ini_iso: etapasCalc[0].ini_iso, fim_iso: etapasCalc[etapasCalc.length-1].fim_real_iso,
      d0_simulado: d0Sim, execucao: execucao, previsao: absToLabel(fim2),
      suap: p.link_suap || "#", motivo: motivos.length ? motivos[motivos.length-1] : "",
      modalidade: modalAbrev(p.modalidade), temIRP: !!p.tem_irp, etapas: etapasCalc
    };
  }

  function unidadeSigla(){ return (new URLSearchParams(location.search).get("unidade") || "COMP").toUpperCase(); }

  var _payloadCache = null;
  function buildPayload(){
    if (_payloadCache) return _payloadCache;
    _payloadCache = sbReady.then(function(sb){
      var db = sb.schema(SCHEMA);
      return db.from("unidade").select("id,sigla,nome").then(function(ru){
        var us = ru.data || [];
        var sig = unidadeSigla();
        var uni = us.find(function(x){ return String(x.sigla||"").toUpperCase()===sig; }) || us[0];
        if (!uni) return { processos: [], geradoEm: new Date().toISOString() };
        return db.from("processo")
          .select("id,num_suap,objeto,modalidade,d0,tem_irp,link_suap,status,publicado,etapa(nome,ordem,fase,agente_responsavel,status_etapa,prazo_dias,prazo_ini,prazo_fim,data_realizacao,motivo_atraso)")
          .eq("unidade_id", uni.id).order("num_suap")
          .then(function(rp){
            var procs = (rp.data || []).map(mapProc).filter(Boolean);
            return { processos: procs, geradoEm: new Date().toISOString() };
          });
      });
    }).catch(function(e){ console.error("[adapter] erro:", e); return { processos: [], erro: String(e) }; });
    return _payloadCache;
  }

  // ---- capacidade do setor (card KPI público) ----
  // Chama uma RPC SECURITY DEFINER que devolve só o agregado { ok, pct, nivel,
  // mensagem, totalPts, tetoPts } — sem expor nomes/linhas por servidor.
  function buildCapacidade(){
    return sbReady.then(function(sb){
      return sb.schema(SCHEMA).rpc("painel_capacidade", { p_sigla: unidadeSigla() }).then(function(r){
        if (r.error) return { ok:false, erro: r.error.message };
        return r.data || { ok:false, erro:"sem dados de capacidade" };
      });
    }).catch(function(e){ return { ok:false, erro:String(e) }; });
  }

  // ---- intercepta fetch(apiUrl) ----
  var _fetch = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function(url){
    try{
      var u = (typeof url === "string") ? url : (url && url.url) || "";
      if (u.indexOf(SENTINEL) >= 0){
        var builder = /capacidade/i.test(u) ? buildCapacidade : buildPayload;
        return builder().then(function(p){
          return new Response(JSON.stringify(p), { status:200, headers:{ "Content-Type":"application/json" } });
        });
      }
    }catch(e){}
    return _fetch ? _fetch.apply(this, arguments) : Promise.reject(new Error("no fetch"));
  };

  // ---- intercepta JSONP (injeção de <script src=apiUrl?callback=cb>) ----
  function jsonpHook(node){
    try{
      if (node && node.tagName === "SCRIPT" && node.src && node.src.indexOf(SENTINEL) >= 0){
        var m = node.src.match(/[?&]callback=([^&]+)/);
        var cb = m ? decodeURIComponent(m[1]) : null;
        var builderJ = /capacidade/i.test(node.src) ? buildCapacidade : buildPayload;
        builderJ().then(function(p){
          if (cb){
            var fn = cb.split(".").reduce(function(o,k){ return o ? o[k] : undefined; }, window);
            if (typeof fn === "function") fn(p);
          }
          if (typeof node.onload === "function") node.onload();
        });
        return true; // não injeta de fato
      }
    }catch(e){}
    return false;
  }
  var _append = Node.prototype.appendChild;
  Node.prototype.appendChild = function(node){ if (jsonpHook(node)) return node; return _append.call(this, node); };
  var _insert = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function(node, ref){ if (jsonpHook(node)) return node; return _insert.call(this, node, ref); };
})();
