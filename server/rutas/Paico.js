const { Router } = require('express');
const moment = require('moment');
const router = Router();
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');
const request = require('request');
const modInject = require('../DDBB/MODEL/Inyeccion');
const modprodto = require('../DDBB/MODEL/Productos');
const modOf = require('../DDBB/MODEL/ofs');
moment().utc().format();


// ruta principal aqui inicia la aplicacion
router.get('/', async (req, res) => {
  res.render('login/formulario1')
});

//1.- menu
router.post('/menu', async(req, res) => {
  const OPERARIO = req.body.OPERARIO.toUpperCase();
  const codigo = req.body.producto;
  // console.log(codigo);
  var imgbtn = await maqInyectora(codigo);
  var ALERTA = false;
  var maquinaria = "";
  if (codigo === "CFS 450 IQF 1") {
    maquinaria = "IQF";
  }
  if(codigo === "CFS 650 IQF 4"){
    maquinaria = "IQF";
  }
  if(codigo === "CFS 650 TRUTRO NORTE"){
    maquinaria = "ISHIDA";
  }
  if(codigo === "CFS 650 TRUTRO SUR"){
    maquinaria = "ISHIDA";
  }
  var _f = new Date();
  var dia = _f.getDate()-1;
  var yyyy = _f.getFullYear();
  var mm2 = _f.getMonth()+1;
  var mm = mm2<10?"0"+mm2:mm2;
  var dd = dia<10?"0"+dia:dia;
  var leDate = `${yyyy}-${mm}-${dd}T00:00:00.000+00:00`
  //var queryOF = await modOf.find({FECHA_PRODUCT: {$gte:leDate}}).sort({N_OF: -1}).limit(15);
  var queryOF = await modOf.find({$and: [{FECHA_OF: {$gte:leDate}},{LINEA: maquinaria}]}).sort({N_OF: -1});
  res.render('PAICO/menu', {OPERARIO, ALERTA, codigo, imgbtn, queryOF, maquinaria})
});

//--.- menu
router.get('/menu', async(req, res) => {
 
  //console.log(programa);
  var _f = new Date();
  var dia = _f.getDate()-1;
  var yyyy = _f.getFullYear();
  var mm2 = _f.getMonth()+1;
  var mm = mm2<10?"0"+mm2:mm2;
  var dd = dia<10?"0"+dia:dia;
  var leDate = `${yyyy}-${mm}-${dd}T00:00:00.000+00:00`;
  var queryOF = await modOf.find({$and: [{FECHA_OF: {$gte:leDate}},{LINEA: maquinaria}]}).sort({N_OF: -1});
  res.render('PAICO/menu', {queryOF})
});

//2.- ruta de login , por ahora solo pide un nombre para que los datos queden guardados a nombre de alguien
router.post('/inyeccion', async(req, res) => {
  const OPERARIO = req.body.OPERARIO;
  const maquina = req.body.codigo;
  const of = req.body.N_OF;
  const programa = req.body.PROGRAMA;
  var cod_producto_ = ''
  var producto_ = ''
  var _f = new Date();
  var dia = _f.getDate();
  var yyyy = _f.getFullYear();
  var mm2 = _f.getMonth()+1;
  var mm = mm2<10?"0"+mm2:mm2;
  var dd = dia<10?"0"+dia:dia;
  var leDate = `${yyyy}-${mm}-${dd}T04:00:00.000+00:00`
  await modOf.find({N_OF: of},(err, obje)=>{
    // console.log(obje)
    if(obje.length==0){
      cod_producto_ = 'SIN REFERENCIA'
    }
    else{
      cod_producto_ = obje[0].COD_ARTICULO
    }
  });
  
  await modprodto.find({COD_PRODUCTO: cod_producto_},(err, obje)=>{
    //console.log(obje)
    if(obje.length == 0)producto_ = 'SIN REFERENCIA'
    else(
      producto_ = obje[0].PRODUCTO
    )
    res.render('PAICO/Inyeccion', { OPERARIO, MAQUINA:maquina, of, COD_PRODUCT: cod_producto_ , PRODUCTO: producto_, programa})
  })
  
});

// ruta que devuelve el nombre del producto en base al codigo de producto
router.post('/getproduct', async (req, res) => {
  const {PRODUCTO} = req.body;
  const getptoduct = await modprodto.findOne({COD_PRODUCTO: PRODUCTO});
  //console.log(getptoduct);
  res.json(getptoduct);
  return getptoduct;
})

// funcion que devuelce la imagen de al maquina inyectora en uso
async function maqInyectora(maq){
  var arrmaq = maq.split(' ');
  var themaq = arrmaq[1];
  var imgbtn ="";
  if(themaq === '650'){
    imgbtn = '/img/cfs650_1.png'
  }
  if(themaq === '450'){
    imgbtn = '/img/cfs450_1.png'
  }
  return imgbtn;
}

