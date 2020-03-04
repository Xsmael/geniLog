const Syslog = require('simple-syslog-server') ;
var log= require('noogger');
// Create our syslog server with the given transport
const socktype = 'UDP' ; // or 'TCP' or 'TLS'
const address = '' ; // Any
const port = 514 ;
var server = Syslog(socktype) ;
 
// State Information
var listening = false ;
var clients = [] ;
var count = 0 ;
 
server.on('msg', data => {
    // console.log(typeof data.tag);
    let tag= data.tag;
    if(tag.startsWith("logportalauth")) {
        log.notice( data.msg+' at '+data.timestamp);
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
 