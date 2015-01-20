'use strict';

var dbc          = require('dbc');
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
   var client_id   = msg.token.client_id
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


var processMongrel2Message = function (msg, errCallback) {

   this.logger.log('debug', msg);

   if ( msg.headers.METHOD === 'GET' ){
      return getPermissions(msg)
   }
   else if ( msg.headers.METHOD === 'POST' ){
      return postPermissions(msg,errCallback)
   }
};


module.exports.init                   = init;
module.exports.processMongrel2Message = processMongrel2Message;