//3.- FUNCION QUE TOMA EL %INYECCION QUE TOMA EL OPERADOR Y LO COMPARA CON EL ALMACENADO EN LA BASE DE DATOS PARA COMPROBAR SI ESTE ESTA DENTRO O FUERA DE RANGO Y SEGUN CORRESPONDA ENVIA MENSAGES
// VIA TELEGRAM PARA DAR INFORMACION A LOS USUARIOS QUE ESTEN INCRITOS PARA ECIBIR LOS MENSAGES DE ALERTA DE INYECCION
router.post('/saveiny', async(req, res) => {
  var data = req.body;
  var { OPERARIO } = req.body;
  var { COD_OF } = req.body;//OF
  var { CODIGO } = req.body;//PRODUCTO
  var { X_INYECTED } = req.body;
  var { MAQUINA } = req.body;
  var { TEMP_MAQ } = req.body;
  var { SUPER_INYECT } = req.body;
  var programa = req.body.PROGRAMA;
  var inyectParameter = 0.1; //porcentage de inyeccion
  var downinyected;
  var upinyected;
  var dbinyected;
  const dbiny = await modprodto.findOne({COD_PRODUCTO: CODIGO},(err,obje)=>{
    if(obje == null || obje.length == 0){
      dbinyected = CODIGO
    }else{
      dbinyected = obje.POR_INY_OPTMO;
      upinyected = (dbinyected*inyectParameter)+dbinyected;
      downinyected = dbinyected-(dbinyected*inyectParameter)
    }
  });
  var CODE_ART_NO_REF
  const dbiny2 = await modOf.findOne({N_OF: COD_OF},(err,obje)=>{
    CODE_ART_NO_REF = obje.COD_ARTICULO
  });
 
  
  //console.log("//UP "+upinyected+"--//DOWN "+downinyected+"--//INYEC "+X_INYECTED);
  // HACER VALIDACION EN BASE A LOS % DE INYECCION DE CADA PRODUCTO PARA HACER EL ENVIO DE LOS MENSAJES ATRAVEZ DEL BOT
  // https://botduty.herokuapp.com/--data--:porcentage_inyeccion:29.9 //porcentage_inyeccion=> HACE REFERENCIA AL DATO ENVIADO//: 29.9=>HACE REFERENCIA AL DATO QUE SE DEBE ENVIAR
  // NO DEVE OLVIDAR QUE LOS DATOS DEBEN ESTAR SEPARADOS POR :
  var TEMPERATURA = `TEMPERATURA NORMAL (${TEMP_MAQ}C), TEMPERATURA OPTIMA DE TRABAJO ES DE 0 A 3 GRADOS`;
  var COLOR_TEMP = "alert-success"
  if (TEMP_MAQ > 3) {
    TEMPERATURA = `TEMPERATURA FUERA DE RANGO (${TEMP_MAQ}C), TEMPERATURA OPTIMA DE TRABAJO ES DE 0 A 3 GRADOS`;
    COLOR_TEMP = "alert-danger"
  } 
  var upordown = 'NORMAL';
  var ALERT_INYEC = `% INYECCION DENTRO DEL RANGO (${X_INYECTED})`
  var COLOR_INY = 'alert-success';
  if(X_INYECTED > upinyected){
    upordown = 'ALTO';
    //request.post('https://botduty.herokuapp.com/--data--:ALTO:'+X_INYECTED+":"+dbinyected+":"+data.MAQUINA+":"+data.PRODUCTO);
    var ALERT_INYEC = `% INYECCION FUERA DEL RANGO (ALTO) ${X_INYECTED}% Y DEBERIA ESTAR ENTRE ${downinyected}% Y ${upinyected}%`
    var COLOR_INY = 'alert-danger';
  } else if(X_INYECTED < downinyected){
    upordown = 'BAJO'
    request.post('https://botduty.herokuapp.com/--data--:BAJO:'+X_INYECTED+":"+dbinyected+":"+data.MAQUINA+":"+data.PRODUCTO);
    var ALERT_INYEC = `% INYECCION FUERA DEL RANGO (BAJO) ${X_INYECTED}% Y DEBERIA ESTAR ENTRE ${downinyected}% Y ${upinyected}%`
    var COLOR_INY = 'alert-danger';
  } else if(downinyected == undefined){
    upordown = 'SIN REFERENCIA'
    request.post('https://botduty.herokuapp.com/--data--:'+data.MAQUINA+":"+CODE_ART_NO_REF+":"+X_INYECTED);
    var ALERT_INYEC = `% INYECCION FUERA DEL RANGO (BAJO) ${X_INYECTED}% Y DEBERIA ESTAR ENTRE ${downinyected}% Y ${upinyected}%`
    var COLOR_INY = 'alert-danger';
  }
  
  //data.push({RANGO: upordown})
  const schem = new modInject({
    OPERARIO: data.OPERARIO ,
    MAQUINA:data.MAQUINA ,
    CODIGO:data.CODIGO ,
    PRODUCTO:data.PRODUCTO ,
    FECHA:data.FECHA ,
    HORA:data.HORA ,
    KG_IN:data.KG_IN ,
    KG_OUT:data.KG_OUT ,
    X_INYECTED:data.X_INYECTED ,
    PRESS_MAQ:data.PRES_MAQ ,
    VEL_CINT_MAQ:data.VEL_CINT_MAQ ,
    VEL_CINT_MAQ:data.VEL_CINT_MAQ ,
    FILTER_CLEAM_MAQ:data.FILTER_CLEAM_MAQ ,
    TEMP_MAQ: data.TEMP_MAQ,
    GOLP_X_MAQ:data.GOLP_X_MAQ,
    SUPERVISADO: SUPER_INYECT,
    OF: data.COD_OF,
    RANGO: upordown,
    PROGRAMA: programa
  });
  const saveS = await schem.save();
  var imgbtn = await maqInyectora(data.MAQUINA);

  var maquinaria = "";
  if (MAQUINA === "CFS 450 IQF 1") {
    maquinaria = "IQF";
  }
  if(MAQUINA === "CFS 650 IQF 4"){
    maquinaria = "IQF";
  }
  if(MAQUINA === "CFS 650 TRUTRO NORTE"){
    maquinaria = "ISHIDA";
  }
  if(MAQUINA === "CFS 650 TRUTRO SUR"){
    maquinaria = "ISHIDA";
  }
  var _f = new Date();
  var dia = _f.getDate()-1;
  var yyyy = _f.getFullYear();
  var mm2 = _f.getMonth()+1;
  var mm = mm2<10?"0"+mm2:mm2;
  var dd = dia<10?"0"+dia:dia;
  var leDate = `${yyyy}-${mm}-${dd}T04:00:00.000+00:00`
  console.log(leDate);
  //var queryOF = await modOf.find({FECHA_PRODUCT: {$gte:leDate}}).sort({N_OF: -1}).limit(15);
  var queryOF = await modOf.find({$and: [{FECHA_OF: {$gte:leDate}},{LINEA: maquinaria}]}).sort({N_OF: -1});
  var arrgrafpersonal = await grafPesonal(data.CODIGO, COD_OF);
 
  var ALERTA = true;
  var GRAFICO = true;
  res.render('PAICO/menu', {OPERARIO, ALERTA, TEMPERATURA, COLOR_TEMP, ALERT_INYEC, COLOR_INY, imgbtn, queryOF, GRAFICO, GRAFTITLE: data.PRODUCTO, arrgrafpersonal, codigo: data.MAQUINA})
  //res.redirect('./menu')
});

