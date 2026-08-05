/* ── STORAGE GENÉRICO ───────────────────────────────────────────────
   Única camada de acesso ao localStorage. Todo serviço (Horímetro,
   Paradas, Fertirrigação, Indicadores, Planejamento, Calibração,
   Cadastros, Auditoria) lê/grava por aqui — nenhum acessa
   `localStorage` diretamente.

   `lsGet` mantém um cache em memória por chave (invalidado só quando
   `lsSet` grava aquela mesma chave), evitando reler e re-parsear o
   mesmo JSON do localStorage toda vez que um agrupamento/consulta
   percorre muitos registros (ex.: `horimetroPivoInfo` chamado uma vez
   por lançamento dentro de `agruparPorChave`) — otimização da Etapa 8,
   sem mudar o comportamento de nenhuma chamada existente.
   ──────────────────────────────────────────────────────────────── */
const _lsCache={};
const lsGet=(key,def=[])=>{
  if(key in _lsCache) return _lsCache[key];
  try{
    const raw=localStorage.getItem(key);
    const val=raw===null?def:JSON.parse(raw);
    _lsCache[key]=val;
    return val;
  }catch{ return def; }
};
const lsSet=(key,val)=>{ localStorage.setItem(key,JSON.stringify(val)); _lsCache[key]=val; };
