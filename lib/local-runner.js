/**
 * Created by dmccarthy on 14/11/2013.
 */


'use strict';

var cloudletApi = require('./main.js');

var config = {
   dao_sink        : { spec:'tcp://127.0.0.1:49999', bind:false, type:'push', id:'a' },
   mongrel_handler : {
      source : { spec:'tcp://127.0.0.1:49909', bind:false, type: 'pull', isMongrel2:true, id:'b' },
      sink   : { spec:'tcp://127.0.0.1:49910', bind:false, type: 'pub',  isMongrel2:true, id:'c' }
   },
   internal_handler : {
      source : {spec : 'tcp://127.0.0.1:49570', bind : true,  subscribe: '', type : 'sub', id : 'AuthSource'},
      sink   : {spec : 'tcp://127.0.0.1:49570 ', bind : false, subscribe: '', type : 'pub', id : 'AuthSink', asJson: true}
   },
   subscription_handler : {
      sink : { spec : 'tcp://127.0.0.1:49505', id : 'f', bind : false, type : 'pull', isMongrel2 : true }
   },
   logger_params : {
      'path'     : '/opt/peat/cloudlet_platform/logs/permissions_api',
      'log_level': 'debug',
      'as_json'  : true
   },
   trusted_security_framework_public_key: '-----BEGIN PUBLIC KEY-----\n'+
      'MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBAKT8kGk6ZNo3sC4IIo29leRLVD23T2r0\n'+
      'vWXBEkk2pV42HsxKAmPs789AGHH9XwbGpD7FvrcBWWgb65v32Hg/NGkCAwEAAQ==\n'+
      '-----END PUBLIC KEY-----'
};


cloudletApi(config);