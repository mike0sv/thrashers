const IMG_SCALE = 0.46;
const IMG_SHIFT_X = 0;
const IMG_SHIFT_Y = 0;

const REFRESH_PERIOD = 20;
const PHASE_TIME = 1000;
const POINTS_SIZE = 4;
const limit_x = 800;
const limit_y = 600;
const FADE_PHASE_SHARE = 0.2;
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

var background1 = null;

const ACTORS_URI = 'http://35.231.19.141:5000/actors';

var points = {};

// function addPoint() {
//     points.push({
//         current: {
//             x: Math.random() * limit_x,
//             y: Math.random() * limit_y
//         },
//         prev: null
//     })
// }


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
    points.forEach(point => {
        point.state = 'standing'
    });

    for (let mac in apiPoints) {
        if (!apiPoints.hasOwnProperty(mac)) continue;
        // if (!mac.endsWith('0')) continue;

        // console.log('mac', mac);

        const newPoint = apiPoints[mac];

        if (newPoint.coord[Z] !== 20) continue;

        if (points.hasOwnProperty(mac)) {
            const oldPoint = points[mac];
            oldPoint['prev'] = oldPoint['coord'];
            oldPoint['coord'] = newPoint['coord'];
            oldPoint['role'] = newPoint['role'];
            newPoint.state = 'moving';
            // todo update color
        } else {
            newPoint.state = 'new';
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
}

function addTextInfo() {
    ctx.fillStyle = textColor;
    ctx.font = "Lato,sans-serif";
    ctx.fillText("Healthy people: " + individualsCount, 850, 50);
    ctx.fillText("People infected: " + infectedCount, 850, 70);
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
            fade_phase = phase > FADE_PHASE_SHARE ? 1 : phase * (1 - FADE_PHASE_SHARE);
        } else {
            fade_phase = 1;
        }
        size = fade_phase * POINTS_SIZE + Math.sin(fade_phase * Math.PI) * 8 * POINTS_SIZE;
    }

    // ctx.fillStyle = 'rgb(255, 165, 0, 30)';
    ctx.fillStyle = colors[point['role']];
    ctx.fillRect((x - size / 2) * COORD_SCALE, (y - size / 2) * COORD_SCALE, size, size);
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