// ruta que busca los datos en la DDBB y los procesa para mostrarlos.
router.get('/grafico5', async (req, res) => {
  // var query = await modInject.find();
  var anterior = moment().subtract(18, 'days').format('YYYY/MM/DD').split('/').join('-');
  var anterior = moment().subtract(8, 'days').format('YYYY/MM/DD').split('/').join('-');
  // var hoy = moment().format('YYYY/MM/DD').split('/').join('-');
  
  var fechaInicial = anterior+"T00:00:00.000+00:00";
  var fechaFinal = hoy+"T00:00:00.000+00:00";
  var query1 = await modInject.find({$and: [{FECHA: {$gte: fechaInicial}},{FECHA: {$lte: fechaFinal}},{MAQUINA: 'CFS 450 IQF 1'}]});
  // var query2 = await modInject.find({$and: [{FECHA: {$gte: fechaInicial}},{FECHA: {$lte: fechaFinal}},{MAQUINA: 'CFS 650 IQF 4'}]});
  // var query3 = await modInject.find({$and: [{FECHA: {$gte: fechaInicial}},{FECHA: {$lte: fechaFinal}},{MAQUINA: 'CFS 650 TRUTRO NORTE'}]});
  // var query4 = await modInject.find({$and: [{FECHA: {$gte: fechaInicial}},{FECHA: {$lte: fechaFinal}},{MAQUINA: 'CFS 650 TRUTRO SUR'}]});

  //console.log(query1.length);
  // console.log(query2.length);
  // console.log(query3.length);
  // console.log(query4.length);
  // query.forEach(element => {
  //   console.log(element.PRODUCTO);
  // });
  //console.log(fechaInicial+"///"+fechaFinal);
  // modelo de datos para grafico
  // {x: new Date(2020, 01, 06, 10, 00), y: 16.3, markerColor: "green" },//NORMAL
  // {x: new Date(2020, 01, 06, 11, 00), y: 13.5, markerColor: "red", indexLabel: "\u25Bc",  indexLabelFontColor: "red"},//BAJO
  // {x: new Date(2020, 01, 06, 12, 00), y: 20.6, markerColor: "red", indexLabel: "\u25B2",  indexLabelFontColor: "red"},//ALTO
  var codigosAR = [];
  for (let co = 0; co < query1.length; co++) {
    const element = query1[co];
    //console.log(element.CODIGO);
    if(!codigosAR.length){
      codigosAR.push(element.CODIGO)
    }
    else {
      var existe = await codigosAR.includes(element.CODIGO);
      if(!existe){
        codigosAR.push(element.CODIGO);
      }
    }
  }
  for (let co2 = 0; co2 < codigosAR.length; co2++) {
    const element2 = codigosAR[co2];
    var productosAR = [{"type":"spline", "showInLegend":true,"yValueFormatString":"#,## %","xValueType":"dataTime","name":"nombre de producto"}];
    for (let co3 = 0; co3 < query1.length; co3++) {
      const element3 = query1[co3];
      var code_01 = element3.CODIGO;

    }
  }
 // console.log(codigosAR);
  var alto = '';
  var grafico = [];
  for (let t = 0; t < query1.length; t++) {
    const element = query1[t];
    var fecha = await formatDate(element.FECHA, element.HORA);
    if(element.RANGO === "BAJO"){//valor bajo
      grafico.push({
        x: fecha,
        y: element.X_INYECTED,
        markerColor: "red", indexLabel: "\u25Bc",  indexLabelFontColor: "red"
      })
    } else if(element.RANGO === "ALTO"){//valor alto
      grafico.push({
        x: fecha,
        y: element.X_INYECTED,
        markerColor: "red", indexLabel: "\u25B2",  indexLabelFontColor: "red"
      })
    }else if(element.RANGO === "NORMAL"){// valor normal
      grafico.push({
        x: fecha,
        y: element.X_INYECTED,
        markerColor: "green", indexLabel: "",  indexLabelFontColor: ""
      })
    }
  };
  //console.log(grafico);
  res.render('PAICO/grafico', { grafico })
});


