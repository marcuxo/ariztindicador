const mongoose = require('mongoose');
require('dotenv').config();
mongoose.set('useFindAndModify', false);
//mongoose.connect('mongodb://marcuxo:abc123abc@200.35.158.174:27017/admin', {//marcuxo:abc123
mongoose.connect(`mongodb://${process.env.DBUSER}:${process.env.DBPASS}@200.35.158.174:27017/${process.env.DBNAME}`, {//marcuxo:abc123
  useUnifiedTopology: true,
  useCreateIndex: true,
  useNewUrlParser: true
})
  .then(db => console.log('|=>DDBB'))
  .catch(err => console.error(err));
  DBCONN = mongoose.connection.useDb('indicador_inject');
  module.exports = {DBCONN};