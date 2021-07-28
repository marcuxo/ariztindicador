const mongoose = require('mongoose');
const { Schema } = mongoose;
const {DBCONN} = require('../CONN.DDBB')

const inyectoSchema = new Schema({
  "MAQUINA": { type: String },
  "OPERARIO": { type: String },
  "CODIGO": { type: String },
  "FECHA": { type: Date },
  "HORA": { type: String },
  "KG_IN": { type: String },
  "KG_OUT": { type: String },
  "X_INYECTED": { type: String },
  "PRODUCTO": { type: String },
  "PRESS_MAQ": { type: String },
  "VEL_CINT_MAQ": { type: String, default: "DEFAULT" },
  "GOLP_X_MAQ": { type: String },
  "FILTER_CLEAM_MAQ": { type: String, default: "DEFAULT" },
  "OF": { type: String, default: "DEFAULT" },
  "TEMP_MAQ": { type: String},
  "SUPERVISADO": { type: String, default: "NOVISADO"},
  "RANGO": { type: String},
  "FILE": {type: String, default: "TO-APP"},
  "PROGRAMA": {type: Number}
});

module.exports = DBCONN.model('Inyeccion', inyectoSchema);