// PRUEBA DE CONEXION ENTRE LA APLICACION Y EL BOT 
router.get('/bot', async (req, res) => { 
  request.post('https://botduty.herokuapp.com/--data--:IQF 4:12457845784:28');
  res.send("holi soy un bot prrr 🤖")
});

// RUTA PARA AGREGAR LOS DATOS DE INYECCION
router.get('/array8', async(req, res) => {
  // array de carga de datos
  //var array_long = [];
  const direccion = path.join(__dirname,'../public/archivo/brutedata.json');
    async function data(){
      fs.readFile(direccion, 'utf-8',async function(err, fileContents){
      if(err) throw err;
      data = JSON.parse(fileContents);
      for (let n = 0; n < data.length; n++) {
        //console.log(n+"=>"+data.length);
        const element = data[n];
        const squema = new modprodto({
          COD_PRODUCTO:element.COD_PRODUCTO,
          PRODUCTO:element.PRODUCTO,
          POR_INY_OPTMO:element.INYECT,
          MEAT:element.CARNE,
        });
        const save = await squema.save();
        //console.log(squema);
      }
    });
    return
  }
  data();
  const contar = await modInject.find().countDocuments();
  res.json(contar);
  
});
 
// RUTA DA A ELEGIR QUE GRAFICO VER
router.get('/grafico', async(req, res) => {

  res.render('PAICO/menugrafico')
});

// ruta que busca los datos en la DDBB y los procesa para mostrarlos.
router.get('/grafico/iqf1', async (req, res) => {
  // var query = await modInject.find();
  var anterior = moment().subtract(30, 'days').format('YYYY/MM/DD').split('/').join('-');
  var hoy = moment().format('YYYY/MM/DD').split('/').join('-');
  // var hoy = moment().format('YYYY/MM/DD').split('/').join('-');
  var TITULO = "CFS 450 IQF 1";
  var fechaInicial = anterior+"T00:00:00.000+00:00";
  var fechaFinal = hoy+"T00:00:00.000+00:00";
  var query1 = await modInject.find({$and: [{FECHA: {$gte: fechaInicial}},{FECHA: {$lte: fechaFinal}},{PROGRAMA: 91}]});
 // procesadorDatos
  // var query2 = await modInject.find({$and: [{FECHA: {$gte: fechaInicial}},{FECHA: {$lte: fechaFinal}},{MAQUINA: 'CFS 650 IQF 4'}]});
  // var query3 = await modInject.find({$and: [{FECHA: {$gte: fechaInicial}},{FECHA: {$lte: fechaFinal}},{MAQUINA: 'CFS 650 TRUTRO NORTE'}]});
  // var query4 = await modInject.find({$and: [{FECHA: {$gte: fechaInicial}},{FECHA: {$lte: fechaFinal}},{MAQUINA: 'CFS 650 TRUTRO SUR'}]});

  //console.log(query1.length);
  // console.log(query2.length);
  // console.log(query3.length);
  // console.log(query4.length);
  // query.forEach(element => {
  //   console.log(element.PRODUCTO);
  // });
  //console.log(fechaInicial+"///"+fechaFinal);
  // modelo de datos para grafico
  // {x: new Date(2020, 01, 06, 10, 00), y: 16.3, markerColor: "green" },//NORMAL
  // {x: new Date(2020, 01, 06, 11, 00), y: 13.5, markerColor: "red", indexLabel: "\u25Bc",  indexLabelFontColor: "red"},//BAJO
  // {x: new Date(2020, 01, 06, 12, 00), y: 20.6, markerColor: "red", indexLabel: "\u25B2",  indexLabelFontColor: "red"},//ALTO
  //console.log(query1[0]);

  //async function procesadorDatos(query1) {
    var codigosAR = [];
    var productosAR1 = [];
    for (let co = 0; co < query1.length; co++) {
      const element = query1[co];
      //console.log(element.CODIGO);
      if(!codigosAR.length){
        codigosAR.push(element.OF);
        productosAR1.push(element.PRODUCTO);
      }
      else {
        var existe = await codigosAR.includes(element.OF);
        if(!existe){
          codigosAR.push(element.OF);
          productosAR1.push(element.PRODUCTO);
        }
      }
    }
    //console.log(productosAR1);
    //return
    var grafdataM = [];
    
    for (let co2 = 0; co2 < codigosAR.length; co2++) {
    // console.log(co2+ "=="+ productosAR1[co2]);
      const element2 = codigosAR[co2];
      var dataGraf = [];
      var productosAR = {"type":"spline", "showInLegend":true,"yValueFormatString":"#,## %","xValueType":"dataTime","name": productosAR1[co2],"dataPoints": dataGraf};
      for (let co3 = 0; co3 < query1.length; co3++) {
        const element3 = query1[co3];
        var code_01 = await element3;
        if (codigosAR[co2] === code_01.OF) {
  var fecha = await formatDate(element3.FECHA, element3.HORA);
  if(element3.RANGO === "BAJO"){//valor bajo
    dataGraf.push({
      x: fecha,
      y: element3.X_INYECTED,
      markerColor: "red", indexLabel: "\u25Bc",  indexLabelFontColor: "red"
    })
  } else if(element3.RANGO === "ALTO"){//valor alto
    dataGraf.push({
      x: fecha,
      y: element3.X_INYECTED,
      markerColor: "red", indexLabel: "\u25B2",  indexLabelFontColor: "red"
    })
  }else if(element3.RANGO === "NORMAL"){// valor normal
    dataGraf.push({
      x: fecha,
      y: element3.X_INYECTED,
      markerColor: "green", indexLabel: "",  indexLabelFontColor: ""
    })
  }
        } else {
          //dataGraf.push("no es igual");
        }
      }
      grafdataM.push(productosAR)
    }
    //console.log(grafdataM);
    var alto = '';
    var grafico = [];
    for (let t = 0; t < query1.length; t++) {
      const element = query1[t];
      var fecha = await formatDate(element.FECHA, element.HORA);
      if(element.RANGO === "BAJO"){//valor bajo
        grafico.push({
          x: fecha,
          y: element.X_INYECTED,
          markerColor: "red", indexLabel: "\u25Bc",  indexLabelFontColor: "red"
        })
      } else if(element.RANGO === "ALTO"){//valor alto
        grafico.push({
          x: fecha,
          y: element.X_INYECTED,
          markerColor: "red", indexLabel: "\u25B2",  indexLabelFontColor: "red"
        })
      }else if(element.RANGO === "NORMAL"){// valor normal
        grafico.push({
          x: fecha,
          y: element.X_INYECTED,
          markerColor: "green", indexLabel: "",  indexLabelFontColor: ""
        })
      }
    //};//fin for
  }//fin funcion procesador de datos
  //console.log(grafico);
  res.render('PAICO/grafico', { grafdataM, grafico, TITULO})
});

