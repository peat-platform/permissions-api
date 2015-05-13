'use strict';

var openiLogger  = require('peat-logger');
var openiUtils   = require('cloudlet-utils');
var dbc         = require('dbc');

var type         = ['type','object'];
var level        = ['app','cloudlet'];
var crud         = ['create','read','update','delete'];
var config;

var init = function(conf){
   config = conf;
   this.logger  = openiLogger(config.logger_params);
};


var parsePermissions = function( client_perms, errCallback ){

   if (null === client_perms || undefined === client_perms) {
      errCallback("Invalid format: permissions body not found.");
      return;
   }

   var server_perms = { '@objects' : {}, '@types' : {}, '@service_enabler' : {} };

   for ( var i = 0; i < client_perms.length; i++ ){
      var perm = client_perms[i];


      if ( 'service_enabler' === perm.type){
         server_perms['@service_enabler'][perm.ref] = perm
         continue
      }

      if( undefined === perm.type || undefined === perm.access_level || undefined === perm.ref || undefined === perm.access_type ){
         errCallback("Invalid permission: ", perm);
         return;
      }

      if( -1 === type.indexOf(perm.type.toLowerCase())){
         errCallback("Incorrect type, must be one of: type or object");
         return;
      }

      if( -1 === level.indexOf(perm.access_level.toLowerCase())){
         errCallback("Incorrect Access Level, must be one of: APP or CLOUDLET");
         return;
      }

      if( -1 === crud.indexOf(perm.access_type.toLowerCase())){
         errCallback("Incorrect Access Type, must be one of: CREATE, READ, UPDATE, or DELETE");
         return;
      }

      if ( 'object' === perm.type){
         if(!openiUtils.isObjectId(perm.ref)) {
            errCallback("Object Reference: Invalid Object id");
            return;
         }
         if ( undefined === server_perms['@objects'][perm.ref] ){
            server_perms['@objects'][perm.ref] = {}
         }
         server_perms['@objects'][perm.ref][perm.access_type.toLowerCase()] = true
      }
      else if ( 'type' === perm.type ){

         if(!openiUtils.isTypeId(perm.ref)) {
            errCallback("Type Reference: Invalid Type ID");
            return;
         }
         if ( undefined === server_perms['@types'][perm.ref] ){
            server_perms['@types'][perm.ref] = {'@app_level' : {}, '@cloudlet_level' : {}}
         }

         if ('app' === perm.access_level.toLowerCase()){
            server_perms['@types'][perm.ref]['@app_level'][perm.access_type.toLowerCase()] = true
         }
         else{
            server_perms['@types'][perm.ref]['@cloudlet_level'][perm.access_type.toLowerCase()] = true
         }
      }
      else if ( 'service_enabler' === perm.type ){

         //service_enablers

         console.log("TODO: Add type id mapping")
      }

   }

   return server_perms;
};

var getPermissions = function(msg){

   var cloudlet_id = msg.token.cloudlet;
   var client_id   = msg.token.client_id;
   var third_party = msg.token.context;

   //var key         = third_party + "+" + client_id + "+" + cloudlet_id
   var key         = third_party + "+" + cloudlet_id;

   return {
      'dao_actions'      : [
         {
            'action'      : 'GET',
            'database'    : key,
            'cloudlet_id' : cloudlet_id,
            'third_party' : third_party,
            'resp_type'   : 'permissions',
            'bucket'      : 'permissions'
         }
      ],
      'clients'      : [
         {
            'uuid' : msg.uuid,
            'connId' : msg.connId
         }
      ]
   };

};


var postPermissions = function(msg, errCallback){

   var cloudlet_id = msg.token.cloudlet;
   var third_party = msg.token.context;

   var key         = third_party + "+" + cloudlet_id;

   var permissions = {
      _date_created : new Date().toJSON(),
      status        : 'unpropagated',
      perms         : parsePermissions(msg.json, errCallback)
   };


   if(undefined !== permissions.perms) {

      var dao_action = []

      dao_action.push({
         'action'     : 'UPDATE_PERMISSIONS',
         'database'   : key,
         'object_data': permissions,
         'cloudlet_id': cloudlet_id,
         'third_party': third_party,
         'resp_type'  : 'permissions_create',
         'bucket'     : 'permissions'
      })

      for (var i in permissions.perms['@service_enabler']){
         var se = permissions.perms['@service_enabler'][i]
         var key = se.cloudlet + "+" + cloudlet_id;

         dao_action.push({
            'action'     : 'UPDATE_PERMISSIONS',
            'database'   : key,
            'object_data': permissions,
            'cloudlet_id': cloudlet_id,
            'third_party': se.cloudlet,
            'resp_type'  : 'permissions_create',
            'bucket'     : 'permissions'
         })
      }

      return {
         'dao_actions': dao_action,
         'clients'    : [
            {
               'uuid'  : msg.uuid,
               'connId': msg.connId
            }
         ]
      };
   }

};


