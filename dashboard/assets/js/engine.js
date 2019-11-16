const IMG_SCALE = 0.46;
const IMG_SHIFT_X = 0;
const IMG_SHIFT_Y = 0;

const REFRESH_PERIOD = 10;
const PHASE_TIME = 1000;
const POINTS_SIZE = 4;
const FADE_PHASE_SHARE = 0.1;
const FADE_SHIFT_MAX = 0.3;
const X = 0;
const Y = 1;
const Z = 2;
const COORD_SCALE = 1.63;

const textColor = '#F18021';
const colors = {
    infected: '#F18021',
    passive: '#770578',
    curer: '#35E2DF'
};

var canvas = null;
var ctx = null;
var phase = 0;
var loading = false;
var individualsCount = 0;
var infectedCount = 0;
var floor = 20;

const LAYER_CONF = {
    x: 850,
    y: 300,
    shift: 50,
    widthEdge: 20,
    widthCenter: 30,
    height: 12
};

var background1 = null;

const API_URI = 'http://35.231.19.141:5000';
const ACTORS_URI = API_URI + '/actors';
const INFECT_URI = API_URI + '/infect';
const HEAL_URI = API_URI + '/heal_all';

var points = {};


function start() {
    setupCanvas();
    loadBackground();
}

window.onload = start;

function reload() {
    draw();
    if (phase <= 1) {
        phase += REFRESH_PERIOD / PHASE_TIME;
    } else if (!loading) {
        loading = true;
        loadNewPoints();
    }
}

function loadNewPoints() {
    $.getJSON({
        url: ACTORS_URI,
        success: nextPhase
        // todo handle errors here
    });
}

function nextPhase(apiPoints) {
    var infectedCountNew = 0;
    for (let mac in points) {
        if (!points.hasOwnProperty(mac)) continue;
        points[mac].state = 'standing'
        delete points[mac].prev;
    }

    for (let mac in apiPoints) {
        if (!apiPoints.hasOwnProperty(mac)) continue;
        // if (!mac.endsWith('0')) continue;

        // console.log('mac', mac);

        const newPoint = apiPoints[mac];

        if (newPoint.coord[Z] !== floor) continue;

        if (points.hasOwnProperty(mac)) {
            const oldPoint = points[mac];
            oldPoint['prev'] = oldPoint['coord'];
            oldPoint['coord'] = newPoint['coord'];
            oldPoint['role'] = newPoint['role'];
            newPoint.state = 'moving';
            // todo update color
        } else {
            newPoint.state = 'new';
            newPoint.fadeInDelay = Math.random() * Math.min(1 - FADE_PHASE_SHARE, FADE_SHIFT_MAX);
            points[mac] = newPoint;
        }

        if (newPoint.role === 'infected') {
            infectedCountNew++;
        }
    }
    infectedCount = infectedCountNew;
    loading = false;
    phase = 0;
}

function gotToFloor() {

}

function draw() {
    // console.log('draw');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(background1, IMG_SHIFT_X, IMG_SHIFT_Y, background1.width * IMG_SCALE, background1.height * IMG_SCALE);

    // console.log('drawing points', Object.keys(points).length , phase);
    for (let mac in points) {
        if (!points.hasOwnProperty(mac)) continue;
        drawPoint(points[mac]);
    }
    individualsCount = Object.keys(points).length;
    addTextInfo();
    drawLayers();
}

function addTextInfo() {
    ctx.fillStyle = textColor;
    ctx.font = "Lato,sans-serif";
    ctx.fillText("Healthy people: " + individualsCount, 850, 50);
    ctx.fillText("People infected: " + infectedCount, 850, 70);
}

function infect() {
    $.get(INFECT_URI + '?floor=' + floor);
}

function heal() {
    for (let mac in points) {
        if (!points.hasOwnProperty(mac)) continue;
        points[mac].state = 'passive';
    }
    $.get(HEAL_URI);
}


function drawPoint(point) {

    var x, y, size;
    if (point.hasOwnProperty('prev')) {
        const shift = Math.sin(phase * Math.PI / 2);
        x = point.prev[X] + shift * (point.coord[X] - point.prev[X]);
        y = point.prev[Y] + shift * (point.coord[Y] - point.prev[Y]);
        size = POINTS_SIZE;
    } else {
        x = point.coord[X];
        y = point.coord[Y];
        var fade_phase = null;
        if (point.state === 'new') {
            const delay = point.fadeInDelay;
            if (phase < delay) {
                fade_phase = 0;
            } else if (phase > FADE_PHASE_SHARE + delay) {
                fade_phase = 1;
            } else {
                fade_phase = phase * (1 - FADE_PHASE_SHARE - delay);
            }
        } else {
            fade_phase = 1;
        }
        size = fade_phase * POINTS_SIZE + Math.sin(fade_phase * Math.PI) * 2.5 * POINTS_SIZE;
    }

    ctx.fillStyle = colors[point['role']];
    ctx.fillRect(x * COORD_SCALE - size / 2, y * COORD_SCALE - size / 2, size, size);
}

/*
nfectedCount = 0;

const LAYER_CONF = {
    x: 850,
    y: 300,
    shift: 50,
    widthEdge: 30,
    widthCenter: 60,
    height: 30
};
 */

function drawLayers() {
    // const fullLength = LAYER_CONF.widthCenter + LAYER_CONF.widthEdge * 2;
    var x = LAYER_CONF.x;
    var y = LAYER_CONF.y;
    drawLayer(x, y);
}

function drawLayer(x,y) {
    // console.log('kek');
    ctx.moveTo(x + LAYER_CONF.widthEdge, y);
    ctx.beginPath();
    ctx.lineTo(x + LAYER_CONF.widthEdge, y);
    ctx.lineTo(x + LAYER_CONF.widthEdge * 2 + LAYER_CONF.widthCenter, y);
    ctx.lineTo(x + LAYER_CONF.widthEdge + LAYER_CONF.widthCenter, y + LAYER_CONF.height);
    ctx.lineTo(x, y + LAYER_CONF.height);
    ctx.closePath();
    ctx.fillStyle = textColor;
    ctx.fill();
}

function loadBackground() {
    ctx.webkitImageSmoothingEnabled = false;
    ctx.mozImageSmoothingEnabled = false;
    ctx.imageSmoothingEnabled = false;

    background1 = new Image();
    background1.onload = function () {
        console.log('Background loaded');
        setInterval(reload, REFRESH_PERIOD);
    };
    background1.src = 'images/floor1.jpg';
}

function setupCanvas() {
    canvas = document.getElementById('floor1');
    ctx = canvas.getContext('2d');
    var dpr = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    return ctx;
}

