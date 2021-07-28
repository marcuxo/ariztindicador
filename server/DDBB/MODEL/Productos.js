const mongoose = require('mongoose');
const { Schema } = mongoose;
const { DBCONN } = require('../CONN.DDBB')

const productoSchema = new Schema({
  "COD_PRODUCTO": { type: String},
  "PRODUCTO": { type: String },
  "MAQUINA": { type: String, default: "DEFAULT" },
  "POR_INY_OPTMO": { type: Number },
  "SALMUERA": { type: String, default:"DEFAULT" },
  "MEAT": { type: String },
  "MERCADO": { type: String, default:"DEFAULT" },
});

module.exports = DBCONN.model('Productos', productoSchema);