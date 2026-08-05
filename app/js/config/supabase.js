// Conexão Supabase - Portal COI

const COI_SUPABASE_URL = "https://hzduodmytbkqjbbyizkb.supabase.co";

const COI_SUPABASE_KEY = "sb_publishable_ApEZW_1CC7kzRBuF9qpyRg_cNeZV__9";

window.coiDB = window.supabase.createClient(
  COI_SUPABASE_URL,
  COI_SUPABASE_KEY
);