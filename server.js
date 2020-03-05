const Syslog = require('simple-syslog-server') ;
var log= require('noogger');
var mysql= require('mysql2');
// Create our syslog server with the given transport
const socktype = 'UDP' ; // or 'TCP' or 'TLS'
const address = '' ; // Any
const port = 514 ;
var db_connection;
var server = Syslog(socktype) ;
var  CONFIG={
    "DB_RECONNECTION_TIMEOUT": 2000,
    "DB_CONFIG": {
        "host": "localhost",
        "user": "root",
        "password": "",
        "database": "captiveportal_stats"
    }
};

connectDB();
// State Information
var listening = false ;
var clients = [] ;
var count = 0 ;
var reLOGIN= /Zone: [\w\d]+ \- Voucher login good for (\d+) min\.: ([A-Za-z0-9]+), ([a-fA-F0-9:]{17}|[a-fA-F0-9]{12}), ([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/i;
var reINVALID= /Zone: [\w\d]+ \- FAILURE: ([\w\W\d\D]*), ([a-fA-F0-9:]{17}|[a-fA-F0-9]{12}), ([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+), Invalid credentials specified/g;
server.on('msg', data => {
    // console.log(typeof data.tag);
    let tag= data.tag;
    if(tag.startsWith("logportalauth")) {
        log.notice( data.msg  );

        if(data.msg.indexOf("Voucher login good for")>-1) {
            let result= reLOGIN.exec(data.msg );
            let info= {
                durantion: result[1],
                code: result[2],
                mac: result[3],
                ip: result[4]
            };
            
            db_connection.execute('INSERT INTO logins(id, code, durantion, mac, ip, time) VALUES (?,?,?,?,NOW())',
            [null, info.code, info.durantion, info.mac, info.ip],
                function (err, results, fields) {
                    if (err) log.error("DB: " + err);
                });
        }
        else if(data.msg.indexOf("LOGIN - TERMINATING SESSION")>-1) {

        }
        else{
            var result;
            if(result= reINVALID.exec(data.msg)) {
                let info= {
                    code: result[1],
                    mac: result[2],
                    ip: result[3],
                    error:'INVALID_CREDENTIAL',
                    errorMsg:'Invalid credentials specified'
                };
                db_connection.execute('INSERT INTO failures(id, code, error, errorMsg, mac, ip, time) VALUES (?,?,?,?,?,?,NOW())',
                [null, info.code, info.error, info.errorMsg, info.mac, info.ip],
                function (err, results, fields) {
                    if (err) log.error("DB: " + err);
                    else log.info("Insert success");
                });
            }
        }        
    }    
    // if(data.tag.contains("php-fpm") ) {
    //     console.log(data.msg);
    // }
    /*
    message received (1) from ::ffff:192.168.1.13:59666
    {
      "facility": "daemon",
      "facilityCode": 3,
      "severity": "info",
      "severityCode": 6,
      "tag": "systemd[1]",
      "timestamp": "2018-12-26T17:53:57.000Z",
      "hostname": "localhost",
      "address": "::ffff:192.168.1.13",
      "family": "IPv6",
      "port": 20514,
      "size": 80,
      "msg": "Started Daily apt download activities."
    }	
    */
})
.on('invalid', err => {
    log.warning('Invalid message format received: '+ err) ;
})
.on('error', err => {
    log.warning('Client disconnected abruptly: '+ err) ;
})
.on('connection', s => {
    let addr = s.address().address ;
   log.debug(`Client connected: ${addr}\n`) ;
    clients.push(s) ;
    s.on('end', () => {
       log.debug(`Client disconnected: ${addr}\n`) ;
        let i = clients.indexOf(s) ;
        if(i !== -1)
            clients.splice(i, 1) ;
    }) ;
})
.listen({host: address, port: port})
.then(() => {
    listening = true ;
   log.debug(`Now listening on: ${address}:${port}`) ;
})
.catch(err => {
    if ((err.code == 'EACCES') && (port < 1024)) {
        log.error('Cannot listen on ports below 1024 without root permissions. Select a higher port number: %o', err) ;
    }
    else { // Some other error so attempt to close server socket
        log.error(`Error listening to ${address}:${port} - %o`, err) ;
        try {
            if(listening)
                server.close() ;
        }
        catch (err) {
            log.warning(`Error trying to close server socket ${address}:${port} - %o`, err) ;
        }
    }
}) ;


function connectDB() {
    db_connection = mysql.createConnection(CONFIG.DB_CONFIG);
    db_connection.on("error", function (err) {
        log.error('DB ERROR: ' + err);
        setTimeout(connectDB, CONFIG.DB_RECONNECTION_TIMEOUT); // AUTO RECONNECTION
    });
    db_connection.connect((err, res) => {
        if (err) log.error(err);
        else {

            log.notice("DB connected");
        
        }
    });
}

 