// ruta que busca los datos en la DDBB y los procesa para mostrarlos.
router.get('/grafico/iqf4', async (req, res) => {
  // var query = await modInject.find();
  var anterior = moment().subtract(30, 'days').format('YYYY/MM/DD').split('/').join('-');
  var hoy = moment().format('YYYY/MM/DD').split('/').join('-');
  // var hoy = moment().format('YYYY/MM/DD').split('/').join('-');
  var TITULO = "CFS 650 IQF 4";

  var fechaInicial = anterior+"T00:00:00.000+00:00";
  var fechaFinal = hoy+"T00:00:00.000+00:00";
  var query1 = await modInject.find({$and: [{FECHA: {$gte: fechaInicial}},{FECHA: {$lte: fechaFinal}},{PROGRAMA: 94}]});
 // procesadorDatos
  // var query2 = await modInject.find({$and: [{FECHA: {$gte: fechaInicial}},{FECHA: {$lte: fechaFinal}},{MAQUINA: 'CFS 650 IQF 4'}]});
  // var query3 = await modInject.find({$and: [{FECHA: {$gte: fechaInicial}},{FECHA: {$lte: fechaFinal}},{MAQUINA: 'CFS 650 TRUTRO NORTE'}]});
  // var query4 = await modInject.find({$and: [{FECHA: {$gte: fechaInicial}},{FECHA: {$lte: fechaFinal}},{MAQUINA: 'CFS 650 TRUTRO SUR'}]});

  //console.log(query1.length);
  // console.log(query2.length);
  // console.log(query3.length);
  // console.log(query4.length);
  // query.forEach(element => {
  //   console.log(element.PRODUCTO);
  // });
  //console.log(fechaInicial+"///"+fechaFinal);
  // modelo de datos para grafico
  // {x: new Date(2020, 01, 06, 10, 00), y: 16.3, markerColor: "green" },//NORMAL
  // {x: new Date(2020, 01, 06, 11, 00), y: 13.5, markerColor: "red", indexLabel: "\u25Bc",  indexLabelFontColor: "red"},//BAJO
  // {x: new Date(2020, 01, 06, 12, 00), y: 20.6, markerColor: "red", indexLabel: "\u25B2",  indexLabelFontColor: "red"},//ALTO
  //console.log(query1[0]);

  //async function procesadorDatos(query1) {
    var codigosAR = [];
    var productosAR1 = [];
    for (let co = 0; co < query1.length; co++) {
      const element = query1[co];
      //console.log(element.CODIGO);
      if(!codigosAR.length){
        codigosAR.push(element.OF);
        productosAR1.push(element.PRODUCTO);
      }
      else {
        var existe = await codigosAR.includes(element.OF);
        if(!existe){
          codigosAR.push(element.OF);
          productosAR1.push(element.PRODUCTO);
        }
      }
    }
    //console.log(productosAR1);
    //return
    var grafdataM = [];
    
    for (let co2 = 0; co2 < codigosAR.length; co2++) {
    // console.log(co2+ "=="+ productosAR1[co2]);
      const element2 = codigosAR[co2];
      var dataGraf = [];
      var productosAR = {"type":"spline", "showInLegend":true,"yValueFormatString":"#,## %","xValueType":"dataTime","name": productosAR1[co2],"dataPoints": dataGraf};
      for (let co3 = 0; co3 < query1.length; co3++) {
        const element3 = query1[co3];
        var code_01 = await element3;
        if (codigosAR[co2] === code_01.OF) {
  var fecha = await formatDate(element3.FECHA, element3.HORA);
  if(element3.RANGO === "BAJO"){//valor bajo
    dataGraf.push({
      x: fecha,
      y: element3.X_INYECTED,
      markerColor: "red", indexLabel: "\u25Bc",  indexLabelFontColor: "red"
    })
  } else if(element3.RANGO === "ALTO"){//valor alto
    dataGraf.push({
      x: fecha,
      y: element3.X_INYECTED,
      markerColor: "red", indexLabel: "\u25B2",  indexLabelFontColor: "red"
    })
  }else if(element3.RANGO === "NORMAL"){// valor normal
    dataGraf.push({
      x: fecha,
      y: element3.X_INYECTED,
      markerColor: "green", indexLabel: "",  indexLabelFontColor: ""
    })
  }
        } else {
          //dataGraf.push("no es igual");
        }
      }
      grafdataM.push(productosAR)
    }
    //console.log(grafdataM);
    var alto = '';
    var grafico = [];
    for (let t = 0; t < query1.length; t++) {
      const element = query1[t];
      var fecha = await formatDate(element.FECHA, element.HORA);
      if(element.RANGO === "BAJO"){//valor bajo
        grafico.push({
          x: fecha,
          y: element.X_INYECTED,
          markerColor: "red", indexLabel: "\u25Bc",  indexLabelFontColor: "red"
        })
      } else if(element.RANGO === "ALTO"){//valor alto
        grafico.push({
          x: fecha,
          y: element.X_INYECTED,
          markerColor: "red", indexLabel: "\u25B2",  indexLabelFontColor: "red"
        })
      }else if(element.RANGO === "NORMAL"){// valor normal
        grafico.push({
          x: fecha,
          y: element.X_INYECTED,
          markerColor: "green", indexLabel: "",  indexLabelFontColor: ""
        })
      }
    //};//fin for
  }//fin funcion procesador de datos
  //console.log(grafico);
  res.render('PAICO/grafico', { grafdataM, grafico, TITULO})
});

