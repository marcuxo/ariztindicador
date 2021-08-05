const mongoose = require('mongoose');
const { Schema } = mongoose;
const {DBCONN} = require('../CONN.DDBB')

const userchema = new Schema({
  "NOMBRE": { type: String},
  "RUT": { type: String},
  "MAQUINA": { type: String, default: 'NO-INFO'},
  "BOSS_LINE": { type: String, default: 'NO-INFO'},
  "STADO": { type: Boolean, default: true},
});

module.exports = DBCONN.model('user', userchema);