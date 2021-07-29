const mongoose = require('mongoose');
const { Schema } = mongoose;
const {DBCONN} = require('../CONN.DDBB')

const ofSchema = new Schema({
  "PLANTA": { type: String, default: "129"},
  "N_OF": { type: Number },
  "FECHA_SACRIF": { type: Date, default:"NO-FECHA" },
  "FECHA_OF": { type: Date, default:"NO-FECHA" },
  "FECHA_PRODUCT": { type: Date, default:"NO-FECHA" },
  "COD_ARTICULO": { type: String },
  "NOM_ARTICULO": { type: String },
  "N_PROGRAM": { type: String },
  "LINEA": { type: String },
  "ESTADO": { type: String, default: "SIN ESTADO"},
  "FILE": {type: String, default: "TO-APP"}
});

module.exports = DBCONN.model('ofs', ofSchema);