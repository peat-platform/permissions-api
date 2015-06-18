/**
 * Created by dconway on 05/03/15.
 */
'use strict';

var openiLogger = require('openi-logger');
var openiUtils = require('openi-cloudlet-utils');
var zmq = require('m2nodehandler');


var handler = function (config, senderToDao, senderToClient) {

   zmq.receiver(config.internal_handler.source, config.internal_handler.sink, function (msg) {

      var body     = msg.body;
      var postData = body.request.data;
      var clients  = body.response.result;

      console.log("body", body);

      var valid = false;

      for ( var i in clients ) {
         if ( clients[i].api_key !== undefined && clients[i].api_key === postData.app_api_key && valid === false) {
            valid = true;
         }
      }

      if ( valid ) {
         var key = postData.app_api_key + "_" + new Date().getTime();

         //TODO: Type Validation
         var appPermissions = {
            _date_created: new Date().toJSON(),
            permissions  : postData.permissions,
            types        : postData.types
         };


         if ( undefined !== appPermissions.permissions ) {
            senderToDao.send( {
               'dao_actions': [
                  {
                     'action'     : 'APP_PERMISSIONS',
                     'database'   : key,
                     'object_data': appPermissions,
                     'resp_type'  : 'permissions_create',
                     'bucket'     : 'app_permissions'
                  }
               ],
               'mongrel_sink' : config.mongrel_handler.sink,
               'clients'    : [
                  {
                     'uuid'  : msg.uuid,
                     'connId': msg.connId
                  }
               ]
            });
         }
      }
      else {
         senderToClient.send(msg.uuid, msg.connId, zmq.status.BAD_REQUEST_400, zmq.standard_headers.json,
            {'error':'Not Authorised to change app permissions'});
      }


   });
};

module.exports = handler;