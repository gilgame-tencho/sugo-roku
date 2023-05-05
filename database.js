'use strict';

const express = require('express');
const http = require('http');
const path = require('path');
const socketIO = require('socket.io');
const app = express();
const server = http.Server(app);
const io = socketIO(server);
const fs = require('fs');
const yaml = require('yaml');
const { Level } = require('level');

const leveldb = {
    names: new Level(__dirname + '/database/names', { valueEncoding: 'json' }),
}

// ### system param, common methods ###
const server_conf = yaml.parse(fs.readFileSync(__dirname + '/conf/server_conf.yml', 'utf-8'));

class loggerClass{
  constructor(obj={}){
    this.level_no = {
      debug: 1,
      info: 2,
      error: 3,
    };
    this.log_level = this.level_no[server_conf.loglevel];
    this.iam = obj.name;
  }
  // not use.
  log(msg, level='debug'){
      let logmsg = '';
      logmsg += '[' + level;
      logmsg += ' ' + this.iam + '] ';
      logmsg += msg;
      if(this.level_no[level] >= this.log_level){
          console.log(logmsg);
      }
  }
  debug(msg){
    this.log(msg, 'debug');
  }
  info(msg){
      this.log(msg, 'info');
  }
  error(msg){
      this.log(msg, 'error');
  }
}
const logger = new loggerClass({name: this.constructor.name});

// common functions.
function random(range){
  return Math.round(Math.random() * range * 10, 0) % range;
}

async function sleep(msg, wait=500){
  await new Promise(resolve => setTimeout(() => {
    if (msg) logger.info(msg);
    resolve();
  }, wait));
}

class LevelDB{
  constructor(obj={}){
    this.db_name = 'please name.';
    this.mydb = {};
    this.logger = new loggerClass({name: this.constructor.name});
  }
}

class Hoges extends LevelDB{
  constructor(obj={}){
    super(obj);
    // this.db_name = 'names';
    // this.mydb = leveldb.names;
  }
  async init(){}
  async getAll(){}
}

class Names extends LevelDB{
  constructor(obj={}){
    super(obj);
    this.db_name = 'names';
    this.mydb = leveldb.names;
    this.loaded = false;
  }
  async init(){
    const names = fs.readFileSync(__dirname + '/database/names.tsv', 'utf-8');
    logger.info('start init.');
    let names_data = [];
    names.split('\r\n').forEach((raw) => {
        let raw_data = raw.split('\t');
        names_data.push(raw_data);
    });
    for(let i=0; i<names_data.length; i++){
        let name = names_data[i];
        let icon;
        if(name[0] === 'Male'){
            icon = 'f' + (random(3) * 2 + 1);
        }else{
            icon = 'f' + (random(3) * 2 + 2);
        }
        await leveldb.names.put(name[1], {
            gender: name[0],
            name: {
                en: name[1],
                ja: name[2],
            },
            icon: icon,
            level: 1,
            guideline: {
                radian: -135,
                angle: -135 / 360 * 2 * Math.PI,
            },
            class: 'soldier',
            class_status: {},
            ex: 0,
            nex: 100,
            action: 'wait',
        });
    };
    logger.info('end init.');
  }
  async load(){
    if( !this.loaded ){
      this.logger.info("Load go.");
      this.list = await leveldb.names.iterator({}).all();
      await sleep();
      this.logger.info(`Loaded list length: ${this.list.length}`);
      this.loaded = true;
    }
  }
  async getAll(){
    await this.load();
    let result = this.list;
    logger.debug(result);
    return result;
  }
  async gacha(){
    await this.load();
    let rs = random(this.list.length);
    this.logger.debug(this.list[rs]);
    return this.list[rs];
  }
}

// init class objects...
const names = new Names();
const hoges = new Hoges();

class Size{
  constructor(obj={}){
    this.size = 1.0;
  }
}

function math1(sub){
  let obj_a = [];
  let result = sub;
  let max = 100;
  for(let i=0; i<max; i++){
    obj_a.push(new Size());
  }
  obj_a.forEach(element => {
    result += element.size;
  });
  logger.info(`math1 result:${result}`);
  return result;
}

async function func1(ta, wait=500){
  await new Promise(resolve => setTimeout(() => {
    ta = 'Timer after';
    logger.info('Set Timer');
    resolve();
  }, wait));
  return ta;
}

async function func2(param, wait=500){
  await new Promise(resolve => setTimeout(() => {
    logger.info(param);
    resolve();
  }, wait));
  return param;
}

async function app1(){
  logger.info('Start app1');
  let ta = 'before';
  // ta = fs.readFile(__dirname + '/conf/server_conf.yml');
  let abc = 1;

  ta = await func1(ta);
  let call = [1,2,3];
  // forEach is no async.
  await call.forEach(async ele =>{
    await func2(ele, 1000);
  });
  let call2 = [4,5,6];
  // try for apglizm. if want to wait. 
  for(let i=0; i<call2.length; i++){
    await func2(call2[i], 250);
  }
  abc = math1(abc);

  logger.info(`[app1] ta:${ta}, abc:${abc}`);
  logger.info('End app1');
}

function init(){
  names.init();
  hoges.init();
}

function show(){
  names.getAll();
  hoges.getAll();
}

async function rand(size=1){
  let res = [];
  for(let i=0; i<size; i++){
    // ... format. realy?
    let levelres = await names.gacha();
    let jsondata = {};
    jsondata[levelres[0]] = levelres[1];
    res.push(jsondata);
  }
  return res;
}

app.get('/', (request, response) => {
  app1();
  response.send('Sample REST API');
  logger.info('Called get sample');
});

app.get('/names/all', async (request, response) => {
  await show();
  response.send('Sample REST API');
  logger.info('Called get names');
});

app.get('/names/rand', async (request, response) => {
  let size = 1;
  if(request.query.size) size = request.query.size;
  response.send(await rand(size));
  logger.info('Called get rand');
});

app.get('/init', async (request, response) => {
  await init();
  response.send('Sample REST API');
  logger.info('Called get init');
});

server.listen(server_conf.apl_db, function() {
  logger.info(`Starting server on port ${server_conf.apl_db}`);
});
