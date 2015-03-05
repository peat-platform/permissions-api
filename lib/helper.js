'use strict';

var openiLogger  = require('openi-logger');
var openiUtils   = require('openi-cloudlet-utils');

var type         = ['type','object']
var level        = ['app','cloudlet']
var crud         = ['create','read','update','delete']


var init = function(logger_params){
   this.logger  = openiLogger(logger_params);
};


var parsePermissions = function(client_perms, errCallback){

   var server_perms = { '@objects' : {}, '@types' : {} }

   for ( var i = 0; i < client_perms.length; i++ ){
      var perm = client_perms[i]

      if( -1 === type.indexOf(perm.type.toLowerCase())){
         errCallback("Incorrect type, must be one of: type or object")
         return;
      }

      if( -1 === level.indexOf(perm.access_level.toLowerCase())){
         errCallback("Incorrect Access Level, must be one of: APP or CLOUDLET")
         return;
      }

      if( -1 === crud.indexOf(perm.access_type.toLowerCase())){
         errCallback("Incorrect Access Type, must be one of: CREATE, READ, UPDATE, or DELETE")
         return;
      }

      if ( 'object' === perm.type){
         if(!openiUtils.isObjectId(perm.ref)) {
            errCallback("Object Reference: Invalid Object id")
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
      else if ( 'GraphObject' === perm.type ){
         console.log("TODO: Add type id mapping")
      }

   }

   return server_perms
}

var getPermissions = function(msg){

   var cloudlet_id = msg.token.cloudlet
   var client_id   = msg.token.client_id
   var third_party = msg.token.context

   //var key         = third_party + "+" + client_id + "+" + cloudlet_id
   var key         = third_party + "+" + cloudlet_id

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

   var cloudlet_id = msg.token.cloudlet
   var third_party = msg.token.context

   //var key         = third_party + "+" + client_id + "+" + cloudlet_id
   var key         = third_party + "+" + cloudlet_id

   var permissions = {
      _date_created : new Date().toJSON(),
      status        : 'unpropagated',
      perms         : parsePermissions(msg.json, errCallback)
   }

   if(undefined !== permissions.perms) {
      return {
         'dao_actions': [
            {
               'action'     : 'UPDATE_PERMISSIONS',
               'database'   : key,
               'object_data': permissions,
               'cloudlet_id': cloudlet_id,
               'third_party': third_party,
               'resp_type'  : 'permissions_create',
               'bucket'     : 'permissions'
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

var parseAppPermissions = function(client_perms, errCallback){

   var perms = client_perms.perms
   var types = client_perms.types

   var data = { 'perms' : [], 'types' : types }

   data.perms = parsePermissions(msg.json, errCallback);

   return data;

}


var getAppPermissions = function(msg) {

   //1e35ac717f53c96b1b3c4c40894c349e
   console.log("msg.path", msg.path)

   var key = msg.path.replace('/api/v1/app_permissions/', '')

   //TODO: make more robust
   //extract key
   //return error if not there

   //var key = '1e35ac717f53c96b1b3c4c40894c349e'

   var startKey = [key];
   var endKey   = [key + '\uefff' ];

   return {
      'dao_actions': [
         {
            'action'     : 'VIEW',
            'database'   : key,
            'design_doc' : "permission_views",
            'view_name'  : "app_permissions",
            'start_key'   : startKey ,
            'end_key'     : endKey,
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
}


var putAppPermissions = function(msg, errCallback){

   var key          = msg.json.app_api_key + "_" + new Date().getTime()

   //TODO: Type Validation
   var appPermissions = {
      _date_created : new Date().toJSON(),
      permissions   : msg.json.permissions,
      types         : msg.json.types
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


var processMongrel2Message = function (msg, errCallback) {

   this.logger.log('debug', msg);

   if ( msg.headers.METHOD === 'GET' ){
      if(msg.headers.PATH.indexOf("app_") >= 0){
         return getAppPermissions(msg)
      }
      else {
         return getPermissions(msg)
      }
   }
   else if ( msg.headers.METHOD === 'POST' ){
      return postPermissions(msg,errCallback)
   }
   else if ( msg.headers.METHOD === 'PUT' ){
      return putAppPermissions(msg,errCallback)
   }
};


module.exports.init                   = init;
module.exports.processMongrel2Message = processMongrel2Message;