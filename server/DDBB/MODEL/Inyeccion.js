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
  "X_INYECTED_OPTIMO": { type: String },
  "PRODUCTO": { type: String },
  "PRESS_MAQ": { type: String, default: "DEFAULT"  },
  "VEL_CINT_MAQ": { type: String, default: "DEFAULT" },
  "GOLP_X_MAQ": { type: String, default: "DEFAULT"  },
  "FILTER_CLEAM_MAQ": { type: String, default: "DEFAULT" },
  "OF": { type: String, default: "DEFAULT" },
  "TEMP_MAQ": { type: String, default: "DEFAULT" },
  "SUPERVISADO": { type: String, default: "NOVISADO"},
  "RANGO": { type: String},
  "FILE": {type: String, default: "TO-APP"},
  "PROGRAMA": {type: Number, default: 0 }
});

module.exports = DBCONN.model('Inyeccion', inyectoSchema);