var authorizePermissionAccess = function( msg, senderToDao, errcallback ){


   if(msg['json']['app_api_key'] === null || msg['json']['app_api_key'] === undefined) {
      errcallback("'app_api_key' required");
   }


   var meta = {
      "limit"       : 1000,
      "offset"      : 0,
      "total_count" : 0,
      "prev"        : null,
      "next"        : null
   };

   var action = {
      'dao_actions' : [
         {
            'action'     : 'GENERIC_VIEW',
            'start_key'  : msg.token.cloudlet,
            'end_key'    : msg.token.cloudlet + '\uefff',
            'design_doc' : 'clients_views',
            'view_name'  : "clients_by_cloudlet_id",
            'meta'       : meta,
            'resp_type'  : 'clients',
            'cloudlet'   : msg.token.cloudlet,
            'bucket'     : 'clients',
            'data'       : msg.json
         }
      ],
      'mongrel_sink' : config.internal_handler.sink,
      'clients'     : [
         {
            'uuid'  : msg.uuid,
            'connId': msg.connId
         }
      ]
   };

   //Send Data to dao to retrieve list of client. Client-session authentication performed by internalWorker.js
   senderToDao.send(action);
};


var getAppPermissions = function(msg) {

   var key   = msg.path.replace('/api/v1/app_permissions/', '');
   var meta  = {}
   var order = 'descending'

   if (msg.path.indexOf('app_permissions_latest') !== -1){
      key        = msg.path.replace('/api/v1/app_permissions_latest/', '');
      meta.limit = 1
   }

   var startKey = [key];
   var endKey   = [key + '\uefff' ];

   return {
      'dao_actions': [
         {
            'action'     : 'VIEW',
            'database'   : key,
            'design_doc' : "permission_views",
            'view_name'  : "app_permissions",
            'start_key'  : startKey ,
            'end_key'    : endKey,
            'order'      : order,
            'meta'       : meta,
            'resp_type'  : 'permissions',
            'bucket'     : 'app_permissions'
         }
      ],
      'clients'    : [
         {
            'uuid'  : msg.uuid,
            'connId': msg.connId
         }
      ]
   };
};


var putAppPermissions = function(msg, errCallback){

   var key          = msg.json.app_api_key + "_" + new Date().getTime()

   //TODO: Type Validation
   var appPermissions = {
      _date_created    : new Date().toJSON(),
      permissions      : msg.json.permissions,
      types            : msg.json.types,
      service_enablers : msg.json.service_enablers
   }


   if (undefined !== appPermissions.permissions) {
      return {
         'dao_actions': [
            {
               'action'     : 'APP_PERMISSIONS',
               'database'   : key,
               'object_data': appPermissions,
               'resp_type'  : 'permissions_create',
               'bucket'     : 'app_permissions'
            }
         ],
         'clients'    : [
            {
               'uuid'  : msg.uuid,
               'connId': msg.connId
            }
         ]
      };
   }

};


var processMongrel2Message = function (msg, senderToDao,errCallback) {

   this.logger.log('debug', msg);

   if ( msg.headers.METHOD === 'GET' ){
      if(msg.headers.PATH.indexOf("app_") >= 0){
         return getAppPermissions(msg);
      }
      else {
         return getPermissions(msg);
      }
   }
   else if ( msg.headers.METHOD === 'POST' ){
      return postPermissions(msg, errCallback);
   }
   else if ( msg.headers.METHOD === 'PUT' ){
      if(msg.headers.PATH.indexOf("app_") >= 0){
         return putAppPermissions(msg);
      }
      else {
         return authorizePermissionAccess(msg, senderToDao, errCallback);
      }
   }
};


module.exports.init                   = init;
module.exports.processMongrel2Message = processMongrel2Message;