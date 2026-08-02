const express = require('express');
const app = express();
const path = require('path');
const bodyParser = require("body-parser");
const PORT = process.env.PORT || 8000;

require('events').EventEmitter.defaultMaxListeners = 500;

let code = require('./pair');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/code', code);

app.get('/update-config', (req, res) => {
    res.send("Update config route working ✅");
});

app.get('/pair', (req, res) => {
    res.sendFile(path.join(__dirname, 'pair.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'main.html'));
});

app.listen(PORT, () => {
    console.log(`
 ██████╗  ██╗  ██╗ ██████╗ ███████╗████████╗
██╔════╝  ██║  ██║██╔═══██╗██╔════╝╚══██╔══╝
██║  ███╗ ███████║██║   ██║███████╗   ██║   
██║   ██║ ██╔══██║██║   ██║╚════██║   ██║   
╚██████╔╝ ██║  ██║╚██████╔╝███████║   ██║   
 ╚═════╝  ╚═╝  ╚═╝ ╚═════╝ ╚══════╝   ╚═╝   

👻 NEXUS MD SERVER ONLINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ Bot    : NEXUS MD
🌐 URL    : http://localhost:${PORT}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
});

module.exports = app;
