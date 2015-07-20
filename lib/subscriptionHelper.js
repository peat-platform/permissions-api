/**
 * Created by dconway on 16/06/15.
 */

'use strict';
var squel         = require("squel");
var zmq      = require('m2nodehandler');
var couchbase  = require('couchbase');



var getAppSubscriptions = function (msg, api_key, config) {

   var senderToSubscription = zmq.sender({ spec : 'tcp://127.0.0.1:49500', id : 'f', bind : false, type : 'pub', isMongrel2 : false });
   var cluster = new couchbase.Cluster( 'couchbase://localhost' );
   var bucket = cluster.openBucket('objects');
   bucket.enableN1ql('localhost:8093');

   var meta = {
      limit  : 50,
      offset : 0
   };

   var n1ql = squel.select();

   n1ql.from("objects")
      .field('`@id` as id')
      .field('`@data`')
      .limit(meta.limit)
      .offset(meta.offset);

   n1ql.where('`@data`.client_id = "' + api_key + '"');


   n1ql = couchbase.N1qlQuery.fromString(n1ql.toString());

   bucket.query(n1ql, function(err, res)
   {
      if (err) {
         console.log("Error running N1QL Query for OPENi Subscriptions: " + err);
      }
      else {
         senderToSubscription.send({
            'type'    : 'appSubs',
            'result' : res,
            'token'   : msg.token
         });
      }
   });

};




module.exports.getAppSubscriptions = getAppSubscriptions;