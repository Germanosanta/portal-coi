/* DATA LOADER COI */

window.D = window.D || {};

window.EXE_D = window.EXE_D || [];
window.ITV_D = window.ITV_D || [];
window.HOR_D = window.HOR_D || [];
window.FERTI_D = window.FERTI_D || [];
window.FAL_D = window.FAL_D || [];

window.CULTURAS_ALL = window.CULTURAS_ALL || [];
window.AREAS_ALL = window.AREAS_ALL || [];

window.LAMINA_PIVOS_SEED = window.LAMINA_PIVOS_SEED || {};

window.DATA_SOURCE = 'remoto';
function loadJSON(path){

  return fetch(path,{cache:'no-store'})
    .then(res=>{

      if(!res.ok){
        throw new Error('HTTP '+res.status+' em '+path);
      }

      return res.json();

    });

}


function mockData(){

  window.D = {

    irrig_totals:{
      plan:0,
      feito:0,
      ass:0,
      oper:0,
      mec:0,
      ele:0,
      horas_irr:0,
      horas_par:0,
      par_n:0
    },

    irrig_timeline:[],
    irrig_pivos:[],
    irrig_causas:[],
    irrig_pivos_paradas:[],

    irrig_heatmap_meses:[],
    irrig_heatmap_pivos:[],
    irrig_heatmap:[],

    ferti_stats:{
      total:0,
      realizado:0,
      ass:0,
      motivos:{}
    },

    ferti_meses:[],

    itv_stats:{
      total:0,
      horas_total:0,
      oper:0,
      mec:0,
      ele:0,
      med_h:0
    },

    itv_meses:[],

    fal_stats:{
      mec:0,
      ele:0,
      oper:0,
      prog:0,
      total:1
    },

    fal_meses:[],

    hor_stats:{
      total_horas:0,
      total_registros:0,
      karitel_n:0,
      rdm_n:0,
      csv_n:0,
      pivos_ativos:0,
      inconsistentes:0
    },

    hor_meses:[],
    hor_pivos:[],
    hor_culturas:[],
    hor_opers:[],
    faz_data:{},
    pivos_cad:[]

  };


  window.EXE_D=[];
  window.ITV_D=[];
  window.HOR_D=[];
  window.FERTI_D=[];
  window.FAL_D=[];


  window.CULTURAS_ALL=[];
  window.AREAS_ALL=['COMPLETO'];

  window.LAMINA_PIVOS_SEED={};

  window.DATA_SOURCE='simulado';

}
async function loadAllData(){

  try{

    const [
      resumo,
      exe,
      itv,
      hor,
      ferti,
      fal,
      culturas,
      areas,
      laminaPivos

    ] = await Promise.all([

      loadJSON('data/resumo.json'),
      loadJSON('data/exec.json'),
      loadJSON('data/intervalos.json'),
      loadJSON('data/horimetro.json'),
      loadJSON('data/fertirrigacao.json'),
      loadJSON('data/falhas.json'),
      loadJSON('data/culturas_all.json'),
      loadJSON('data/areas_all.json'),
      loadJSON('data/lamina_pivos.json')

    ]);


    window.D = resumo;

    window.EXE_D = exe;
    window.ITV_D = itv;
    window.HOR_D = hor;
    window.FERTI_D = ferti;
    window.FAL_D = fal;


    window.CULTURAS_ALL = culturas;
    window.AREAS_ALL = areas;

    window.LAMINA_PIVOS_SEED = laminaPivos;

    window.DATA_SOURCE = 'remoto';


    console.log(
      '[data-loader] Dados carregados com sucesso'
    );


  }catch(err){


    console.warn(
      '[data-loader] Falha ao carregar data/*.json — usando dados simulados.',
      err
    );


    mockData();


  }

}