const express = require('express');
const cors = require('cors');
const path = require('path');
const fileupload = require('express-fileupload');
const expHBS = require('express-handlebars');
const app = express();
//require('./DDBB/CONN.DDBB')


// settings
// app.set('port', 4084);
app.set('port', process.env.PORT);
app.set('views', path.join(__dirname, 'views'));
app.engine('.hbs', expHBS({
  defaultLayout: 'injectmain',
  layoutsDir: path.join(app.get('views'), 'principal'),
  partialsDir: path.join(app.get('views'), 'bodynjection'),
  extname: '.hbs'
}));
app.set('view engine', '.hbs');

app.use(cors());
app.use(fileupload());
app.use(express.json());
app.use(express.urlencoded({ extended: true}));

app.use('/paico', require('./rutas/Paico'));
//app.use('/ochagavia', require('./rutas/Ochagavia'));

app.use(express.static(path.join(__dirname, 'public')));

app.listen(app.get('port'), ()=> {
  console.log(`|=>${app.get('port')}`);
});