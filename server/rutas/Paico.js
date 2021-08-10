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
const modUser = require('../DDBB/MODEL/users');
moment().utc().format();

// ruta principal aqui inicia la aplicacion
router.get('/', async (req, res) => {
  const users = await modUser.find()
  const user = await users.map(w=>{
    const {NOMBRE, RUT}=w
    return {NOMBRE, RUT};
  })
  // console.log(user)
  res.render('login/formulario1',{user})
});

//1.- menu **EN DESARROLLO MODULO DE NUEVA SELECCION DE OF POR PRODUCTO
router.post('/menu', async(req, res) => {
  const OPERARIO = req.body.OPERARIO;
  const codigo = req.body.producto;
  //console.log(codigo, OPERARIO);
  var imgbtn = '';
  var ALERTA = false;
  var maquinaria = "";

  if (codigo === "CFS 450 IQF 1") {
    maquinaria = "IQF";
    imgbtn = '/img/cfs450_1.png';
  }
  if(codigo === "CFS 650 IQF 4"){
    maquinaria = "IQF";
    imgbtn = '/img/cfs450_1.png';
  }
  if(codigo === "CFS 650 TRUTRO NORTE"){
    maquinaria = "ISHIDA";
    imgbtn = '/img/cfs450_1.png';
  }
  if(codigo === "CFS 650 TRUTRO SUR"){
    maquinaria = "ISHIDA";
    imgbtn = '/img/cfs450_1.png';
  }
  if(codigo === "METALQUIMIA"){
    maquinaria = "INYEC";
    imgbtn = '/img/INYEC.png';
  }

  var _f = new Date();
  var dia = _f.getDate()-1;//dias a tras para generar busqueda de OFs
  var yyyy = _f.getFullYear();
  var mm2 = _f.getMonth()+1;
  var mm = mm2<10?"0"+mm2:mm2;
  var dd = dia<10?"0"+dia:dia;
  var leDate = `${yyyy}-${mm}-${dd}T00:00:00.000+00:00`
  //var queryOF = await modOf.find({FECHA_PRODUCT: {$gte:leDate}}).sort({N_OF: -1}).limit(15);
  // var queryOF = await modOf.find({$and: [{FECHA_OF: {$gte:leDate}},{LINEA: maquinaria},{ESTADO:{$not:/A/}}]}).sort({N_OF: -1});
  var arr_of = [];
  var queryOF = await modOf.find({$and: [{FECHA_OF: {$gte:leDate}},{LINEA: maquinaria},{ESTADO:{$not:/A/}}]}, (err,obje)=>{
    const arrOFS = obje.map(dat=> dat.N_OF)
    arr_of = arrOFS
  })

  var arr_data = [];
  for (let frg = 0; frg < arr_of.length; frg++) {
    const itm4 = arr_of[frg];
    await modOf.findOne({N_OF:itm4},async(err,obje)=>{
      await modprodto.findOne({COD_PRODUCTO: obje.COD_ARTICULO},(err,bjos)=>{
        //console.log(bjos)
        if(bjos == null)arr_data.push({PRODUCTO:obje.COD_ARTICULO,N_OF:obje.N_OF,LINEA:obje.LINEA,FECHA:obje.FECHA_OF, COD_PRODUCT:obje.COD_ARTICULO})
        else arr_data.push({PRODUCTO:bjos.PRODUCTO,N_OF:obje.N_OF,LINEA:obje.LINEA,FECHA:obje.FECHA_OF, COD_PRODUCT:obje.COD_ARTICULO})
        //arr_data.push({PRODUCTO:bjos.PRODUCTO,N_OF:obje.N_OF,LINEA:obje.LINEA,FECHA:obje.FECHA_OF, COD_PRODUCT:obje.COD_ARTICULO})
        //return ({PRODUCTO:bjos.PRODUCTO,N_OF:obje.N_OF,LINEA:obje.LINEA,FECHA:obje.FECHA_OF})
        return
      })
    })
  }
  
  var arr_select = [];
  for (let xcvd = 0; xcvd < arr_data.length; xcvd++) {
    const fdat = arr_data[xcvd];
    //console.log(fdat)
    if(arr_select.length == 0)arr_select.push(fdat.COD_PRODUCT)
    else{
      var esta = arr_select.includes(fdat.COD_PRODUCT)
      if(!esta)arr_select.push(fdat.COD_PRODUCT)
    }
  }
  //console.log(arr_select)

  function formatFecha(fech) {
    var a = new Date(fech);
    var dd = a.getDate()<10?"0"+a.getDate():a.getDate();
    var mm = (a.getMonth()+1)<10?"0"+(a.getMonth()+1):(a.getMonth()+1);
    return dd+"/"+mm
  }
  function getProducto(cod_) {
    var o = true;
    var cont = 0;
    while (o) {
      if(arr_data[cont].COD_PRODUCT == cod_){
        o = false
        return arr_data[cont].PRODUCTO
      }
      cont = cont+1
    }
  }
  var arr_sel_show = [];
  var arrtemp1 = [];
    for (let ret = 0; ret < arr_select.length; ret++) {
      const sel_fin = arr_select[ret];
      var tempProduct = '';
      for (let esdf = 0; esdf < arr_data.length; esdf++) {
        const sel_int = arr_data[esdf];
        //console.log(sel_int)
        //console.log(sel_int.PRODUCTO)
        if(sel_fin === sel_int.COD_PRODUCT){
          arrtemp1.push({OF:sel_int.N_OF,FECHA: await formatFecha(sel_int.FECHA)})
        }
      }
      
      arr_sel_show.push({PRODUCTO:getProducto(sel_fin),OF:arrtemp1})
      arrtemp1 = [];
    }
 //console.log(arr_sel_show)
 var ADMINISTRATIVO = false;
 if(OPERARIO === "ADMINISTRATIVO")ADMINISTRATIVO=true

 res.render('PAICO/menu', {OPERARIO, ALERTA, codigo, imgbtn, queryOF, maquinaria,arr_sel_show, ADMINISTRATIVO})
});

