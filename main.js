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

const STANDERD = require('./game_modules/standerd_modules.js');
const DB = require('./game_modules/database_modules.js');

// ### system param, common methods ###
const server_conf = yaml.parse(fs.readFileSync(__dirname + '/conf/server_conf.yml', 'utf-8'));

const SERVER_NAME = 'main';
const FIELD_WIDTH = server_conf.FIELD_WIDTH;
const FIELD_HEIGHT = server_conf.FIELD_HEIGHT;
const FPS = server_conf.FPS;


const logger = STANDERD.logger({
    server_name: SERVER_NAME,
    log_level: server_conf.loglevel,
    name: this.constructor.name,
});

const database_param = {
    url_base: 'http://localhost:3001/',
}
const database = DB.database(database_param);

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
        this.steps = {};
        this.start_step = null;
        this.goal_step = null;
        this.players = {};
        this.bots = {};
        this.bullets = {};
        this.walls = {};
        this.coin = null;
    }
    toJSON(){
        return Object.assign(super.toJSON(), {
            pieces: this.pieces,
            steps: this.steps,
            start_step: this.start_step,
            goal_step: this.goal_step,
            players: this.players,
            bots: this.bots,
            bullets: this.bullets,
            walls: this.walls,
            coin: this.coin,
        });
    }
}

// ### ---

class SugoGameMaster{
    constructor(){
        this.start();
    }
    start(){
        let cnt = 40;
        let x = 150;
        let y = 150;
        let retu = 8;
        let obj = {
            x: x + 100*0.5 - 50 * 0.5,
            y: y + 100*0.5 - 50 * 0.5,
            width:50,
            height:50,
        }
        let piece = new BotPiece(obj);

        let obj_coin = Object.assign({}, obj);
        obj_coin.x = 50;
        obj_coin.y = 50;
        ccdm.coin = new Coin(obj_coin);

        obj.width = 100;
        obj.height = 100;
        let first_step = null;
        let back = null;
        for(let i=0;i<cnt;i++){
            obj.x = x * (i % retu) + x;
            obj.y = y * Math.floor(i / retu) + y;
            let step = new Step(obj);
            ccdm.steps[step.id] = step;
            if(i==2){ first_step = step }
            if(i==0){
                ccdm.start_step = step.id;
            }else{
                ccdm.steps[back].next = step.id;
                step.back = back;
            }
            if(i== cnt - 1){ ccdm.goal_step = step.id }
            back = step.id;
        }
        piece.set_step(first_step);
        ccdm.pieces[piece.id] = piece;
    }
}

