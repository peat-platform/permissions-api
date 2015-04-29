'use strict';

var jwt      = require('jsonwebtoken');
var zmq      = require('m2nodehandler');
var helper   = require('./helper.js');
var internal = require('./internalWorker.js');


var processMessage = function (config, msg, senderToClient, senderToDao) {

   var daoMsg = helper.processMongrel2Message(msg, senderToDao, function (err) {
      senderToClient.send(msg.uuid, msg.connId, zmq.status.BAD_REQUEST_400, zmq.standard_headers.json, { "error": err });

   });

   if ( undefined !== daoMsg ) {
      daoMsg.mongrel_sink = config.mongrel_handler.sink;
      senderToDao.send(daoMsg);
   }

};


var permissionsApi = function (config) {

   helper.init(config);

   var senderToDao    = zmq.sender(config.dao_sink);
   var senderToClient = zmq.sender(config.mongrel_handler.sink);

   internal(config, senderToDao, senderToClient);

   zmq.receiver(config.mongrel_handler.source, config.mongrel_handler.sink, function (msg) {

      if ( undefined === msg.headers.authorization || null === msg.headers.authorization ) {
         senderToClient.send(msg.uuid, msg.connId, zmq.status.BAD_REQUEST_400, zmq.standard_headers.json, { "error": "Auth token required" });
         return;
      }

      var tokenB64 = msg.headers.authorization.replace("Bearer ", "");

      jwt.verify(tokenB64, config.trusted_security_framework_public_key, function (err, token) {

         if ( token ) {
            msg.token = token;
         }

         if ( undefined !== err && null !== err ) {
            senderToClient.send(msg.uuid, msg.connId, zmq.status.BAD_REQUEST_400, zmq.standard_headers.json, { "error": "Invalid token: " + err });
         }
         else {
            processMessage(config, msg, senderToClient, senderToDao);
         }
      });
   });
};


module.exports = permissionsApi;