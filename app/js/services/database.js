// Serviço de Banco de Dados COI

/* Fase 19 — helper compartilhado para ler uma tabela inteira sem cair no
   limite de "Max Rows" do PostgREST (config do projeto Supabase, hoje
   1000): pagina em blocos de `pageSize` via .range() até a página vir
   menor que o pedido. Usado por todo SyncCache que faz `.select('*')`
   sem range — ver horimetro.js (onde o bug de truncamento em ~1000
   linhas foi encontrado e corrigido primeiro) para o histórico completo
   do problema. Recebe uma factory (from,to)=>query já com .order()/
   .eq() aplicados, para não engessar cada chamador. */
async function sbFetchAll(queryFactory,pageSize){
  const PAGE=pageSize||1000;
  let all=[],from=0;
  while(true){
    const {data,error}=await queryFactory(from,from+PAGE-1);
    if(error) throw error;
    all=all.concat(data||[]);
    if(!data||data.length<PAGE) break;
    from+=PAGE;
  }
  return all;
}

async function testarConexaoBanco(){

    const { data, error } = await window.coiDB
        .from('perfis')
        .select('*')
        .limit(1);

    if(error){
        console.error(
            "Erro Supabase:",
            error
        );
        return false;
    }

    console.log(
        "Supabase conectado:",
        data
    );

    return true;
}