// ruta que busca los datos en la DDBB y los procesa para mostrarlos.
router.get('/grafico/650', async (req, res) => {
  // var query = await modInject.find();
  var anterior = moment().subtract(30, 'days').format('YYYY/MM/DD').split('/').join('-');
  var hoy = moment().format('YYYY/MM/DD').split('/').join('-');
  // var hoy = moment().format('YYYY/MM/DD').split('/').join('-');
  var TITULO = "CFS 650 TRUTRO";
  var fechaInicial = anterior+"T00:00:00.000+00:00";
  var fechaFinal = hoy+"T00:00:00.000+00:00";
  var query1 = await modInject.find({$and: [{FECHA: {$gte: fechaInicial}},{FECHA: {$lte: fechaFinal}},{PROGRAMA: 33}]});
 // procesadorDatos
  // var query2 = await modInject.find({$and: [{FECHA: {$gte: fechaInicial}},{FECHA: {$lte: fechaFinal}},{MAQUINA: 'CFS 650 IQF 4'}]});
  // var query3 = await modInject.find({$and: [{FECHA: {$gte: fechaInicial}},{FECHA: {$lte: fechaFinal}},{MAQUINA: 'CFS 650 TRUTRO NORTE'}]});
  // var query4 = await modInject.find({$and: [{FECHA: {$gte: fechaInicial}},{FECHA: {$lte: fechaFinal}},{MAQUINA: 'CFS 650 TRUTRO SUR'}]});

  //console.log(query1.length);
  // console.log(query2.length);
  // console.log(query3.length);
  // console.log(query4.length);
  // query.forEach(element => {
  //   console.log(element.PRODUCTO);
  // });
  //console.log(fechaInicial+"///"+fechaFinal);
  // modelo de datos para grafico
  // {x: new Date(2020, 01, 06, 10, 00), y: 16.3, markerColor: "green" },//NORMAL
  // {x: new Date(2020, 01, 06, 11, 00), y: 13.5, markerColor: "red", indexLabel: "\u25Bc",  indexLabelFontColor: "red"},//BAJO
  // {x: new Date(2020, 01, 06, 12, 00), y: 20.6, markerColor: "red", indexLabel: "\u25B2",  indexLabelFontColor: "red"},//ALTO
  //console.log(query1[0]);

  //async function procesadorDatos(query1) {
    var codigosAR = [];
    var productosAR1 = [];
    for (let co = 0; co < query1.length; co++) {
      const element = query1[co];
      //console.log(element.CODIGO);
      if(!codigosAR.length){
        codigosAR.push(element.OF);
        productosAR1.push(element.PRODUCTO);
      }
      else {
        var existe = await codigosAR.includes(element.OF);
        if(!existe){
          codigosAR.push(element.OF);
          productosAR1.push(element.PRODUCTO);
        }
      }
    }
    //console.log(productosAR1);
    //return
    var grafdataM = [];
    
    for (let co2 = 0; co2 < codigosAR.length; co2++) {
    // console.log(co2+ "=="+ productosAR1[co2]);
      const element2 = codigosAR[co2];
      var dataGraf = [];
      var productosAR = {"type":"spline", "showInLegend":true,"yValueFormatString":"#,## %","xValueType":"dataTime","name": productosAR1[co2],"dataPoints": dataGraf};
      for (let co3 = 0; co3 < query1.length; co3++) {
        const element3 = query1[co3];
        var code_01 = await element3;
        if (codigosAR[co2] === code_01.OF) {
  var fecha = await formatDate(element3.FECHA, element3.HORA);
  if(element3.RANGO === "BAJO"){//valor bajo
    dataGraf.push({
      x: fecha,
      y: element3.X_INYECTED,
      markerColor: "red", indexLabel: "\u25Bc",  indexLabelFontColor: "red"
    })
  } else if(element3.RANGO === "ALTO"){//valor alto
    dataGraf.push({
      x: fecha,
      y: element3.X_INYECTED,
      markerColor: "red", indexLabel: "\u25B2",  indexLabelFontColor: "red"
    })
  }else if(element3.RANGO === "NORMAL"){// valor normal
    dataGraf.push({
      x: fecha,
      y: element3.X_INYECTED,
      markerColor: "green", indexLabel: "",  indexLabelFontColor: ""
    })
  }
        } else {
          //dataGraf.push("no es igual");
        }
      }
      grafdataM.push(productosAR)
    }
    //console.log(grafdataM);
    var alto = '';
    var grafico = [];
    for (let t = 0; t < query1.length; t++) {
      const element = query1[t];
      var fecha = await formatDate(element.FECHA, element.HORA);
      if(element.RANGO === "BAJO"){//valor bajo
        grafico.push({
          x: fecha,
          y: element.X_INYECTED,
          markerColor: "red", indexLabel: "\u25Bc",  indexLabelFontColor: "red"
        })
      } else if(element.RANGO === "ALTO"){//valor alto
        grafico.push({
          x: fecha,
          y: element.X_INYECTED,
          markerColor: "red", indexLabel: "\u25B2",  indexLabelFontColor: "red"
        })
      }else if(element.RANGO === "NORMAL"){// valor normal
        grafico.push({
          x: fecha,
          y: element.X_INYECTED,
          markerColor: "green", indexLabel: "",  indexLabelFontColor: ""
        })
      }
    //};//fin for
  }//fin funcion procesador de datos
  //console.log(grafico);
  res.render('PAICO/grafico', { grafdataM, grafico, TITULO})
});