//--.- menu no en uso
router.get('/menu', async(req, res) => {
 
  //console.log(programa);
  var _f = new Date();
  var dia = _f.getDate()-1;
  var yyyy = _f.getFullYear();
  var mm2 = _f.getMonth()+1;
  var mm = mm2<10?"0"+mm2:mm2;
  var dd = dia<10?"0"+dia:dia;
  var leDate = `${yyyy}-${mm}-${dd}T00:00:00.000+00:00`;
  var queryOF = await modOf.find({$and: [{FECHA_OF: {$gte:leDate}},{LINEA: maquinaria},{ESTADO:{$not:/A/}}]}).sort({N_OF: -1});
  res.render('PAICO/menu', {queryOF})
});

//2.- ruta de login , por ahora solo pide un nombre para que los datos queden guardados a nombre de alguien
router.post('/inyeccion', async(req, res) => {
  const OPERARIO = req.body.OPERARIO;
  const maquina = req.body.MAQUINA;
  const of1 = req.body.N_OF;
  const of = req.body.N_OF1;
  //console.log(of)
  const programa = req.body.PROGRAMA;
  var cod_producto_ = ''
  var producto_ = ''
  await modOf.find({N_OF: of},async(err, obje)=>{
    //console.log(obje)
    cod_producto_ = obje[0].COD_ARTICULO;
    await modprodto.find({COD_PRODUCTO: cod_producto_},(err, obje)=>{
      //console.log(obje)
      if(obje.length == 0)producto_ = 'SIN REFERENCIA'
      else(
        producto_ = obje[0].PRODUCTO
      )
      setTimeout(() => {
        res.render('PAICO/Inyeccion', { OPERARIO, MAQUINA:maquina, of, COD_PRODUCT: cod_producto_ , PRODUCTO: producto_, programa}) 
      }, 3000);
    })
    // if(obje.length==0){
    //   cod_producto_ = 'SIN REFERENCIA'
    // }
    // else{
    //   cod_producto_ = obje[0].COD_ARTICULO
    // }
  });
  //console.log("codigo:",cod_producto_)
  return
  await modprodto.find({COD_PRODUCTO: cod_producto_},(err, obje)=>{
    console.log(obje)
    if(obje.length == 0)producto_ = 'SIN REFERENCIA'
    else(
      producto_ = obje[0].PRODUCTO
    )
    setTimeout(() => {
      res.render('PAICO/Inyeccion', { OPERARIO, MAQUINA:maquina, of, COD_PRODUCT: cod_producto_ , PRODUCTO: producto_, programa}) 
    }, 3000);
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
  if(themaq === 'METALQUIMIA'){
    imgbtn = '/img/INYEC.png'
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
  //console.log(SUPER_INYECT)
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
   if(downinyected == undefined || upinyected == undefined){
    //--upordown = 'SIN REFERENCIA'
    // request.post('https://botduty.herokuapp.com/--data--:'+data.MAQUINA+":"+CODIGO+":"+X_INYECTED);
    var ALERT_INYEC = `PORCENTAJE DE INYECCION  ${X_INYECTED}%`
    var COLOR_INY = 'alert-warning';
  }
  if(X_INYECTED > upinyected){
    upordown = 'ALTO';
    //request.post('https://botduty.herokuapp.com/--data--:ALTO:'+X_INYECTED+":"+dbinyected+":"+data.MAQUINA+":"+data.PRODUCTO);
    var ALERT_INYEC = `% INYECCION FUERA DEL RANGO (ALTO) ${X_INYECTED}% Y DEBERIA ESTAR ENTRE ${downinyected}% Y ${upinyected}%`
    var COLOR_INY = 'alert-danger';
  }
  if(X_INYECTED < downinyected){
    upordown = 'BAJO'
    //--request.post('https://botduty.herokuapp.com/--data--:BAJO:'+X_INYECTED+":"+dbinyected+":"+data.MAQUINA+":"+data.PRODUCTO);
    var ALERT_INYEC = `% INYECCION FUERA DEL RANGO (BAJO) ${X_INYECTED}% Y DEBERIA ESTAR ENTRE ${downinyected}% Y ${upinyected}%`
    var COLOR_INY = 'alert-danger';
  }
 
  
  //console.log(data)
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
    X_INYECTED_OPTIMO:dbinyected,
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

  var maquinaria = "";
  if (MAQUINA === "CFS 450 IQF 1") {
    maquinaria = "IQF";
    imgbtn = '/img/cfs450_1.png';
  }
  if(MAQUINA === "CFS 650 IQF 4"){
    maquinaria = "IQF";
    imgbtn = '/img/cfs450_1.png';
  }
  if(MAQUINA === "CFS 650 TRUTRO NORTE"){
    maquinaria = "ISHIDA";
    imgbtn = '/img/cfs450_1.png';
  }
  if(MAQUINA === "CFS 650 TRUTRO SUR"){
    maquinaria = "ISHIDA";
    imgbtn = '/img/cfs450_1.png';
  }
  if(MAQUINA === "METALQUIMIA"){
    maquinaria = "INYEC";
    imgbtn = '/img/INYEC.png';
  }
  

  var _f = new Date();
  var dia = _f.getDate()-1;
  var yyyy = _f.getFullYear();
  var mm2 = _f.getMonth()+1;
  var mm = mm2<10?"0"+mm2:mm2;
  var dd = dia<10?"0"+dia:dia;
  var leDate = `${yyyy}-${mm}-${dd}T04:00:00.000+00:00`
  //console.log(leDate);
  //var queryOF = await modOf.find({FECHA_PRODUCT: {$gte:leDate}}).sort({N_OF: -1}).limit(15);
  var arr_of = [];
  var queryOF = await modOf.find({$and: [{FECHA_OF: {$gte:leDate}},{LINEA: maquinaria},{ESTADO:{$not:/A/}}]}, (err,obje)=>{
    const arrOFS = obje.map(dat=> dat.N_OF)
    arr_of = arrOFS
  })

  var arr_data = [];
  for (let frg = 0; frg < arr_of.length; frg++) {
    const itm4 = arr_of[frg];
    await modOf.findOne({N_OF:itm4},async(err,obje)=>{
      await modprodto.findOne({COD_PRODUCTO: obje.COD_ARTICULO},(err,bjos)=>{
        //console.log(bjos)
        if(bjos == null)arr_data.push({PRODUCTO:obje.COD_ARTICULO,N_OF:obje.N_OF,LINEA:obje.LINEA,FECHA:obje.FECHA_OF, COD_PRODUCT:obje.COD_ARTICULO})
        else arr_data.push({PRODUCTO:bjos.PRODUCTO,N_OF:obje.N_OF,LINEA:obje.LINEA,FECHA:obje.FECHA_OF, COD_PRODUCT:obje.COD_ARTICULO})
        //arr_data.push({PRODUCTO:bjos.PRODUCTO,N_OF:obje.N_OF,LINEA:obje.LINEA,FECHA:obje.FECHA_OF, COD_PRODUCT:obje.COD_ARTICULO})
        //return ({PRODUCTO:bjos.PRODUCTO,N_OF:obje.N_OF,LINEA:obje.LINEA,FECHA:obje.FECHA_OF})
        return
      })
    })
  }
  
  var arr_select = [];
  for (let xcvd = 0; xcvd < arr_data.length; xcvd++) {
    const fdat = arr_data[xcvd];
    //console.log(fdat)
    if(arr_select.length == 0)arr_select.push(fdat.COD_PRODUCT)
    else{
      var esta = arr_select.includes(fdat.COD_PRODUCT)
      if(!esta)arr_select.push(fdat.COD_PRODUCT)
    }
  }
  //console.log(arr_select)

  function formatFecha(fech) {
    var a = new Date(fech);
    var dd = a.getDate()<10?"0"+a.getDate():a.getDate();
    var mm = (a.getMonth()+1)<10?"0"+(a.getMonth()+1):(a.getMonth()+1);
    return dd+"/"+mm
  }
  function getProducto(cod_) {
    var o = true;
    var cont = 0;
    while (o) {
      if(arr_data[cont].COD_PRODUCT == cod_){
        o = false
        return arr_data[cont].PRODUCTO
      }
      cont = cont+1
    }
  }
  var arr_sel_show = [];
  var arrtemp1 = [];
    for (let ret = 0; ret < arr_select.length; ret++) {
      const sel_fin = arr_select[ret];
      var tempProduct = '';
      for (let esdf = 0; esdf < arr_data.length; esdf++) {
        const sel_int = arr_data[esdf];
        //console.log(sel_int)
        //console.log(sel_int.PRODUCTO)
        if(sel_fin === sel_int.COD_PRODUCT){
          arrtemp1.push({OF:sel_int.N_OF,FECHA: await formatFecha(sel_int.FECHA)})
        }
      }
      
      arr_sel_show.push({PRODUCTO:getProducto(sel_fin),OF:arrtemp1})
      arrtemp1 = [];
    }
  var arrgrafpersonal = await grafPesonal(data.CODIGO, COD_OF);
 
  var ALERTA = true;
  var GRAFICO = true;
  var ADMINISTRATIVO = false;
 if(OPERARIO === "ADMINISTRATIVO")ADMINISTRATIVO=true
  res.render('PAICO/menu', {OPERARIO, ALERTA,ADMINISTRATIVO, TEMPERATURA, COLOR_TEMP, ALERT_INYEC, COLOR_INY, imgbtn, queryOF, GRAFICO, GRAFTITLE: data.PRODUCTO, arrgrafpersonal, codigo: data.MAQUINA,arr_sel_show})
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
  var anterior = moment().subtract(30, 'days').format('YYYY/MM/DD').split('/').join('-');
  var hoy = moment().format('YYYY/MM/DD').split('/').join('-');
  var TITULO = "CFS 450 IQF 1";
  var fechaInicial = anterior+"T00:00:00.000+00:00";
  var fechaFinal = hoy+"T00:00:00.000+00:00";
  var query1 = await modInject.find({$and: [{FECHA: {$gte: fechaInicial}},{FECHA: {$lte: fechaFinal}},{PROGRAMA: 91}]});
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

// dep -- ruta para cargar of masivamente
router.post('/uploadof', async (req, res) => {
  const OPERARIO = req.body.OPERARIO;
  res.render('PAICO/loadof', {OPERARIO})
});

//dep-- ruta para cargar inyecciones masivamente
router.post('/uploadinyeccion', async (req, res) => {
  const OPERARIO = req.body.OPERARIO;
  res.render('PAICO/loadinyeccion', {OPERARIO})
});

//dep-- ruta que recive el excel con los datos para ser procesado y cargado
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
router.post('/xlsxpamco', async(req, res) => {
  var OPERARIO = req.body.OPERARIO;
  var eccel = req.files.ARCHIVO;
  var libro = xlsx.read(eccel.data);
  var hoja = libro.SheetNames[0];
  var lineas = xlsx.utils.sheet_to_json(libro.Sheets[hoja]);

  function formHora(codestr) {
    var fecha = ((codestr - (25567 + 1)) * 86400 * 1000);
    var fecha1 = new Date(fecha);
    var hora = fecha1.getUTCHours()<10?"0"+fecha1.getUTCHours():fecha1.getUTCHours();
    var mm = fecha1.getUTCMinutes()<10?"0"+fecha1.getUTCMinutes():fecha1.getUTCMinutes();
    var spt = hora+':'+mm
    return spt;
  }
  function formFecha(codeFCA) {
    var f1 = codeFCA.split('.')
    var f2 = f1[2]+"-"+f1[1]+"-"+f1[0]
    return f2;
  }
  function formPorcent(codeX) {
    var c1 = codeX * 100
    var c2 = Math.round(c1)
    return c2;
  }
  function IsOnRange(por, optmo) {
    if(Number(por) < Number(optmo)) return "BAJO"
    if(Number(por) > Number(optmo)) return "ALTO"
  }

  //recorido de excel
  var arrdata = [];
  for (let gr = 0; gr < lineas.length; gr++) {
    const itm = lineas[gr];
    var fecha = await formFecha(itm['Fecha'])
    var hora = await formHora(itm['Hora'])
    var fechora = fecha+"T"+hora+':00.000Z';
    var forcent = formPorcent(itm['% de Inyeccion'])
    //console.log(fechora)
    await consultCPX(itm['Codigo'])
    const inser = await modInject({
      OF: itm['OF'],
      FECHA: fechora,
      HORA: hora,
      KG_IN: itm['kg Entrada'],
      KG_OUT: itm['Kg Salida'],
      PRODUCTO: itm['Codigo'],
      MAQUINA: itm['LINEA'],
      SUPERVISADO: itm['Supervisor'].toUpperCase(),
      OPERARIO: itm['Operador'].toUpperCase(),
      X_INYECTED: forcent,
      RANGO: await IsOnRange(forcent,xinyectOPTMOfolder),
      FILE: "TO-FILE-ONE",
      X_INYECTED_OPTIMO:xinyectOPTMOfolder
    });
    const sert = inser.save()
  }
  
  
  
  // FUNCIO QUE RECIVE EL PORCENTAGE DE INYECCION ACTUAL MAS EL CODIGO DEL PRODUCTO PARA BUSCAR EL CODIGO EN LA DB Y TRAER EL PORCENTAGE DE INYECCION OPTIMO
  // PARA CALCULAR EL PORCENTAGE ALTO Y BAJO Y COMPARARLO CON EL PORCENTAGE DE INYECCION ACTUAL
  var codigoFolder = ''
  var productoFolder = ''
  var xinyectOPTMOfolder = ''
  async function consultCPX(cod_pro) {
    if(cod_pro === codigoFolder){
      return
    } else {
      var query = await modprodto.findOne({COD_PRODUCTO: cod_pro});
      //console.log('con '+query.PRODUCTO, query.POR_INY_OPTMO)
      codigoFolder = cod_pro;
      productoFolder = query.PRODUCTO;
      xinyectOPTMOfolder = query.POR_INY_OPTMO;
    };
  };

  res.status(200).json({status:200, data: lineas.length})
});

// ruta que permite subri el pamco via excel
router.post('/cargardatos',async(req, res) => {
  const {OPERARIO, MAQUINA} = req.body;
  //console.log(OPERARIO, MAQUINA)
  res.render('PAICO/cargardatos',{OPERARIO})
})

//ruta que permite visualizar el menu de datos
router.post('/datos',async(req, res) => {
  const {OPERARIO, MAQUINA} = req.body;
  const machines = ['CFS 450 IQF 1', 'CFS 650 IQF 4', 'CFS 650 TRUTRO NORTE', 'CFS 650 TRUTRO SUR', 'METALQUIMIA'];
  var countMachn = [];
  for (let asd = 0; asd < machines.length; asd++) {
    const mans = machines[asd];
    const l = await modInject.find({MAQUINA: mans}).countDocuments();
    countMachn.push({MAQUINA: mans, COUNT: l})
  }
  
  res.render('PAICO/datos',{OPERARIO,countMachn})
})

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

// //funcion temporal para agregar los datos de los operadores de la plataforma
// async function addData_() {
//   var arr_save = [
//     {NOMBRE: 'OLGUIN OSCAR', RUT: '13558567-K',MAQUINA: 'IQF', BOSS_LINE: 'GUILLERMO NARVAEZ', STADO: true},
//     {NOMBRE: 'TORO IAIAS', RUT: '20464275-3',MAQUINA: 'IQF', BOSS_LINE: 'GUILLERMO NARVAEZ', STADO: true},
//     {NOMBRE: 'NARANJO ALEJANDRO', RUT: '13771548-1',MAQUINA: 'IQF', BOSS_LINE: 'GUILLERMO NARVAEZ', STADO: true},
//     {NOMBRE: 'ROJAS MAURICIO', RUT: '10374175-0',MAQUINA: 'IQF', BOSS_LINE: 'GUILLERMO NARVAEZ', STADO: true},
//     {NOMBRE: 'HUERTA PATRICIO', RUT: '18960237-5',MAQUINA: 'METALQUIMIA', BOSS_LINE: 'GUILLERMO NARVAEZ', STADO: true},
//     {NOMBRE: 'IBARRA CRISTOPHER', RUT: '15533225-5',MAQUINA: 'METALQUIMIA', BOSS_LINE: 'GUILLERMO NARVAEZ', STADO: true},
//     {NOMBRE: 'LUIS RUBIO', RUT: '15964744-7',MAQUINA: 'ISHIDA', BOSS_LINE: 'OCTAVIO MUNOZ', STADO: true},
//     {NOMBRE: 'JONATHAN VARGAS', RUT: '17081291-3',MAQUINA: 'ISHIDA', BOSS_LINE: 'OCTAVIO MUNOZ', STADO: true},
//     {NOMBRE: 'CARLOS LAZO', RUT: '11628677-7',MAQUINA: 'ISHIDA', BOSS_LINE: 'OCTAVIO MUNOZ', STADO: true},
//     {NOMBRE: 'LUIS FARIAS', RUT: '13771600-3',MAQUINA: 'ISHIDA', BOSS_LINE: 'OCTAVIO MUNOZ', STADO: true},
//     {NOMBRE: 'JAVIER GALLEGUILLOS', RUT: '19411323-4',MAQUINA: 'ISHIDA', BOSS_LINE: 'OCTAVIO MUNOZ', STADO: true},
//     {NOMBRE: 'JEUDY DOMINIQUE', RUT: '25970249-6',MAQUINA: 'ISHIDA', BOSS_LINE: 'OCTAVIO MUNOZ', STADO: true},
//     {NOMBRE: 'RODRIGUEZ MIGUE', RUT: '26320174-4',MAQUINA: 'ISHIDA', BOSS_LINE: 'OCTAVIO MUNOZ', STADO: true},
//   ]
//   await modUser.insertMany(arr_save)
// }
// addData_()

module.exports = router;


// //1.- menu **EN DESARROLLO MODULO DE NUEVA SELECCION DE OF POR PRODUCTO
// router.post('/menu', async(req, res) => {
//   const OPERARIO = req.body.OPERARIO.toUpperCase();
//   const codigo = req.body.producto;
//    //console.log(codigo, OPERARIO);
//   var imgbtn = await maqInyectora(codigo);
//   var ALERTA = false;
//   var maquinaria = "";

//   if (codigo === "CFS 450 IQF 1") {
//     maquinaria = "IQF";
//   }
//   if(codigo === "CFS 650 IQF 4"){
//     maquinaria = "IQF";
//   }
//   if(codigo === "CFS 650 TRUTRO NORTE"){
//     maquinaria = "ISHIDA";
//   }
//   if(codigo === "CFS 650 TRUTRO SUR"){
//     maquinaria = "ISHIDA";
//   }
//   if(codigo === "METALQUIMIA"){
//     maquinaria = "METALQUIMIA";
//   }

//   var _f = new Date();
//   var dia = _f.getDate()-2;//dias a tras para generar busqueda de OFs
//   var yyyy = _f.getFullYear();
//   var mm2 = _f.getMonth()+1;
//   var mm = mm2<10?"0"+mm2:mm2;
//   var dd = dia<10?"0"+dia:dia;
//   var leDate = `${yyyy}-${mm}-${dd}T00:00:00.000+00:00`
//   //var queryOF = await modOf.find({FECHA_PRODUCT: {$gte:leDate}}).sort({N_OF: -1}).limit(15);
//   // var queryOF = await modOf.find({$and: [{FECHA_OF: {$gte:leDate}},{LINEA: maquinaria},{ESTADO:{$not:/A/}}]}).sort({N_OF: -1});
//   var arr_of = [];
//   var queryOF = await modOf.find({$and: [{FECHA_OF: {$gte:leDate}},{LINEA: maquinaria},{ESTADO:{$not:/A/}}]}, (err,obje)=>{
//     const arrOFS = obje.map(dat=> dat.N_OF)
//     arr_of = arrOFS
//   })

//   var arr_data = [];
//   for (let frg = 0; frg < arr_of.length; frg++) {
//     const itm4 = arr_of[frg];
//     await modOf.findOne({N_OF:itm4},async(err,obje)=>{
//       await modprodto.findOne({COD_PRODUCTO: obje.COD_ARTICULO},(err,bjos)=>{
//         //console.log(bjos)
//         arr_data.push({PRODUCTO:bjos.PRODUCTO,N_OF:obje.N_OF,LINEA:obje.LINEA,FECHA:obje.FECHA_OF, COD_PRODUCT:obje.COD_PRODUCTO})
//         //return ({PRODUCTO:bjos.PRODUCTO,N_OF:obje.N_OF,LINEA:obje.LINEA,FECHA:obje.FECHA_OF})
//         return
//       })
//     })
//   }
  
//   var arr_select = [];
//   for (let xcvd = 0; xcvd < arr_data.length; xcvd++) {
//     const fdat = arr_data[xcvd];
//     if(arr_select.length == 0)arr_select.push(fdat.PRODUCTO)
//     else{
//       var esta = arr_select.includes(fdat.PRODUCTO)
//       if(!esta)arr_select.push(fdat.PRODUCTO)
//     }
//   }
//   function formatFecha(fech) {
//     var a = new Date(fech);
//     var dd = a.getDate()<10?"0"+a.getDate():a.getDate();
//     var mm = (a.getMonth()+1)<10?"0"+(a.getMonth()+1):(a.getMonth()+1);
//     return dd+"/"+mm
//   }
//   var arr_sel_show = [];
//   var arrtemp1 = [];
//     for (let ret = 0; ret < arr_select.length; ret++) {
//       const sel_fin = arr_select[ret];
//       for (let esdf = 0; esdf < arr_data.length; esdf++) {
//         const sel_int = arr_data[esdf];
//         //console.log(sel_int)
//         if(sel_fin === sel_int.PRODUCTO){
//           arrtemp1.push({OF:sel_int.N_OF,FECHA: await formatFecha(sel_int.FECHA)})
//         }
//       }
//       arr_sel_show.push({PRODUCTO:sel_fin,OF:arrtemp1})
//       arrtemp1 = [];
//     }
// // console.log(arr_sel_show)

//  res.render('PAICO/menu', {OPERARIO, ALERTA, codigo, imgbtn, queryOF, maquinaria,arr_sel_show})
// });