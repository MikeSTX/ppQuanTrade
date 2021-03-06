#!/usr/bin/env node

/*
 * This module is a bridge between a remote server and the client
 * It uses 0MQ to dispatch bi-directionnal messages to clients according to the channel parameter
 * In addition it can run local program (with futur cluster module, one per core actually)
 */

//TODO Use optimist or other cli tools to configure those ugly harcoded uri
var zmq          = require('zmq')
    , nma        = require('android_notify')
    , worker     = require('worker')
    , backPort   = 'tcp://127.0.0.1:5570'
    , frontPort  = 'tcp://127.0.0.1:5555'
    , logger_uri = 'tcp://127.0.0.1:5540';
    

function createQueueDevice(frontPort, backPort) {
    // Type of data the forwarder will route to the client
    var filters = [];

    // Socket connected to client
    var frontSocket = zmq.socket('router'),
    // Socket connected to local processes
        backSocket = zmq.socket('dealer');

    frontSocket.identity = 'router' + process.pid;
    backSocket.identity = 'dealer' + process.pid;
    
    frontSocket.bind(frontPort, function (err) {
        console.log('Frontend connection bound to', frontPort);
    });

    // Depending of type, route messages from "envelope" to everybody connected to backsocket
    // Or fork a new process with the configuration received
    // Or use it for its own configuration
    frontSocket.on('message', function(envelope, data) {
        console.log(frontSocket.identity + ': received from ' + envelope + ' - ' + data.toString());
        json_data = JSON.parse(data);

        // Fork request, use worker node to spawn the process with its configuration, all specified in the message
        if (json_data.type == 'fork') {
            console.log('Processing fork request...');
            worker.run(json_data, backSocket, frontSocket, envelope);
        }

        // Forwarder conofiguration message
        //NOTE handle only log configuration, and not really sophisticated
        else if (json_data.type == 'configure') {
            console.log('Configuring forwarder...');
            filters = json_data.filters
            createZmQLogHandler(logger_uri, frontSocket, json_data.verbose, json_data.log_redirection);
        }

        else if (json_data.type == 'acknowledgment') {
            if (json_data.statut != 0) {
                console.log('** Error on client side')
            }
        }

        // All other types route to backend socket, not that sophisticated neither
        else {
            console.log('Routing data to backend socket...')
            backSocket.send(JSON.stringify(json_data))
        }
    });

    backSocket.bind(backPort, function (err) {
        console.log('Backend connection bound to', backPort);
    });
    
    // Route every message from clients, connected to backsocket, to clients connected to frontsocket
    // whose identity is json_data.channel.
    backSocket.on('message', function(data) {
        console.log(backSocket.identity + ': route data to frontend');
        json_data = JSON.parse(data)

        // For android channel use NotifyMyAndroid module
        if (json_data.channel == 'android') {
            //NOTE could use below function to check if send a notification is possible
            //nma.check_key(nma.apikey)
            nma.notify(nma.apikey, json_data.appname, json_data.title, json_data.description, json_data.priority);
        }
        else {
            for (var i=0; i < filters.length; i++) {
                if (json_data.type == filters[i]) {
                    frontSocket.send([json_data.channel, JSON.stringify(json_data)]);
                }
            }
        } 
    });

    // Route logbook zmq messages to clients with json_data.channel identity
    // see notes.rst for message json fields
    function createZmQLogHandler (uri, logSocket, verbose, redirection) {
        console.log('Setting up ZMQ distributed logger with level,  %d, redirected to %s', verbose, redirection)

        // Subscriber socker as logbook use publisher socket whith channel ''
        var socket = zmq.socket('sub');
        socket.identity = 'logbooksub' + process.pid;
        socket.subscribe('');

        socket.on('message', function(data) {
            json_data = JSON.parse(data)
            redirection = (typeof redirection == 'undefined') ? json_data.channel : redirection;
            // Sends to 'ZMQ Messaging' client if the level is relevant
            if (json_data.level >= verbose) {
                console.log('App logged: ' + json_data.msg);
                logSocket.send([redirection, JSON.stringify(json_data)])
            }
        });

        socket.connect(uri, function(err) {
            if (err) throw err;
            console.log('ZMQ distributed logger connected on ', uri);
        });
    };
    //createZmQLogHandler(logger_uri, frontSocket);
}

createQueueDevice(frontPort, backPort);