router.get('/getof/:prm', async (req, res) => {
  const programa = req.params.prm;
  var _f = new Date().now();
  var dia = _f.getDate();
  var yyyy = _f.getFullYear();
  var mm = _f.getMonth()<10?"0"+_f.getMonth():_f.getMonth();
  var dd = dia<10?"0"+dia:dia;
  var isFecha = yyyy+", "+mm+", "+(dd)
  const queryOF = await modOf.find({FECHA_OF: Date.now()}).sort({N_OF: -1});
  res.json(queryOF);
});

// ruta para cargar of masivamente
router.post('/uploadof', async (req, res) => {
  const OPERARIO = req.body.OPERARIO;
  res.render('PAICO/loadof', {OPERARIO})
});

// ruta para cargar inyecciones masivamente
router.post('/uploadinyeccion', async (req, res) => {
  const OPERARIO = req.body.OPERARIO;
  res.render('PAICO/loadinyeccion', {OPERARIO})
});

// ruta que recive el excel con los datos para ser procesado y cargado
router.post('/xlsxof', async(req, res) => {
  var OPERARIO = req.body.OPERARIO;
  var eccel = req.files.file;
  var libro = xlsx.read(eccel.data);
  var hoja = libro.SheetNames[0];
  var lineas = xlsx.utils.sheet_to_json(libro.Sheets[hoja]);

  for (const iterator of lineas) {
    //console.log(getLinea(iterator.N_PROGRAMA));
    var loadof = new modOf({
      OF: iterator.OF,
      FECHA_PRODUCT: formatExcelof(iterator.FECHA),
      COD_ARTICULO: iterator.COD_ARTICULO,
      N_PROGRAM: iterator.N_PROGRAMA,
      LINEA: getLinea(iterator.N_PROGRAMA),
      ESTADO: "TO-FILE",
      FILE: OPERARIO
    });
    var saveof = await loadof.save();
  }

  function getLinea(PRO){
    if (PRO == 91) {
      return "CFS 450 IQF 1"
    }
    if (PRO == 94) {
      return "CFS 650 IQF 4"
    }
    else {
      return "CFS 650 TRUTRO"
    }
    //return PRO;
  }

  function formatExcelof(fecha_) {
    var resultado = ((fecha_* 86400)-2209161600)*1000;
    var fecha = new Date(resultado)//1600128000000
      //console.log(fecha);
    return fecha;
  }

  res.render('PAICO/loadof', { TOTAL: lineas.length, OPERARIO })
});

