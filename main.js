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

// ### system param, common methods ###
const server_conf = yaml.parse(fs.readFileSync(__dirname + '/conf/server_conf.yml', 'utf-8'));

const SERVER_NAME = 'main';
const FIELD_WIDTH = server_conf.FIELD_WIDTH;
const FIELD_HEIGHT = server_conf.FIELD_HEIGHT;
const FPS = server_conf.FPS;

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
      logmsg += `[${SERVER_NAME}] `;
      logmsg += `[${level} ${this.iam}] `;
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

class dataBaseClass{
    constructor(obj={}){
        this.url_base = obj.url_base;
        this.table = 'names'
    }
    get(url){
        let data = [];
        http.get(url, function(res){
            logger.debug('call get');
            res.on('data', (chunk) => { data.push(chunk) }).on('end', () => {
                let events = JSON.parse(Buffer.concat(data));
                logger.debug(events[0]);
                console.log(events[0]);
                return events;
            })
        });
    }
    get_rand(){
        this.get(`${this.url_base}${this.table}/rand`);
    }
}
const database_param = {
    url_base: 'http://localhost:3001/',
}
const database = new dataBaseClass(database_param);

class ClientCommonDataManager{
    constructor(obj={}){
        this.id = Math.floor(Math.random()*1000000000);
    }
    toJSON(){
        return {
            id: this.id,
        };
    }
}
class CCDM extends ClientCommonDataManager{
    constructor(obj={}){
        super(obj);
        this.pieces = {};
        this.players = {};
        this.bots = {};
        this.bullets = {};
        this.walls = {};
    }
    toJSON(){
        return Object.assign(super.toJSON(), {
            pieces: this.pieces,
            players: this.players,
            bots: this.bots,
            bullets: this.bullets,
            walls: this.walls,
        });
    }
}

// ### ---

class SugoGameMaster{
    constructor(){
        this.start();
    }
    start(){
        let obj = {
            x: 130, y:130, height:50, width:50
        }
        let piece = new Piece(obj);
        ccdm.pieces[piece.id] = piece;
    }
}

class OriginObject{
    constructor(obj={}){
        this.id = Math.floor(Math.random()*1000000000);
        this.x = obj.x;
        this.y = obj.y;
        this.width = obj.width;
        this.height = obj.height;
    }
    toJSON(){
        return {
            id: this.id,
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
        };
    }
}
class GameObject extends OriginObject{
    constructor(obj={}){
        super(obj);
        this.angle = obj.angle;
        this.direction = obj.direction;

        this.logger = new loggerClass({name: this.constructor.name});
    }
    move(distance){
        const oldX = this.x, oldY = this.y;
        
        this.x += distance * Math.cos(this.angle);
        this.y += distance * Math.sin(this.angle);
        
        let collision = false;
        if(this.x < 0 || this.x + this.width >= FIELD_WIDTH || this.y < 0 || this.y + this.height >= FIELD_HEIGHT){
            collision = true;
        }
        if(this.intersectWalls()){
            collision = true;
        }
        if(collision){
            this.x = oldX; this.y = oldY;
        }
        return !collision;
    }
    intersect(obj){
        return (this.x <= obj.x + obj.width) &&
            (this.x + this.width >= obj.x) &&
            (this.y <= obj.y + obj.height) &&
            (this.y + this.height >= obj.y);
    }
    intersectWalls(){
        return Object.values(ccdm.walls).some((wall) => {
            if(this.intersect(wall)){
                return true;
            }
        });
    }
    toJSON(){
        return {
            id: this.id,
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
            angle: this.angle,
            direction: this.direction
        };
    }
};

