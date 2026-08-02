const express = require('express');
const app = express();
__path = process.cwd()
const bodyParser = require("body-parser");
const PORT = process.env.PORT || 8000;
let code = require('./pair'); 

require('events').EventEmitter.defaultMaxListeners = 500;

app.use('/code', code);
app.get('/update-config', (req, res) => {
    res.send("Update config route working ✅");
});
app.use('/pair', async (req, res, next) => {
    res.sendFile(__path + '/pair.html')
});
app.use('/', async (req, res, next) => {
    res.sendFile(__path + '/main.html')
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.listen(PORT, () => {
console.log(`
 ██████╗  ██╗  ██╗ ██████╗ ███████╗████████╗
██╔════╝  ██║  ██║██╔═══██╗██╔════╝╚══██╔══╝
██║  ███╗ ███████║██║   ██║███████╗   ██║   
██║   ██║ ██╔══██║██║   ██║╚════██║   ██║   
╚██████╔╝ ██║  ██║╚██████╔╝███████║   ██║   
 ╚═════╝  ╚═╝  ╚═╝ ╚═════╝ ╚══════╝   ╚═╝   

👻 GHOST X MD SERVER ONLINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💖 Don't Forget To Give a Star
⚡ Bot    : GHOST X MD MINI
🌐 URL    : http://localhost:${PORT}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`)

});

module.exports = app;