// ruta que recive el excel con los datos para ser procesado y cargado
router.post('/xlsxinyeccion', async(req, res) => {
  var OPERARIO = req.body.OPERARIO;
  var eccel = req.files.file;
  var libro = xlsx.read(eccel.data);
  var hoja = libro.SheetNames[0];
  var lineas = xlsx.utils.sheet_to_json(libro.Sheets[hoja]);
  console.log(lineas)
  for (const iterator of lineas) {
    var producto_ = await modOf.find({N_OF: iterator.OF})
    var porcent_ =  await porcentil(iterator.KG_IN, iterator.KG_OUT);
    //console.log(producto_);
    var inyeccion = new modInject({
      OF: iterator.OF,
      FECHA: formatExcelINYECTFECHA(iterator.FECHA, iterator.HORA),
      HORA: formatExcelINYECTHORA(iterator.FECHA, iterator.HORA),
      KG_IN: iterator.KG_IN,
      KG_OUT: iterator.KG_OUT,
      VEL_CINT_MAQ: iterator.VEL_CINTA,
      GOLP_X_MAQ: iterator.GOLP_X_MIN,
      PRESS_MAQ: iterator.PRESION,
      TEMP_MAQ: iterator.TEMP_SALMUERA,
      PRODUCTO: producto_[0].NOM_ARTICULO,
      MAQUINA: producto_[0].LINEA,
      SUPERVISADO: "TO-FILE",
      X_INYECTED: porcent_,
      RANGO: await isuporlow(porcent_, producto_[0].COD_ARTICULO),
      FILE: OPERARIO,
      PROGRAMA: producto_[0].N_PROGRAM
    });
    var insave = inyeccion.save();
  }
  // FUNCION QUE RECIVE LA DECHA Y HORA EN FORMATO NUMERICO Y QUE FORMATEA LA FECHA PARA JAVASCRIPT DE UN CODIGO DE EXCEL
  function formatExcelINYECTFECHA(fecha01, hora01) {
    var fecha_ = fecha01+hora01;
    var resultado = ((fecha_* 86400)-2209161600)*1000;
    var fecha = new Date(resultado)//1600128000000
    // console.log(fecha_);
    return fecha;
  }
  // FUNCION QUE RECIVE LA DECHA Y HORA EN FORMATO NUMERICO Y QUE FORMATEA LA HORA PARA JAVASCRIPT DE UN CODIGO DE EXCEL
  function formatExcelINYECTHORA(fecha01, hora01) {
    var fecha_ = fecha01+hora01;
    var resultado = ((fecha_* 86400)-2209161600)*1000;
    var fecha = new Date(resultado)//1600128000000
    var hh, mm, hora;
    hh = fecha.getHours()<10?"0"+fecha.getHours():fecha.getHours();
    mm = fecha.getMinutes()<10?"0"+fecha.getMinutes():fecha.getMinutes();
    hora = hh+":"+mm;
    return hora;
  }
  async function getmaquinada(of) {
    var consultaof = await modOf.find({ N_OF: of});
    for (const iterator of consultaof) {
      return iterator.NOM_ARTICULO;      
      // return consultaof[0].NOM_ARTICULO;
    }
  }
  async function getproducto(of) {
    var consultaof = await modOf.find({ N_OF: of});
    for (const iterator of consultaof) {
      return iterator.LINEA;      
      // return consultaof[0].NOM_ARTICULO;
    }
  }
  // FUNCION QUE RECIVE LOS KILOS DE ENTRADA Y SALIDA CON LOS QUE CALCULA EL PORCENTAGE DE INYECCION ACUAL 
  async function porcentil(kin, kout) {
    var dato1 = kout - kin;
    var dato2 = (dato1*100)/kin;
    var dcimo = dato2.toFixed(2)
    return dcimo;
  }
  // FUNCIO QUE RECIVE EL PORCENTAGE DE INYECCION ACTUAL MAS EL CODIGO DEL PRODUCTO PARA BUSCAR EL CODIGO EN LA DB Y TRAER EL PORCENTAGE DE INYECCION OPTIMO
  // PARA CALCULAR EL PORCENTAGE ALTO Y BAJO Y COMPARARLO CON EL PORCENTAGE DE INYECCION ACTUAL
  async function isuporlow(porcent01, cod_pro) {
    var query = await modprodto.find({COD_PRODUCTO: cod_pro});
    for (const iterator of query) {
      //console.log(iterator);
      var xdb = iterator.POR_INY_OPTMO;
      var alto = (xdb*0.1)+xdb;
      var bajo = xdb-(xdb*0.1);
      if(porcent01 > alto) {
        return "ALTO"
      }
      if(porcent01 < bajo) {
        return "BAJO"
      }
      else {
        return "NORMAL"
      }
    }
  }
  res.render('PAICO/loadinyeccion', { TOTAL: lineas.length, OPERARIO });
});

async function loadOF(){
  var arraOF = []
  for (let k = 0; k < arraOF.length; k++) {
    const element = arraOF[k];
    //console.log(k+"=>"+arraOF.length);
    const data = modOf({
      PLANTA: element.PLANTA,
      N_OF: element.N_OF,
      FECHA_SACRIF: element.FECHA_SACRIF,
      FECHA_PRODUCT: element.FECHA_PRODUCT,
      COD_ARTICULO: element.COD_ARTICULO,
      NOM_ARTICULO: element.NOM_ARTICULO,
      N_PROGRAM: element.N_PROGRAMA,
      LINEA: element.LINEA,
      //ESTADO: "ESPERA"
    });
    const savedata = await data.save()
    
  }

  //console.log("finale")
};

// FUNCION QUE TOMA COMO PARAMETROS LA FECHA Y LA HORA Y LA DEVUELVE EN EL FORMATO REQUERIDO PARA EL GRAFICO
async function formatDate(fecha, hora){
  var fh = hora.split(":");
  var _f = new Date(fecha);
  var dia = _f.getDate();
  var yyyy = _f.getFullYear();
  var mm = _f.getMonth()<10?"0"+_f.getMonth():_f.getMonth();
  var dd = dia<10?"0"+dia:dia;
  var isFecha = yyyy+", "+mm+", "+(dd)+", "+fh[0]+", "+fh[1];
  //console.log(isFecha);
  return isFecha;
}

//funcion que devuleve un array con los datos de cierto producto para sermostrados en un grafico
async function grafPesonal(producto, _of) {
  const dataGraf1 = await modInject.find({$and: [{CODIGO: producto},{OF: _of}]});
  //console.log(dataGraf1);
  var data_grafica = [];
  for (let u = 0; u < dataGraf1.length; u++) {
    const element = dataGraf1[u];
    
    var upordown2 = '';
    if(element.RANGO === 'ALTO' || element.RANGO === 'BAJO'){
      upordown2 = 'red';
    } else {
      upordown2 = 'green'
    }
    var chekdate = (await formatDate(element.FECHA, element.HORA)).toString()
    //console.log(chekdate);
    data_grafica.push({x: chekdate, y: element.X_INYECTED, markerColor: upordown2});
    //{ x: new Date(2016, 01, 1,10,12), y: 61.5, markerColor: "green" },-***********************************
  }
  //console.log(data_grafica);
  return data_grafica;
}

module.exports = router;
