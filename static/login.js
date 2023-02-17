'use strict';

const socket = io();
const canvas_main = $('#canvas-main')[0];
const context_main = canvas_main.getContext('2d');

const images = {};

function login(){
    console.log('login...');
    socket.emit('login', {name: $("#name").val() });
    // $("#start-screen").hide();
}
