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
  // const findPrdto = await modprodto.find().sort({COD_PRODUCTO: 1});
  // var PRODUCTO = [];
  // for (let r = 0; r < findPrdto.length; r++) {
  //   const element = await findPrdto[r];
  //   //console.log(element.COD_PRODUCTO);
  //   PRODUCTO.push({CODIGO: element.COD_PRODUCTO})
  // }
  //loadOF();
  res.render('login/formulario1')
});

//1.- menu
router.post('/menu', async(req, res) => {
  const OPERARIO = req.body.OPERARIO.toUpperCase();
  const codigo = req.body.producto;
  var programa = "";
  // console.log(codigo);
  var imgbtn = await maqInyectora(codigo);
  var ALERTA = false;
  if (codigo === "CFS 450 IQF 1") {
    programa = "91";
  }else if(codigo === "CFS 650 IQF 4"){
    programa = "94";
  }else{
    programa = "33";
  }
  //console.log(programa);
  var _f = new Date();
  var dia = _f.getDate();
  var yyyy = _f.getFullYear();
  var mm2 = _f.getMonth()+1;
  var mm = mm2<10?"0"+mm2:mm2;
  var dd = dia<10?"0"+dia:dia;
  var leDate = `${yyyy}-${mm}-${dd}T04:00:00.000+00:00`
  var queryOF = await modOf.find({FECHA_PRODUCT: leDate}).sort({N_OF: -1}).limit(15);
  res.render('PAICO/menu', {OPERARIO, ALERTA, codigo, imgbtn, queryOF, programa})
});

