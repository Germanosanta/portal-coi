// Conexão Supabase - Portal COI
// Projeto novo (o anterior, hzduodmytbkqjbbyizkb, ficou pausado sem vaga
// gratuita pra reativar — ver histórico do projeto).

const COI_SUPABASE_URL = "https://ijmojpwqvdqjazfcirle.supabase.co";
const COI_SUPABASE_KEY = "sb_publishable_Qtzn5qOp75AkQ7od9pgS8g_EHgqdMck";

window.coiDB = window.supabase.createClient(
  COI_SUPABASE_URL,
  COI_SUPABASE_KEY,
  {
    db: {
      schema: "coi"
    }
  }
);
