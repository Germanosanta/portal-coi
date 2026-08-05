// Serviço de Banco de Dados COI

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