//--.- menu
router.get('/menu', async(req, res) => {
 
  //console.log(programa);
  var _f = new Date();
  var dia = _f.getDate();
  var yyyy = _f.getFullYear();
  var mm2 = _f.getMonth()+1;
  var mm = mm2<10?"0"+mm2:mm2;
  var dd = dia<10?"0"+dia:dia;
  var leDate = `${yyyy}-${mm}-${dd}T00:00:00.000+00:00`
  var queryOF = await modOf.find({FECHA_OF: leDate}).sort({N_OF: -1}).limit(15);
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
  await modOf.find({$and:[{FECHA_PRODUCT:leDate},{N_OF: of}]},(err, obje)=>{
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
  var { TEMP_MAQ } = req.body;
  var { SUPER_INYECT } = req.body;
  var programa = req.body.PROGRAMA;
  var inyectParameter = 0.1; //porcentage de inyeccion
  //console.log(CODIGO);
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

  var programa = "";
  //console.log(codigo);
  var ALERTA = false;
  if (imgbtn === "CFS 450 IQF 1") {
    programa = "91";
  }else if(imgbtn === "CFS 650 IQF 4"){
    programa = "94";
  }else{
    programa = "33";
  }
  //console.log(programa);
  var _f = new Date();
  var dia = _f.getDate();
  var yyyy = _f.getFullYear();
  var mm2 = _f.getMonth()+1;
  var mm = mm2<10?"0"+mm2:mm2;
  var dd = dia<10?"0"+dia:dia;
  var leDate = `${yyyy}-${mm}-${dd}T04:00:00.000+00:00`
  var queryOF = await modOf.find({FECHA_PRODUCT: leDate}).sort({N_OF: -1}).limit(15);
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
  const queryOF = await modOf.find({FECHA_PRODUCT: Date.now()}).sort({N_OF: -1}).limit(15);
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
  var arraOF = [
    {"PLANTA":"129","N_OF":3296361,"FECHA_SACRIF":"2020-09-07","FECHA_PRODUCT":"2020-09-15","COD_ARTICULO":"583321929","NOM_ARTICULO":"BISTEC DE PAVO 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3297962,"FECHA_SACRIF":"2020-09-14","FECHA_PRODUCT":"2020-09-15","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3297970,"FECHA_SACRIF":"2020-09-15","FECHA_PRODUCT":"2020-09-16","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3297974,"FECHA_SACRIF":"2020-09-15","FECHA_PRODUCT":"2020-09-15","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3297975,"FECHA_SACRIF":"2020-09-15","FECHA_PRODUCT":"2020-09-15","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3298056,"FECHA_SACRIF":"2020-09-11","FECHA_PRODUCT":"2020-09-15","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3298057,"FECHA_SACRIF":"2020-09-11","FECHA_PRODUCT":"2020-09-15","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3298061,"FECHA_SACRIF":"2020-09-11","FECHA_PRODUCT":"2020-09-15","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3298062,"FECHA_SACRIF":"2020-09-14","FECHA_PRODUCT":"2020-09-15","COD_ARTICULO":"202621874","NOM_ARTICULO":"ALA TRUTRO POLLO IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3298064,"FECHA_SACRIF":"2020-09-14","FECHA_PRODUCT":"2020-09-15","COD_ARTICULO":"244720900","NOM_ARTICULO":"XALA TR. POLLO MEXICO IQF 10 K","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3298157,"FECHA_SACRIF":"2020-09-15","FECHA_PRODUCT":"2020-09-15","COD_ARTICULO":"284130011","NOM_ARTICULO":"XALA MIXTA PROCESO 2,2 LB USA","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3298158,"FECHA_SACRIF":"2020-09-11","FECHA_PRODUCT":"2020-09-15","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3298159,"FECHA_SACRIF":"2020-09-11","FECHA_PRODUCT":"2020-09-15","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3298161,"FECHA_SACRIF":"2020-09-12","FECHA_PRODUCT":"2020-09-15","COD_ARTICULO":"284925952","NOM_ARTICULO":"XALA MIXTA POLLO 10 LB FIRST S","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3298162,"FECHA_SACRIF":"2020-09-12","FECHA_PRODUCT":"2020-09-16","COD_ARTICULO":"291020909","NOM_ARTICULO":"XPECHUGA POLLO S/HP IQF 10KG","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3298163,"FECHA_SACRIF":"2020-09-14","FECHA_PRODUCT":"2020-09-15","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3298271,"FECHA_SACRIF":"2020-09-11","FECHA_PRODUCT":"2020-09-15","COD_ARTICULO":"202621874","NOM_ARTICULO":"ALA TRUTRO POLLO IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3298272,"FECHA_SACRIF":"2020-09-12","FECHA_PRODUCT":"2020-09-16","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3298273,"FECHA_SACRIF":"2020-09-12","FECHA_PRODUCT":"2020-09-16","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3298278,"FECHA_SACRIF":"2020-09-12","FECHA_PRODUCT":"2020-09-16","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3298279,"FECHA_SACRIF":"2020-09-14","FECHA_PRODUCT":"2020-09-16","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3298281,"FECHA_SACRIF":"2020-09-14","FECHA_PRODUCT":"2020-09-16","COD_ARTICULO":"291020909","NOM_ARTICULO":"XPECHUGA POLLO S/HP IQF 10KG","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3298282,"FECHA_SACRIF":"2020-09-15","FECHA_PRODUCT":"2020-09-16","COD_ARTICULO":"291020909","NOM_ARTICULO":"XPECHUGA POLLO S/HP IQF 10KG","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3298500,"FECHA_SACRIF":"2020-09-15","FECHA_PRODUCT":"2020-09-16","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3298513,"FECHA_SACRIF":"2020-09-16","FECHA_PRODUCT":"","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3298515,"FECHA_SACRIF":"2020-09-16","FECHA_PRODUCT":"2020-09-16","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3298690,"FECHA_SACRIF":"2020-09-14","FECHA_PRODUCT":"2020-09-17","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3298691,"FECHA_SACRIF":"2020-09-15","FECHA_PRODUCT":"2020-09-16","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3298702,"FECHA_SACRIF":"2020-09-15","FECHA_PRODUCT":"2020-09-16","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3298709,"FECHA_SACRIF":"2020-09-16","FECHA_PRODUCT":"2020-09-16","COD_ARTICULO":"284130011","NOM_ARTICULO":"XALA MIXTA PROCESO 2,2 LB USA","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3298813,"FECHA_SACRIF":"2020-09-17","FECHA_PRODUCT":"2020-09-17","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3298814,"FECHA_SACRIF":"2020-09-16","FECHA_PRODUCT":"2020-09-17","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3298817,"FECHA_SACRIF":"2020-09-16","FECHA_PRODUCT":"2020-09-17","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3298847,"FECHA_SACRIF":"2020-09-17","FECHA_PRODUCT":"2020-09-17","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3298848,"FECHA_SACRIF":"2020-09-14","FECHA_PRODUCT":"2020-09-16","COD_ARTICULO":"224623023","NOM_ARTICULO":"FILETILLO POLLO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3298849,"FECHA_SACRIF":"2020-09-14","FECHA_PRODUCT":"2020-09-16","COD_ARTICULO":"209723021","NOM_ARTICULO":"PECHUGA POLLO SHP CUISINE & CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3299011,"FECHA_SACRIF":"2020-09-14","FECHA_PRODUCT":"2020-09-17","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3299012,"FECHA_SACRIF":"2020-09-14","FECHA_PRODUCT":"2020-09-17","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3299013,"FECHA_SACRIF":"2020-09-14","FECHA_PRODUCT":"2020-09-17","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3299016,"FECHA_SACRIF":"2020-09-14","FECHA_PRODUCT":"2020-09-17","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3299017,"FECHA_SACRIF":"2020-09-15","FECHA_PRODUCT":"2020-09-17","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3299018,"FECHA_SACRIF":"2020-09-15","FECHA_PRODUCT":"2020-09-17","COD_ARTICULO":"291020909","NOM_ARTICULO":"XPECHUGA POLLO S/HP IQF 10KG","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3299019,"FECHA_SACRIF":"2020-09-15","FECHA_PRODUCT":"2020-09-17","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3299094,"FECHA_SACRIF":"2020-09-12","FECHA_PRODUCT":"2020-09-17","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3299095,"FECHA_SACRIF":"2020-09-14","FECHA_PRODUCT":"2020-09-17","COD_ARTICULO":"229223020","NOM_ARTICULO":"TRUTRO CORTO POLLO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3299337,"FECHA_SACRIF":"2020-09-14","FECHA_PRODUCT":"2020-09-17","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3299409,"FECHA_SACRIF":"2020-09-21","FECHA_PRODUCT":"2020-09-22","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3299417,"FECHA_SACRIF":"2020-09-21","FECHA_PRODUCT":"2020-09-22","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3299422,"FECHA_SACRIF":"2020-09-21","FECHA_PRODUCT":"2020-09-21","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3299424,"FECHA_SACRIF":"2020-09-21","FECHA_PRODUCT":"2020-09-21","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3299428,"FECHA_SACRIF":"2020-09-15","FECHA_PRODUCT":"2020-09-21","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3299429,"FECHA_SACRIF":"2020-09-15","FECHA_PRODUCT":"2020-09-21","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3299430,"FECHA_SACRIF":"2020-09-15","FECHA_PRODUCT":"2020-09-21","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3299431,"FECHA_SACRIF":"2020-09-15","FECHA_PRODUCT":"2020-09-22","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3299433,"FECHA_SACRIF":"2020-09-15","FECHA_PRODUCT":"2020-09-21","COD_ARTICULO":"244720900","NOM_ARTICULO":"XALA TR. POLLO MEXICO IQF 10 K","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3299434,"FECHA_SACRIF":"2020-09-16","FECHA_PRODUCT":"2020-09-21","COD_ARTICULO":"244720900","NOM_ARTICULO":"XALA TR. POLLO MEXICO IQF 10 K","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3299435,"FECHA_SACRIF":"2020-09-16","FECHA_PRODUCT":"2020-09-21","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3299436,"FECHA_SACRIF":"2020-09-15","FECHA_PRODUCT":"2020-09-21","COD_ARTICULO":"291020909","NOM_ARTICULO":"XPECHUGA POLLO S/HP IQF 10KG","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3299437,"FECHA_SACRIF":"2020-09-16","FECHA_PRODUCT":"2020-09-21","COD_ARTICULO":"291020909","NOM_ARTICULO":"XPECHUGA POLLO S/HP IQF 10KG","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3299438,"FECHA_SACRIF":"2020-09-16","FECHA_PRODUCT":"2020-09-21","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3299476,"FECHA_SACRIF":"2020-09-14","FECHA_PRODUCT":"2020-09-21","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3299477,"FECHA_SACRIF":"2020-09-15","FECHA_PRODUCT":"2020-09-21","COD_ARTICULO":"254621907","NOM_ARTICULO":"XFILETILLO POLLO IQF HEB","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3299478,"FECHA_SACRIF":"2020-09-15","FECHA_PRODUCT":"2020-09-21","COD_ARTICULO":"284120753","NOM_ARTICULO":"XALAS MIXTA POLLO IQF 2,2 lb","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3299482,"FECHA_SACRIF":"2020-09-15","FECHA_PRODUCT":"2020-09-21","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3299799,"FECHA_SACRIF":"2020-09-22","FECHA_PRODUCT":"2020-09-23","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3299803,"FECHA_SACRIF":"2020-09-22","FECHA_PRODUCT":"2020-09-22","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3299805,"FECHA_SACRIF":"2020-09-22","FECHA_PRODUCT":"2020-09-22","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3299806,"FECHA_SACRIF":"2020-09-15","FECHA_PRODUCT":"2020-09-22","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3299807,"FECHA_SACRIF":"2020-09-16","FECHA_PRODUCT":"2020-09-22","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3299808,"FECHA_SACRIF":"2020-09-16","FECHA_PRODUCT":"2020-09-22","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3299810,"FECHA_SACRIF":"2020-09-16","FECHA_PRODUCT":"2020-09-22","COD_ARTICULO":"284120753","NOM_ARTICULO":"XALAS MIXTA POLLO IQF 2,2 lb","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3299811,"FECHA_SACRIF":"2020-09-15","FECHA_PRODUCT":"2020-09-22","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3299812,"FECHA_SACRIF":"2020-09-16","FECHA_PRODUCT":"2020-09-22","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3299813,"FECHA_SACRIF":"2020-09-16","FECHA_PRODUCT":"2020-09-22","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3299814,"FECHA_SACRIF":"2020-09-17","FECHA_PRODUCT":"2020-09-22","COD_ARTICULO":"244720900","NOM_ARTICULO":"XALA TR. POLLO MEXICO IQF 10 K","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3299815,"FECHA_SACRIF":"2020-09-17","FECHA_PRODUCT":"2020-09-22","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3299816,"FECHA_SACRIF":"2020-09-16","FECHA_PRODUCT":"2020-09-22","COD_ARTICULO":"291020909","NOM_ARTICULO":"XPECHUGA POLLO S/HP IQF 10KG","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3299817,"FECHA_SACRIF":"2020-09-17","FECHA_PRODUCT":"2020-09-22","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3299818,"FECHA_SACRIF":"2020-09-17","FECHA_PRODUCT":"2020-09-22","COD_ARTICULO":"291020909","NOM_ARTICULO":"XPECHUGA POLLO S/HP IQF 10KG","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3299819,"FECHA_SACRIF":"2020-09-16","FECHA_PRODUCT":"2020-09-22","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3299936,"FECHA_SACRIF":"2020-09-15","FECHA_PRODUCT":"2020-09-22","COD_ARTICULO":"254621907","NOM_ARTICULO":"XFILETILLO POLLO IQF HEB","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3300212,"FECHA_SACRIF":"2020-09-21","FECHA_PRODUCT":"","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3300213,"FECHA_SACRIF":"2020-09-21","FECHA_PRODUCT":"2020-09-23","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3300214,"FECHA_SACRIF":"2020-09-17","FECHA_PRODUCT":"2020-09-23","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3300215,"FECHA_SACRIF":"2020-09-21","FECHA_PRODUCT":"2020-09-23","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3300216,"FECHA_SACRIF":"2020-09-16","FECHA_PRODUCT":"2020-09-23","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3300217,"FECHA_SACRIF":"2020-09-21","FECHA_PRODUCT":"2020-09-23","COD_ARTICULO":"294325957","NOM_ARTICULO":"XALA TRUTRO 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3300218,"FECHA_SACRIF":"2020-09-21","FECHA_PRODUCT":"2020-09-23","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3300219,"FECHA_SACRIF":"2020-09-21","FECHA_PRODUCT":"2020-09-23","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3300220,"FECHA_SACRIF":"2020-09-17","FECHA_PRODUCT":"2020-09-23","COD_ARTICULO":"291020909","NOM_ARTICULO":"XPECHUGA POLLO S/HP IQF 10KG","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3300222,"FECHA_SACRIF":"2020-09-21","FECHA_PRODUCT":"2020-09-23","COD_ARTICULO":"291020909","NOM_ARTICULO":"XPECHUGA POLLO S/HP IQF 10KG","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3300272,"FECHA_SACRIF":"2020-09-22","FECHA_PRODUCT":"2020-09-23","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3300281,"FECHA_SACRIF":"2020-09-23","FECHA_PRODUCT":"2020-09-24","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3300286,"FECHA_SACRIF":"2020-09-23","FECHA_PRODUCT":"2020-09-23","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3300288,"FECHA_SACRIF":"2020-09-23","FECHA_PRODUCT":"2020-09-23","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3300453,"FECHA_SACRIF":"2020-09-23","FECHA_PRODUCT":"2020-09-23","COD_ARTICULO":"284130011","NOM_ARTICULO":"XALA MIXTA PROCESO 2,2 LB USA","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3300685,"FECHA_SACRIF":"2020-09-22","FECHA_PRODUCT":"2020-09-24","COD_ARTICULO":"209723021","NOM_ARTICULO":"PECHUGA POLLO SHP CUISINE & CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3300686,"FECHA_SACRIF":"2020-09-22","FECHA_PRODUCT":"2020-09-24","COD_ARTICULO":"224623023","NOM_ARTICULO":"FILETILLO POLLO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3300688,"FECHA_SACRIF":"2020-09-21","FECHA_PRODUCT":"2020-09-24","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3300689,"FECHA_SACRIF":"2020-09-22","FECHA_PRODUCT":"2020-09-24","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3300690,"FECHA_SACRIF":"2020-09-21","FECHA_PRODUCT":"2020-09-24","COD_ARTICULO":"291020909","NOM_ARTICULO":"XPECHUGA POLLO S/HP IQF 10KG","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3300691,"FECHA_SACRIF":"2020-09-22","FECHA_PRODUCT":"2020-09-24","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3300692,"FECHA_SACRIF":"2020-09-22","FECHA_PRODUCT":"2020-09-24","COD_ARTICULO":"291020909","NOM_ARTICULO":"XPECHUGA POLLO S/HP IQF 10KG","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3300693,"FECHA_SACRIF":"2020-09-23","FECHA_PRODUCT":"2020-09-24","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3300749,"FECHA_SACRIF":"2020-09-23","FECHA_PRODUCT":"2020-09-24","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3300757,"FECHA_SACRIF":"2020-09-24","FECHA_PRODUCT":"2020-09-25","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3300761,"FECHA_SACRIF":"2020-09-24","FECHA_PRODUCT":"2020-09-24","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3300763,"FECHA_SACRIF":"2020-09-24","FECHA_PRODUCT":"2020-09-24","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3300917,"FECHA_SACRIF":"2020-09-23","FECHA_PRODUCT":"2020-09-24","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3301173,"FECHA_SACRIF":"2020-09-22","FECHA_PRODUCT":"2020-09-24","COD_ARTICULO":"229223020","NOM_ARTICULO":"TRUTRO CORTO POLLO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3301254,"FECHA_SACRIF":"2020-09-22","FECHA_PRODUCT":"2020-09-25","COD_ARTICULO":"229223020","NOM_ARTICULO":"TRUTRO CORTO POLLO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3301255,"FECHA_SACRIF":"2020-09-23","FECHA_PRODUCT":"2020-09-25","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3301256,"FECHA_SACRIF":"2020-09-23","FECHA_PRODUCT":"2020-09-25","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3301257,"FECHA_SACRIF":"2020-09-23","FECHA_PRODUCT":"2020-09-25","COD_ARTICULO":"284120753","NOM_ARTICULO":"XALAS MIXTA POLLO IQF 2,2 lb","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3301259,"FECHA_SACRIF":"2020-09-23","FECHA_PRODUCT":"2020-09-25","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3301260,"FECHA_SACRIF":"2020-09-23","FECHA_PRODUCT":"2020-09-25","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3301261,"FECHA_SACRIF":"2020-09-22","FECHA_PRODUCT":"2020-09-25","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3301262,"FECHA_SACRIF":"2020-09-23","FECHA_PRODUCT":"2020-09-25","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3301264,"FECHA_SACRIF":"2020-09-23","FECHA_PRODUCT":"2020-09-25","COD_ARTICULO":"291020909","NOM_ARTICULO":"XPECHUGA POLLO S/HP IQF 10KG","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3301265,"FECHA_SACRIF":"2020-09-24","FECHA_PRODUCT":"2020-09-25","COD_ARTICULO":"202621874","NOM_ARTICULO":"ALA TRUTRO POLLO IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3301275,"FECHA_SACRIF":"2020-09-24","FECHA_PRODUCT":"2020-09-25","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3301283,"FECHA_SACRIF":"2020-09-25","FECHA_PRODUCT":"2020-09-26","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3301288,"FECHA_SACRIF":"2020-09-25","FECHA_PRODUCT":"2020-09-25","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3301290,"FECHA_SACRIF":"2020-09-25","FECHA_PRODUCT":"2020-09-25","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3301487,"FECHA_SACRIF":"2020-09-25","FECHA_PRODUCT":"2020-09-25","COD_ARTICULO":"284130011","NOM_ARTICULO":"XALA MIXTA PROCESO 2,2 LB USA","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3301528,"FECHA_SACRIF":"2020-09-22","FECHA_PRODUCT":"2020-09-25","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3301689,"FECHA_SACRIF":"2020-09-24","FECHA_PRODUCT":"2020-09-26","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3301690,"FECHA_SACRIF":"2020-09-23","FECHA_PRODUCT":"2020-09-26","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3301691,"FECHA_SACRIF":"2020-09-23","FECHA_PRODUCT":"2020-09-26","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3301692,"FECHA_SACRIF":"2020-09-25","FECHA_PRODUCT":"2020-09-26","COD_ARTICULO":"284120753","NOM_ARTICULO":"XALAS MIXTA POLLO IQF 2,2 lb","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3301693,"FECHA_SACRIF":"2020-09-24","FECHA_PRODUCT":"2020-09-26","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3301694,"FECHA_SACRIF":"2020-09-24","FECHA_PRODUCT":"2020-09-26","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3301695,"FECHA_SACRIF":"2020-09-22","FECHA_PRODUCT":"2020-09-26","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3301697,"FECHA_SACRIF":"2020-09-23","FECHA_PRODUCT":"2020-09-26","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3301698,"FECHA_SACRIF":"2020-09-24","FECHA_PRODUCT":"2020-09-26","COD_ARTICULO":"244720900","NOM_ARTICULO":"XALA TR. POLLO MEXICO IQF 10 K","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3301699,"FECHA_SACRIF":"2020-09-24","FECHA_PRODUCT":"2020-09-26","COD_ARTICULO":"202721871","NOM_ARTICULO":"TRUTRO CORTO POLLO  IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3301700,"FECHA_SACRIF":"2020-09-24","FECHA_PRODUCT":"2020-09-26","COD_ARTICULO":"291020909","NOM_ARTICULO":"XPECHUGA POLLO S/HP IQF 10KG","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3301701,"FECHA_SACRIF":"2020-09-25","FECHA_PRODUCT":"2020-09-26","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3301702,"FECHA_SACRIF":"2020-09-24","FECHA_PRODUCT":"2020-09-26","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3301781,"FECHA_SACRIF":"2020-09-25","FECHA_PRODUCT":"2020-09-26","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3301790,"FECHA_SACRIF":"2020-09-26","FECHA_PRODUCT":"2020-09-28","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3301794,"FECHA_SACRIF":"2020-09-26","FECHA_PRODUCT":"2020-09-26","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3301796,"FECHA_SACRIF":"2020-09-26","FECHA_PRODUCT":"2020-09-26","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3301929,"FECHA_SACRIF":"2020-09-22","FECHA_PRODUCT":"2020-09-26","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3302233,"FECHA_SACRIF":"2020-09-23","FECHA_PRODUCT":"2020-09-28","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3302234,"FECHA_SACRIF":"2020-09-24","FECHA_PRODUCT":"2020-09-28","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3302235,"FECHA_SACRIF":"2020-09-24","FECHA_PRODUCT":"2020-09-28","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3302236,"FECHA_SACRIF":"2020-09-25","FECHA_PRODUCT":"2020-09-28","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3302237,"FECHA_SACRIF":"2020-09-25","FECHA_PRODUCT":"2020-09-28","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3302238,"FECHA_SACRIF":"2020-09-24","FECHA_PRODUCT":"2020-09-28","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3302240,"FECHA_SACRIF":"2020-09-25","FECHA_PRODUCT":"2020-09-28","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3302241,"FECHA_SACRIF":"2020-09-25","FECHA_PRODUCT":"2020-09-28","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3302242,"FECHA_SACRIF":"2020-09-25","FECHA_PRODUCT":"2020-09-28","COD_ARTICULO":"291020909","NOM_ARTICULO":"XPECHUGA POLLO S/HP IQF 10KG","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3302327,"FECHA_SACRIF":"2020-09-26","FECHA_PRODUCT":"2020-09-28","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3302336,"FECHA_SACRIF":"2020-09-28","FECHA_PRODUCT":"2020-09-29","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3302340,"FECHA_SACRIF":"2020-09-28","FECHA_PRODUCT":"","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3302342,"FECHA_SACRIF":"2020-09-28","FECHA_PRODUCT":"2020-09-28","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3302454,"FECHA_SACRIF":"2020-09-25","FECHA_PRODUCT":"2020-09-28","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3302456,"FECHA_SACRIF":"2020-09-28","FECHA_PRODUCT":"2020-09-29","COD_ARTICULO":"284130011","NOM_ARTICULO":"XALA MIXTA PROCESO 2,2 LB USA","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3302697,"FECHA_SACRIF":"2020-09-25","FECHA_PRODUCT":"","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3302698,"FECHA_SACRIF":"2020-09-25","FECHA_PRODUCT":"2020-09-28","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3302735,"FECHA_SACRIF":"2020-09-24","FECHA_PRODUCT":"2020-09-28","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3302736,"FECHA_SACRIF":"2020-09-25","FECHA_PRODUCT":"2020-09-29","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3302737,"FECHA_SACRIF":"2020-09-25","FECHA_PRODUCT":"2020-09-29","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3302738,"FECHA_SACRIF":"2020-09-26","FECHA_PRODUCT":"2020-09-29","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3302739,"FECHA_SACRIF":"2020-09-26","FECHA_PRODUCT":"2020-09-29","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3302740,"FECHA_SACRIF":"2020-09-26","FECHA_PRODUCT":"2020-09-29","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3302741,"FECHA_SACRIF":"2020-09-26","FECHA_PRODUCT":"2020-09-29","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3302742,"FECHA_SACRIF":"2020-09-25","FECHA_PRODUCT":"2020-09-29","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3302745,"FECHA_SACRIF":"2020-09-24","FECHA_PRODUCT":"2020-09-29","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3302748,"FECHA_SACRIF":"2020-09-26","FECHA_PRODUCT":"2020-09-29","COD_ARTICULO":"202721871","NOM_ARTICULO":"TRUTRO CORTO POLLO  IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3302750,"FECHA_SACRIF":"2020-09-26","FECHA_PRODUCT":"2020-09-29","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3302751,"FECHA_SACRIF":"2020-09-28","FECHA_PRODUCT":"2020-09-29","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3302752,"FECHA_SACRIF":"2020-09-26","FECHA_PRODUCT":"2020-09-29","COD_ARTICULO":"284925952","NOM_ARTICULO":"XALA MIXTA POLLO 10 LB FIRST S","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3302753,"FECHA_SACRIF":"2020-09-26","FECHA_PRODUCT":"2020-09-29","COD_ARTICULO":"291020909","NOM_ARTICULO":"XPECHUGA POLLO S/HP IQF 10KG","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3302754,"FECHA_SACRIF":"2020-09-25","FECHA_PRODUCT":"2020-09-29","COD_ARTICULO":"291020909","NOM_ARTICULO":"XPECHUGA POLLO S/HP IQF 10KG","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3302755,"FECHA_SACRIF":"2020-09-28","FECHA_PRODUCT":"2020-09-29","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3302819,"FECHA_SACRIF":"2020-09-28","FECHA_PRODUCT":"2020-09-29","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3302828,"FECHA_SACRIF":"2020-09-29","FECHA_PRODUCT":"2020-09-30","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3302832,"FECHA_SACRIF":"2020-09-29","FECHA_PRODUCT":"2020-10-01","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3302834,"FECHA_SACRIF":"2020-09-29","FECHA_PRODUCT":"2020-09-29","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3302965,"FECHA_SACRIF":"2020-09-25","FECHA_PRODUCT":"2020-09-29","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3302988,"FECHA_SACRIF":"2020-09-28","FECHA_PRODUCT":"2020-09-29","COD_ARTICULO":"291020909","NOM_ARTICULO":"XPECHUGA POLLO S/HP IQF 10KG","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3303226,"FECHA_SACRIF":"2020-09-26","FECHA_PRODUCT":"2020-09-29","COD_ARTICULO":"583321929","NOM_ARTICULO":"BISTEC DE PAVO 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3303315,"FECHA_SACRIF":"2020-09-29","FECHA_PRODUCT":"2020-09-30","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3303325,"FECHA_SACRIF":"2020-09-30","FECHA_PRODUCT":"2020-10-01","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3303329,"FECHA_SACRIF":"2020-09-30","FECHA_PRODUCT":"2020-10-01","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3303331,"FECHA_SACRIF":"2020-09-30","FECHA_PRODUCT":"2020-09-30","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3303335,"FECHA_SACRIF":"2020-09-28","FECHA_PRODUCT":"2020-09-30","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3303336,"FECHA_SACRIF":"2020-09-28","FECHA_PRODUCT":"2020-09-30","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3303337,"FECHA_SACRIF":"2020-09-25","FECHA_PRODUCT":"2020-09-30","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3303338,"FECHA_SACRIF":"2020-09-28","FECHA_PRODUCT":"2020-09-30","COD_ARTICULO":"284120753","NOM_ARTICULO":"XALAS MIXTA POLLO IQF 2,2 lb","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3303339,"FECHA_SACRIF":"2020-09-26","FECHA_PRODUCT":"2020-09-30","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3303341,"FECHA_SACRIF":"2020-09-28","FECHA_PRODUCT":"2020-09-30","COD_ARTICULO":"202721871","NOM_ARTICULO":"TRUTRO CORTO POLLO  IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3303342,"FECHA_SACRIF":"2020-09-28","FECHA_PRODUCT":"2020-09-30","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3303343,"FECHA_SACRIF":"2020-09-28","FECHA_PRODUCT":"2020-09-30","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3303344,"FECHA_SACRIF":"2020-09-29","FECHA_PRODUCT":"2020-10-01","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3303345,"FECHA_SACRIF":"2020-09-29","FECHA_PRODUCT":"2020-10-01","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3303347,"FECHA_SACRIF":"2020-09-29","FECHA_PRODUCT":"2020-09-30","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3303349,"FECHA_SACRIF":"2020-09-29","FECHA_PRODUCT":"2020-09-30","COD_ARTICULO":"284925952","NOM_ARTICULO":"XALA MIXTA POLLO 10 LB FIRST S","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3303350,"FECHA_SACRIF":"2020-09-28","FECHA_PRODUCT":"2020-09-30","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3303351,"FECHA_SACRIF":"2020-09-29","FECHA_PRODUCT":"2020-09-30","COD_ARTICULO":"294325957","NOM_ARTICULO":"XALA TRUTRO 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3303493,"FECHA_SACRIF":"2020-09-25","FECHA_PRODUCT":"2020-09-30","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3303837,"FECHA_SACRIF":"2020-09-30","FECHA_PRODUCT":"2020-10-01","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3303847,"FECHA_SACRIF":"2020-10-01","FECHA_PRODUCT":"2020-10-02","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3303851,"FECHA_SACRIF":"2020-10-01","FECHA_PRODUCT":"","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3303853,"FECHA_SACRIF":"2020-10-01","FECHA_PRODUCT":"2020-10-01","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3303858,"FECHA_SACRIF":"2020-09-29","FECHA_PRODUCT":"2020-10-01","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3303860,"FECHA_SACRIF":"2020-09-26","FECHA_PRODUCT":"2020-10-01","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3303862,"FECHA_SACRIF":"2020-09-29","FECHA_PRODUCT":"2020-10-01","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3303863,"FECHA_SACRIF":"2020-09-29","FECHA_PRODUCT":"2020-10-01","COD_ARTICULO":"291020909","NOM_ARTICULO":"XPECHUGA POLLO S/HP IQF 10KG","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3303993,"FECHA_SACRIF":"2020-10-01","FECHA_PRODUCT":"2020-10-02","COD_ARTICULO":"284130011","NOM_ARTICULO":"XALA MIXTA PROCESO 2,2 LB USA","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3303994,"FECHA_SACRIF":"2020-09-30","FECHA_PRODUCT":"2020-10-01","COD_ARTICULO":"202621874","NOM_ARTICULO":"ALA TRUTRO POLLO IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3303995,"FECHA_SACRIF":"2020-09-30","FECHA_PRODUCT":"2020-10-01","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3303997,"FECHA_SACRIF":"2020-09-29","FECHA_PRODUCT":"2020-10-01","COD_ARTICULO":"283820753","NOM_ARTICULO":"XFILETILLO DE POLLO IQF 2,2 lb","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3303998,"FECHA_SACRIF":"2020-09-29","FECHA_PRODUCT":"2020-10-01","COD_ARTICULO":"254621907","NOM_ARTICULO":"XFILETILLO POLLO IQF HEB","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3304083,"FECHA_SACRIF":"2020-09-30","FECHA_PRODUCT":"2020-10-01","COD_ARTICULO":"202721871","NOM_ARTICULO":"TRUTRO CORTO POLLO  IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3304084,"FECHA_SACRIF":"2020-09-30","FECHA_PRODUCT":"2020-10-01","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3304085,"FECHA_SACRIF":"2020-09-30","FECHA_PRODUCT":"2020-10-01","COD_ARTICULO":"291020909","NOM_ARTICULO":"XPECHUGA POLLO S/HP IQF 10KG","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3304122,"FECHA_SACRIF":"2020-10-02","FECHA_PRODUCT":"2020-10-03","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3304324,"FECHA_SACRIF":"2020-09-30","FECHA_PRODUCT":"2020-10-02","COD_ARTICULO":"224623023","NOM_ARTICULO":"FILETILLO POLLO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3304326,"FECHA_SACRIF":"2020-09-30","FECHA_PRODUCT":"2020-10-02","COD_ARTICULO":"229223020","NOM_ARTICULO":"TRUTRO CORTO POLLO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3304328,"FECHA_SACRIF":"2020-10-01","FECHA_PRODUCT":"2020-10-02","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3304329,"FECHA_SACRIF":"2020-10-01","FECHA_PRODUCT":"2020-10-02","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3304330,"FECHA_SACRIF":"2020-09-30","FECHA_PRODUCT":"2020-10-02","COD_ARTICULO":"209723021","NOM_ARTICULO":"PECHUGA POLLO SHP CUISINE & CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3304331,"FECHA_SACRIF":"2020-10-01","FECHA_PRODUCT":"2020-10-02","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3304334,"FECHA_SACRIF":"2020-10-01","FECHA_PRODUCT":"2020-10-02","COD_ARTICULO":"291020909","NOM_ARTICULO":"XPECHUGA POLLO S/HP IQF 10KG","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3304335,"FECHA_SACRIF":"2020-10-01","FECHA_PRODUCT":"2020-10-02","COD_ARTICULO":"202721871","NOM_ARTICULO":"TRUTRO CORTO POLLO  IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3304389,"FECHA_SACRIF":"2020-10-01","FECHA_PRODUCT":"2020-10-02","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3304399,"FECHA_SACRIF":"2020-10-02","FECHA_PRODUCT":"2020-10-03","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3304403,"FECHA_SACRIF":"2020-10-02","FECHA_PRODUCT":"2020-10-03","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3304405,"FECHA_SACRIF":"2020-10-02","FECHA_PRODUCT":"2020-10-02","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3304561,"FECHA_SACRIF":"2020-10-01","FECHA_PRODUCT":"2020-10-02","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3304607,"FECHA_SACRIF":"2020-09-30","FECHA_PRODUCT":"2020-10-02","COD_ARTICULO":"202621874","NOM_ARTICULO":"ALA TRUTRO POLLO IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3304669,"FECHA_SACRIF":"2020-09-29","FECHA_PRODUCT":"2020-10-02","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3304826,"FECHA_SACRIF":"2020-09-29","FECHA_PRODUCT":"2020-10-03","COD_ARTICULO":"583321929","NOM_ARTICULO":"BISTEC DE PAVO 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3304827,"FECHA_SACRIF":"2020-09-30","FECHA_PRODUCT":"2020-10-14","COD_ARTICULO":"576023021","NOM_ARTICULO":"BISTEC TRUTRO PAVO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3304828,"FECHA_SACRIF":"2020-09-30","FECHA_PRODUCT":"2020-10-03","COD_ARTICULO":"576123028","NOM_ARTICULO":"FILETE PECH PAVO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3304829,"FECHA_SACRIF":"2020-10-01","FECHA_PRODUCT":"2020-10-03","COD_ARTICULO":"284120753","NOM_ARTICULO":"XALAS MIXTA POLLO IQF 2,2 lb","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3304835,"FECHA_SACRIF":"2020-10-02","FECHA_PRODUCT":"2020-10-03","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3304836,"FECHA_SACRIF":"2020-10-02","FECHA_PRODUCT":"2020-10-03","COD_ARTICULO":"291020909","NOM_ARTICULO":"XPECHUGA POLLO S/HP IQF 10KG","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3304837,"FECHA_SACRIF":"2020-09-30","FECHA_PRODUCT":"2020-10-03","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3304839,"FECHA_SACRIF":"2020-10-02","FECHA_PRODUCT":"2020-10-03","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3304924,"FECHA_SACRIF":"2020-10-02","FECHA_PRODUCT":"2020-10-03","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3304935,"FECHA_SACRIF":"2020-10-03","FECHA_PRODUCT":"2020-10-05","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3304939,"FECHA_SACRIF":"2020-10-03","FECHA_PRODUCT":"2020-10-03","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3304941,"FECHA_SACRIF":"2020-10-03","FECHA_PRODUCT":"2020-10-03","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3305142,"FECHA_SACRIF":"2020-09-30","FECHA_PRODUCT":"2020-10-03","COD_ARTICULO":"229223020","NOM_ARTICULO":"TRUTRO CORTO POLLO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3305143,"FECHA_SACRIF":"2020-09-30","FECHA_PRODUCT":"2020-10-03","COD_ARTICULO":"291020909","NOM_ARTICULO":"XPECHUGA POLLO S/HP IQF 10KG","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3305317,"FECHA_SACRIF":"2020-10-02","FECHA_PRODUCT":"2020-10-03","COD_ARTICULO":"202721871","NOM_ARTICULO":"TRUTRO CORTO POLLO  IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3305373,"FECHA_SACRIF":"2020-10-02","FECHA_PRODUCT":"2020-10-05","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3305381,"FECHA_SACRIF":"2020-10-03","FECHA_PRODUCT":"2020-10-05","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3305382,"FECHA_SACRIF":"2020-10-03","FECHA_PRODUCT":"2020-10-05","COD_ARTICULO":"284925952","NOM_ARTICULO":"XALA MIXTA POLLO 10 LB FIRST S","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3305383,"FECHA_SACRIF":"2020-10-02","FECHA_PRODUCT":"2020-10-05","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3305473,"FECHA_SACRIF":"2020-10-03","FECHA_PRODUCT":"2020-10-05","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3305488,"FECHA_SACRIF":"2020-10-05","FECHA_PRODUCT":"","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3305490,"FECHA_SACRIF":"2020-10-05","FECHA_PRODUCT":"2020-10-05","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3305581,"FECHA_SACRIF":"2020-10-05","FECHA_PRODUCT":"2020-10-06","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3305606,"FECHA_SACRIF":"2020-09-25","FECHA_PRODUCT":"","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3305626,"FECHA_SACRIF":"2020-10-03","FECHA_PRODUCT":"2020-10-05","COD_ARTICULO":"291020909","NOM_ARTICULO":"XPECHUGA POLLO S/HP IQF 10KG","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3305891,"FECHA_SACRIF":"2020-10-01","FECHA_PRODUCT":"2020-10-06","COD_ARTICULO":"583321929","NOM_ARTICULO":"BISTEC DE PAVO 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3305893,"FECHA_SACRIF":"2020-10-02","FECHA_PRODUCT":"2020-10-06","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3305894,"FECHA_SACRIF":"2020-10-01","FECHA_PRODUCT":"2020-10-06","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3305895,"FECHA_SACRIF":"2020-10-01","FECHA_PRODUCT":"2020-10-06","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3305896,"FECHA_SACRIF":"2020-10-05","FECHA_PRODUCT":"2020-10-06","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3305899,"FECHA_SACRIF":"2020-10-05","FECHA_PRODUCT":"2020-10-06","COD_ARTICULO":"224820903","NOM_ARTICULO":"XALA 1 y 2 DE POLLO IQF 10 KG","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3305900,"FECHA_SACRIF":"2020-10-05","FECHA_PRODUCT":"2020-10-06","COD_ARTICULO":"202721871","NOM_ARTICULO":"TRUTRO CORTO POLLO  IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3305901,"FECHA_SACRIF":"2020-10-05","FECHA_PRODUCT":"2020-10-06","COD_ARTICULO":"202621874","NOM_ARTICULO":"ALA TRUTRO POLLO IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3305981,"FECHA_SACRIF":"2020-10-05","FECHA_PRODUCT":"2020-10-06","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3305992,"FECHA_SACRIF":"2020-10-06","FECHA_PRODUCT":"2020-10-07","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3305996,"FECHA_SACRIF":"2020-10-06","FECHA_PRODUCT":"2020-10-06","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3305998,"FECHA_SACRIF":"2020-10-06","FECHA_PRODUCT":"2020-10-06","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3306128,"FECHA_SACRIF":"2020-10-02","FECHA_PRODUCT":"2020-10-06","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3306203,"FECHA_SACRIF":"2020-10-06","FECHA_PRODUCT":"2020-10-06","COD_ARTICULO":"284130011","NOM_ARTICULO":"XALA MIXTA PROCESO 2,2 LB USA","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3306494,"FECHA_SACRIF":"2020-10-06","FECHA_PRODUCT":"2020-10-07","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3306506,"FECHA_SACRIF":"2020-10-07","FECHA_PRODUCT":"2020-10-08","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3306510,"FECHA_SACRIF":"2020-10-07","FECHA_PRODUCT":"2020-10-07","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3306512,"FECHA_SACRIF":"2020-10-07","FECHA_PRODUCT":"2020-10-07","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3306532,"FECHA_SACRIF":"2020-10-03","FECHA_PRODUCT":"2020-10-07","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3306533,"FECHA_SACRIF":"2020-10-03","FECHA_PRODUCT":"2020-10-07","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3306534,"FECHA_SACRIF":"2020-10-03","FECHA_PRODUCT":"2020-10-07","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3306535,"FECHA_SACRIF":"2020-10-03","FECHA_PRODUCT":"2020-10-07","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3306536,"FECHA_SACRIF":"2020-10-03","FECHA_PRODUCT":"2020-10-07","COD_ARTICULO":"284925952","NOM_ARTICULO":"XALA MIXTA POLLO 10 LB FIRST S","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3306539,"FECHA_SACRIF":"2020-10-06","FECHA_PRODUCT":"2020-10-07","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3306541,"FECHA_SACRIF":"2020-10-06","FECHA_PRODUCT":"2020-10-07","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3306542,"FECHA_SACRIF":"2020-10-06","FECHA_PRODUCT":"2020-10-07","COD_ARTICULO":"202721871","NOM_ARTICULO":"TRUTRO CORTO POLLO  IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3306772,"FECHA_SACRIF":"2020-10-02","FECHA_PRODUCT":"2020-10-07","COD_ARTICULO":"291020909","NOM_ARTICULO":"XPECHUGA POLLO S/HP IQF 10KG","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3306773,"FECHA_SACRIF":"2020-10-03","FECHA_PRODUCT":"2020-10-07","COD_ARTICULO":"291020909","NOM_ARTICULO":"XPECHUGA POLLO S/HP IQF 10KG","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3307050,"FECHA_SACRIF":"2020-10-07","FECHA_PRODUCT":"2020-10-08","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3307061,"FECHA_SACRIF":"2020-10-08","FECHA_PRODUCT":"2020-10-09","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3307065,"FECHA_SACRIF":"2020-10-08","FECHA_PRODUCT":"2020-10-08","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3307067,"FECHA_SACRIF":"2020-10-08","FECHA_PRODUCT":"2020-10-08","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3307076,"FECHA_SACRIF":"2020-10-05","FECHA_PRODUCT":"2020-10-08","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3307077,"FECHA_SACRIF":"2020-10-05","FECHA_PRODUCT":"2020-10-08","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3307079,"FECHA_SACRIF":"2020-10-05","FECHA_PRODUCT":"2020-10-08","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3307080,"FECHA_SACRIF":"2020-10-05","FECHA_PRODUCT":"2020-10-08","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3307083,"FECHA_SACRIF":"2020-10-07","FECHA_PRODUCT":"2020-10-08","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3307084,"FECHA_SACRIF":"2020-10-07","FECHA_PRODUCT":"2020-10-08","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3307085,"FECHA_SACRIF":"2020-10-07","FECHA_PRODUCT":"2020-10-08","COD_ARTICULO":"291020909","NOM_ARTICULO":"XPECHUGA POLLO S/HP IQF 10KG","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3307086,"FECHA_SACRIF":"2020-10-07","FECHA_PRODUCT":"2020-10-08","COD_ARTICULO":"284925952","NOM_ARTICULO":"XALA MIXTA POLLO 10 LB FIRST S","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3307216,"FECHA_SACRIF":"2020-10-07","FECHA_PRODUCT":"2020-10-08","COD_ARTICULO":"202721871","NOM_ARTICULO":"TRUTRO CORTO POLLO  IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3307237,"FECHA_SACRIF":"2020-10-05","FECHA_PRODUCT":"2020-10-08","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3307252,"FECHA_SACRIF":"2020-10-06","FECHA_PRODUCT":"2020-10-08","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3307264,"FECHA_SACRIF":"2020-10-07","FECHA_PRODUCT":"2020-10-09","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3307595,"FECHA_SACRIF":"2020-10-08","FECHA_PRODUCT":"2020-10-09","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3307605,"FECHA_SACRIF":"2020-10-09","FECHA_PRODUCT":"2020-10-10","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3307608,"FECHA_SACRIF":"2020-10-09","FECHA_PRODUCT":"2020-10-09","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3307609,"FECHA_SACRIF":"2020-10-09","FECHA_PRODUCT":"2020-10-09","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3307614,"FECHA_SACRIF":"2020-10-06","FECHA_PRODUCT":"2020-10-09","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3307615,"FECHA_SACRIF":"2020-10-06","FECHA_PRODUCT":"2020-10-09","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3307617,"FECHA_SACRIF":"2020-10-06","FECHA_PRODUCT":"2020-10-09","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3307618,"FECHA_SACRIF":"2020-10-06","FECHA_PRODUCT":"2020-10-09","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3307619,"FECHA_SACRIF":"2020-10-06","FECHA_PRODUCT":"2020-10-09","COD_ARTICULO":"283820753","NOM_ARTICULO":"XFILETILLO DE POLLO IQF 2,2 lb","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3307622,"FECHA_SACRIF":"2020-10-08","FECHA_PRODUCT":"2020-10-09","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3307623,"FECHA_SACRIF":"2020-10-08","FECHA_PRODUCT":"2020-10-09","COD_ARTICULO":"202721871","NOM_ARTICULO":"TRUTRO CORTO POLLO  IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3307624,"FECHA_SACRIF":"2020-10-08","FECHA_PRODUCT":"2020-10-09","COD_ARTICULO":"224820903","NOM_ARTICULO":"XALA 1 y 2 DE POLLO IQF 10 KG","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3307626,"FECHA_SACRIF":"2020-10-08","FECHA_PRODUCT":"2020-10-09","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3307627,"FECHA_SACRIF":"2020-10-08","FECHA_PRODUCT":"2020-10-09","COD_ARTICULO":"294025956","NOM_ARTICULO":"XPECHUGA SHP IQF 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3307628,"FECHA_SACRIF":"2020-10-09","FECHA_PRODUCT":"2020-10-09","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3308046,"FECHA_SACRIF":"2020-10-07","FECHA_PRODUCT":"2020-10-10","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3308048,"FECHA_SACRIF":"2020-10-06","FECHA_PRODUCT":"2020-10-10","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3308049,"FECHA_SACRIF":"2020-10-06","FECHA_PRODUCT":"2020-10-10","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3308050,"FECHA_SACRIF":"2020-10-09","FECHA_PRODUCT":"2020-10-10","COD_ARTICULO":"244720900","NOM_ARTICULO":"XALA TR. POLLO MEXICO IQF 10 K","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3308051,"FECHA_SACRIF":"2020-10-09","FECHA_PRODUCT":"2020-10-10","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3308052,"FECHA_SACRIF":"2020-10-09","FECHA_PRODUCT":"2020-10-10","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3308053,"FECHA_SACRIF":"2020-10-07","FECHA_PRODUCT":"2020-10-10","COD_ARTICULO":"209723021","NOM_ARTICULO":"PECHUGA POLLO SHP CUISINE & CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3308054,"FECHA_SACRIF":"2020-10-07","FECHA_PRODUCT":"2020-10-10","COD_ARTICULO":"229223020","NOM_ARTICULO":"TRUTRO CORTO POLLO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3308135,"FECHA_SACRIF":"2020-10-09","FECHA_PRODUCT":"2020-10-10","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3308147,"FECHA_SACRIF":"2020-10-10","FECHA_PRODUCT":"2020-10-13","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3308157,"FECHA_SACRIF":"2020-10-09","FECHA_PRODUCT":"2020-10-10","COD_ARTICULO":"294125953","NOM_ARTICULO":"XFILETILLO 4X10 LB USA","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3308243,"FECHA_SACRIF":"2020-10-10","FECHA_PRODUCT":"2020-10-10","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3308311,"FECHA_SACRIF":"2020-10-07","FECHA_PRODUCT":"2020-10-10","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3308528,"FECHA_SACRIF":"2020-10-09","FECHA_PRODUCT":"2020-10-13","COD_ARTICULO":"294125953","NOM_ARTICULO":"XFILETILLO 4X10 LB USA","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3308529,"FECHA_SACRIF":"2020-10-07","FECHA_PRODUCT":"2020-10-13","COD_ARTICULO":"224623023","NOM_ARTICULO":"FILETILLO POLLO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3308533,"FECHA_SACRIF":"2020-10-10","FECHA_PRODUCT":"2020-10-13","COD_ARTICULO":"244720900","NOM_ARTICULO":"XALA TR. POLLO MEXICO IQF 10 K","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3308534,"FECHA_SACRIF":"2020-10-10","FECHA_PRODUCT":"2020-10-13","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3308535,"FECHA_SACRIF":"2020-10-10","FECHA_PRODUCT":"2020-10-13","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3308537,"FECHA_SACRIF":"2020-10-10","FECHA_PRODUCT":"2020-10-13","COD_ARTICULO":"202721871","NOM_ARTICULO":"TRUTRO CORTO POLLO  IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3308553,"FECHA_SACRIF":"2020-10-08","FECHA_PRODUCT":"2020-10-13","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3308606,"FECHA_SACRIF":"2020-10-10","FECHA_PRODUCT":"2020-10-13","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3308618,"FECHA_SACRIF":"2020-10-13","FECHA_PRODUCT":"2020-10-14","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3308624,"FECHA_SACRIF":"2020-10-13","FECHA_PRODUCT":"2020-10-13","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3308802,"FECHA_SACRIF":"2020-10-07","FECHA_PRODUCT":"2020-10-13","COD_ARTICULO":"209723021","NOM_ARTICULO":"PECHUGA POLLO SHP CUISINE & CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3309008,"FECHA_SACRIF":"2020-10-08","FECHA_PRODUCT":"","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3309009,"FECHA_SACRIF":"2020-10-08","FECHA_PRODUCT":"2020-10-13","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3309010,"FECHA_SACRIF":"2020-10-13","FECHA_PRODUCT":"2020-10-13","COD_ARTICULO":"244720900","NOM_ARTICULO":"XALA TR. POLLO MEXICO IQF 10 K","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3309056,"FECHA_SACRIF":"2020-10-13","FECHA_PRODUCT":"2020-10-13","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3309143,"FECHA_SACRIF":"2020-10-13","FECHA_PRODUCT":"2020-10-14","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3309155,"FECHA_SACRIF":"2020-10-14","FECHA_PRODUCT":"2020-10-15","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3309159,"FECHA_SACRIF":"2020-10-14","FECHA_PRODUCT":"2020-10-15","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3309161,"FECHA_SACRIF":"2020-10-14","FECHA_PRODUCT":"2020-10-14","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3309165,"FECHA_SACRIF":"2020-10-08","FECHA_PRODUCT":"2020-10-14","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3309167,"FECHA_SACRIF":"2020-10-09","FECHA_PRODUCT":"2020-10-14","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3309169,"FECHA_SACRIF":"2020-10-09","FECHA_PRODUCT":"2020-10-14","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3309171,"FECHA_SACRIF":"2020-10-13","FECHA_PRODUCT":"2020-10-14","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3309172,"FECHA_SACRIF":"2020-10-13","FECHA_PRODUCT":"2020-10-14","COD_ARTICULO":"202721871","NOM_ARTICULO":"TRUTRO CORTO POLLO  IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3309173,"FECHA_SACRIF":"2020-10-08","FECHA_PRODUCT":"2020-10-14","COD_ARTICULO":"283820753","NOM_ARTICULO":"XFILETILLO DE POLLO IQF 2,2 lb","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3309174,"FECHA_SACRIF":"2020-10-13","FECHA_PRODUCT":"2020-10-14","COD_ARTICULO":"305821928","NOM_ARTICULO":"FILETILLO DE POLLO CDG 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3309175,"FECHA_SACRIF":"2020-10-13","FECHA_PRODUCT":"2020-10-16","COD_ARTICULO":"305921925","NOM_ARTICULO":"PECHUGA DE POLLO S/HP CDG 750G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3309260,"FECHA_SACRIF":"2020-10-13","FECHA_PRODUCT":"2020-10-14","COD_ARTICULO":"244720900","NOM_ARTICULO":"XALA TR. POLLO MEXICO IQF 10 K","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3309261,"FECHA_SACRIF":"2020-10-13","FECHA_PRODUCT":"2020-10-14","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3309306,"FECHA_SACRIF":"2020-10-08","FECHA_PRODUCT":"2020-10-14","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3309309,"FECHA_SACRIF":"2020-10-13","FECHA_PRODUCT":"2020-10-14","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3309322,"FECHA_SACRIF":"2020-09-30","FECHA_PRODUCT":"2020-10-15","COD_ARTICULO":"576123028","NOM_ARTICULO":"FILETE PECH PAVO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3309356,"FECHA_SACRIF":"2020-10-07","FECHA_PRODUCT":"2020-10-14","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3309572,"FECHA_SACRIF":"2020-10-09","FECHA_PRODUCT":"2020-10-14","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3309659,"FECHA_SACRIF":"2020-10-14","FECHA_PRODUCT":"2020-10-15","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3309670,"FECHA_SACRIF":"2020-10-15","FECHA_PRODUCT":"2020-10-16","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3309674,"FECHA_SACRIF":"2020-10-15","FECHA_PRODUCT":"2020-10-16","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3309676,"FECHA_SACRIF":"2020-10-15","FECHA_PRODUCT":"2020-10-15","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3309677,"FECHA_SACRIF":"2020-10-09","FECHA_PRODUCT":"2020-10-15","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3309678,"FECHA_SACRIF":"2020-10-14","FECHA_PRODUCT":"2020-10-15","COD_ARTICULO":"244720900","NOM_ARTICULO":"XALA TR. POLLO MEXICO IQF 10 K","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3309680,"FECHA_SACRIF":"2020-10-14","FECHA_PRODUCT":"2020-10-15","COD_ARTICULO":"202721871","NOM_ARTICULO":"TRUTRO CORTO POLLO  IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3309682,"FECHA_SACRIF":"2020-10-14","FECHA_PRODUCT":"2020-10-15","COD_ARTICULO":"202621874","NOM_ARTICULO":"ALA TRUTRO POLLO IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3309683,"FECHA_SACRIF":"2020-10-13","FECHA_PRODUCT":"2020-10-15","COD_ARTICULO":"294025956","NOM_ARTICULO":"XPECHUGA SHP IQF 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3309812,"FECHA_SACRIF":"2020-10-14","FECHA_PRODUCT":"2020-10-15","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3309819,"FECHA_SACRIF":"2020-10-10","FECHA_PRODUCT":"2020-10-15","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3309821,"FECHA_SACRIF":"2020-10-10","FECHA_PRODUCT":"","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3309866,"FECHA_SACRIF":"2020-10-07","FECHA_PRODUCT":"2020-10-15","COD_ARTICULO":"229223020","NOM_ARTICULO":"TRUTRO CORTO POLLO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3310158,"FECHA_SACRIF":"2020-10-15","FECHA_PRODUCT":"2020-10-16","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3310173,"FECHA_SACRIF":"2020-10-16","FECHA_PRODUCT":"2020-10-17","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3310175,"FECHA_SACRIF":"2020-10-16","FECHA_PRODUCT":"2020-10-16","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3310185,"FECHA_SACRIF":"2020-10-13","FECHA_PRODUCT":"2020-10-16","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3310186,"FECHA_SACRIF":"2020-10-13","FECHA_PRODUCT":"2020-10-16","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3310187,"FECHA_SACRIF":"2020-10-13","FECHA_PRODUCT":"2020-10-16","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3310188,"FECHA_SACRIF":"2020-10-14","FECHA_PRODUCT":"2020-10-16","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3310191,"FECHA_SACRIF":"2020-10-15","FECHA_PRODUCT":"2020-10-16","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3310192,"FECHA_SACRIF":"2020-10-15","FECHA_PRODUCT":"2020-10-16","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3310193,"FECHA_SACRIF":"2020-10-15","FECHA_PRODUCT":"2020-10-16","COD_ARTICULO":"202721871","NOM_ARTICULO":"TRUTRO CORTO POLLO  IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3310195,"FECHA_SACRIF":"2020-10-15","FECHA_PRODUCT":"2020-10-16","COD_ARTICULO":"294325957","NOM_ARTICULO":"XALA TRUTRO 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3310196,"FECHA_SACRIF":"2020-10-15","FECHA_PRODUCT":"2020-10-16","COD_ARTICULO":"294025956","NOM_ARTICULO":"XPECHUGA SHP IQF 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3310198,"FECHA_SACRIF":"","FECHA_PRODUCT":"2020-10-16","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3310597,"FECHA_SACRIF":"2020-10-15","FECHA_PRODUCT":"2020-10-17","COD_ARTICULO":"209723021","NOM_ARTICULO":"PECHUGA POLLO SHP CUISINE & CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3310598,"FECHA_SACRIF":"2020-10-15","FECHA_PRODUCT":"2020-10-17","COD_ARTICULO":"229223020","NOM_ARTICULO":"TRUTRO CORTO POLLO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3310599,"FECHA_SACRIF":"2020-10-15","FECHA_PRODUCT":"2020-10-17","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3310600,"FECHA_SACRIF":"2020-10-16","FECHA_PRODUCT":"","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3310604,"FECHA_SACRIF":"2020-10-16","FECHA_PRODUCT":"2020-10-17","COD_ARTICULO":"244720900","NOM_ARTICULO":"XALA TR. POLLO MEXICO IQF 10 K","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3310605,"FECHA_SACRIF":"2020-10-16","FECHA_PRODUCT":"2020-10-17","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3310606,"FECHA_SACRIF":"2020-10-16","FECHA_PRODUCT":"2020-10-17","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3310607,"FECHA_SACRIF":"2020-10-16","FECHA_PRODUCT":"2020-10-17","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3310608,"FECHA_SACRIF":"2020-10-15","FECHA_PRODUCT":"2020-10-17","COD_ARTICULO":"283820753","NOM_ARTICULO":"XFILETILLO DE POLLO IQF 2,2 lb","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3310662,"FECHA_SACRIF":"2020-10-16","FECHA_PRODUCT":"2020-10-17","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3310674,"FECHA_SACRIF":"2020-10-16","FECHA_PRODUCT":"2020-10-17","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3310680,"FECHA_SACRIF":"2020-10-17","FECHA_PRODUCT":"2020-10-17","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3311071,"FECHA_SACRIF":"2020-10-14","FECHA_PRODUCT":"2020-10-17","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3311145,"FECHA_SACRIF":"2020-10-15","FECHA_PRODUCT":"2020-10-19","COD_ARTICULO":"224623023","NOM_ARTICULO":"FILETILLO POLLO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3311148,"FECHA_SACRIF":"2020-10-17","FECHA_PRODUCT":"2020-10-19","COD_ARTICULO":"244720900","NOM_ARTICULO":"XALA TR. POLLO MEXICO IQF 10 K","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3311152,"FECHA_SACRIF":"2020-10-17","FECHA_PRODUCT":"2020-10-19","COD_ARTICULO":"202621874","NOM_ARTICULO":"ALA TRUTRO POLLO IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3311153,"FECHA_SACRIF":"2020-10-16","FECHA_PRODUCT":"2020-10-19","COD_ARTICULO":"202721871","NOM_ARTICULO":"TRUTRO CORTO POLLO  IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3311154,"FECHA_SACRIF":"2020-10-15","FECHA_PRODUCT":"2020-10-19","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3311217,"FECHA_SACRIF":"2020-10-17","FECHA_PRODUCT":"2020-10-19","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3311230,"FECHA_SACRIF":"2020-10-17","FECHA_PRODUCT":"2020-10-19","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3311234,"FECHA_SACRIF":"2020-10-19","FECHA_PRODUCT":"","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3311236,"FECHA_SACRIF":"2020-10-19","FECHA_PRODUCT":"2020-10-19","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3311340,"FECHA_SACRIF":"2020-10-09","FECHA_PRODUCT":"2020-10-20","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3311614,"FECHA_SACRIF":"2020-10-15","FECHA_PRODUCT":"2020-10-19","COD_ARTICULO":"224623023","NOM_ARTICULO":"FILETILLO POLLO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3311615,"FECHA_SACRIF":"2020-10-15","FECHA_PRODUCT":"2020-10-20","COD_ARTICULO":"224623023","NOM_ARTICULO":"FILETILLO POLLO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3311616,"FECHA_SACRIF":"2020-10-15","FECHA_PRODUCT":"2020-10-20","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3311618,"FECHA_SACRIF":"2020-10-15","FECHA_PRODUCT":"2020-10-20","COD_ARTICULO":"576023021","NOM_ARTICULO":"BISTEC TRUTRO PAVO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3311621,"FECHA_SACRIF":"2020-10-19","FECHA_PRODUCT":"2020-10-20","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3311622,"FECHA_SACRIF":"2020-10-17","FECHA_PRODUCT":"2020-10-20","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3311623,"FECHA_SACRIF":"2020-10-19","FECHA_PRODUCT":"2020-10-20","COD_ARTICULO":"244720900","NOM_ARTICULO":"XALA TR. POLLO MEXICO IQF 10 K","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3311625,"FECHA_SACRIF":"2020-10-19","FECHA_PRODUCT":"2020-10-20","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3311688,"FECHA_SACRIF":"2020-10-19","FECHA_PRODUCT":"2020-10-20","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3311700,"FECHA_SACRIF":"2020-10-19","FECHA_PRODUCT":"2020-10-20","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3311704,"FECHA_SACRIF":"2020-10-20","FECHA_PRODUCT":"","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3311709,"FECHA_SACRIF":"2020-10-20","FECHA_PRODUCT":"2020-10-20","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3311823,"FECHA_SACRIF":"2020-10-15","FECHA_PRODUCT":"2020-10-20","COD_ARTICULO":"229223020","NOM_ARTICULO":"TRUTRO CORTO POLLO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3311891,"FECHA_SACRIF":"2020-10-20","FECHA_PRODUCT":"2020-10-20","COD_ARTICULO":"284130011","NOM_ARTICULO":"XALA MIXTA PROCESO 2,2 LB USA","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3312149,"FECHA_SACRIF":"2020-10-15","FECHA_PRODUCT":"2020-10-21","COD_ARTICULO":"283820753","NOM_ARTICULO":"XFILETILLO DE POLLO IQF 2,2 lb","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3312151,"FECHA_SACRIF":"2020-10-16","FECHA_PRODUCT":"2020-10-21","COD_ARTICULO":"283820753","NOM_ARTICULO":"XFILETILLO DE POLLO IQF 2,2 lb","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3312152,"FECHA_SACRIF":"2020-10-17","FECHA_PRODUCT":"2020-10-21","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3312154,"FECHA_SACRIF":"2020-10-20","FECHA_PRODUCT":"2020-10-21","COD_ARTICULO":"244720900","NOM_ARTICULO":"XALA TR. POLLO MEXICO IQF 10 K","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3312155,"FECHA_SACRIF":"2020-10-20","FECHA_PRODUCT":"2020-10-21","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3312156,"FECHA_SACRIF":"2020-10-19","FECHA_PRODUCT":"2020-10-21","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3312157,"FECHA_SACRIF":"2020-10-19","FECHA_PRODUCT":"2020-10-21","COD_ARTICULO":"294025956","NOM_ARTICULO":"XPECHUGA SHP IQF 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3312218,"FECHA_SACRIF":"2020-10-20","FECHA_PRODUCT":"2020-10-21","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3312230,"FECHA_SACRIF":"2020-10-20","FECHA_PRODUCT":"2020-10-21","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3312234,"FECHA_SACRIF":"2020-10-21","FECHA_PRODUCT":"","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3312236,"FECHA_SACRIF":"2020-10-21","FECHA_PRODUCT":"2020-10-21","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3312472,"FECHA_SACRIF":"2020-10-20","FECHA_PRODUCT":"2020-10-21","COD_ARTICULO":"202721871","NOM_ARTICULO":"TRUTRO CORTO POLLO  IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3312474,"FECHA_SACRIF":"2020-10-20","FECHA_PRODUCT":"2020-10-21","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3312720,"FECHA_SACRIF":"2020-10-19","FECHA_PRODUCT":"2020-10-22","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3312721,"FECHA_SACRIF":"2020-10-19","FECHA_PRODUCT":"2020-10-22","COD_ARTICULO":"583421926","NOM_ARTICULO":"FILETE DE PAVO 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3312723,"FECHA_SACRIF":"2020-10-20","FECHA_PRODUCT":"2020-10-22","COD_ARTICULO":"284120753","NOM_ARTICULO":"XALAS MIXTA POLLO IQF 2,2 lb","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3312724,"FECHA_SACRIF":"2020-10-20","FECHA_PRODUCT":"2020-10-22","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3312725,"FECHA_SACRIF":"2020-10-22","FECHA_PRODUCT":"2020-10-22","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3312726,"FECHA_SACRIF":"2020-10-21","FECHA_PRODUCT":"2020-10-22","COD_ARTICULO":"244720900","NOM_ARTICULO":"XALA TR. POLLO MEXICO IQF 10 K","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3312781,"FECHA_SACRIF":"2020-10-21","FECHA_PRODUCT":"2020-10-22","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3312792,"FECHA_SACRIF":"2020-10-21","FECHA_PRODUCT":"2020-10-22","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3312797,"FECHA_SACRIF":"2020-10-22","FECHA_PRODUCT":"2020-10-26","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3312799,"FECHA_SACRIF":"2020-10-22","FECHA_PRODUCT":"2020-10-22","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3313310,"FECHA_SACRIF":"2020-10-22","FECHA_PRODUCT":"2020-10-23","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3313321,"FECHA_SACRIF":"2020-10-22","FECHA_PRODUCT":"2020-10-23","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3313326,"FECHA_SACRIF":"2020-10-23","FECHA_PRODUCT":"2020-10-26","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3313328,"FECHA_SACRIF":"2020-10-23","FECHA_PRODUCT":"2020-10-23","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3313330,"FECHA_SACRIF":"2020-10-21","FECHA_PRODUCT":"2020-10-23","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3313332,"FECHA_SACRIF":"2020-10-20","FECHA_PRODUCT":"2020-10-23","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3313334,"FECHA_SACRIF":"2020-10-21","FECHA_PRODUCT":"2020-10-23","COD_ARTICULO":"202621874","NOM_ARTICULO":"ALA TRUTRO POLLO IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3313335,"FECHA_SACRIF":"2020-10-22","FECHA_PRODUCT":"2020-10-23","COD_ARTICULO":"244720900","NOM_ARTICULO":"XALA TR. POLLO MEXICO IQF 10 K","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3313336,"FECHA_SACRIF":"2020-10-22","FECHA_PRODUCT":"2020-10-23","COD_ARTICULO":"284925952","NOM_ARTICULO":"XALA MIXTA POLLO 10 LB FIRST S","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3313337,"FECHA_SACRIF":"2020-10-22","FECHA_PRODUCT":"2020-10-23","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3313338,"FECHA_SACRIF":"2020-10-21","FECHA_PRODUCT":"2020-10-23","COD_ARTICULO":"202721871","NOM_ARTICULO":"TRUTRO CORTO POLLO  IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3313480,"FECHA_SACRIF":"2020-10-15","FECHA_PRODUCT":"2020-10-23","COD_ARTICULO":"229223020","NOM_ARTICULO":"TRUTRO CORTO POLLO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3313481,"FECHA_SACRIF":"2020-10-20","FECHA_PRODUCT":"2020-10-23","COD_ARTICULO":"284120753","NOM_ARTICULO":"XALAS MIXTA POLLO IQF 2,2 lb","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3313509,"FECHA_SACRIF":"2020-10-22","FECHA_PRODUCT":"2020-10-23","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3313764,"FECHA_SACRIF":"2020-10-20","FECHA_PRODUCT":"2020-10-24","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3313765,"FECHA_SACRIF":"2020-10-21","FECHA_PRODUCT":"2020-10-24","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3313767,"FECHA_SACRIF":"2020-10-21","FECHA_PRODUCT":"2020-10-24","COD_ARTICULO":"305921925","NOM_ARTICULO":"PECHUGA DE POLLO S/HP CDG 750G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3313768,"FECHA_SACRIF":"2020-10-21","FECHA_PRODUCT":"2020-10-24","COD_ARTICULO":"305821928","NOM_ARTICULO":"FILETILLO DE POLLO CDG 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3313769,"FECHA_SACRIF":"2020-10-23","FECHA_PRODUCT":"2020-10-24","COD_ARTICULO":"202621874","NOM_ARTICULO":"ALA TRUTRO POLLO IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3313770,"FECHA_SACRIF":"2020-10-23","FECHA_PRODUCT":"2020-10-24","COD_ARTICULO":"294025956","NOM_ARTICULO":"XPECHUGA SHP IQF 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3313771,"FECHA_SACRIF":"2020-10-22","FECHA_PRODUCT":"2020-10-24","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3313773,"FECHA_SACRIF":"2020-10-22","FECHA_PRODUCT":"2020-10-23","COD_ARTICULO":"294025956","NOM_ARTICULO":"XPECHUGA SHP IQF 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3313774,"FECHA_SACRIF":"2020-10-23","FECHA_PRODUCT":"2020-10-23","COD_ARTICULO":"284130011","NOM_ARTICULO":"XALA MIXTA PROCESO 2,2 LB USA","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3313853,"FECHA_SACRIF":"2020-10-23","FECHA_PRODUCT":"2020-10-24","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3313866,"FECHA_SACRIF":"2020-10-23","FECHA_PRODUCT":"2020-10-24","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3313871,"FECHA_SACRIF":"2020-10-24","FECHA_PRODUCT":"2020-10-26","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3313873,"FECHA_SACRIF":"2020-10-24","FECHA_PRODUCT":"2020-10-24","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3314003,"FECHA_SACRIF":"2020-10-23","FECHA_PRODUCT":"2020-10-24","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3314124,"FECHA_SACRIF":"2020-10-24","FECHA_PRODUCT":"2020-10-24","COD_ARTICULO":"294325957","NOM_ARTICULO":"XALA TRUTRO 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3314125,"FECHA_SACRIF":"2020-10-22","FECHA_PRODUCT":"2020-10-24","COD_ARTICULO":"294025956","NOM_ARTICULO":"XPECHUGA SHP IQF 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3314170,"FECHA_SACRIF":"2020-10-22","FECHA_PRODUCT":"2020-10-26","COD_ARTICULO":"283820753","NOM_ARTICULO":"XFILETILLO DE POLLO IQF 2,2 lb","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3314171,"FECHA_SACRIF":"2020-10-23","FECHA_PRODUCT":"2020-10-26","COD_ARTICULO":"209723021","NOM_ARTICULO":"PECHUGA POLLO SHP CUISINE & CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3314172,"FECHA_SACRIF":"2020-10-22","FECHA_PRODUCT":"2020-10-26","COD_ARTICULO":"254621907","NOM_ARTICULO":"XFILETILLO POLLO IQF HEB","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3314173,"FECHA_SACRIF":"2020-10-22","FECHA_PRODUCT":"2020-10-26","COD_ARTICULO":"583421926","NOM_ARTICULO":"FILETE DE PAVO 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3314174,"FECHA_SACRIF":"2020-10-22","FECHA_PRODUCT":"2020-10-26","COD_ARTICULO":"583321929","NOM_ARTICULO":"BISTEC DE PAVO 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3314175,"FECHA_SACRIF":"2020-10-24","FECHA_PRODUCT":"2020-10-26","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3314176,"FECHA_SACRIF":"2020-10-23","FECHA_PRODUCT":"2020-10-26","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3314177,"FECHA_SACRIF":"2020-10-24","FECHA_PRODUCT":"2020-10-26","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3314178,"FECHA_SACRIF":"2020-10-24","FECHA_PRODUCT":"2020-10-26","COD_ARTICULO":"244720900","NOM_ARTICULO":"XALA TR. POLLO MEXICO IQF 10 K","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3314179,"FECHA_SACRIF":"2020-10-23","FECHA_PRODUCT":"2020-10-26","COD_ARTICULO":"294025956","NOM_ARTICULO":"XPECHUGA SHP IQF 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3314180,"FECHA_SACRIF":"2020-10-23","FECHA_PRODUCT":"2020-10-26","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3314222,"FECHA_SACRIF":"2020-10-24","FECHA_PRODUCT":"2020-10-26","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3314233,"FECHA_SACRIF":"2020-10-24","FECHA_PRODUCT":"2020-10-26","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3314238,"FECHA_SACRIF":"2020-10-26","FECHA_PRODUCT":"","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3314240,"FECHA_SACRIF":"2020-10-26","FECHA_PRODUCT":"2020-10-26","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3314560,"FECHA_SACRIF":"2020-10-24","FECHA_PRODUCT":"2020-10-26","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3314597,"FECHA_SACRIF":"2020-10-23","FECHA_PRODUCT":"2020-10-26","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3314598,"FECHA_SACRIF":"2020-10-22","FECHA_PRODUCT":"2020-10-26","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3314600,"FECHA_SACRIF":"2020-10-24","FECHA_PRODUCT":"2020-10-26","COD_ARTICULO":"202621874","NOM_ARTICULO":"ALA TRUTRO POLLO IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3314649,"FECHA_SACRIF":"2020-10-23","FECHA_PRODUCT":"2020-10-26","COD_ARTICULO":"284120753","NOM_ARTICULO":"XALAS MIXTA POLLO IQF 2,2 lb","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3314912,"FECHA_SACRIF":"2020-10-23","FECHA_PRODUCT":"2020-10-27","COD_ARTICULO":"229223020","NOM_ARTICULO":"TRUTRO CORTO POLLO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3314913,"FECHA_SACRIF":"2020-10-23","FECHA_PRODUCT":"2020-10-27","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3314914,"FECHA_SACRIF":"2020-10-23","FECHA_PRODUCT":"2020-10-27","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3314918,"FECHA_SACRIF":"2020-10-26","FECHA_PRODUCT":"2020-10-27","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3314921,"FECHA_SACRIF":"2020-10-26","FECHA_PRODUCT":"2020-10-27","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3314928,"FECHA_SACRIF":"2020-10-26","FECHA_PRODUCT":"2020-10-27","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3314942,"FECHA_SACRIF":"2020-10-26","FECHA_PRODUCT":"2020-10-27","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3314947,"FECHA_SACRIF":"2020-10-27","FECHA_PRODUCT":"","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3314949,"FECHA_SACRIF":"2020-10-27","FECHA_PRODUCT":"2020-10-27","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3315083,"FECHA_SACRIF":"2020-10-26","FECHA_PRODUCT":"2020-10-27","COD_ARTICULO":"294025956","NOM_ARTICULO":"XPECHUGA SHP IQF 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3315395,"FECHA_SACRIF":"2020-10-27","FECHA_PRODUCT":"2020-10-28","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3315407,"FECHA_SACRIF":"2020-10-27","FECHA_PRODUCT":"2020-10-28","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3315414,"FECHA_SACRIF":"2020-10-28","FECHA_PRODUCT":"2020-10-28","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3315419,"FECHA_SACRIF":"2020-10-24","FECHA_PRODUCT":"2020-10-28","COD_ARTICULO":"254621907","NOM_ARTICULO":"XFILETILLO POLLO IQF HEB","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3315421,"FECHA_SACRIF":"2020-10-23","FECHA_PRODUCT":"2020-10-28","COD_ARTICULO":"576123028","NOM_ARTICULO":"FILETE PECH PAVO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3315422,"FECHA_SACRIF":"2020-10-24","FECHA_PRODUCT":"2020-10-28","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3315423,"FECHA_SACRIF":"2020-10-23","FECHA_PRODUCT":"2020-10-28","COD_ARTICULO":"224623023","NOM_ARTICULO":"FILETILLO POLLO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3315424,"FECHA_SACRIF":"2020-10-27","FECHA_PRODUCT":"2020-10-28","COD_ARTICULO":"244720900","NOM_ARTICULO":"XALA TR. POLLO MEXICO IQF 10 K","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3315589,"FECHA_SACRIF":"2020-10-27","FECHA_PRODUCT":"2020-10-28","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3315593,"FECHA_SACRIF":"2020-10-26","FECHA_PRODUCT":"2020-10-28","COD_ARTICULO":"576023021","NOM_ARTICULO":"BISTEC TRUTRO PAVO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3315836,"FECHA_SACRIF":"2020-10-23","FECHA_PRODUCT":"2020-10-29","COD_ARTICULO":"224623023","NOM_ARTICULO":"FILETILLO POLLO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3315837,"FECHA_SACRIF":"2020-10-23","FECHA_PRODUCT":"2020-10-29","COD_ARTICULO":"224623023","NOM_ARTICULO":"FILETILLO POLLO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3315838,"FECHA_SACRIF":"2020-10-26","FECHA_PRODUCT":"2020-10-29","COD_ARTICULO":"209723021","NOM_ARTICULO":"PECHUGA POLLO SHP CUISINE & CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3315840,"FECHA_SACRIF":"2020-10-26","FECHA_PRODUCT":"2020-10-29","COD_ARTICULO":"224623023","NOM_ARTICULO":"FILETILLO POLLO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3315842,"FECHA_SACRIF":"2020-10-26","FECHA_PRODUCT":"2020-10-29","COD_ARTICULO":"229223020","NOM_ARTICULO":"TRUTRO CORTO POLLO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3315844,"FECHA_SACRIF":"2020-10-28","FECHA_PRODUCT":"2020-10-29","COD_ARTICULO":"244720900","NOM_ARTICULO":"XALA TR. POLLO MEXICO IQF 10 K","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3315845,"FECHA_SACRIF":"2020-10-28","FECHA_PRODUCT":"2020-10-29","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3315846,"FECHA_SACRIF":"2020-10-28","FECHA_PRODUCT":"2020-10-29","COD_ARTICULO":"294025956","NOM_ARTICULO":"XPECHUGA SHP IQF 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3315847,"FECHA_SACRIF":"2020-10-26","FECHA_PRODUCT":"2020-10-29","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3315848,"FECHA_SACRIF":"2020-10-27","FECHA_PRODUCT":"2020-10-29","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3315909,"FECHA_SACRIF":"2020-10-28","FECHA_PRODUCT":"2020-10-29","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3315921,"FECHA_SACRIF":"2020-10-28","FECHA_PRODUCT":"2020-10-29","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3315925,"FECHA_SACRIF":"2020-10-29","FECHA_PRODUCT":"","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3315927,"FECHA_SACRIF":"2020-10-29","FECHA_PRODUCT":"2020-10-29","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3316110,"FECHA_SACRIF":"2020-10-28","FECHA_PRODUCT":"2020-10-29","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3316111,"FECHA_SACRIF":"2020-10-28","FECHA_PRODUCT":"2020-10-29","COD_ARTICULO":"284925952","NOM_ARTICULO":"XALA MIXTA POLLO 10 LB FIRST S","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3316115,"FECHA_SACRIF":"2020-10-29","FECHA_PRODUCT":"2020-10-29","COD_ARTICULO":"284130011","NOM_ARTICULO":"XALA MIXTA PROCESO 2,2 LB USA","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3316153,"FECHA_SACRIF":"2020-10-27","FECHA_PRODUCT":"2020-10-29","COD_ARTICULO":"583321929","NOM_ARTICULO":"BISTEC DE PAVO 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3316221,"FECHA_SACRIF":"2020-10-27","FECHA_PRODUCT":"2020-10-29","COD_ARTICULO":"202621874","NOM_ARTICULO":"ALA TRUTRO POLLO IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3316427,"FECHA_SACRIF":"2020-10-26","FECHA_PRODUCT":"2020-10-30","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3316431,"FECHA_SACRIF":"2020-10-27","FECHA_PRODUCT":"2020-10-30","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3316432,"FECHA_SACRIF":"2020-10-28","FECHA_PRODUCT":"2020-10-30","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3316433,"FECHA_SACRIF":"2020-10-29","FECHA_PRODUCT":"2020-10-30","COD_ARTICULO":"244720900","NOM_ARTICULO":"XALA TR. POLLO MEXICO IQF 10 K","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3316434,"FECHA_SACRIF":"2020-10-29","FECHA_PRODUCT":"2020-10-30","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3316477,"FECHA_SACRIF":"2020-10-29","FECHA_PRODUCT":"2020-10-30","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3316489,"FECHA_SACRIF":"2020-10-29","FECHA_PRODUCT":"2020-10-30","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3316494,"FECHA_SACRIF":"2020-10-30","FECHA_PRODUCT":"2020-10-31","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3316496,"FECHA_SACRIF":"2020-10-30","FECHA_PRODUCT":"2020-10-30","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3316678,"FECHA_SACRIF":"2020-10-29","FECHA_PRODUCT":"2020-10-30","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3316680,"FECHA_SACRIF":"2020-10-30","FECHA_PRODUCT":"2020-10-30","COD_ARTICULO":"284130011","NOM_ARTICULO":"XALA MIXTA PROCESO 2,2 LB USA","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3316710,"FECHA_SACRIF":"2020-10-26","FECHA_PRODUCT":"2020-10-30","COD_ARTICULO":"294025956","NOM_ARTICULO":"XPECHUGA SHP IQF 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3317035,"FECHA_SACRIF":"2020-10-30","FECHA_PRODUCT":"2020-11-02","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3317047,"FECHA_SACRIF":"2020-10-30","FECHA_PRODUCT":"2020-11-02","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3317052,"FECHA_SACRIF":"2020-11-02","FECHA_PRODUCT":"","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3317054,"FECHA_SACRIF":"2020-11-02","FECHA_PRODUCT":"2020-11-02","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3317058,"FECHA_SACRIF":"2020-10-29","FECHA_PRODUCT":"2020-11-02","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3317059,"FECHA_SACRIF":"2020-10-29","FECHA_PRODUCT":"2020-11-02","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3317060,"FECHA_SACRIF":"2020-10-28","FECHA_PRODUCT":"","COD_ARTICULO":"583321929","NOM_ARTICULO":"BISTEC DE PAVO 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3317061,"FECHA_SACRIF":"2020-10-29","FECHA_PRODUCT":"2020-11-02","COD_ARTICULO":"305821928","NOM_ARTICULO":"FILETILLO DE POLLO CDG 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3317062,"FECHA_SACRIF":"2020-10-29","FECHA_PRODUCT":"2020-11-02","COD_ARTICULO":"305921925","NOM_ARTICULO":"PECHUGA DE POLLO S/HP CDG 750G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3317067,"FECHA_SACRIF":"2020-10-30","FECHA_PRODUCT":"2020-11-02","COD_ARTICULO":"244720900","NOM_ARTICULO":"XALA TR. POLLO MEXICO IQF 10 K","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3317068,"FECHA_SACRIF":"2020-10-29","FECHA_PRODUCT":"2020-11-02","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3317073,"FECHA_SACRIF":"2020-10-29","FECHA_PRODUCT":"2020-11-02","COD_ARTICULO":"284120753","NOM_ARTICULO":"XALAS MIXTA POLLO IQF 2,2 lb","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3317254,"FECHA_SACRIF":"2020-10-28","FECHA_PRODUCT":"2020-11-02","COD_ARTICULO":"284925952","NOM_ARTICULO":"XALA MIXTA POLLO 10 LB FIRST S","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3317255,"FECHA_SACRIF":"2020-10-29","FECHA_PRODUCT":"2020-11-02","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3317256,"FECHA_SACRIF":"2020-10-30","FECHA_PRODUCT":"2020-11-02","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3317485,"FECHA_SACRIF":"2020-10-29","FECHA_PRODUCT":"2020-11-03","COD_ARTICULO":"576023021","NOM_ARTICULO":"BISTEC TRUTRO PAVO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3317486,"FECHA_SACRIF":"2020-10-29","FECHA_PRODUCT":"2020-11-03","COD_ARTICULO":"576123028","NOM_ARTICULO":"FILETE PECH PAVO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3317487,"FECHA_SACRIF":"2020-10-29","FECHA_PRODUCT":"2020-11-03","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3317489,"FECHA_SACRIF":"2020-10-30","FECHA_PRODUCT":"2020-11-03","COD_ARTICULO":"284120753","NOM_ARTICULO":"XALAS MIXTA POLLO IQF 2,2 lb","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3317490,"FECHA_SACRIF":"2020-10-30","FECHA_PRODUCT":"2020-11-03","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3317491,"FECHA_SACRIF":"2020-11-02","FECHA_PRODUCT":"2020-11-03","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3317492,"FECHA_SACRIF":"2020-10-30","FECHA_PRODUCT":"2020-11-03","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3317493,"FECHA_SACRIF":"2020-11-02","FECHA_PRODUCT":"2020-11-03","COD_ARTICULO":"244720900","NOM_ARTICULO":"XALA TR. POLLO MEXICO IQF 10 K","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3317495,"FECHA_SACRIF":"2020-11-02","FECHA_PRODUCT":"2020-11-03","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3317559,"FECHA_SACRIF":"2020-11-02","FECHA_PRODUCT":"2020-11-03","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3317572,"FECHA_SACRIF":"2020-11-02","FECHA_PRODUCT":"2020-11-03","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3317577,"FECHA_SACRIF":"2020-11-03","FECHA_PRODUCT":"","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3317579,"FECHA_SACRIF":"2020-11-03","FECHA_PRODUCT":"2020-11-03","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3317746,"FECHA_SACRIF":"2020-11-02","FECHA_PRODUCT":"","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3317965,"FECHA_SACRIF":"2020-10-30","FECHA_PRODUCT":"2020-11-03","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3318050,"FECHA_SACRIF":"2020-11-03","FECHA_PRODUCT":"2020-11-04","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3318062,"FECHA_SACRIF":"2020-11-03","FECHA_PRODUCT":"2020-11-04","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3318066,"FECHA_SACRIF":"2020-11-04","FECHA_PRODUCT":"","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3318068,"FECHA_SACRIF":"2020-11-04","FECHA_PRODUCT":"2020-11-04","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3318072,"FECHA_SACRIF":"2020-10-30","FECHA_PRODUCT":"2020-11-04","COD_ARTICULO":"583421926","NOM_ARTICULO":"FILETE DE PAVO 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3318073,"FECHA_SACRIF":"2020-10-30","FECHA_PRODUCT":"2020-11-04","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3318075,"FECHA_SACRIF":"2020-11-02","FECHA_PRODUCT":"2020-11-04","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3318077,"FECHA_SACRIF":"2020-10-30","FECHA_PRODUCT":"2020-11-04","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3318078,"FECHA_SACRIF":"2020-11-03","FECHA_PRODUCT":"2020-11-04","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3318079,"FECHA_SACRIF":"2020-11-03","FECHA_PRODUCT":"2020-11-04","COD_ARTICULO":"284925952","NOM_ARTICULO":"XALA MIXTA POLLO 10 LB FIRST S","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3318081,"FECHA_SACRIF":"2020-11-03","FECHA_PRODUCT":"2020-11-04","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3318264,"FECHA_SACRIF":"2020-10-30","FECHA_PRODUCT":"2020-11-04","COD_ARTICULO":"583321929","NOM_ARTICULO":"BISTEC DE PAVO 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3318265,"FECHA_SACRIF":"2020-11-03","FECHA_PRODUCT":"","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3318280,"FECHA_SACRIF":"2020-11-02","FECHA_PRODUCT":"2020-11-04","COD_ARTICULO":"287120750","NOM_ARTICULO":"XALA MEDIA POLLO IQF 2,2 lb","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3318281,"FECHA_SACRIF":"2020-11-03","FECHA_PRODUCT":"2020-11-04","COD_ARTICULO":"209723021","NOM_ARTICULO":"PECHUGA POLLO SHP CUISINE & CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3318282,"FECHA_SACRIF":"2020-11-03","FECHA_PRODUCT":"2020-11-04","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3318528,"FECHA_SACRIF":"2020-11-03","FECHA_PRODUCT":"2020-11-04","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3318554,"FECHA_SACRIF":"2020-11-03","FECHA_PRODUCT":"2020-11-05","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3318556,"FECHA_SACRIF":"2020-11-03","FECHA_PRODUCT":"2020-11-05","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3318557,"FECHA_SACRIF":"2020-11-03","FECHA_PRODUCT":"2020-11-05","COD_ARTICULO":"229223020","NOM_ARTICULO":"TRUTRO CORTO POLLO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3318558,"FECHA_SACRIF":"2020-11-03","FECHA_PRODUCT":"2020-11-05","COD_ARTICULO":"209723021","NOM_ARTICULO":"PECHUGA POLLO SHP CUISINE & CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3318559,"FECHA_SACRIF":"2020-11-03","FECHA_PRODUCT":"2020-11-05","COD_ARTICULO":"224623023","NOM_ARTICULO":"FILETILLO POLLO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3318560,"FECHA_SACRIF":"2020-11-04","FECHA_PRODUCT":"2020-11-05","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3318561,"FECHA_SACRIF":"2020-11-04","FECHA_PRODUCT":"2020-11-05","COD_ARTICULO":"244720900","NOM_ARTICULO":"XALA TR. POLLO MEXICO IQF 10 K","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3318562,"FECHA_SACRIF":"2020-11-04","FECHA_PRODUCT":"2020-11-05","COD_ARTICULO":"202721871","NOM_ARTICULO":"TRUTRO CORTO POLLO  IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3318564,"FECHA_SACRIF":"2020-11-02","FECHA_PRODUCT":"2020-11-05","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3318624,"FECHA_SACRIF":"2020-11-04","FECHA_PRODUCT":"2020-11-05","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3318634,"FECHA_SACRIF":"2020-11-04","FECHA_PRODUCT":"2020-11-05","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3318638,"FECHA_SACRIF":"2020-11-05","FECHA_PRODUCT":"","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3318640,"FECHA_SACRIF":"2020-11-05","FECHA_PRODUCT":"2020-11-05","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3318820,"FECHA_SACRIF":"2020-11-04","FECHA_PRODUCT":"2020-11-05","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3318850,"FECHA_SACRIF":"2020-11-03","FECHA_PRODUCT":"2020-11-05","COD_ARTICULO":"576023021","NOM_ARTICULO":"BISTEC TRUTRO PAVO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3318851,"FECHA_SACRIF":"2020-11-03","FECHA_PRODUCT":"2020-11-05","COD_ARTICULO":"576123028","NOM_ARTICULO":"FILETE PECH PAVO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3319109,"FECHA_SACRIF":"2020-11-04","FECHA_PRODUCT":"2020-11-06","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3319110,"FECHA_SACRIF":"2020-11-04","FECHA_PRODUCT":"2020-11-06","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3319111,"FECHA_SACRIF":"2020-11-05","FECHA_PRODUCT":"2020-11-06","COD_ARTICULO":"305921925","NOM_ARTICULO":"PECHUGA DE POLLO S/HP CDG 750G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3319113,"FECHA_SACRIF":"2020-11-05","FECHA_PRODUCT":"2020-11-06","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3319117,"FECHA_SACRIF":"2020-11-05","FECHA_PRODUCT":"2020-11-06","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3319119,"FECHA_SACRIF":"2020-11-05","FECHA_PRODUCT":"2020-11-06","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3319120,"FECHA_SACRIF":"2020-11-05","FECHA_PRODUCT":"2020-11-06","COD_ARTICULO":"202721871","NOM_ARTICULO":"TRUTRO CORTO POLLO  IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3319121,"FECHA_SACRIF":"2020-11-05","FECHA_PRODUCT":"2020-11-06","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3319123,"FECHA_SACRIF":"2020-11-05","FECHA_PRODUCT":"2020-11-06","COD_ARTICULO":"244720900","NOM_ARTICULO":"XALA TR. POLLO MEXICO IQF 10 K","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3319183,"FECHA_SACRIF":"2020-11-05","FECHA_PRODUCT":"2020-11-06","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3319193,"FECHA_SACRIF":"2020-11-05","FECHA_PRODUCT":"2020-11-06","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3319199,"FECHA_SACRIF":"2020-11-06","FECHA_PRODUCT":"2020-11-06","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3319374,"FECHA_SACRIF":"2020-11-05","FECHA_PRODUCT":"2020-11-06","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3319402,"FECHA_SACRIF":"2020-10-28","FECHA_PRODUCT":"2020-11-06","COD_ARTICULO":"583321929","NOM_ARTICULO":"BISTEC DE PAVO 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3319662,"FECHA_SACRIF":"2020-11-05","FECHA_PRODUCT":"2020-11-07","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3319663,"FECHA_SACRIF":"2020-11-06","FECHA_PRODUCT":"2020-11-07","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3319664,"FECHA_SACRIF":"2020-11-04","FECHA_PRODUCT":"2020-11-07","COD_ARTICULO":"576023021","NOM_ARTICULO":"BISTEC TRUTRO PAVO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3319665,"FECHA_SACRIF":"2020-11-06","FECHA_PRODUCT":"2020-11-07","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3319666,"FECHA_SACRIF":"2020-11-04","FECHA_PRODUCT":"2020-11-07","COD_ARTICULO":"576123028","NOM_ARTICULO":"FILETE PECH PAVO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3319668,"FECHA_SACRIF":"2020-11-06","FECHA_PRODUCT":"2020-11-07","COD_ARTICULO":"244720900","NOM_ARTICULO":"XALA TR. POLLO MEXICO IQF 10 K","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3319669,"FECHA_SACRIF":"2020-11-06","FECHA_PRODUCT":"2020-11-07","COD_ARTICULO":"202721871","NOM_ARTICULO":"TRUTRO CORTO POLLO  IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3319671,"FECHA_SACRIF":"2020-11-06","FECHA_PRODUCT":"2020-11-07","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3319672,"FECHA_SACRIF":"2020-11-06","FECHA_PRODUCT":"2020-11-07","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3319718,"FECHA_SACRIF":"2020-11-06","FECHA_PRODUCT":"2020-11-07","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3319728,"FECHA_SACRIF":"2020-11-06","FECHA_PRODUCT":"2020-11-07","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3319732,"FECHA_SACRIF":"2020-11-07","FECHA_PRODUCT":"2020-11-09","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3319734,"FECHA_SACRIF":"2020-11-07","FECHA_PRODUCT":"2020-11-07","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3319911,"FECHA_SACRIF":"2020-11-06","FECHA_PRODUCT":"2020-11-07","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3319996,"FECHA_SACRIF":"2020-11-05","FECHA_PRODUCT":"2020-11-07","COD_ARTICULO":"583321929","NOM_ARTICULO":"BISTEC DE PAVO 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3320192,"FECHA_SACRIF":"2020-11-07","FECHA_PRODUCT":"2020-11-09","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3320194,"FECHA_SACRIF":"2020-11-06","FECHA_PRODUCT":"2020-11-09","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3320195,"FECHA_SACRIF":"2020-11-07","FECHA_PRODUCT":"2020-11-09","COD_ARTICULO":"244720900","NOM_ARTICULO":"XALA TR. POLLO MEXICO IQF 10 K","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3320196,"FECHA_SACRIF":"2020-11-07","FECHA_PRODUCT":"2020-11-09","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3320197,"FECHA_SACRIF":"2020-11-07","FECHA_PRODUCT":"2020-11-09","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3320354,"FECHA_SACRIF":"2020-11-07","FECHA_PRODUCT":"2020-11-09","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3320367,"FECHA_SACRIF":"2020-11-07","FECHA_PRODUCT":"2020-11-09","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3320371,"FECHA_SACRIF":"2020-11-06","FECHA_PRODUCT":"2020-11-09","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3320373,"FECHA_SACRIF":"2020-11-09","FECHA_PRODUCT":"2020-11-09","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3320480,"FECHA_SACRIF":"2020-11-07","FECHA_PRODUCT":"2020-11-09","COD_ARTICULO":"202721871","NOM_ARTICULO":"TRUTRO CORTO POLLO  IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3320482,"FECHA_SACRIF":"2020-11-06","FECHA_PRODUCT":"2020-11-09","COD_ARTICULO":"583321929","NOM_ARTICULO":"BISTEC DE PAVO 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3320485,"FECHA_SACRIF":"2020-11-07","FECHA_PRODUCT":"2020-11-09","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3320808,"FECHA_SACRIF":"2020-11-09","FECHA_PRODUCT":"2020-11-10","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3320819,"FECHA_SACRIF":"2020-11-09","FECHA_PRODUCT":"2020-11-10","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3320823,"FECHA_SACRIF":"2020-11-10","FECHA_PRODUCT":"2020-11-11","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3320825,"FECHA_SACRIF":"2020-11-10","FECHA_PRODUCT":"2020-11-10","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3320830,"FECHA_SACRIF":"2020-11-09","FECHA_PRODUCT":"2020-11-10","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3320831,"FECHA_SACRIF":"2020-11-09","FECHA_PRODUCT":"2020-11-10","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3320832,"FECHA_SACRIF":"2020-11-09","FECHA_PRODUCT":"2020-11-10","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3320834,"FECHA_SACRIF":"2020-11-09","FECHA_PRODUCT":"2020-11-10","COD_ARTICULO":"244720900","NOM_ARTICULO":"XALA TR. POLLO MEXICO IQF 10 K","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3320835,"FECHA_SACRIF":"2020-11-09","FECHA_PRODUCT":"2020-11-10","COD_ARTICULO":"202721871","NOM_ARTICULO":"TRUTRO CORTO POLLO  IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3320993,"FECHA_SACRIF":"2020-11-09","FECHA_PRODUCT":"2020-11-10","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3320995,"FECHA_SACRIF":"2020-11-07","FECHA_PRODUCT":"2020-11-10","COD_ARTICULO":"583321929","NOM_ARTICULO":"BISTEC DE PAVO 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3321247,"FECHA_SACRIF":"2020-11-10","FECHA_PRODUCT":"2020-11-10","COD_ARTICULO":"244720900","NOM_ARTICULO":"XALA TR. POLLO MEXICO IQF 10 K","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3321248,"FECHA_SACRIF":"2020-11-10","FECHA_PRODUCT":"2020-11-10","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3321329,"FECHA_SACRIF":"2020-11-10","FECHA_PRODUCT":"2020-11-11","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3321340,"FECHA_SACRIF":"2020-11-10","FECHA_PRODUCT":"2020-11-11","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3321344,"FECHA_SACRIF":"2020-11-09","FECHA_PRODUCT":"2020-11-11","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3321346,"FECHA_SACRIF":"2020-11-11","FECHA_PRODUCT":"2020-11-11","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3321429,"FECHA_SACRIF":"2020-11-10","FECHA_PRODUCT":"2020-11-11","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3321431,"FECHA_SACRIF":"2020-11-10","FECHA_PRODUCT":"2020-11-11","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3321433,"FECHA_SACRIF":"2020-11-10","FECHA_PRODUCT":"2020-11-11","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3321434,"FECHA_SACRIF":"2020-11-10","FECHA_PRODUCT":"2020-11-11","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3321436,"FECHA_SACRIF":"2020-11-09","FECHA_PRODUCT":"2020-11-11","COD_ARTICULO":"202721871","NOM_ARTICULO":"TRUTRO CORTO POLLO  IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3321520,"FECHA_SACRIF":"2020-11-09","FECHA_PRODUCT":"2020-11-11","COD_ARTICULO":"583321929","NOM_ARTICULO":"BISTEC DE PAVO 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3321540,"FECHA_SACRIF":"2020-11-10","FECHA_PRODUCT":"2020-11-11","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3321578,"FECHA_SACRIF":"2020-11-11","FECHA_PRODUCT":"2020-11-11","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3321860,"FECHA_SACRIF":"2020-11-11","FECHA_PRODUCT":"2020-11-12","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3321870,"FECHA_SACRIF":"2020-11-11","FECHA_PRODUCT":"2020-11-12","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3321874,"FECHA_SACRIF":"2020-11-11","FECHA_PRODUCT":"2020-11-13","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3321876,"FECHA_SACRIF":"2020-11-12","FECHA_PRODUCT":"2020-11-12","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3321877,"FECHA_SACRIF":"2020-11-10","FECHA_PRODUCT":"2020-11-12","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3321879,"FECHA_SACRIF":"2020-11-11","FECHA_PRODUCT":"2020-11-12","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3321881,"FECHA_SACRIF":"2020-11-11","FECHA_PRODUCT":"2020-11-12","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3321884,"FECHA_SACRIF":"2020-11-11","FECHA_PRODUCT":"2020-11-12","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3321885,"FECHA_SACRIF":"2020-11-11","FECHA_PRODUCT":"2020-11-12","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3322319,"FECHA_SACRIF":"2020-11-12","FECHA_PRODUCT":"2020-11-12","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3322323,"FECHA_SACRIF":"2020-11-12","FECHA_PRODUCT":"2020-11-12","COD_ARTICULO":"202721871","NOM_ARTICULO":"TRUTRO CORTO POLLO  IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3322325,"FECHA_SACRIF":"2020-11-11","FECHA_PRODUCT":"2020-11-13","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3322327,"FECHA_SACRIF":"2020-11-11","FECHA_PRODUCT":"2020-11-13","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3322328,"FECHA_SACRIF":"2020-11-10","FECHA_PRODUCT":"2020-11-13","COD_ARTICULO":"583321929","NOM_ARTICULO":"BISTEC DE PAVO 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3322331,"FECHA_SACRIF":"2020-11-12","FECHA_PRODUCT":"2020-11-13","COD_ARTICULO":"244720900","NOM_ARTICULO":"XALA TR. POLLO MEXICO IQF 10 K","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3322332,"FECHA_SACRIF":"2020-11-12","FECHA_PRODUCT":"2020-11-13","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3322333,"FECHA_SACRIF":"2020-11-12","FECHA_PRODUCT":"2020-11-13","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3322387,"FECHA_SACRIF":"2020-11-12","FECHA_PRODUCT":"2020-11-13","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3322396,"FECHA_SACRIF":"2020-11-12","FECHA_PRODUCT":"2020-11-13","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3322402,"FECHA_SACRIF":"2020-11-13","FECHA_PRODUCT":"2020-11-13","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3322599,"FECHA_SACRIF":"2020-11-11","FECHA_PRODUCT":"2020-11-13","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3322765,"FECHA_SACRIF":"2020-11-13","FECHA_PRODUCT":"2020-11-13","COD_ARTICULO":"244720900","NOM_ARTICULO":"XALA TR. POLLO MEXICO IQF 10 K","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3322771,"FECHA_SACRIF":"2020-11-12","FECHA_PRODUCT":"2020-11-14","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3322772,"FECHA_SACRIF":"2020-11-11","FECHA_PRODUCT":"2020-11-14","COD_ARTICULO":"583421926","NOM_ARTICULO":"FILETE DE PAVO 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3322773,"FECHA_SACRIF":"2020-11-11","FECHA_PRODUCT":"2020-11-14","COD_ARTICULO":"576023021","NOM_ARTICULO":"BISTEC TRUTRO PAVO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3322774,"FECHA_SACRIF":"2020-11-11","FECHA_PRODUCT":"2020-11-14","COD_ARTICULO":"576123028","NOM_ARTICULO":"FILETE PECH PAVO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3322775,"FECHA_SACRIF":"2020-11-12","FECHA_PRODUCT":"2020-11-14","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3322776,"FECHA_SACRIF":"2020-11-12","FECHA_PRODUCT":"2020-11-14","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3322778,"FECHA_SACRIF":"2020-11-13","FECHA_PRODUCT":"2020-11-14","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3322779,"FECHA_SACRIF":"2020-11-13","FECHA_PRODUCT":"2020-11-14","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3322781,"FECHA_SACRIF":"2020-11-13","FECHA_PRODUCT":"2020-11-14","COD_ARTICULO":"202721871","NOM_ARTICULO":"TRUTRO CORTO POLLO  IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3322843,"FECHA_SACRIF":"2020-11-13","FECHA_PRODUCT":"2020-11-14","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3322852,"FECHA_SACRIF":"2020-11-13","FECHA_PRODUCT":"2020-11-14","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3322856,"FECHA_SACRIF":"2020-11-14","FECHA_PRODUCT":"2020-11-14","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3322858,"FECHA_SACRIF":"2020-11-14","FECHA_PRODUCT":"2020-11-14","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3323337,"FECHA_SACRIF":"2020-11-12","FECHA_PRODUCT":"2020-11-16","COD_ARTICULO":"576023021","NOM_ARTICULO":"BISTEC TRUTRO PAVO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3323338,"FECHA_SACRIF":"2020-11-12","FECHA_PRODUCT":"2020-11-16","COD_ARTICULO":"576123028","NOM_ARTICULO":"FILETE PECH PAVO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3323339,"FECHA_SACRIF":"2020-11-13","FECHA_PRODUCT":"2020-11-16","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3323340,"FECHA_SACRIF":"2020-11-13","FECHA_PRODUCT":"2020-11-16","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3323341,"FECHA_SACRIF":"2020-11-13","FECHA_PRODUCT":"2020-11-16","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3323344,"FECHA_SACRIF":"2020-11-14","FECHA_PRODUCT":"2020-11-16","COD_ARTICULO":"244720900","NOM_ARTICULO":"XALA TR. POLLO MEXICO IQF 10 K","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3323346,"FECHA_SACRIF":"2020-11-14","FECHA_PRODUCT":"2020-11-16","COD_ARTICULO":"202721871","NOM_ARTICULO":"TRUTRO CORTO POLLO  IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3323385,"FECHA_SACRIF":"2020-11-14","FECHA_PRODUCT":"2020-11-16","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3323396,"FECHA_SACRIF":"2020-11-14","FECHA_PRODUCT":"2020-11-16","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3323400,"FECHA_SACRIF":"2020-11-16","FECHA_PRODUCT":"2020-11-16","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3323402,"FECHA_SACRIF":"2020-11-16","FECHA_PRODUCT":"2020-11-16","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3323605,"FECHA_SACRIF":"2020-11-16","FECHA_PRODUCT":"2020-11-16","COD_ARTICULO":"244720900","NOM_ARTICULO":"XALA TR. POLLO MEXICO IQF 10 K","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3323851,"FECHA_SACRIF":"2020-11-16","FECHA_PRODUCT":"2020-11-17","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3323861,"FECHA_SACRIF":"2020-11-16","FECHA_PRODUCT":"2020-11-17","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3323865,"FECHA_SACRIF":"2020-11-17","FECHA_PRODUCT":"","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3323867,"FECHA_SACRIF":"2020-11-17","FECHA_PRODUCT":"2020-11-17","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3323934,"FECHA_SACRIF":"2020-11-13","FECHA_PRODUCT":"2020-11-17","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3323935,"FECHA_SACRIF":"2020-11-16","FECHA_PRODUCT":"2020-11-17","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3323936,"FECHA_SACRIF":"2020-11-14","FECHA_PRODUCT":"2020-11-17","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3323937,"FECHA_SACRIF":"2020-11-16","FECHA_PRODUCT":"","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3323938,"FECHA_SACRIF":"2020-11-16","FECHA_PRODUCT":"2020-11-17","COD_ARTICULO":"202721871","NOM_ARTICULO":"TRUTRO CORTO POLLO  IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3324104,"FECHA_SACRIF":"2020-11-16","FECHA_PRODUCT":"2020-11-17","COD_ARTICULO":"244720900","NOM_ARTICULO":"XALA TR. POLLO MEXICO IQF 10 K","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3324107,"FECHA_SACRIF":"2020-11-14","FECHA_PRODUCT":"2020-11-17","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3324411,"FECHA_SACRIF":"2020-11-17","FECHA_PRODUCT":"2020-11-18","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3324421,"FECHA_SACRIF":"2020-11-17","FECHA_PRODUCT":"2020-11-18","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3324425,"FECHA_SACRIF":"2020-11-18","FECHA_PRODUCT":"","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3324427,"FECHA_SACRIF":"2020-11-18","FECHA_PRODUCT":"2020-11-18","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3324431,"FECHA_SACRIF":"2020-11-14","FECHA_PRODUCT":"2020-11-18","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3324432,"FECHA_SACRIF":"2020-11-14","FECHA_PRODUCT":"2020-11-18","COD_ARTICULO":"583321929","NOM_ARTICULO":"BISTEC DE PAVO 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3324433,"FECHA_SACRIF":"2020-11-16","FECHA_PRODUCT":"2020-11-18","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3324434,"FECHA_SACRIF":"2020-11-17","FECHA_PRODUCT":"2020-11-18","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3324435,"FECHA_SACRIF":"2020-11-17","FECHA_PRODUCT":"2020-11-18","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3324436,"FECHA_SACRIF":"2020-11-17","FECHA_PRODUCT":"2020-11-18","COD_ARTICULO":"244720900","NOM_ARTICULO":"XALA TR. POLLO MEXICO IQF 10 K","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3324806,"FECHA_SACRIF":"2020-11-17","FECHA_PRODUCT":"2020-11-18","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3324858,"FECHA_SACRIF":"2020-11-18","FECHA_PRODUCT":"2020-11-18","COD_ARTICULO":"202721871","NOM_ARTICULO":"TRUTRO CORTO POLLO  IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3324900,"FECHA_SACRIF":"2020-11-17","FECHA_PRODUCT":"2020-11-19","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3324901,"FECHA_SACRIF":"2020-11-18","FECHA_PRODUCT":"2020-11-19","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3324902,"FECHA_SACRIF":"2020-11-18","FECHA_PRODUCT":"2020-11-19","COD_ARTICULO":"283820753","NOM_ARTICULO":"XFILETILLO DE POLLO IQF 2,2 lb","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3324903,"FECHA_SACRIF":"2020-11-18","FECHA_PRODUCT":"2020-11-19","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3324904,"FECHA_SACRIF":"2020-11-18","FECHA_PRODUCT":"2020-11-19","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3324905,"FECHA_SACRIF":"2020-11-18","FECHA_PRODUCT":"2020-11-19","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3324906,"FECHA_SACRIF":"2020-11-18","FECHA_PRODUCT":"2020-11-19","COD_ARTICULO":"244720900","NOM_ARTICULO":"XALA TR. POLLO MEXICO IQF 10 K","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3324908,"FECHA_SACRIF":"2020-11-18","FECHA_PRODUCT":"2020-11-19","COD_ARTICULO":"294025956","NOM_ARTICULO":"XPECHUGA SHP IQF 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3324970,"FECHA_SACRIF":"2020-11-18","FECHA_PRODUCT":"2020-11-19","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3324979,"FECHA_SACRIF":"2020-11-18","FECHA_PRODUCT":"2020-11-19","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3324983,"FECHA_SACRIF":"2020-11-19","FECHA_PRODUCT":"","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3324985,"FECHA_SACRIF":"2020-11-19","FECHA_PRODUCT":"2020-11-19","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3325287,"FECHA_SACRIF":"2020-11-19","FECHA_PRODUCT":"2020-11-19","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3325549,"FECHA_SACRIF":"2020-11-19","FECHA_PRODUCT":"2020-11-20","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3325560,"FECHA_SACRIF":"2020-11-19","FECHA_PRODUCT":"2020-11-20","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3325564,"FECHA_SACRIF":"2020-11-20","FECHA_PRODUCT":"","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3325566,"FECHA_SACRIF":"2020-11-20","FECHA_PRODUCT":"2020-11-20","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3325571,"FECHA_SACRIF":"2020-11-19","FECHA_PRODUCT":"2020-11-20","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3325572,"FECHA_SACRIF":"2020-11-19","FECHA_PRODUCT":"2020-11-20","COD_ARTICULO":"305821928","NOM_ARTICULO":"FILETILLO DE POLLO CDG 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3325573,"FECHA_SACRIF":"2020-11-19","FECHA_PRODUCT":"2020-11-20","COD_ARTICULO":"224623023","NOM_ARTICULO":"FILETILLO POLLO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3325574,"FECHA_SACRIF":"2020-11-19","FECHA_PRODUCT":"2020-11-20","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3325575,"FECHA_SACRIF":"2020-11-19","FECHA_PRODUCT":"2020-11-20","COD_ARTICULO":"284925952","NOM_ARTICULO":"XALA MIXTA POLLO 10 LB FIRST S","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3325576,"FECHA_SACRIF":"2020-11-19","FECHA_PRODUCT":"2020-11-20","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3325577,"FECHA_SACRIF":"2020-11-19","FECHA_PRODUCT":"2020-11-20","COD_ARTICULO":"294025956","NOM_ARTICULO":"XPECHUGA SHP IQF 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3326043,"FECHA_SACRIF":"2020-11-19","FECHA_PRODUCT":"2020-11-20","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3326045,"FECHA_SACRIF":"2020-11-19","FECHA_PRODUCT":"2020-11-20","COD_ARTICULO":"576123028","NOM_ARTICULO":"FILETE PECH PAVO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3326051,"FECHA_SACRIF":"2020-11-20","FECHA_PRODUCT":"2020-11-21","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3326052,"FECHA_SACRIF":"2020-11-20","FECHA_PRODUCT":"2020-11-21","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3326054,"FECHA_SACRIF":"2020-11-20","FECHA_PRODUCT":"2020-11-21","COD_ARTICULO":"244720900","NOM_ARTICULO":"XALA TR. POLLO MEXICO IQF 10 K","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3326055,"FECHA_SACRIF":"2020-11-20","FECHA_PRODUCT":"2020-11-21","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3326148,"FECHA_SACRIF":"2020-11-20","FECHA_PRODUCT":"2020-11-21","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3326158,"FECHA_SACRIF":"2020-11-20","FECHA_PRODUCT":"2020-11-21","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3326164,"FECHA_SACRIF":"2020-11-21","FECHA_PRODUCT":"2020-11-21","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3326330,"FECHA_SACRIF":"2020-11-20","FECHA_PRODUCT":"2020-11-21","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3326333,"FECHA_SACRIF":"2020-11-17","FECHA_PRODUCT":"2020-11-21","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3326410,"FECHA_SACRIF":"2020-11-19","FECHA_PRODUCT":"2020-11-21","COD_ARTICULO":"202721871","NOM_ARTICULO":"TRUTRO CORTO POLLO  IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3326646,"FECHA_SACRIF":"2020-11-20","FECHA_PRODUCT":"2020-11-21","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3326662,"FECHA_SACRIF":"2020-11-23","FECHA_PRODUCT":"2020-11-23","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3326663,"FECHA_SACRIF":"2020-11-20","FECHA_PRODUCT":"2020-11-23","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3326664,"FECHA_SACRIF":"2020-11-19","FECHA_PRODUCT":"2020-11-23","COD_ARTICULO":"576023021","NOM_ARTICULO":"BISTEC TRUTRO PAVO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3326665,"FECHA_SACRIF":"2020-11-19","FECHA_PRODUCT":"2020-11-23","COD_ARTICULO":"576123028","NOM_ARTICULO":"FILETE PECH PAVO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3326666,"FECHA_SACRIF":"2020-11-21","FECHA_PRODUCT":"2020-11-23","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3326670,"FECHA_SACRIF":"2020-11-23","FECHA_PRODUCT":"2020-11-23","COD_ARTICULO":"202621874","NOM_ARTICULO":"ALA TRUTRO POLLO IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3326671,"FECHA_SACRIF":"2020-11-20","FECHA_PRODUCT":"2020-11-23","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3326672,"FECHA_SACRIF":"2020-11-20","FECHA_PRODUCT":"2020-11-23","COD_ARTICULO":"294025956","NOM_ARTICULO":"XPECHUGA SHP IQF 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3326702,"FECHA_SACRIF":"2020-11-23","FECHA_PRODUCT":"2020-11-23","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3326847,"FECHA_SACRIF":"2020-11-21","FECHA_PRODUCT":"2020-11-23","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3326858,"FECHA_SACRIF":"2020-11-21","FECHA_PRODUCT":"2020-11-23","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3326864,"FECHA_SACRIF":"2020-11-23","FECHA_PRODUCT":"2020-11-23","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3327191,"FECHA_SACRIF":"2020-11-21","FECHA_PRODUCT":"2020-11-23","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3327233,"FECHA_SACRIF":"2020-11-19","FECHA_PRODUCT":"2020-11-25","COD_ARTICULO":"583421926","NOM_ARTICULO":"FILETE DE PAVO 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3327317,"FECHA_SACRIF":"2020-11-23","FECHA_PRODUCT":"2020-11-24","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3327328,"FECHA_SACRIF":"2020-11-23","FECHA_PRODUCT":"2020-11-24","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3327332,"FECHA_SACRIF":"2020-11-24","FECHA_PRODUCT":"2020-11-25","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3327334,"FECHA_SACRIF":"2020-11-24","FECHA_PRODUCT":"2020-11-24","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3327364,"FECHA_SACRIF":"2020-11-23","FECHA_PRODUCT":"2020-11-24","COD_ARTICULO":"287120750","NOM_ARTICULO":"XALA MEDIA POLLO IQF 2,2 lb","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3327365,"FECHA_SACRIF":"2020-11-23","FECHA_PRODUCT":"2020-11-24","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3327366,"FECHA_SACRIF":"2020-11-23","FECHA_PRODUCT":"2020-11-24","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3327367,"FECHA_SACRIF":"2020-11-20","FECHA_PRODUCT":"2020-11-24","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3327369,"FECHA_SACRIF":"2020-11-21","FECHA_PRODUCT":"2020-11-24","COD_ARTICULO":"244720900","NOM_ARTICULO":"XALA TR. POLLO MEXICO IQF 10 K","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3327371,"FECHA_SACRIF":"2020-11-20","FECHA_PRODUCT":"2020-11-24","COD_ARTICULO":"202721871","NOM_ARTICULO":"TRUTRO CORTO POLLO  IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3327373,"FECHA_SACRIF":"2020-11-23","FECHA_PRODUCT":"2020-11-24","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3327519,"FECHA_SACRIF":"2020-11-21","FECHA_PRODUCT":"2020-11-24","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3327522,"FECHA_SACRIF":"2020-11-17","FECHA_PRODUCT":"","COD_ARTICULO":"583321929","NOM_ARTICULO":"BISTEC DE PAVO 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3327576,"FECHA_SACRIF":"2020-11-20","FECHA_PRODUCT":"2020-11-24","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3327695,"FECHA_SACRIF":"2020-11-24","FECHA_PRODUCT":"2020-11-24","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3327866,"FECHA_SACRIF":"2020-11-24","FECHA_PRODUCT":"2020-11-25","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3327879,"FECHA_SACRIF":"2020-11-24","FECHA_PRODUCT":"2020-11-25","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3327885,"FECHA_SACRIF":"2020-11-25","FECHA_PRODUCT":"2020-11-25","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3327891,"FECHA_SACRIF":"2020-11-24","FECHA_PRODUCT":"2020-11-25","COD_ARTICULO":"287120750","NOM_ARTICULO":"XALA MEDIA POLLO IQF 2,2 lb","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3327892,"FECHA_SACRIF":"2020-11-24","FECHA_PRODUCT":"2020-11-25","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3327893,"FECHA_SACRIF":"2020-11-24","FECHA_PRODUCT":"2020-11-25","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3327894,"FECHA_SACRIF":"2020-11-24","FECHA_PRODUCT":"2020-11-25","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3327895,"FECHA_SACRIF":"2020-11-23","FECHA_PRODUCT":"2020-11-25","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3327896,"FECHA_SACRIF":"2020-11-23","FECHA_PRODUCT":"2020-11-25","COD_ARTICULO":"244720900","NOM_ARTICULO":"XALA TR. POLLO MEXICO IQF 10 K","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3327897,"FECHA_SACRIF":"2020-11-23","FECHA_PRODUCT":"2020-11-25","COD_ARTICULO":"294025956","NOM_ARTICULO":"XPECHUGA SHP IQF 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3327898,"FECHA_SACRIF":"2020-11-23","FECHA_PRODUCT":"2020-11-25","COD_ARTICULO":"202721871","NOM_ARTICULO":"TRUTRO CORTO POLLO  IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3327899,"FECHA_SACRIF":"2020-11-24","FECHA_PRODUCT":"2020-11-25","COD_ARTICULO":"284925952","NOM_ARTICULO":"XALA MIXTA POLLO 10 LB FIRST S","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3327900,"FECHA_SACRIF":"2020-11-24","FECHA_PRODUCT":"2020-11-25","COD_ARTICULO":"244720900","NOM_ARTICULO":"XALA TR. POLLO MEXICO IQF 10 K","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3328337,"FECHA_SACRIF":"2020-11-19","FECHA_PRODUCT":"","COD_ARTICULO":"583421926","NOM_ARTICULO":"FILETE DE PAVO 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3328350,"FECHA_SACRIF":"2020-11-25","FECHA_PRODUCT":"2020-11-25","COD_ARTICULO":"305821928","NOM_ARTICULO":"FILETILLO DE POLLO CDG 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3328351,"FECHA_SACRIF":"2020-11-25","FECHA_PRODUCT":"2020-11-25","COD_ARTICULO":"305921925","NOM_ARTICULO":"PECHUGA DE POLLO S/HP CDG 750G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3328352,"FECHA_SACRIF":"2020-11-25","FECHA_PRODUCT":"2020-11-26","COD_ARTICULO":"254621907","NOM_ARTICULO":"XFILETILLO POLLO IQF HEB","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3328353,"FECHA_SACRIF":"2020-11-25","FECHA_PRODUCT":"2020-11-26","COD_ARTICULO":"254621907","NOM_ARTICULO":"XFILETILLO POLLO IQF HEB","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3328357,"FECHA_SACRIF":"2020-11-21","FECHA_PRODUCT":"2020-11-25","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3328358,"FECHA_SACRIF":"2020-11-23","FECHA_PRODUCT":"2020-11-25","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3328442,"FECHA_SACRIF":"2020-11-25","FECHA_PRODUCT":"2020-11-26","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3328452,"FECHA_SACRIF":"2020-11-25","FECHA_PRODUCT":"2020-11-26","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3328458,"FECHA_SACRIF":"2020-11-26","FECHA_PRODUCT":"2020-11-26","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3328463,"FECHA_SACRIF":"2020-11-23","FECHA_PRODUCT":"2020-11-26","COD_ARTICULO":"583321929","NOM_ARTICULO":"BISTEC DE PAVO 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3328464,"FECHA_SACRIF":"2020-11-25","FECHA_PRODUCT":"2020-11-26","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3328465,"FECHA_SACRIF":"2020-11-25","FECHA_PRODUCT":"2020-11-26","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3328467,"FECHA_SACRIF":"2020-11-24","FECHA_PRODUCT":"2020-11-26","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3328468,"FECHA_SACRIF":"2020-11-24","FECHA_PRODUCT":"2020-11-26","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3328470,"FECHA_SACRIF":"2020-11-24","FECHA_PRODUCT":"2020-11-26","COD_ARTICULO":"202721871","NOM_ARTICULO":"TRUTRO CORTO POLLO  IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3328471,"FECHA_SACRIF":"2020-11-25","FECHA_PRODUCT":"2020-11-26","COD_ARTICULO":"244720900","NOM_ARTICULO":"XALA TR. POLLO MEXICO IQF 10 K","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3328890,"FECHA_SACRIF":"2020-11-26","FECHA_PRODUCT":"2020-11-26","COD_ARTICULO":"284130011","NOM_ARTICULO":"XALA MIXTA PROCESO 2,2 LB USA","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3328892,"FECHA_SACRIF":"2020-11-27","FECHA_PRODUCT":"2020-11-28","COD_ARTICULO":"284130011","NOM_ARTICULO":"XALA MIXTA PROCESO 2,2 LB USA","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3328975,"FECHA_SACRIF":"2020-11-26","FECHA_PRODUCT":"2020-11-27","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3328987,"FECHA_SACRIF":"2020-11-26","FECHA_PRODUCT":"2020-11-27","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3328993,"FECHA_SACRIF":"2020-11-27","FECHA_PRODUCT":"2020-11-27","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3329086,"FECHA_SACRIF":"2020-11-26","FECHA_PRODUCT":"2020-11-26","COD_ARTICULO":"210825967","NOM_ARTICULO":"TRUTRO CORTO POLLO IQF 1.8KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3329088,"FECHA_SACRIF":"2020-11-26","FECHA_PRODUCT":"2020-11-27","COD_ARTICULO":"284120753","NOM_ARTICULO":"XALAS MIXTA POLLO IQF 2,2 lb","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3329089,"FECHA_SACRIF":"2020-11-26","FECHA_PRODUCT":"2020-11-27","COD_ARTICULO":"254621907","NOM_ARTICULO":"XFILETILLO POLLO IQF HEB","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3329091,"FECHA_SACRIF":"2020-11-26","FECHA_PRODUCT":"2020-11-27","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3329092,"FECHA_SACRIF":"2020-11-26","FECHA_PRODUCT":"2020-11-27","COD_ARTICULO":"244720900","NOM_ARTICULO":"XALA TR. POLLO MEXICO IQF 10 K","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3329093,"FECHA_SACRIF":"2020-11-26","FECHA_PRODUCT":"2020-11-27","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3329094,"FECHA_SACRIF":"2020-11-25","FECHA_PRODUCT":"2020-11-27","COD_ARTICULO":"202721871","NOM_ARTICULO":"TRUTRO CORTO POLLO  IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3329178,"FECHA_SACRIF":"2020-11-26","FECHA_PRODUCT":"2020-11-26","COD_ARTICULO":"211925963","NOM_ARTICULO":"FILETILLO DE POLLO IQF 1.8KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3329179,"FECHA_SACRIF":"2020-11-26","FECHA_PRODUCT":"2020-11-26","COD_ARTICULO":"225225967","NOM_ARTICULO":"PECHUGA POLLO S/HP IQF 1.8KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3329216,"FECHA_SACRIF":"2020-11-26","FECHA_PRODUCT":"2020-11-27","COD_ARTICULO":"294025956","NOM_ARTICULO":"XPECHUGA SHP IQF 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3329469,"FECHA_SACRIF":"2020-11-27","FECHA_PRODUCT":"2020-11-28","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3329470,"FECHA_SACRIF":"2020-11-27","FECHA_PRODUCT":"2020-11-28","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3329471,"FECHA_SACRIF":"2020-11-27","FECHA_PRODUCT":"2020-11-28","COD_ARTICULO":"284120753","NOM_ARTICULO":"XALAS MIXTA POLLO IQF 2,2 lb","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3329472,"FECHA_SACRIF":"2020-11-27","FECHA_PRODUCT":"2020-11-28","COD_ARTICULO":"284120753","NOM_ARTICULO":"XALAS MIXTA POLLO IQF 2,2 lb","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3329473,"FECHA_SACRIF":"2020-11-27","FECHA_PRODUCT":"2020-11-28","COD_ARTICULO":"224623023","NOM_ARTICULO":"FILETILLO POLLO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3329476,"FECHA_SACRIF":"2020-11-27","FECHA_PRODUCT":"2020-11-28","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3329477,"FECHA_SACRIF":"2020-11-27","FECHA_PRODUCT":"2020-11-28","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3329478,"FECHA_SACRIF":"2020-11-27","FECHA_PRODUCT":"2020-11-28","COD_ARTICULO":"202721871","NOM_ARTICULO":"TRUTRO CORTO POLLO  IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3329479,"FECHA_SACRIF":"2020-11-27","FECHA_PRODUCT":"2020-11-28","COD_ARTICULO":"294025956","NOM_ARTICULO":"XPECHUGA SHP IQF 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3329525,"FECHA_SACRIF":"2020-11-27","FECHA_PRODUCT":"2020-11-28","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3329535,"FECHA_SACRIF":"2020-11-27","FECHA_PRODUCT":"2020-11-28","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3329539,"FECHA_SACRIF":"2020-11-26","FECHA_PRODUCT":"2020-11-28","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3329541,"FECHA_SACRIF":"2020-11-28","FECHA_PRODUCT":"2020-11-28","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3330025,"FECHA_SACRIF":"2020-11-25","FECHA_PRODUCT":"2020-11-28","COD_ARTICULO":"583321929","NOM_ARTICULO":"BISTEC DE PAVO 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3330026,"FECHA_SACRIF":"2020-11-26","FECHA_PRODUCT":"2020-11-28","COD_ARTICULO":"254621907","NOM_ARTICULO":"XFILETILLO POLLO IQF HEB","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3330046,"FECHA_SACRIF":"2020-11-27","FECHA_PRODUCT":"2020-11-30","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3330048,"FECHA_SACRIF":"2020-11-28","FECHA_PRODUCT":"2020-11-30","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3330049,"FECHA_SACRIF":"2020-11-26","FECHA_PRODUCT":"2020-11-30","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3330050,"FECHA_SACRIF":"2020-11-28","FECHA_PRODUCT":"2020-11-30","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3330052,"FECHA_SACRIF":"2020-11-28","FECHA_PRODUCT":"2020-11-30","COD_ARTICULO":"244720900","NOM_ARTICULO":"XALA TR. POLLO MEXICO IQF 10 K","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3330055,"FECHA_SACRIF":"2020-11-28","FECHA_PRODUCT":"2020-11-30","COD_ARTICULO":"202721871","NOM_ARTICULO":"TRUTRO CORTO POLLO  IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3330115,"FECHA_SACRIF":"2020-11-28","FECHA_PRODUCT":"2020-11-30","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3330126,"FECHA_SACRIF":"2020-11-28","FECHA_PRODUCT":"2020-11-30","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3330132,"FECHA_SACRIF":"2020-11-30","FECHA_PRODUCT":"2020-11-30","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3330275,"FECHA_SACRIF":"2020-11-28","FECHA_PRODUCT":"2020-11-30","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3330281,"FECHA_SACRIF":"2020-11-30","FECHA_PRODUCT":"2020-11-30","COD_ARTICULO":"284130011","NOM_ARTICULO":"XALA MIXTA PROCESO 2,2 LB USA","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3330283,"FECHA_SACRIF":"2020-11-27","FECHA_PRODUCT":"2020-11-30","COD_ARTICULO":"576023021","NOM_ARTICULO":"BISTEC TRUTRO PAVO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3330284,"FECHA_SACRIF":"2020-11-27","FECHA_PRODUCT":"2020-11-30","COD_ARTICULO":"576123028","NOM_ARTICULO":"FILETE PECH PAVO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3330523,"FECHA_SACRIF":"2020-11-30","FECHA_PRODUCT":"2020-12-01","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3330544,"FECHA_SACRIF":"2020-11-30","FECHA_PRODUCT":"2020-12-01","COD_ARTICULO":"284120753","NOM_ARTICULO":"XALAS MIXTA POLLO IQF 2,2 lb","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3330545,"FECHA_SACRIF":"2020-11-30","FECHA_PRODUCT":"2020-12-01","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3330546,"FECHA_SACRIF":"2020-11-28","FECHA_PRODUCT":"2020-12-01","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3330547,"FECHA_SACRIF":"2020-11-30","FECHA_PRODUCT":"2020-12-01","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3330549,"FECHA_SACRIF":"2020-11-30","FECHA_PRODUCT":"2020-12-01","COD_ARTICULO":"294025956","NOM_ARTICULO":"XPECHUGA SHP IQF 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3330550,"FECHA_SACRIF":"2020-11-30","FECHA_PRODUCT":"2020-12-01","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3330609,"FECHA_SACRIF":"2020-11-30","FECHA_PRODUCT":"2020-12-01","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3330620,"FECHA_SACRIF":"2020-11-30","FECHA_PRODUCT":"2020-12-01","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3330623,"FECHA_SACRIF":"2020-11-30","FECHA_PRODUCT":"","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3330625,"FECHA_SACRIF":"2020-12-01","FECHA_PRODUCT":"2020-12-01","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3330839,"FECHA_SACRIF":"2020-11-28","FECHA_PRODUCT":"2020-12-01","COD_ARTICULO":"576023021","NOM_ARTICULO":"BISTEC TRUTRO PAVO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3330840,"FECHA_SACRIF":"2020-11-28","FECHA_PRODUCT":"2020-12-01","COD_ARTICULO":"576123028","NOM_ARTICULO":"FILETE PECH PAVO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3331100,"FECHA_SACRIF":"2020-12-01","FECHA_PRODUCT":"2020-12-01","COD_ARTICULO":"202721871","NOM_ARTICULO":"TRUTRO CORTO POLLO  IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3331101,"FECHA_SACRIF":"2020-12-01","FECHA_PRODUCT":"2020-12-02","COD_ARTICULO":"305821928","NOM_ARTICULO":"FILETILLO DE POLLO CDG 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3331102,"FECHA_SACRIF":"2020-12-01","FECHA_PRODUCT":"2020-12-02","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3331103,"FECHA_SACRIF":"2020-12-01","FECHA_PRODUCT":"2020-12-02","COD_ARTICULO":"305921925","NOM_ARTICULO":"PECHUGA DE POLLO S/HP CDG 750G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3331104,"FECHA_SACRIF":"2020-12-01","FECHA_PRODUCT":"2020-12-02","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3331105,"FECHA_SACRIF":"2020-11-30","FECHA_PRODUCT":"2020-12-02","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3331106,"FECHA_SACRIF":"2020-12-01","FECHA_PRODUCT":"2020-12-02","COD_ARTICULO":"244720900","NOM_ARTICULO":"XALA TR. POLLO MEXICO IQF 10 K","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3331107,"FECHA_SACRIF":"2020-12-01","FECHA_PRODUCT":"2020-12-02","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3331108,"FECHA_SACRIF":"2020-12-01","FECHA_PRODUCT":"2020-12-02","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3331109,"FECHA_SACRIF":"2020-12-01","FECHA_PRODUCT":"2020-12-02","COD_ARTICULO":"294025956","NOM_ARTICULO":"XPECHUGA SHP IQF 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3331195,"FECHA_SACRIF":"2020-12-01","FECHA_PRODUCT":"2020-12-02","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3331207,"FECHA_SACRIF":"2020-12-01","FECHA_PRODUCT":"2020-12-02","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3331211,"FECHA_SACRIF":"2020-12-02","FECHA_PRODUCT":"","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3331213,"FECHA_SACRIF":"2020-12-02","FECHA_PRODUCT":"2020-12-02","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3331394,"FECHA_SACRIF":"2020-11-30","FECHA_PRODUCT":"2020-12-02","COD_ARTICULO":"583321929","NOM_ARTICULO":"BISTEC DE PAVO 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3331395,"FECHA_SACRIF":"2020-12-01","FECHA_PRODUCT":"2020-12-02","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3331441,"FECHA_SACRIF":"2020-12-02","FECHA_PRODUCT":"2020-12-02","COD_ARTICULO":"265410019","NOM_ARTICULO":"TR. ENT POLLO GRANEL MARINADO","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3331623,"FECHA_SACRIF":"2020-12-02","FECHA_PRODUCT":"2020-12-02","COD_ARTICULO":"202721871","NOM_ARTICULO":"TRUTRO CORTO POLLO  IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3331642,"FECHA_SACRIF":"2020-12-02","FECHA_PRODUCT":"2020-12-03","COD_ARTICULO":"254621907","NOM_ARTICULO":"XFILETILLO POLLO IQF HEB","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3331643,"FECHA_SACRIF":"2020-12-02","FECHA_PRODUCT":"2020-12-03","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3331644,"FECHA_SACRIF":"2020-12-02","FECHA_PRODUCT":"2020-12-03","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3331645,"FECHA_SACRIF":"2020-12-02","FECHA_PRODUCT":"2020-12-03","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3331647,"FECHA_SACRIF":"2020-12-02","FECHA_PRODUCT":"2020-12-03","COD_ARTICULO":"244720900","NOM_ARTICULO":"XALA TR. POLLO MEXICO IQF 10 K","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3331649,"FECHA_SACRIF":"2020-12-02","FECHA_PRODUCT":"2020-12-03","COD_ARTICULO":"291020909","NOM_ARTICULO":"XPECHUGA POLLO S/HP IQF 10KG","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3331709,"FECHA_SACRIF":"2020-12-02","FECHA_PRODUCT":"2020-12-03","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3331719,"FECHA_SACRIF":"2020-12-02","FECHA_PRODUCT":"2020-12-03","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3331723,"FECHA_SACRIF":"2020-12-03","FECHA_PRODUCT":"","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3331725,"FECHA_SACRIF":"2020-12-03","FECHA_PRODUCT":"2020-12-03","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3331870,"FECHA_SACRIF":"2020-12-02","FECHA_PRODUCT":"2020-12-03","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3331873,"FECHA_SACRIF":"2020-12-01","FECHA_PRODUCT":"2020-12-03","COD_ARTICULO":"583321929","NOM_ARTICULO":"BISTEC DE PAVO 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3331911,"FECHA_SACRIF":"2020-11-23","FECHA_PRODUCT":"2020-12-03","COD_ARTICULO":"583321929","NOM_ARTICULO":"BISTEC DE PAVO 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3331912,"FECHA_SACRIF":"2020-12-03","FECHA_PRODUCT":"2020-12-03","COD_ARTICULO":"294325957","NOM_ARTICULO":"XALA TRUTRO 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3331914,"FECHA_SACRIF":"2020-12-03","FECHA_PRODUCT":"2020-12-03","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3332113,"FECHA_SACRIF":"2020-12-02","FECHA_PRODUCT":"2020-12-03","COD_ARTICULO":"576023021","NOM_ARTICULO":"BISTEC TRUTRO PAVO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3332114,"FECHA_SACRIF":"2020-12-02","FECHA_PRODUCT":"2020-12-03","COD_ARTICULO":"576123028","NOM_ARTICULO":"FILETE PECH PAVO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3332115,"FECHA_SACRIF":"2020-12-03","FECHA_PRODUCT":"2020-12-03","COD_ARTICULO":"202721871","NOM_ARTICULO":"TRUTRO CORTO POLLO  IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3332158,"FECHA_SACRIF":"2020-12-04","FECHA_PRODUCT":"2020-12-04","COD_ARTICULO":"294125953","NOM_ARTICULO":"XFILETILLO 4X10 LB USA","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3332159,"FECHA_SACRIF":"2020-12-04","FECHA_PRODUCT":"2020-12-04","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3332160,"FECHA_SACRIF":"2020-12-03","FECHA_PRODUCT":"2020-12-04","COD_ARTICULO":"294025956","NOM_ARTICULO":"XPECHUGA SHP IQF 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3332161,"FECHA_SACRIF":"2020-12-04","FECHA_PRODUCT":"2020-12-04","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3332162,"FECHA_SACRIF":"2020-12-04","FECHA_PRODUCT":"2020-12-04","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3332195,"FECHA_SACRIF":"2020-12-04","FECHA_PRODUCT":"2020-12-04","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3332287,"FECHA_SACRIF":"2020-12-03","FECHA_PRODUCT":"2020-12-04","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3332288,"FECHA_SACRIF":"2020-12-03","FECHA_PRODUCT":"2020-12-04","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3332351,"FECHA_SACRIF":"2020-12-02","FECHA_PRODUCT":"2020-12-04","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3332362,"FECHA_SACRIF":"2020-12-03","FECHA_PRODUCT":"2020-12-04","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3332368,"FECHA_SACRIF":"2020-12-04","FECHA_PRODUCT":"2020-12-04","COD_ARTICULO":"294025956","NOM_ARTICULO":"XPECHUGA SHP IQF 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3332474,"FECHA_SACRIF":"2020-12-04","FECHA_PRODUCT":"2020-12-04","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3332522,"FECHA_SACRIF":"2020-12-03","FECHA_PRODUCT":"2020-12-04","COD_ARTICULO":"229223020","NOM_ARTICULO":"TRUTRO CORTO POLLO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3332523,"FECHA_SACRIF":"2020-12-03","FECHA_PRODUCT":"2020-12-05","COD_ARTICULO":"254621907","NOM_ARTICULO":"XFILETILLO POLLO IQF HEB","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3332528,"FECHA_SACRIF":"2020-11-17","FECHA_PRODUCT":"2020-12-05","COD_ARTICULO":"583321929","NOM_ARTICULO":"BISTEC DE PAVO 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3332529,"FECHA_SACRIF":"2020-11-19","FECHA_PRODUCT":"2020-12-05","COD_ARTICULO":"583421926","NOM_ARTICULO":"FILETE DE PAVO 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3332695,"FECHA_SACRIF":"2020-12-03","FECHA_PRODUCT":"2020-12-05","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3332697,"FECHA_SACRIF":"2020-12-03","FECHA_PRODUCT":"2020-12-05","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3332698,"FECHA_SACRIF":"2020-12-03","FECHA_PRODUCT":"2020-12-05","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3332699,"FECHA_SACRIF":"2020-12-03","FECHA_PRODUCT":"2020-12-05","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3332700,"FECHA_SACRIF":"2020-12-04","FECHA_PRODUCT":"2020-12-05","COD_ARTICULO":"202721871","NOM_ARTICULO":"TRUTRO CORTO POLLO  IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3332701,"FECHA_SACRIF":"2020-12-03","FECHA_PRODUCT":"2020-12-05","COD_ARTICULO":"284925952","NOM_ARTICULO":"XALA MIXTA POLLO 10 LB FIRST S","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3332702,"FECHA_SACRIF":"2020-12-04","FECHA_PRODUCT":"2020-12-05","COD_ARTICULO":"291020909","NOM_ARTICULO":"XPECHUGA POLLO S/HP IQF 10KG","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3332703,"FECHA_SACRIF":"2020-12-04","FECHA_PRODUCT":"2020-12-05","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3332704,"FECHA_SACRIF":"2020-12-04","FECHA_PRODUCT":"2020-12-05","COD_ARTICULO":"294025956","NOM_ARTICULO":"XPECHUGA SHP IQF 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3332705,"FECHA_SACRIF":"2020-12-04","FECHA_PRODUCT":"2020-12-05","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3332706,"FECHA_SACRIF":"2020-12-04","FECHA_PRODUCT":"2020-12-05","COD_ARTICULO":"294125953","NOM_ARTICULO":"XFILETILLO 4X10 LB USA","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3332708,"FECHA_SACRIF":"2020-12-04","FECHA_PRODUCT":"2020-12-04","COD_ARTICULO":"284130011","NOM_ARTICULO":"XALA MIXTA PROCESO 2,2 LB USA","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3332761,"FECHA_SACRIF":"2020-12-04","FECHA_PRODUCT":"2020-12-05","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3332771,"FECHA_SACRIF":"2020-12-04","FECHA_PRODUCT":"2020-12-05","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3332777,"FECHA_SACRIF":"2020-12-05","FECHA_PRODUCT":"2020-12-05","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3332896,"FECHA_SACRIF":"2020-12-03","FECHA_PRODUCT":"2020-12-05","COD_ARTICULO":"229223020","NOM_ARTICULO":"TRUTRO CORTO POLLO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3332941,"FECHA_SACRIF":"2020-12-03","FECHA_PRODUCT":"2020-12-05","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3333116,"FECHA_SACRIF":"2020-12-05","FECHA_PRODUCT":"2020-12-07","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3333117,"FECHA_SACRIF":"2020-12-04","FECHA_PRODUCT":"2020-12-07","COD_ARTICULO":"287120750","NOM_ARTICULO":"XALA MEDIA POLLO IQF 2,2 lb","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3333118,"FECHA_SACRIF":"2020-12-04","FECHA_PRODUCT":"2020-12-07","COD_ARTICULO":"284120753","NOM_ARTICULO":"XALAS MIXTA POLLO IQF 2,2 lb","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3333119,"FECHA_SACRIF":"2020-12-03","FECHA_PRODUCT":"2020-12-07","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3333120,"FECHA_SACRIF":"2020-12-07","FECHA_PRODUCT":"2020-12-07","COD_ARTICULO":"287120750","NOM_ARTICULO":"XALA MEDIA POLLO IQF 2,2 lb","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3333124,"FECHA_SACRIF":"2020-12-05","FECHA_PRODUCT":"2020-12-07","COD_ARTICULO":"244720900","NOM_ARTICULO":"XALA TR. POLLO MEXICO IQF 10 K","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3333125,"FECHA_SACRIF":"2020-12-05","FECHA_PRODUCT":"2020-12-07","COD_ARTICULO":"291020909","NOM_ARTICULO":"XPECHUGA POLLO S/HP IQF 10KG","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3333215,"FECHA_SACRIF":"2020-12-05","FECHA_PRODUCT":"2020-12-07","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3333226,"FECHA_SACRIF":"2020-12-05","FECHA_PRODUCT":"2020-12-07","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3333230,"FECHA_SACRIF":"2020-12-05","FECHA_PRODUCT":"2020-12-07","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3333232,"FECHA_SACRIF":"2020-12-07","FECHA_PRODUCT":"2020-12-07","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3333344,"FECHA_SACRIF":"2020-12-07","FECHA_PRODUCT":"2020-12-09","COD_ARTICULO":"284130011","NOM_ARTICULO":"XALA MIXTA PROCESO 2,2 LB USA","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3333346,"FECHA_SACRIF":"2020-12-05","FECHA_PRODUCT":"2020-12-07","COD_ARTICULO":"202621874","NOM_ARTICULO":"ALA TRUTRO POLLO IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3333347,"FECHA_SACRIF":"2020-12-05","FECHA_PRODUCT":"2020-12-07","COD_ARTICULO":"202721871","NOM_ARTICULO":"TRUTRO CORTO POLLO  IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3333354,"FECHA_SACRIF":"2020-12-04","FECHA_PRODUCT":"2020-12-07","COD_ARTICULO":"294125953","NOM_ARTICULO":"XFILETILLO 4X10 LB USA","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3333617,"FECHA_SACRIF":"2020-12-07","FECHA_PRODUCT":"2020-12-07","COD_ARTICULO":"224820903","NOM_ARTICULO":"XALA 1 y 2 DE POLLO IQF 10 KG","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3333694,"FECHA_SACRIF":"2020-12-07","FECHA_PRODUCT":"2020-12-09","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3333705,"FECHA_SACRIF":"2020-12-07","FECHA_PRODUCT":"2020-12-09","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3333709,"FECHA_SACRIF":"2020-12-07","FECHA_PRODUCT":"2020-12-09","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3333711,"FECHA_SACRIF":"2020-12-09","FECHA_PRODUCT":"2020-12-09","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3333734,"FECHA_SACRIF":"2020-12-07","FECHA_PRODUCT":"2020-12-09","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3333735,"FECHA_SACRIF":"2020-12-07","FECHA_PRODUCT":"2020-12-09","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3333736,"FECHA_SACRIF":"2020-12-07","FECHA_PRODUCT":"2020-12-09","COD_ARTICULO":"284120753","NOM_ARTICULO":"XALAS MIXTA POLLO IQF 2,2 lb","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3333737,"FECHA_SACRIF":"2020-12-07","FECHA_PRODUCT":"2020-12-09","COD_ARTICULO":"284120753","NOM_ARTICULO":"XALAS MIXTA POLLO IQF 2,2 lb","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3333738,"FECHA_SACRIF":"2020-12-07","FECHA_PRODUCT":"2020-12-09","COD_ARTICULO":"294125953","NOM_ARTICULO":"XFILETILLO 4X10 LB USA","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3333739,"FECHA_SACRIF":"2020-12-07","FECHA_PRODUCT":"2020-12-09","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3333740,"FECHA_SACRIF":"2020-12-07","FECHA_PRODUCT":"2020-12-09","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3333741,"FECHA_SACRIF":"2020-12-07","FECHA_PRODUCT":"2020-12-09","COD_ARTICULO":"202721871","NOM_ARTICULO":"TRUTRO CORTO POLLO  IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3333742,"FECHA_SACRIF":"2020-12-07","FECHA_PRODUCT":"2020-12-09","COD_ARTICULO":"224820903","NOM_ARTICULO":"XALA 1 y 2 DE POLLO IQF 10 KG","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3333743,"FECHA_SACRIF":"2020-12-07","FECHA_PRODUCT":"2020-12-09","COD_ARTICULO":"291020909","NOM_ARTICULO":"XPECHUGA POLLO S/HP IQF 10KG","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3334117,"FECHA_SACRIF":"2020-12-09","FECHA_PRODUCT":"2020-12-09","COD_ARTICULO":"202621874","NOM_ARTICULO":"ALA TRUTRO POLLO IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3334120,"FECHA_SACRIF":"2020-12-03","FECHA_PRODUCT":"2020-12-09","COD_ARTICULO":"229223020","NOM_ARTICULO":"TRUTRO CORTO POLLO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3334128,"FECHA_SACRIF":"2020-12-09","FECHA_PRODUCT":"2020-12-09","COD_ARTICULO":"209723021","NOM_ARTICULO":"PECHUGA POLLO SHP CUISINE & CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3334416,"FECHA_SACRIF":"2020-12-09","FECHA_PRODUCT":"2020-12-10","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3334424,"FECHA_SACRIF":"2020-12-09","FECHA_PRODUCT":"2020-12-10","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3334428,"FECHA_SACRIF":"2020-12-09","FECHA_PRODUCT":"2020-12-10","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3334430,"FECHA_SACRIF":"2020-12-10","FECHA_PRODUCT":"2020-12-10","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3334431,"FECHA_SACRIF":"2020-12-09","FECHA_PRODUCT":"2020-12-10","COD_ARTICULO":"229223020","NOM_ARTICULO":"TRUTRO CORTO POLLO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3334432,"FECHA_SACRIF":"2020-12-09","FECHA_PRODUCT":"2020-12-10","COD_ARTICULO":"209723021","NOM_ARTICULO":"PECHUGA POLLO SHP CUISINE & CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3334433,"FECHA_SACRIF":"2020-12-09","FECHA_PRODUCT":"2020-12-10","COD_ARTICULO":"305921925","NOM_ARTICULO":"PECHUGA DE POLLO S/HP CDG 750G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3334434,"FECHA_SACRIF":"2020-12-09","FECHA_PRODUCT":"2020-12-10","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3334435,"FECHA_SACRIF":"2020-12-09","FECHA_PRODUCT":"2020-12-10","COD_ARTICULO":"211921927","NOM_ARTICULO":"FILETILLO DE POLLO 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3334438,"FECHA_SACRIF":"2020-12-09","FECHA_PRODUCT":"2020-12-10","COD_ARTICULO":"202621874","NOM_ARTICULO":"ALA TRUTRO POLLO IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3334439,"FECHA_SACRIF":"2020-12-07","FECHA_PRODUCT":"2020-12-10","COD_ARTICULO":"291020909","NOM_ARTICULO":"XPECHUGA POLLO S/HP IQF 10KG","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3334440,"FECHA_SACRIF":"2020-12-09","FECHA_PRODUCT":"2020-12-10","COD_ARTICULO":"202721871","NOM_ARTICULO":"TRUTRO CORTO POLLO  IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3334602,"FECHA_SACRIF":"2020-12-09","FECHA_PRODUCT":"2020-12-10","COD_ARTICULO":"291020909","NOM_ARTICULO":"XPECHUGA POLLO S/HP IQF 10KG","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3334825,"FECHA_SACRIF":"2020-12-10","FECHA_PRODUCT":"2020-12-10","COD_ARTICULO":"294025956","NOM_ARTICULO":"XPECHUGA SHP IQF 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3334848,"FECHA_SACRIF":"2020-12-09","FECHA_PRODUCT":"2020-12-10","COD_ARTICULO":"254820690","NOM_ARTICULO":"FILETILLO POLLO C/TT IQF 10 KG","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3334849,"FECHA_SACRIF":"2020-12-10","FECHA_PRODUCT":"2020-12-10","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3334850,"FECHA_SACRIF":"2020-12-10","FECHA_PRODUCT":"2020-12-11","COD_ARTICULO":"283820753","NOM_ARTICULO":"XFILETILLO DE POLLO IQF 2,2 lb","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3334851,"FECHA_SACRIF":"2020-12-10","FECHA_PRODUCT":"2020-12-11","COD_ARTICULO":"294125953","NOM_ARTICULO":"XFILETILLO 4X10 LB USA","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3334853,"FECHA_SACRIF":"2020-12-10","FECHA_PRODUCT":"2020-12-11","COD_ARTICULO":"284925952","NOM_ARTICULO":"XALA MIXTA POLLO 10 LB FIRST S","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3334854,"FECHA_SACRIF":"2020-12-10","FECHA_PRODUCT":"2020-12-11","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3334855,"FECHA_SACRIF":"2020-12-10","FECHA_PRODUCT":"2020-12-11","COD_ARTICULO":"294225950","NOM_ARTICULO":"XALAS TRU-MEDIA 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3334856,"FECHA_SACRIF":"2020-12-10","FECHA_PRODUCT":"2020-12-11","COD_ARTICULO":"202721871","NOM_ARTICULO":"TRUTRO CORTO POLLO  IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3334857,"FECHA_SACRIF":"2020-12-10","FECHA_PRODUCT":"2020-12-11","COD_ARTICULO":"294025956","NOM_ARTICULO":"XPECHUGA SHP IQF 4 X 10 LB USA","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3334911,"FECHA_SACRIF":"2020-12-10","FECHA_PRODUCT":"2020-12-11","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3334920,"FECHA_SACRIF":"2020-12-10","FECHA_PRODUCT":"2020-12-11","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3334924,"FECHA_SACRIF":"2020-12-10","FECHA_PRODUCT":"2020-12-11","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3334926,"FECHA_SACRIF":"2020-12-11","FECHA_PRODUCT":"2020-12-11","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3335197,"FECHA_SACRIF":"2020-12-09","FECHA_PRODUCT":"2020-12-11","COD_ARTICULO":"229223020","NOM_ARTICULO":"TRUTRO CORTO POLLO CUISINE&CO","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3335357,"FECHA_SACRIF":"2020-12-11","FECHA_PRODUCT":"2020-12-11","COD_ARTICULO":"224820903","NOM_ARTICULO":"XALA 1 y 2 DE POLLO IQF 10 KG","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3335362,"FECHA_SACRIF":"2020-12-10","FECHA_PRODUCT":"2020-12-12","COD_ARTICULO":"294125953","NOM_ARTICULO":"XFILETILLO 4X10 LB USA","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3335363,"FECHA_SACRIF":"2020-12-11","FECHA_PRODUCT":"2020-12-12","COD_ARTICULO":"225221921","NOM_ARTICULO":"PECHUGA DE POLLO S/HP 700G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3335364,"FECHA_SACRIF":"2020-12-11","FECHA_PRODUCT":"2020-12-12","COD_ARTICULO":"305821928","NOM_ARTICULO":"FILETILLO DE POLLO CDG 650G","N_PROGRAMA":"91","LINEA":"IQF 1 STAR FROST"},
    {"PLANTA":"129","N_OF":3335366,"FECHA_SACRIF":"2020-12-11","FECHA_PRODUCT":"2020-12-12","COD_ARTICULO":"224820903","NOM_ARTICULO":"XALA 1 y 2 DE POLLO IQF 10 KG","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3335367,"FECHA_SACRIF":"2020-12-11","FECHA_PRODUCT":"2020-12-12","COD_ARTICULO":"202621874","NOM_ARTICULO":"ALA TRUTRO POLLO IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3335368,"FECHA_SACRIF":"2020-12-11","FECHA_PRODUCT":"2020-12-12","COD_ARTICULO":"244720900","NOM_ARTICULO":"XALA TR. POLLO MEXICO IQF 10 K","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3335370,"FECHA_SACRIF":"2020-12-11","FECHA_PRODUCT":"2020-12-12","COD_ARTICULO":"291020909","NOM_ARTICULO":"XPECHUGA POLLO S/HP IQF 10KG","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3335405,"FECHA_SACRIF":"2020-12-11","FECHA_PRODUCT":"2020-12-12","COD_ARTICULO":"268512604","NOM_ARTICULO":"TRUTRO CUARTO DE POLLO EXTRA","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3335406,"FECHA_SACRIF":"2020-12-12","FECHA_PRODUCT":"2020-12-12","COD_ARTICULO":"265410019","NOM_ARTICULO":"TR. ENT POLLO GRANEL MARINADO","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3335414,"FECHA_SACRIF":"2020-12-11","FECHA_PRODUCT":"2020-12-12","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3335418,"FECHA_SACRIF":"2020-12-12","FECHA_PRODUCT":"2020-12-12","COD_ARTICULO":"201512609","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3335420,"FECHA_SACRIF":"2020-12-12","FECHA_PRODUCT":"2020-12-12","COD_ARTICULO":"200612607","NOM_ARTICULO":"TRUTRO ENTERO DE POLLO GRANEL","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
    {"PLANTA":"129","N_OF":3335830,"FECHA_SACRIF":"2020-12-12","FECHA_PRODUCT":"","COD_ARTICULO":"282721808","NOM_ARTICULO":"XALITAS MEDIA DE POLLO","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3335831,"FECHA_SACRIF":"2020-12-11","FECHA_PRODUCT":"2020-12-12","COD_ARTICULO":"202721871","NOM_ARTICULO":"TRUTRO CORTO POLLO  IQF","N_PROGRAMA":"94","LINEA":"IQF 4 SKAGINN"},
    {"PLANTA":"129","N_OF":3335902,"FECHA_SACRIF":"","FECHA_PRODUCT":"","COD_ARTICULO":"212112607","NOM_ARTICULO":"PECHUGA DESHUESADA GRANEL 10K","N_PROGRAMA":"33","LINEA":"EMPAQUE CAJAS ISHIDA"},
  ]
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

// var arrOF = [			
//   {"CODIGO":"212521874","NOMBRE":"TRUTRO ¼ IQF CORTE AMERICANO","OBJ_INYE":36},					
// {"CODIGO":"202621874","NOMBRE":"ALA TRUTRO POLLO IQF","OBJ_INYE":25},					
// {"CODIGO":"224820903","NOMBRE":"XALA 1 y 2 DE POLLO IQF 10 KG","OBJ_INYE":24.6},					
// {"CODIGO":"244720900","NOMBRE":"XALA TR. POLLO MEXICO IQF 10 K","OBJ_INYE":24.6},					
// {"CODIGO":"209720907","NOMBRE":"XPECH POL SHP 90-110 IQF 10K","OBJ_INYE":21},					
// {"CODIGO":"211320904","NOMBRE":"XPECH POL SHP 110-130 IQF 10K","OBJ_INYE":21},					
// {"CODIGO":"212120909","NOMBRE":"XPECH POL SHP 130-150 IQF 10K","OBJ_INYE":21},					
// {"CODIGO":"213920904","NOMBRE":"XPECH POL SHP 150-170 IQF 10K","OBJ_INYE":21},					
// {"CODIGO":"224520902","NOMBRE":"XPECH POLLO SHP 230-250IQF 10K","OBJ_INYE":21},					
// {"CODIGO":"229320903","NOMBRE":"XPECH POL SHP 230-250 IQF 10K","OBJ_INYE":21},					
// {"CODIGO":"243120909","NOMBRE":"XPECH POL SHP 210-230 IQF 10K ","OBJ_INYE":21},					
// {"CODIGO":"244220905","NOMBRE":"XPECH POLLO SHP170-190 IQF 10K","OBJ_INYE":21},					
// {"CODIGO":"244320902","NOMBRE":"XPECH POLLO SHP190-210 IQF 10K","OBJ_INYE":21},					
// {"CODIGO":"244420909","NOMBRE":"XPECH POL SHP 170-190 IQF 10K","OBJ_INYE":21},					
// {"CODIGO":"247720907","NOMBRE":"XPECH POL SHP 190-210 IQF 10K","OBJ_INYE":21},					
// {"CODIGO":"268621900","NOMBRE":"XPECH POLLO S/HP IQF 10 X1 HEB","OBJ_INYE":21},					
// {"CODIGO":"268921871","NOMBRE":"XMEDIA PECHUGA POLLO C/HP IQF","OBJ_INYE":21},					
// {"CODIGO":"268921901","NOMBRE":"XMEDIA PECH POLL IQF 10X1 HEB ","OBJ_INYE":21},					
// {"CODIGO":"290720909","NOMBRE":"XPECH POL SHP 210-230 IQF 10K","OBJ_INYE":21},					
// {"CODIGO":"291020909","NOMBRE":"XPECHUGA POLLO S/HP IQF 10KG  ","OBJ_INYE":21},					
// {"CODIGO":"202521877","NOMBRE":"TRUTRO LARGO POLLO IQF","OBJ_INYE":25},					
// {"CODIGO":"202721871","NOMBRE":"TRUTRO CORTO POLLO  IQF","OBJ_INYE":25},					
// {"CODIGO":"203220908","NOMBRE":"PECH POLLO S/HP IQF 120-150 GR","OBJ_INYE":25},					
// {"CODIGO":"212321801","NOMBRE":"PECH POLLO DESHUESADA","OBJ_INYE":25},					
// {"CODIGO":"233720904","NOMBRE":"1/2 PECH.POLLO IQF >310 G 10K","OBJ_INYE":25},					
// {"CODIGO":"250621871","NOMBRE":"TRUTRO ENTERO POLLO IQF 10 KG","OBJ_INYE":25},					
// {"CODIGO":"254820690","NOMBRE":"FILETILLO POLLO C/TT IQF 10 KG","OBJ_INYE":8},					
// {"CODIGO":"216520750","NOMBRE":"XALA TRUTRO IQF 2,2 lb CDG USA","OBJ_INYE":20},					
// {"CODIGO":"216525953","NOMBRE":"XALA TRUTRO 4X10LB CDG USA","OBJ_INYE":20},					
// {"CODIGO":"216620757","NOMBRE":"XALAS MIXTA POLL 2,2lb CDG USA","OBJ_INYE":20},					
// {"CODIGO":"216625950","NOMBRE":"XALAS MIXTA 4X10LB CDG USA","OBJ_INYE":20},					
// {"CODIGO":"282721808","NOMBRE":"XALITAS MEDIA DE POLLO","OBJ_INYE":20},					
// {"CODIGO":"283720756","NOMBRE":"XPECHUGA POLLO S/HP IQF 2,2 lb","OBJ_INYE":20},					
// {"CODIGO":"284120753","NOMBRE":"XALAS MIXTA POLLO IQF 2,2 lb","OBJ_INYE":20},					
// {"CODIGO":"284220750","NOMBRE":"XALA TRUTRO POLLO IQF 2,2 lb","OBJ_INYE":20},					
// {"CODIGO":"294225950","NOMBRE":"XALAS TRU-MEDIA 4X10 LB USA   ","OBJ_INYE":20},					
// {"CODIGO":"294325957","NOMBRE":"XALA TRUTRO 4X10 LB USA       ","OBJ_INYE":20},					
// {"CODIGO":"210520756","NOMBRE":"XPECH POLLO S/HP 2,2lb CDG USA","OBJ_INYE":20},					
// {"CODIGO":"210525959","NOMBRE":"XPECH SHP 4X10LB CDG USA","OBJ_INYE":20},					
// {"CODIGO":"294025956","NOMBRE":"XPECH SHP 4X10 LB USA","OBJ_INYE":20},					
// {"CODIGO":"203721924","NOMBRE":"ALA TRUTRO DE POLLO 700G","OBJ_INYE":22},					
// {"CODIGO":"263121801","NOMBRE":"TRUTRO POLLO S/H C/P 9X1 KG","OBJ_INYE":22},					
// {"CODIGO":"225221921","NOMBRE":"PECHUGA DE POLLO S/HP 700G","OBJ_INYE":20},					
// {"CODIGO":"583321929","NOMBRE":"BISTEC DE PAVO 700G","OBJ_INYE":15},					
// {"CODIGO":"583421926","NOMBRE":"FILETE DE PAVO 700G","OBJ_INYE":15},					
// {"CODIGO":"200620756","NOMBRE":"XFILETILLO IQF 2,2lb CDG USA","OBJ_INYE":10.5},					
// {"CODIGO":"200625959","NOMBRE":"XFILETILLO 4X10LB CDG USA","OBJ_INYE":10.5},					
// {"CODIGO":"254621907","NOMBRE":"XFILETILLO POLLO S/TT IQF     ","OBJ_INYE":10},					
// {"CODIGO":"269421905","NOMBRE":"XFILETILLO POLLO IQF HEB 10X1K","OBJ_INYE":10},					
// {"CODIGO":"283820753","NOMBRE":"XFILETILLO DE POLLO IQF 2,2 lb","OBJ_INYE":10.5},					
// {"CODIGO":"294125953","NOMBRE":"XFILETILLO 4X10 LB USA        ","OBJ_INYE":10.5},					
// {"CODIGO":"295522706","NOMBRE":"XPECHUGA DE POLLO SHP 3 oz GP","OBJ_INYE":31},					
// {"CODIGO":"295525936","NOMBRE":"XPECHUGA DE POLLO SHP 3 OZ 2X1","OBJ_INYE":31},					
// {"CODIGO":"295722700","NOMBRE":"XPECHUGA DE POLLO SHP 4 oz GP","OBJ_INYE":31},					
// {"CODIGO":"295725930","NOMBRE":"XPECHUGA DE POLLO SHP 4 OZ 2X1","OBJ_INYE":31},					
// {"CODIGO":"295822707","NOMBRE":"XPECHUGA DE POLLO SHP 5 oz GP","OBJ_INYE":31},					
// {"CODIGO":"295825937","NOMBRE":"XPECHUGA DE POLLO SHP 5 OZ 2X1","OBJ_INYE":31},					
// {"CODIGO":"295922704","NOMBRE":"XPECHUGA DE POLLO SHP 6 oz GP","OBJ_INYE":31},					
// {"CODIGO":"295925934","NOMBRE":"XPECHUGA DE POLLO SHP 6 OZ 2X1","OBJ_INYE":31},					
// {"CODIGO":"296322701","NOMBRE":"XPECHUGA DE POLLO SHP 7 oz GP","OBJ_INYE":31},					
// {"CODIGO":"296325931","NOMBRE":"XPECHUGA DE POLLO SHP 7 OZ 2X1","OBJ_INYE":31},					
// {"CODIGO":"296522705","NOMBRE":"XPECHUGA DE POLLO SHP 8 oz GP","OBJ_INYE":31},					
// {"CODIGO":"296525935","NOMBRE":"XPECHUGA DE POLLO SHP 8 OZ 2X1","OBJ_INYE":31},					
// {"CODIGO":"296622702","NOMBRE":"XPECHUGA DE POLLO SHP 9 oz GP","OBJ_INYE":31},					
// {"CODIGO":"296625932","NOMBRE":"XPECHUGA DE POLLO SHP 9 OZ 2X1","OBJ_INYE":31},					
// {"CODIGO":"211921927","NOMBRE":"FILETILLO DE POLLO 650G","OBJ_INYE":8},					
// {"CODIGO":"239221801","NOMBRE":"ALA TRUTRO POLLO 800 GR IQF","OBJ_INYE":25},					
// {"CODIGO":"574821803","NOMBRE":"FILETE DE PAVO IQF 800 GR X 12","OBJ_INYE":15},					
// {"CODIGO":"574921800","NOMBRE":"BISTEC DE PAVO IQF 800 GR X 12","OBJ_INYE":15},					
// {"CODIGO":"201621820","NOMBRE":"TRUTRO ENTERO MARINADO 2KG IQF","OBJ_INYE":25},					
// {"CODIGO":"224720906","NOMBRE":"ALA 1/2 POLLO IQF 10KG","OBJ_INYE":25},					
// {"CODIGO":"284925952","NOMBRE":"XALA MIXTA POLLO 10 LB FIRST S","OBJ_INYE":20},					
// {"CODIGO":"284925969","NOMBRE":"XALA MIXTA POLLO 4 LB FIRST ST","OBJ_INYE":20},					
// {"CODIGO":"287120750","NOMBRE":"XALA MEDIA POLLO IQF 2,2 lb","OBJ_INYE":20},					
// {"CODIGO":"225120903","NOMBRE":"PECHUGA.DE POLLO TRONCHADA IQF","OBJ_INYE":20},					
// {"CODIGO":"282925961","NOMBRE":"XPECHUGA POLLO SHP IQF USA 4LB","OBJ_INYE":20},					
// {"CODIGO":"293321875","NOMBRE":"XFILETILLO POLLO S/TT IQF 10 K","OBJ_INYE":8},					

// ]
// for (let wer = 0; wer < arrOF.length; wer++) {
//   const elM = arrOF[wer];
//   const inu = new modprodto({
//     COD_PRODUCTO: elM.CODIGO,
//     PRODUCTO: elM.NOMBRE,
//     POR_INY_OPTMO: elM.OBJ_INYE,
//     MEAT: 'POLLO'
//   })
//   const els = inu.save()
// }

module.exports = router;
