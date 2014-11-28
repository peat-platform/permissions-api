/*
 * openi_data_api
 * openi-ict.eu
 *
 * Copyright (c) 2013 dmccarthy
 * Licensed under the MIT license.
 */

'use strict';

var dbc          = require('dbc');
var openiLogger  = require('openi-logger');
var openiUtils   = require('openi-cloudlet-utils');


var init = function(logger_params){
   this.logger  = openiLogger(logger_params);
};


var permissionsCheck = function(msg){

   var key   = msg.token.client_id + "+" + openiUtils.getCloudletId(msg.token)
   var perms = msg.json

   console.log(key, perms)

   return {"error":"incomplete"}

   dbc.assert(null !== msg.json);
   var auth_token, cloudletId, verify, key, permission, cloudletRestURL, cloudletDBObj;


   cloudletId      = openiUtils.getCloudletId(msg.token);
   cloudletRestURL = "http://" + msg.headers.host + '/api/v1/cloudlets/' + cloudletId;

   cloudletDBObj = {
      id             : cloudletId,
      location       : cloudletRestURL,
      alias          : msg.json.alias,
      username       : msg.json.username,
      _date_created  : new Date().toJSON()
   };

   return {
      'dao_actions'      : [
         {
            'action'      : 'POST',
            'database'    : cloudletId,
            'object_name' : 'meta',
            'object_data' : cloudletDBObj,
            'resp_type'   : 'cloudlet',
            'id'          : cloudletId,
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


var parsePermissions = function(client_perms){

   var server_perms = { '@objects' : {}, '@types' : {} }

   for ( var i = 0; i < client_perms.length; i++ ){
      var perm = client_perms[i]
      if ( 'object' === perm.type ){
         if ( undefined === server_perms['@objects'][perm.ref] ){
            server_perms['@objects'][perm.ref] = {}
         }
         server_perms['@objects'][perm.ref][perm.access_type] = true
      }
      else if ( 'type' === perm.type ){
         if ( undefined === server_perms['@types'][perm.ref] ){
            server_perms['@types'][perm.ref] = {'@app_level' : {}, '@cloudlet_level' : {}}
         }

         if ('APP' === perm.access_level){
            server_perms['@types'][perm.ref]['@app_level'][perm.access_type] = true
         }
         else{
            server_perms['@types'][perm.ref]['@cloudlet_level'][perm.access_type] = true
         }
      }
      else if ( 'GraphObject' === perm.type ){
         console.log("TODO: Add type id mapping")
      }
   }

   return server_perms
}


var postPermissions = function(msg){

   var cloudlet_id = openiUtils.getCloudletId(msg.token)
   var third_party = msg.token.client_id

   var key         = third_party + "+" + cloudlet_id

   var permissions = {
      _date_created : new Date().toJSON(),
      status        : 'unpropagated',
      perms         : parsePermissions(msg.json)
   }


   return {
      'dao_actions'      : [
         {
            'action'      : 'UPDATE_PERMISSIONS',
            'database'    : key,
            'object_data' : permissions,
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


var processMongrel2Message = function (msg) {

   this.logger.log('debug', 'process Mongrel 2 Message function');

   this.logger.log('debug', msg);

   if ( msg.headers.METHOD === 'POST' ){

      if ( "/api/v1/permissions/check" === msg.path || "/api/v1/permissions/check/" === msg.path ){
         return permissionsCheck(msg)
      }
      else{
         return postPermissions(msg)
      }
   }
};


module.exports.init                   = init;
module.exports.processMongrel2Message = processMongrel2Message;