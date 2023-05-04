'use strict';

const express = require('express');
const http = require('http');
const path = require('path');
const socketIO = require('socket.io');
const app = express();
const server = http.Server(app);
const io = socketIO(server);

const FIELD_WIDTH = 1000, FIELD_HEIGHT = 1000;

class GameObject{
    constructor(obj={}){
        this.id = Math.floor(Math.random()*1000000000);
        this.x = obj.x;
        this.y = obj.y;
        this.width = obj.width;
        this.height = obj.height;
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
        return Object.values(walls).some((wall) => {
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
            console.log('init player!'+ Math.random());
            this.x = Math.random() * (FIELD_WIDTH - this.width);
            this.y = Math.random() * (FIELD_HEIGHT - this.height);
            this.angle = 0;
            this.direction = 0;  // direction is right:0, left:1;
        }while(this.intersectWalls());
        console.log('init player!'+ Math.random());
    }
    shoot(){
        if(Object.keys(this.bullets).length >= 3){
            return;
        }
        const bullet = new Bullet({
            x: this.x + this.width/2,
            y: this.y + this.height/2,
            angle: this.angle,
            player: this,
        });
        bullet.move(this.width/2);
        this.bullets[bullet.id] = bullet;
        bullets[bullet.id] = bullet;
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
        this.player = obj.player;
    }
    remove(){
        delete this.player.bullets[this.id];
        delete bullets[this.id];
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
        }, 3000);
    }
};
class Wall extends GameObject{
};

// init block. -----------------------------
let players = {};
let bullets = {};
let walls = {};

for(let i=0; i<3; i++){
    const wall = new Wall({
            x: Math.random() * FIELD_WIDTH,
            y: Math.random() * FIELD_HEIGHT,
            width: 200,
            height: 50,
    });
    walls[wall.id] = wall;
}

let bots = {};
for(let i=0; i<1; i++){
    const bot = new BotPlayer({nickname: 'ソルジャー'+(i+1)});
    players[bot.id] = bot;
    bots[bot.id] = bot;
}

io.on('connection', function(socket) {
    let player = null;
    socket.on('game-start', (config) => {
        player = new Player({
            socketId: socket.id,
            nickname: config.nickname,
        });
        players[player.id] = player;
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
        delete players[player.id];
        player = null;
    });
});

const move_score = 10;
const angle_score = 0.2;
setInterval(() => {
    Object.values(players).forEach((player) => {
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
    Object.values(bullets).forEach((bullet) =>{
        if(! bullet.move(10)){
            bullet.remove();
            return;
        }
        Object.values(players).forEach((player) => {
           if(bullet.intersect(player)){
               if(player !== bullet.player){
                   player.damage();
                   bullet.remove();
                   bullet.player.point += 1;
               }
           } 
        });
        Object.values(walls).forEach((wall) => {
           if(bullet.intersect(wall)){
               bullet.remove();
           }
        });
    });
    io.sockets.emit('state', players, bullets, walls);
}, 1000/30);

setInterval(() => {
    // debug.
    Object.values(players).forEach((player) => {
        // console.log("ID:" + player.id + "\tType:" + player.player_type);
    });
}, 1000*5);


// Server config. -----------
app.use('/static', express.static(__dirname + '/static'));

app.get('/', (request, response) => {
  response.sendFile(path.join(__dirname, '/static/index.html'));
});

server.listen(3000, function() {
  console.log('Starting server on port 3000');
});