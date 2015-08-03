'use strict';

var peatLogger  = require('peat-logger');
var peatUtils   = require('cloudlet-utils');
var dbc         = require('dbc');
var subscriptions = require('./subscriptionHelper');

var type         = ['type','object'];
var level        = ['app','cloudlet'];
var crud         = ['create','read','update','delete'];
var config;

var init = function(conf){
   config = conf;
};


var parsePermissions = function( client_perms, errCallback ){

   if (null === client_perms || undefined === client_perms || Object.prototype.toString.call( client_perms ) !== '[object Array]') {
      errCallback("Invalid format: permissions body not found.");
      return;
   }

   var server_perms = { '@objects' : {}, '@types' : {}, '@service_enabler' : {} };

   for ( var i = 0; i < client_perms.length; i++ ){
      var perm = client_perms[i];

      if( undefined === perm.type || undefined === perm.ref ){
         errCallback("Invalid permission: ", perm);
         return;
      }

      if ( "object" == perm.type || "type" == perm.type ){
         if( undefined === perm.access_type || undefined === perm.access_level){
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
      }
      else {
         if( undefined === perm.app_id || !isAppAPIKey(perm.app_id)){
            errCallback("Invalid app id: ", perm);
            return;
         }
         if( undefined === perm.cloudlet || null === peatUtils.isCloudletId( perm.cloudlet)){
            errCallback("Invalid cloudlet id: ", perm);
            return;
         }
         if( undefined === perm.ref ||  "" === perm.ref){
            errCallback("Invalid Service Enabler ref: ", perm);
            return;
         }
      }


      if ( 'object' === perm.type){
         if(!peatUtils.isObjectId(perm.ref)) {
            errCallback("Object Reference: Invalid Object id");
            return;
         }
         if ( undefined === server_perms['@objects'][perm.ref] ){
            server_perms['@objects'][perm.ref] = {}
         }
         server_perms['@objects'][perm.ref][perm.access_type.toLowerCase()] = true
      }
      else if ( 'type' === perm.type ){

         if(!peatUtils.isTypeId(perm.ref)) {
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

         server_perms['@service_enabler'][perm.app_id] = perm

      }

   }

   return server_perms;
};



var isValidSE = function(count, ses, errCallback){

   if (0 === count && undefined === ses){
      return true
   }

   for ( var i = 0; i < ses.length; i++ ) {
      var se = ses[i];


      if (undefined === se.app_id || !isAppAPIKey(se.app_id)) {
         errCallback("Invalid app id: ", se.app_id);
         return false;
      }
      if (undefined === se.cloudlet || null === peatUtils.isCloudletId(se.cloudlet)) {
         errCallback("Invalid cloudlet id: ", se);
         return false;
      }
      if (undefined === se.name || "" === se.name) {
         errCallback("Invalid Service Enabler name: ", se);
         return false;
      }
      if (undefined === se.description || "" === se.description) {
         errCallback("Invalid Service Enabler description: ", se);
         return false;
      }

   }

   return true
}


var isValidPerms = function(app_perms, errCallback){

   var count = 0

   if (null === app_perms || undefined === app_perms) {
      errCallback("Invalid format: permissions body not found.");
      return false;
   }


   for ( var i = 0; i < app_perms.length; i++ ) {
      var perm = app_perms[i];

      if (undefined === perm.type || undefined === perm.ref) {
         errCallback("Invalid permission: ", perm);
         return false;
      }

      if ("object" == perm.type || "type" == perm.type) {
         if (undefined === perm.access_type || undefined === perm.access_level) {
            errCallback("Invalid permission: ", perm);
            return false;
         }

         if (-1 === type.indexOf(perm.type.toLowerCase())) {
            errCallback("Incorrect type, must be one of: type or object");
            return false;
         }

         if (-1 === level.indexOf(perm.access_level.toLowerCase())) {
            errCallback("Incorrect Access Level, must be one of: APP or CLOUDLET");
            return false;
         }

         if (-1 === crud.indexOf(perm.access_type.toLowerCase())) {
            errCallback("Incorrect Access Type, must be one of: CREATE, READ, UPDATE, or DELETE");
            return false;
         }
      }
      else {
         if (undefined === perm.app_id || !isAppAPIKey(perm.app_id)) {
            errCallback("Invalid app id: ", perm);
            return false;
         }
         if (undefined === perm.cloudlet || null === peatUtils.isCloudletId(perm.cloudlet)) {
            errCallback("Invalid cloudlet id: ", perm);
            return false;
         }
         if (undefined === perm.ref || "" === perm.ref) {
            errCallback("Invalid Service Enabler ref: ", perm);
            return false;
         }
      }
   }

   return count
}


var getPermissions = function(msg){

   var cloudlet_id = msg.token.cloudlet;
   var third_party = msg.token.context;
   var app_api_key = extractAppAPIKey(msg.path);

   if (undefined === app_api_key || null === app_api_key || "" === app_api_key){
      app_api_key = msg.token.client_id;
   }

   if (undefined === third_party || null === third_party || "" === third_party){
      third_party = peatUtils.extractCloudletId(msg.path)
   }

   var key = third_party + "+" + cloudlet_id + "+" + app_api_key;

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


var extractAppAPIKey = function(path){

   var api_key_extract = new RegExp(/[^c_][a-z0-9]{32}/);

   var result = api_key_extract.exec(path);

   return (null !== result) ? result[0].replace("/", "") : null;
};


var isAppAPIKey = function(path){

   var api_key_extract = new RegExp(/^[a-z0-9]{32}$/);

   return api_key_extract.test(path);

};


var postPermissions = function(msg, errCallback, senderToDao){

   if (msg.token["peat-token-type"] === "session" && msg.token.scope === "user"){
      var tp = peatUtils.extractCloudletId(msg.path)
      msg.token.context   = tp
      msg.token.client_id = extractAppAPIKey(msg.path)
   }
   else if (msg.token["peat-token-type"] !== "token"){
      errCallback({ error : "Auth token Required"});
      return
   }

   var cloudlet_id = msg.token.cloudlet;
   var app_api_key = extractAppAPIKey(msg.path);
   var third_party = msg.token.context;

   if (undefined === app_api_key || null === app_api_key || "" === app_api_key){
      app_api_key = msg.token.client_id;
   }

   if (undefined === app_api_key || null === app_api_key || "" === app_api_key){
      errCallback({ error : "Error: could not determine api_key"});
      return
   }

   if (undefined === third_party
      || null === third_party
      || undefined === cloudlet_id
      || undefined === cloudlet_id
      || undefined === app_api_key
      || undefined === app_api_key
   ){
      errCallback({ error : "Error: could not determine key"});
      return
   }

   var key         = third_party + "+" + cloudlet_id + "+" + app_api_key;

   var permissions = {
      _date_created : new Date().toJSON(),
      status        : 'unpropagated',
      perms         : parsePermissions(msg.json, errCallback)
   };


   if(undefined !== permissions.perms) {

      var dao_action = [];

      dao_action.push({
         'action'     : 'UPDATE_PERMISSIONS',
         'database'   : key,
         'object_data': permissions,
         'cloudlet_id': cloudlet_id,
         'third_party': app_api_key,
         'third_party_cloudlet': msg.token.context,
         'resp_type'  : 'permissions_create',
         'bucket'     : 'permissions'
      });


      for (var i in permissions.perms['@service_enabler']){
         var se = permissions.perms['@service_enabler'][i];
         subscriptions.getAppSubscriptions(msg, se.app_id, config);
      }

      subscriptions.getAppSubscriptions(msg, app_api_key, config);

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

   var secount      = isValidPerms(msg.json.permissions, errCallback)

   if (false === secount || !isValidSE(secount, msg.json.service_enablers, errCallback)){
      console.log("empty return")
      return;
   }
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


var processMongrel2Message = function (msg, senderToDao, errCallback) {

   if ( msg.headers.METHOD === 'GET' ){
      if(msg.headers.PATH.indexOf("app_") >= 0){
         return getAppPermissions(msg);
      }
      else {
         return getPermissions(msg);
      }
   }
   else if ( msg.headers.METHOD === 'POST' ){
      return postPermissions(msg, errCallback, senderToDao);
   }
   else if ( msg.headers.METHOD === 'PUT' ){
      if(msg.headers.PATH.indexOf("app_") >= 0){
         return putAppPermissions(msg, errCallback);
      }
      else {
         return authorizePermissionAccess(msg, senderToDao, errCallback);
      }
   }
};


module.exports.init                   = init;
module.exports.processMongrel2Message = processMongrel2Message;