class Player extends GameObject{
    constructor(obj={}){
        super(obj);
        this.socketId = obj.socketId;
        this.nickname = obj.nickname;
        this.width = 50;
        this.height = 50;
        this.health = this.maxHealth = 20;
        this.bullets = {};
        this.point = 0;
        this.movement = {};
        this.player_type = 'player';

        do{
            this.logger.debug('init player!'+ Math.random());
            this.x = Math.random() * (FIELD_WIDTH - this.width);
            this.y = Math.random() * (FIELD_HEIGHT - this.height);
            this.angle = 0;
            this.direction = 0;  // direction is right:0, left:1;
        }while(this.intersectWalls());
        this.logger.debug('init player!'+ Math.random());
    }
    shoot(){
        if(Object.keys(this.bullets).length >= 3){
            return;
        }
        const bullet = new Bullet({
            x: this.x + this.width/2,
            y: this.y + this.height/2,
            angle: this.angle,
            character: this,
        });
        bullet.move(this.width/2);
        this.bullets[bullet.id] = bullet;
        ccdm.bullets[bullet.id] = bullet;
    }
    damage(){
        this.health --;
        if(this.health === 0){
            this.remove();
        }
    }
    remove(){
        delete players[this.id];
        io.to(this.socketId).emit('dead');
    }
    toJSON(){
        return Object.assign(super.toJSON(), {
            health: this.health,
            maxHealth: this.maxHealth,
            socketId: this.socketId,
            point: this.point,
            nickname: this.nickname,
            player_type: this.player_type
        });
    }
};
class Bullet extends GameObject{
    constructor(obj){
        super(obj);
        this.width = 15;
        this.height = 15;
        this.character = obj.character;
    }
    remove(){
        delete this.character.bullets[this.id];
        delete ccdm.bullets[this.id];
    }
};
class BotPlayer extends Player{
    constructor(obj){
        super(obj);
        this.player_type = 'bot';
        this.timer = setInterval(() => {
            if(! this.move(4)){
                this.angle = Math.random() * Math.PI * 2;
            }
            if(Math.random()<0.03){
                this.shoot();
            }
        }, 1000/30);
    }
    remove(){
        super.remove();
        clearInterval(this.timer);
        setTimeout(() => {
            const bot = new BotPlayer({nickname: this.nickname});
            players[bot.id] = bot;
        }, server_conf.port);
    }
};
class Wall extends GameObject{
};
class Piece extends OriginObject{
    constructor(obj={}){
        super(obj);
        this.point = obj.point;
    }
    toJSON(){
        return Object.assign(super.toJSON(), {
            point: this.point,
        });
    }
}

// init block. -----------------------------
const ccdm = new CCDM();
const sggm = new SugoGameMaster();

for(let i=0; i<1; i++){
    let bot = new BotPlayer({nickname: 'soldir'+(i+1)});
    // ccdm.players[bot.id] = bot;
    ccdm.bots[bot.id] = bot;
}

io.on('connection', function(socket) {
    let player = null;
    socket.on('game-start', (config) => {
        player = new Player({
            socketId: socket.id,
            nickname: config.nickname,
        });
        ccdm.players[player.id] = player;
    });
    socket.on('movement', function(movement) {
        if(!player || player.health===0){return;}
        player.movement = movement;
    });
    socket.on('shoot', function(){
        if(!player || player.health===0){return;}
        player.shoot();
    });
    socket.on('disconnect', () => {
        if(!player){return;}
        delete ccdm.players[player.id];
        player = null;
    });
});

const move_score = server_conf.move_score;
const angle_score = server_conf.angle_score;
setInterval(() => {
    let characters = Object.assign(ccdm.players, ccdm.bots);
    Object.values(ccdm.players).forEach((player) => {
        const movement = player.movement;
        if(movement.forward){
            player.move(move_score);
        }
        if(movement.back){
            player.move(-move_score);
        }
        if(movement.left){
            player.angle -= angle_score;
        }
        if(movement.right){
            player.angle += angle_score;
        }
        if(movement.up){
            player.move(move_score);
        }
        if(movement.down){
            player.move(move_score);
        }
    });
    Object.values(ccdm.bullets).forEach((bullet) =>{
        if(! bullet.move(10)){
            bullet.remove();
            return;
        }
        Object.values(characters).forEach((character) => {
           if(bullet.intersect(character)){
               if(character !== bullet.character){
                   character.damage();
                   bullet.remove();
                   bullet.character.point += 1;
               }
           }
        });
        Object.values(ccdm.walls).forEach((wall) => {
           if(bullet.intersect(wall)){
               bullet.remove();
           }
        });
    });
    io.sockets.emit('state', ccdm);
}, 1000/FPS);

if(server_conf.debug_process) {
  let logh = "[Debug Process] ";
  setInterval(() => {

    database.get_rand();

    Object.values(ccdm.players).forEach((player) => {
        logger.debug(logh + `ID:${player.id}\tType:${player.player_type}`);
    });
  }, 1000*5);
}

// Server config. -----------
app.use('/static', express.static(__dirname + '/static'));

app.get('/', (request, response) => {
  response.sendFile(path.join(__dirname, '/static/index.html'));
});

server.listen(server_conf.port, function() {
  logger.info(`Starting server on port ${server_conf.port}`);
});