class OriginObject{
    constructor(obj={}){
        this.id = Math.floor(Math.random()*1000000000);
        this.logger = STANDERD.logger({
            server_name: SERVER_NAME,
            log_level: server_conf.loglevel,
            name: this.constructor.name,
        });
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
class PhysicsObject extends OriginObject{
    constructor(obj={}){
        super(obj);
        this.x = obj.x;
        this.y = obj.y;
        this.width = obj.width;
        this.height = obj.height;
    }
    toJSON(){
        return Object.assign(super.toJSON(), {
            x: this.x,
            y: this.y,
            width: this.width,
            height: this.height,
        });
    }
}
class GeneralObject extends OriginObject{
    constructor(obj={}){
        super(obj);
        this.name = obj.name;
    }
    toJSON(){
        return Object.assign(super.toJSON(), {
            name: this.name,
        });
    }
}
class GameObject extends PhysicsObject{
    constructor(obj={}){
        super(obj);
        this.angle = obj.angle;
        this.direction = obj.direction;
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
        return Object.assign(super.toJSON(), {
            angle: this.angle,
            direction: this.direction
        });
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
class Step extends PhysicsObject{
    constructor(obj={}){
        super(obj);
        this.next = obj.next;
        this.back = obj.back;
        this.events = [];
    }
    toJSON(){
        return Object.assign(super.toJSON(), {
            next: this.next,
            back: this.back,
        });
    }
}
class Piece extends PhysicsObject{
    constructor(obj={}){
        super(obj);
        this.step = obj.step;

        // let item_obj = Object.assign(obj,{});
        // item_obj.y = item_obj.y - 50;
        this.item = {
            coin: new Coin(),
        }
        this.get_item_param();
    }
    get_item_param(){
        this.item.coin.set_prop({
            x: this.x,
            y: this.y - 50,
            width: this.width,
            height: this.height,
            item: this.item.coin,
        });
    }
    set_step(step){
        this.step = step.id;
        this.x = step.x + step.width/2 - this.width/2;
        this.y = step.y + step.height/2 - this.height/2;
        this.get_item_param();
    }
    next_step(){
        let next = ccdm.steps[this.step].next;
        if(!next){ next = ccdm.start_step }
        let next_step = ccdm.steps[next];
        this.set_step(next_step);
    }
    toJSON(){
        return Object.assign(super.toJSON(), {
            step: this.step,
            item: this.item,
        });
    }
}
class BotPiece extends Piece{
    constructor(obj={}){
        super(obj);
        this.action_state = obj.action_state ? obj.action_state : 'def';
        this.timer = this.stand_alone();
        this.face = obj.face ? obj.face : 'type1';
    }
    stand_alone(){
        return setInterval(() => {
            this.action();
        }, 1000 * 0.3);
    }
    action(){
        let rand = STANDERD.random(3);
        if(rand == 1){
            this.next_step();
        }
    }
    next_step(){
        if(this.step == ccdm.goal_step){
            this.remove();
        }else{
            super.next_step();
        }
    }
    remove(){
        logger.log(`Delete: ${this.step}`);
        clearInterval(this.timer);
        delete ccdm.pieces[this.id];
    }
    toJSON(){
        return Object.assign(super.toJSON(), {
            action_state: this.action_state,
            face: this.face,
        });
    }
}
class Coin extends PhysicsObject{
    constructor(obj={}){
        super(obj);
        this.choices = [
            'c1',
            'c2',
            'c3',
            'c4',
        ];
        this.roll();
        this.rolling_cool_time = server_conf.cool_time;

        this.cool_timer = setInterval(()=>{
            if(this.rolling_cool_time > 0){
                this.rolling_cool_time = this.rolling_cool_time - FPS;
            }
        }, 1000/FPS);
        // this.timer = this.rolling();
        // this.logger.debug(`coin state: ${this.state}`);
    }
    rolling(){
        if(this.rolling_cool_time > 0){
            this.logger.debug('cool time it now.');
            return 0;
        }
        clearInterval(this.loop_rolling);
        clearTimeout(this.timer_rolling);
        this.timer_rolling = setTimeout(()=>{
            this.logger.debug('coin clear timer.');
            clearInterval(this.loop_rolling);
        }, 1000);
        this.logger.debug('coin start timer.');
        this.loop_rolling = setInterval(()=> {
            this.roll();
        }, 1000/FPS);
        this.rolling_cool_time = server_conf.cool_time;
    }
    roll(){
        let c = Math.floor(Math.random() * 4);
        this.state = this.choices[c];
    }
    set_prop(obj){
        if(!obj){ return }
        this.x = obj.x;
        this.y = obj.y;
        this.width = obj.width;
        this.height = obj.height;
    }
    toJSON(){
        return Object.assign(super.toJSON(), {
            choices: this.choices,
            state: this.state,
        });
    }
}
class Event extends GeneralObject{
    constructor(obj={}){
        super(obj);
        this.description = obj.description;
        this.event_action = obj.event_action;
        this.phenomenon = obj.phenomenon;
        this.probability = obj.probability ? obj.probability : 0.5;
    }
    toJSON(){
        return Object.assign(super.toJSON(), {
            description: this.description,
            event_action: this.event_action,
            phenomenon: this.phenomenon,
            probability: this.probability,
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

setInterval(() => {
    logger.debug('back-frame refresh.');
    io.sockets.emit('back-frame', ccdm);
}, 1000/1*5);

const faces = [
    'type1',
    'type2',
    'type3',
    'type4',
]
setInterval(() => {
    // piece born.
    logger.debug('born.');
    let x = 150;
    let y = 150;
    let obj = {
        x: x + 100*0.5 - 50 * 0.5,
        y: y + 100*0.5 - 50 * 0.5,
        width:50,
        height:50,
        face: faces[STANDERD.random(4)],
    }
    let piece = new BotPiece(obj);
    let step = ccdm.steps[ccdm.start_step];
    piece.set_step(step);
    ccdm.pieces[piece.id] = piece;

    // coin rolling
    ccdm.coin.rolling();
}, 1000/1*3);

if(server_conf.debug_process) {
  let logh = "[Debug Process] ";
  setInterval(() => {

    database.get_rand();

    Object.values(ccdm.players).forEach((player) => {
        logger.debug(logh + `ID:${player.id}\tType:${player.player_type}`);
    });

    ccdm.coin.rolling();
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